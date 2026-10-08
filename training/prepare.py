"""Stream accepted train/validation pairs into separate task-specific gzip datasets."""
from collections import Counter
from contextlib import ExitStack
from difflib import SequenceMatcher
from itertools import zip_longest
import json
from pathlib import Path
import re
import sys

from training.common import ROOT, SPLITS, gzip_writer, indices, jsonl, receipt, run_gate, safe_output, sha256, write_json
from training.candidates import CandidateIndex, build_index
from training.text import lower, tag_sentence, tokens, word_matches

sys.path.insert(0, str(ROOT / 'scripts/data'))
from noise import protected_ranges  # Existing protected-span convention, no evaluation import.


def selected_rows(corpus, split, selection, manifest):
    count = 0
    for at, (clean, pair) in enumerate(zip_longest(jsonl(corpus / f'{split}.jsonl'),
                                                 jsonl(corpus / f'{split}-pairs.jsonl'))):
        count += 1
        if clean is None or pair is None:
            raise ValueError('Unaligned split: ' + split)
        if selection is not None and at not in selection:
            continue
        if (pair.get('id') != clean.get('id') or pair.get('target') != clean.get('text')
                or pair.get('sourceId') != clean.get('sourceId')
                or manifest['assignments'].get(clean.get('sourceId')) != split
                or pair.get('errorOrigin') != 'synthetic'):
            raise ValueError('Selected pair/source alignment mismatch: ' + split)
        yield clean, pair
    if count != manifest['splitCounts'][split]:
        raise ValueError('Unexpected split size: ' + split)


def eligible_words(clean):
    ranges = protected_ranges(clean['text'], clean.get('protectedTerms', []))
    return [lower(m.group()) for m in word_matches(clean['text'])
            if 2 <= len(m.group()) <= 32 and re.fullmatch('[a-zəçğıöşü]+', lower(m.group()))
            and not any(m.start() < end and m.end() > start for start, end in ranges)]


def spelling_examples(clean, pair, index, config, stats):
    noisy, target = word_matches(pair['input']), word_matches(pair['target'])
    a, b = [lower(m.group()) for m in noisy], [lower(m.group()) for m in target]
    ranges = protected_ranges(pair['input'], clean.get('protectedTerms', []))
    alignment = SequenceMatcher(a=a, b=b, autojunk=False)
    chosen, unchanged = [], []
    for kind, left, right, start, end in alignment.get_opcodes():
        if kind == 'equal':
            unchanged.extend((left + n, start + n) for n in range(right - left))
        elif kind == 'replace' and right - left == end - start == 1:
            chosen.append((left, start))
        else:
            stats['unsupportedAlignmentSpans'] += 1
    # Changed positions first; all identity sentences are retained in sampling.
    # Stable hash rotation avoids always training only sentence-initial identity words.
    import hashlib
    unchanged.sort(key=lambda p: hashlib.sha256(f"{config['seed']}:{clean['id']}:{p[0]}".encode()).digest())
    positions = chosen + unchanged
    emitted = 0
    for at, target_at in positions:
        match, word, correct = noisy[at], a[at], b[target_at]
        if any(match.start() < end and match.end() > start for start, end in ranges):
            stats['protectedTokensSkipped'] += 1
            continue
        if not (1 <= len(word) <= config['maxWordChars'] and 1 <= len(correct) <= config['maxWordChars']):
            stats['longTokensSkipped'] += 1
            continue
        alternatives = [word, *index.lookup(word, config['maxCandidates'] - 1)]
        stats['queriedTokens'] += 1
        if word != correct:
            stats['changedTokens'] += 1
            for k in (5, 10, 20):
                stats[f'changedHitsAt{k}'] += correct in alternatives[:k]
        if correct not in alternatives:
            stats['candidateMisses'] += 1
            continue  # Never inject ground-truth candidates to inflate retrieval recall.
        context = config['contextWords']
        left_words, right_words = a[max(0, at - context):at], a[at + 1:at + 1 + context]
        yield {'id': clean['id'], 'sourceId': clean['sourceId'], 'input': word,
               'left': ' '.join(left_words), 'right': ' '.join(right_words),
               'candidates': alternatives, 'label': alternatives.index(correct),
               'identity': word == correct, 'pairCategory': pair['category']}
        emitted += 1
        stats['identityExamples' if word == correct else 'changedExamples'] += 1
        if emitted >= config['maxExamplesPerSentence']:
            break


def prepare(corpus, output, config):
    corpus, output = Path(corpus).resolve(), safe_output(output, corpus)
    accepted, manifest = receipt()
    if output.exists():
        raise ValueError('Output already exists; choose a new run directory, preserve previous runs')
    if config['profile'] == 'smoke' and not 100000 <= config['trainSentences'] <= 500000:
        raise ValueError('Smoke preparation requires 100,000–500,000 train sentences')
    dictionary_path = ROOT / 'lib/editor/generated/az-words.json'
    if not dictionary_path.is_file():
        raise ValueError('Prepare the existing dictionary first: npm run dictionary:import -- public/dictionaries/az')
    # Missing bulk files fail before creating any output. Preparation is not training.
    from training.common import verify_files
    verify_files(corpus)
    selections = {split: indices(manifest['splitCounts'][split], config[split + 'Sentences'],
                                 config['seed'] + offset) for offset, split in enumerate(SPLITS)}
    output.mkdir(parents=True)
    run_gate(corpus, output)
    write_json(output / 'config.json', config)
    dictionary = sorted({lower(w) for w in json.loads(dictionary_path.read_text())
                         if re.fullmatch('[a-zəçğıöşü]{2,32}', lower(w))})
    train_rows = selected_rows(corpus, 'train', selections['train'], manifest)
    build_index(output / 'lexicon.sqlite', (eligible_words(clean) for clean, _ in train_rows), dictionary, config)
    index = CandidateIndex(output / 'lexicon.sqlite', config['prefixLength'])
    metadata = {'schemaVersion': 1, 'status': 'preparing', 'profile': config['profile'],
                'seed': config['seed'], 'manifestSHA256': accepted['manifestSHA256'],
                'corpus': str(corpus), 'hyperparameters': config, 'trainingStarted': False,
                'dictionarySHA256': sha256(dictionary_path), 'splits': {}, 'files': {},
                'candidateGate': 'unmeasured-for-browser; offline recall recorded during preparation',
                'limitations': ['Mechanically filtered corpus, not human-reviewed; residual OCR/spelling/segmentation errors possible.',
                                'Synthetic errors and source-split validation do not establish real-user quality.',
                                'Email and everyday genres underrepresented; separate real calibration data is required.',
                                'Only one-to-one word alignments train CharSpell; spacing/multiword errors remain outside this scorer.',
                                'Candidate cap/prefix lookup and vocabulary cap may miss targets; retrieval coverage must be reported.',
                                'No corpus-derived thresholds or automatic browser promotion.']}
    try:
        for split in SPLITS:
            stats, sources, categories = Counter(), Counter(), Counter()
            with ExitStack() as stack:
                streams = {stage: stack.enter_context(gzip_writer(output / f'{stage}-{split}.jsonl.gz'))
                           for stage in ('charspell', 'wordlm', 'punctcase')}
                def emit(stage, row):
                    streams[stage].write(json.dumps(row, ensure_ascii=False) + '\n')
                    stats[stage + 'Rows'] += 1
                for clean, pair in selected_rows(corpus, split, selections[split], manifest):
                    stats['sentences'] += 1
                    stats['identityPairs'] += pair['input'] == pair['target']
                    categories[pair['category']] += 1
                    sources[clean['sourceId']] += 1
                    # WordLM and PunctCase consume clean text exclusively.
                    emit('wordlm', {'id': clean['id'], 'sourceId': clean['sourceId'], 'words': tokens(clean['text'])})
                    ranges = protected_ranges(clean['text'], clean.get('protectedTerms', []))
                    tagged = tag_sentence(clean['text'], ranges)
                    chunk = config['maxSentenceTokens']
                    for offset in range(0, len(tagged['words']), chunk):
                        row = {key: value[offset:offset + chunk] for key, value in tagged.items()}
                        # Chunk edges do not assert punctuation from unavailable next-chunk context.
                        if offset + chunk < len(tagged['words']):
                            row['punctuation'][-1] = -100
                        if all(label == -100 for label in row['case']):
                            stats['punctcaseProtectedChunksSkipped'] += 1
                            continue
                        emit('punctcase', {'id': clean['id'], 'sourceId': clean['sourceId'], **row})
                    for example in spelling_examples(clean, pair, index, config, stats):
                        emit('charspell', example)
            metadata['splits'][split] = {**stats, 'sources': dict(sources), 'pairCategories': dict(categories)}
        for file in sorted(output.iterdir()):
            if file.is_file():
                metadata['files'][file.name] = {'bytes': file.stat().st_size, 'sha256': sha256(file)}
        metadata['status'] = 'prepared'
        write_json(output / 'prepared.json', metadata)
        return metadata
    finally:
        index.close()
