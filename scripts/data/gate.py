"""Fail closed; phase0 is read only for the final leakage audit, never selection."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
from noise import protected_ranges, KINDS
from common import MINIMUM_SENTENCES, read_jsonl, sha256, write_json

spec = importlib.util.spec_from_file_location('overlap', Path(__file__).with_name('check-overlap.py'))
overlap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overlap)


def gate(directory):
    directory = Path(directory)
    manifest = json.loads((directory / 'MANIFEST.json').read_text())
    errors, counts, audits = [], Counter(), {}
    if manifest.get('minimumCleanSentences') != MINIMUM_SENTENCES:
        errors.append('Required minimum is 5,000,000; cannot change it in a manifest')
    sources = manifest.get('sources', [])
    assignments = manifest.get('assignments', {})
    if len(sources) < 3 or set(assignments.values()) != {'train', 'validation', 'test'}:
        errors.append('Three independent approved source groups and nonempty source splits required')
    for source in sources:
        for field in ('id', 'name', 'url', 'license', 'licenseEvidence', 'collectedAt', 'sha256'):
            if not isinstance(source.get(field), str) or not source[field]:
                errors.append(f'Missing source provenance: {field}')
        approval = source.get('approval', {})
        if approval.get('status') != 'approved' or approval.get('by') != 'repository-owner' or not approval.get('evidence'):
            errors.append(f"Source approval absent: {source.get('id')}")
    references = overlap.phase0_references()
    with tempfile.TemporaryDirectory(prefix='sloth-gate-') as temporary:
        db = sqlite3.connect(str(Path(temporary) / 'split.sqlite'))
        try:
            db.execute('CREATE TABLE seen (hash TEXT PRIMARY KEY, split TEXT)')
            db.execute('CREATE TABLE documents (id TEXT PRIMARY KEY, split TEXT)')
            cross_split = 0
            for split in ('train', 'validation', 'test'):
                paths = [directory / f'{split}.jsonl', directory / f'{split}-pairs.jsonl']
                if any(not path.exists() for path in paths):
                    errors.append(f'Missing clean/pair files: {split}')
                    continue
                for path in paths:
                    receipt = manifest.get('files', {}).get(path.name, {})
                    if receipt.get('sha256') != sha256(path) or receipt.get('bytes') != path.stat().st_size:
                        errors.append(f'File integrity mismatch: {path.name}')
                def rows():
                    nonlocal cross_split
                    pair_iterator = iter(read_jsonl(paths[1]))
                    for row in read_jsonl(paths[0]):
                        counts[split] += 1
                        pair = next(pair_iterator, None)
                        if pair is None or pair.get('id') != row.get('id') or pair.get('target') != row.get('text') or not isinstance(pair.get('input'), str):
                            raise ValueError('Clean/pair alignment mismatch')
                        if pair.get('category') not in KINDS or pair.get('requestedCategory') not in KINDS or pair.get('errorOrigin') != 'synthetic':
                            raise ValueError('Missing synthetic error provenance')
                        for start, end in protected_ranges(row['text'], row.get('protectedTerms', [])):
                            span = row['text'][start:end]
                            if pair['input'].count(span) < row['text'].count(span):
                                raise ValueError('Synthetic pair changed a protected span')
                        if assignments.get(row.get('sourceId')) != split:
                            raise ValueError('Source crosses split boundary')
                        old = db.execute('SELECT split FROM documents WHERE id=?', (row['documentId'],)).fetchone()
                        if old and old[0] != split:
                            raise ValueError('Document crosses split boundary')
                        db.execute('INSERT OR IGNORE INTO documents VALUES (?,?)', (row['documentId'], split))
                        keys = (overlap.ngrams(row['text'], 8) | overlap.ngrams(pair['input'], 8)
                                | {'sentence:' + overlap.sentence_key(row['text']), 'sentence:' + overlap.sentence_key(pair['input'])})
                        for key in keys:
                            old = db.execute('SELECT split FROM seen WHERE hash=?', (key,)).fetchone()
                            if old and old[0] != split:
                                cross_split += 1
                            db.execute('INSERT OR IGNORE INTO seen VALUES (?,?)', (key, split))
                        if counts[split] % 1000 == 0:
                            db.commit()
                        yield row
                        yield {'documentId':row['documentId'], 'text':pair['input']}
                    if next(pair_iterator, None) is not None:
                        raise ValueError('Extra pair rows')
                audits[split] = overlap.compare(rows(), references)
                if audits[split]['status'] != 'passed':
                    errors.append(f'Nonempty zero-overlap audit failed: {split}')
            if cross_split:
                errors.append(f'Cross-split normalized sentence/8-gram collisions: {cross_split}')
        finally:
            db.close()
    total = sum(counts.values())
    if total < MINIMUM_SENTENCES:
        errors.append(f'Insufficient clean sentences: {total}/{MINIMUM_SENTENCES}')
    if total != manifest.get('cleanSentences') or dict(counts) != manifest.get('splitCounts', {}):
        errors.append('Manifest counts mismatch')
    return {'status': 'failed' if errors else 'passed', 'minimumCleanSentences': MINIMUM_SENTENCES,
            'cleanSentences': total, 'auditScope': 'Both clean targets and generated noisy inputs; 8-word normalized ngrams and exact sentences', 'errors': errors, 'phase0Overlap': audits,
            'crossSplitCollisions': cross_split if total else None, 'crossSplitAudit': 'exercised' if total else 'not-exercised', 'trainingStarted': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    parser.add_argument('--out', default='docs/stage1/gate.json')
    args = parser.parse_args()
    try:
        report = gate(args.directory)
    except (ValueError, KeyError, OSError) as error:
        report = {'status': 'failed', 'errors': [str(error)], 'trainingStarted': False}
    write_json(args.out, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['status'] == 'passed' else 2)
