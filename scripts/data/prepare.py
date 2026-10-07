"""Streaming, source-group split corpus builder. It cannot approve source licenses."""
import argparse
from collections import Counter
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import os
import sqlite3
import tempfile
from common import MINIMUM_SENTENCES, normalized, read_jsonl, sha256, source_assignments, words, write_json
from noise import corrupt, pair_seed, KINDS


def _prepare(input_path, sources_path, output):
    metadata = json.loads(Path(sources_path).read_text())
    sources = metadata.get('sources', [])
    if not sources or len({s['id'] for s in sources}) != len(sources):
        raise ValueError('Unique source metadata is required')
    for source in sources:
        for field in ('id', 'name', 'url', 'license', 'licenseEvidence', 'collectedAt', 'sha256'):
            if not isinstance(source.get(field), str) or not source[field]:
                raise ValueError(f'Missing source field: {field}')
        approval = source.get('approval', {})
        if approval.get('status') != 'approved' or approval.get('by') != 'repository-owner' or not approval.get('evidence'):
            raise ValueError(f"Source {source['id']} lacks explicit owner training approval")
    expected = metadata.get('inputSHA256')
    if expected != sha256(input_path):
        raise ValueError('Corpus input SHA-256 mismatch')
    assignments = source_assignments(s['id'] for s in sources)
    by_id = {source['id']: source for source in sources}
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be empty; do not overwrite a previously frozen corpus')
    output.mkdir(parents=True, exist_ok=True)
    counts, rejected, requested, realized, source_counts = Counter(), Counter(), Counter(), Counter(), Counter()
    source_sentences = Counter()
    source_hashes = {source['id']: hashlib.sha256() for source in sources}
    with tempfile.TemporaryDirectory(prefix='sloth-corpus-') as temporary, ExitStack() as stack:
        db = sqlite3.connect(str(Path(temporary) / 'dedup.sqlite'))
        stack.callback(db.close)
        db.execute('CREATE TABLE sentences (hash TEXT PRIMARY KEY)')
        db.execute('CREATE TABLE documents (id TEXT PRIMARY KEY)')
        clean = {split: stack.enter_context((output / f'{split}.jsonl').open('w', encoding='utf-8')) for split in ('train', 'validation', 'test')}
        pairs = {split: stack.enter_context((output / f'{split}-pairs.jsonl').open('w', encoding='utf-8')) for split in clean}
        for document in read_jsonl(input_path):
            source_id, document_id = document.get('sourceId'), document.get('documentId')
            if source_id not in by_id or not isinstance(document_id, str) or not document_id:
                raise ValueError('Document requires registered sourceId and unique nonempty documentId')
            if document.get('language') != 'az':
                raise ValueError('Declared Azerbaijani language is required; this is not independent LID certification')
            try:
                db.execute('INSERT INTO documents VALUES (?)', (document_id,))
            except sqlite3.IntegrityError as error:
                raise ValueError('Repeated documentId; collect all its sentences in one document record') from error
            canonical = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
            source_hashes[source_id].update(canonical.encode())
            source_counts[source_id] += 1
            if 'sentences' in document:
                sentences = document['sentences']
                if not isinstance(sentences, list) or any(not isinstance(s, str) for s in sentences):
                    raise ValueError('sentences must be an array of strings')
            elif isinstance(document.get('text'), str):
                # Conservative fallback; trusted presegmented sentences are preferred.
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZƏÇĞİÖŞÜ])|\n\s*\n', document['text'])
            else:
                raise ValueError('Document requires text or sentences')
            split = assignments[source_id]
            for at, text in enumerate(sentences):
                text = normalized(text)
                if not 4 <= len(words(text)) <= 80 or len(text) > 1000:
                    rejected['length'] += 1
                    continue
                if not text.endswith(('.', '?', '!')):
                    rejected['missing_terminal_punctuation'] += 1
                    continue
                key = hashlib.sha256(text.encode()).hexdigest()
                try:
                    db.execute('INSERT INTO sentences VALUES (?)', (key,))
                except sqlite3.IntegrityError:
                    rejected['exact_duplicate'] += 1
                    continue
                protected = list(document.get('protectedTerms', []))
                first_word = re.search(r'[^\W\d_]+', text)
                # Without reliable NER, preserve an initial capital conservatively,
                # even when it is an ordinary sentence-initial word.
                if first_word and first_word.group()[0].isupper():
                    protected.append(first_word.group())
                row = {'id': f'{document_id}:{at}', 'documentId': document_id, 'sourceId': source_id,
                       'text': text, 'protectedTerms': list(dict.fromkeys(protected))}
                clean[split].write(json.dumps(row, ensure_ascii=False) + '\n')
                pair = corrupt(text, pair_seed(20261007, document_id, at), protected_terms=row['protectedTerms'])
                pairs[split].write(json.dumps({**row, **pair, 'errorOrigin': 'synthetic'}, ensure_ascii=False) + '\n')
                counts[split] += 1
                source_sentences[source_id] += 1
                requested[pair['requestedCategory']] += 1
                realized[pair['category']] += 1
            if sum(source_counts.values()) % 1000 == 0:
                db.commit()
        db.commit()
        for source in sources:
            if source_hashes[source['id']].hexdigest() != source['sha256']:
                raise ValueError(f"Canonical source record SHA-256 mismatch: {source['id']}")
    total = sum(counts.values())
    manifest = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(), 'inputSHA256': expected,
                'minimumCleanSentences': MINIMUM_SENTENCES, 'cleanSentences': total, 'sources': sources,
                'sourceDocumentCounts': dict(source_counts), 'sourceLineCounts': dict(source_counts), 'sourceAcceptedSentenceCounts': dict(source_sentences), 'assignments': assignments, 'splitCounts': dict(counts),
                'rejectedCounts': dict(rejected), 'noise': {'seed': 20261007, 'pairs': total, 'origin': 'synthetic; identity prior 20%, other requested kinds uniform, not fitted to evaluation',
                'requestedCounts': {kind: requested[kind] for kind in KINDS}, 'realizedCounts': {kind: realized[kind] for kind in KINDS},
                'realizedShares': {kind: realized[kind] / total if total else None for kind in KINDS}},
                'files': {path.name: {'sha256': sha256(path), 'bytes': path.stat().st_size} for path in sorted(output.glob('*.jsonl'))},
                'overlapStatus': 'not-checked', 'gate': 'blocked-until-overlap-and-minimum-check',
                'limitations': ['Fallback segmentation is heuristic and source-declared az is not a trained language-ID filter.', 'Casefolded near-duplicates and split ngram collisions must be checked separately.', 'No training or threshold selection occurs in this builder.']}
    write_json(output / 'MANIFEST.json', manifest)
    return manifest


def prepare(input_path, sources_path, output):
    # Late integrity failures leave no accepted/partially built output directory.
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be empty; existing corpus is immutable')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.corpus-staging-', dir=output.parent) as temporary:
        staged = Path(temporary) / 'prepared'
        manifest = _prepare(input_path, sources_path, staged)
        if output.exists():
            output.rmdir()  # Only a still-empty directory can be replaced.
        os.replace(staged, output)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('corpus')
    parser.add_argument('sources')
    parser.add_argument('output')
    args = parser.parse_args()
    print(json.dumps(prepare(args.corpus, args.sources, args.output), ensure_ascii=False))
