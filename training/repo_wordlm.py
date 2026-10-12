"""Explicit WordLM experiment on the frozen GitHub Wikipedia snapshot, not az-v1."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import subprocess
import time

from training.common import ROOT, jsonl, read_json, safe_output, sha256, write_json
from training.text import lower, tokens
from training.wordlm import WordLM, build

FROZEN_MANIFEST = ROOT / 'data/nlp/wikipedia-split-manifest.json'
SPLITS = ('train', 'validation', 'test')


def load_snapshot(source, frozen_manifest=None):
    """Audit all splits, then return only unique clean train/validation targets."""
    source = Path(source).resolve()
    frozen_manifest = frozen_manifest or FROZEN_MANIFEST
    manifest_path = source / 'manifest.json'
    if sha256(manifest_path) != sha256(frozen_manifest):
        raise ValueError('Source manifest differs from the frozen repository snapshot')
    manifest = read_json(manifest_path)
    if manifest.get('version') != 2:
        raise ValueError('Version 2 document/split manifest required')
    documents, clusters = {}, {}
    for doc in manifest['documents']:
        doc_id, cluster, split = doc['documentId'], doc['cluster'], doc['split']
        if not doc_id or not cluster or split not in SPLITS or doc_id in documents:
            raise ValueError('Invalid or duplicate manifest document')
        if cluster in clusters and clusters[cluster] != split:
            raise ValueError('Document cluster crosses splits')
        documents[doc_id], clusters[cluster] = split, split
    clean, summaries, files, owners, word_owners = {}, {}, {}, {}, {}
    for split in SPLITS:
        path = source / (split + '.jsonl')
        expected = manifest['partitions'][split]
        if sha256(path) != expected['sha256']:
            raise ValueError('Source partition checksum mismatch: ' + split)
        unique, source_documents, licenses = {}, set(), set()
        count = 0
        for row in jsonl(path):
            count += 1
            if row.get('split') != split or documents.get(row.get('documentId')) != split:
                raise ValueError('Row crosses document split: ' + split)
            if not isinstance(row.get('target'), str) or not row.get('source') or not row.get('license'):
                raise ValueError('Clean target and source attribution required')
            words = tokens(row['target'])
            if not words:
                raise ValueError('Clean target has no words')
            key = ' '.join(lower(row['target']).split())
            if key in owners and owners[key] != split:
                raise ValueError('Normalized clean target crosses splits')
            owners[key] = split
            unique.setdefault(key, words)
            word_owners.setdefault(tuple(words), set()).add(split)
            source_documents.add(row['documentId'])
            licenses.add(row['license'])
        if count != expected['rows'] or not unique:
            raise ValueError('Invalid or empty source partition: ' + split)
        summaries[split] = {'augmentedRows': count, 'uniqueCleanSentences': len(unique),
                            'documents': len(source_documents), 'licenses': sorted(licenses)}
        files[path.name] = {'sha256': sha256(path), 'bytes': path.stat().st_size}
        # Test text is audited for integrity/overlap, never passed to fitting or scoring.
        if split != 'test':
            clean[split] = list(unique.values())
    files['manifest.json'] = {'sha256': sha256(manifest_path), 'bytes': manifest_path.stat().st_size}
    word_overlap = {left + '/' + right: sum(left in splits and right in splits
                                          for splits in word_owners.values())
                    for left, right in (('train', 'validation'), ('train', 'test'), ('validation', 'test'))}
    return clean, summaries, files, word_overlap


def train(source, output, discount=0.75, min_frequency=2):
    source = Path(source).resolve()
    output = safe_output(output, source)
    if output.exists():
        raise ValueError('Output already exists; preserve it and choose a new directory')
    if not 0 < discount < 1 or min_frequency < 1:
        raise ValueError('Use discount in (0,1) and positive minimum frequency')
    clean, summaries, files, word_overlap = load_snapshot(source)
    counts = Counter(word for sentence in clean['train'] for word in sentence)
    vocabulary = {word for word, count in counts.items() if count >= min_frequency}
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    output.mkdir(parents=True)
    started = time.perf_counter()
    report = {'status': 'running', 'stage': 'wordlm', 'profile': 'repository-snapshot',
              'startedAtUTC': datetime.now(timezone.utc).isoformat(), 'sourceCodeCommit': commit,
              'sourceRepository': 'https://github.com/Sanan2030/SlothAI',
              'source': 'Frozen Wikipedia document splits; see data/nlp/SOURCES.md for attribution.',
              'sourceFiles': files, 'splits': summaries,
              'crossSplitWordSequenceOverlap': word_overlap,
              'trainingSourceSHA256': {name: sha256(ROOT / 'training' / name)
                                       for name in ('repo_wordlm.py', 'wordlm.py', 'text.py', 'common.py')},
              'hyperparameters': {'discount': discount, 'minLMFrequency': min_frequency},
              'architecture': 'Interpolated Kneser-Ney 3-gram with suffix-class OOV mapping',
              'python': platform.python_version(), 'device': 'cpu', 'trainingStarted': True,
              'trainOnlyVocabulary': True, 'testUsedForTrainingOrSelection': False,
              'testReadForIntegrityOnly': True, 'calibrationPerformed': False,
              'browserPromotion': 'none', 'correctionBenefit': 'not measured',
              'limitations': ['Small repository experiment, not the accepted five-million az-v1 corpus.',
                              'Synthetic variants are deduplicated; only clean train targets fit counts.',
                              'Validation perplexity concerns mapped classes, not correction quality.',
                              'Word tokenization removes numbers; template overlap is reported, not removed.',
                              'Unseen classes may yield explicit infinite perplexity.',
                              'Wikipedia attribution/licensing is retained in data/nlp/SOURCES.md.',
                              'No editor weights or thresholds are changed.']}
    write_json(output / 'report.json', report)
    print(json.dumps({'phase': 'training', 'output': str(output), 'splits': summaries}), flush=True)
    try:
        path = output / 'wordlm.sqlite'
        sentences, token_count = build(path, clean['train'], vocabulary, discount)
        model = WordLM(path)
        try:
            validation = model.perplexity(clean['validation'])
            if model.db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Trained SQLite artifact failed integrity check')
            ngrams = {table: model.db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                      for table in ('bigrams', 'trigrams')}
        finally:
            model.close()
        report.update(status='completed', trainSentences=sentences, trainTokens=token_count,
                      vocabulary=len(vocabulary), validation=validation, ngrams=ngrams,
                      artifact=path.name, artifactSHA256=sha256(path), artifactBytes=path.stat().st_size,
                      elapsedSeconds=time.perf_counter() - started,
                      finishedAtUTC=datetime.now(timezone.utc).isoformat())
        write_json(output / 'report.json', report)
        return report
    except BaseException as error:
        report.update(status='failed', error=str(error), elapsedSeconds=time.perf_counter() - started)
        write_json(output / 'report.json', report)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Reproduced nlp:data Wikipedia splits')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(train(args.source, args.out), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        parser.exit(2, str(error) + '\n')


if __name__ == '__main__':
    main()
