"""Pinned, owner-authorized acquisition. Never reads evaluation or trains a model."""
import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import urllib.request
from common import MINIMUM_SENTENCES, normalized, sha256, words, write_json

DATASET = 'LocalDoc/AzTC-full'
REVISION = '4ea07271d4a2c9746759547264a5e4310bc2956e'
CARD = f'https://huggingface.co/datasets/{DATASET}/blob/{REVISION}/README.md'
ALLOWED = {'ANL', 'apasport', 'medeniyyet', 'marja', 'oxuaz', 'axar', 'report', 'musavat'}
FUNCTION_WORDS = {'və', 'ilə', 'üçün', 'bu', 'bir', 'həmin', 'üzrə', 'kimi', 'sonra', 'hər', 'də', 'da', 'deyil', 'daha', 'o', 'həm', 'isə', 'ancaq', 'çünki', 'belə', 'artıq', 'çox', 'hansı', 'ki', 'olan', 'olub', 'olduğu'}
SPLIT = re.compile(r'(?<=[.!?])\s+(?=[“«"(]*[A-ZƏÇĞİÖŞÜ])|\n\s*\n')
LETTERS = re.compile(r'[^\W\d_]+')
AZ_LETTERS = re.compile(r'[a-zA-ZƏəÇçĞğİıÖöŞşÜü]')
BAD = re.compile(r'<[^>]+>|https?://|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|[\x00-\x08\x0e-\x1f\ufffd]')


def segment(row):
    if row.get('source') not in ALLOWED or not isinstance(row.get('text'), str):
        return [], {'unapproved_source_or_invalid_text': 1}
    text = re.sub(r'\b([A-ZƏÇĞİÖŞÜ])\.(?=\s*[A-ZƏÇĞİÖŞÜ])', lambda match: match[1] + '\uE000', row['text'])
    accepted, rejected = [], Counter()
    for sentence in SPLIT.split(text):
        sentence = normalized(sentence.replace('\uE000', '.'))
        tokens = words(sentence)
        if not 4 <= len(tokens) <= 80 or len(sentence) > 1000 or not sentence.endswith(('.', '?', '!')):
            rejected['length_or_terminal_punctuation'] += 1
            continue
        if BAD.search(sentence) or not re.match(r'^[“«"(]*[A-ZƏÇĞİÖŞÜ]', sentence):
            rejected['markup_contact_or_fragment'] += 1
            continue
        letters = ''.join(LETTERS.findall(sentence))
        if len(AZ_LETTERS.findall(letters)) < .98 * len(letters) or not FUNCTION_WORDS.intersection(tokens):
            rejected['language_heuristic'] += 1
            continue
        accepted.append(sentence)
    return accepted, dict(rejected)


def download(entry, folder):
    output = folder / Path(entry['path']).name
    if output.exists() and output.stat().st_size == entry['size'] and sha256(output) == entry['lfs']['oid']:
        return output
    url = f"https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/{entry['path']}?download=true"
    partial = output.with_suffix('.part')
    with urllib.request.urlopen(url, timeout=60) as response:
        if response.status != 200:
            raise ValueError(f'Full shard returned HTTP {response.status}; stop acquisition')
        digest, size = hashlib.sha256(), 0
        with partial.open('wb') as handle:
            for chunk in iter(lambda: response.read(4 * 1024 * 1024), b''):
                digest.update(chunk)
                size += len(chunk)
                handle.write(chunk)
    if size != entry['size'] or digest.hexdigest() != entry['lfs']['oid']:
        raise ValueError('Shard size/SHA-256 mismatch; stop acquisition')
    os.replace(partial, output)
    return output


def collect(folder, workers=6):
    import pyarrow.parquet as parquet
    folder = Path(folder)
    approval = json.loads((folder / 'owner-approval.json').read_text())
    if approval.get('status') != 'approved' or approval.get('by') != 'repository-owner' or approval.get('dataset') != DATASET or approval.get('revision') != REVISION or not approval.get('evidence'):
        raise ValueError('Explicit owner approval of the pinned source/use plan required')
    entries = sorted(json.loads((folder / 'files.json').read_text()), key=lambda entry: entry['path'])
    if not entries or any(not entry['path'].endswith('.parquet') for entry in entries):
        raise ValueError('Original parquet tree metadata required')
    output = folder / 'az-corpus.jsonl.gz'
    partial = folder / 'az-corpus.partial.gz'
    if output.exists() or partial.exists() or (folder / 'dedup.sqlite').exists():
        raise ValueError('Do not overwrite an existing completed or partial collection')
    db = sqlite3.connect(str(folder / 'dedup.sqlite'))
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=NORMAL')
    db.execute('PRAGMA cache_size=-131072')
    db.execute('CREATE TABLE sentences (key BLOB PRIMARY KEY) WITHOUT ROWID')
    db.execute('CREATE TABLE grams (key BLOB PRIMARY KEY, source TEXT) WITHOUT ROWID')
    counts, rejected, document_counts, source_hashes = Counter(), Counter(), Counter(), {}
    receipts, rows_seen, total, started = [], 0, 0, time.monotonic()
    cap = MINIMUM_SENTENCES // 4
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for entry in entries:
            path = download(entry, folder)
            receipts.append({'path': entry['path'], 'bytes': path.stat().st_size, 'sha256': entry['lfs']['oid'], 'verified': True, 'collectedAt': datetime.now(timezone.utc).isoformat()})
            ordinal = 0
            for batch in parquet.ParquetFile(path).iter_batches(batch_size=512, columns=['text', 'source']):
                rows = batch.to_pylist()
                eligible = [(ordinal + at, row) for at, row in enumerate(rows) if row.get('source') in ALLOWED and counts[row['source']] < cap]
                rejected['quarantined_or_capped_rows'] += len(rows) - len(eligible)
                rows_seen += len(rows)
                ordinal += len(rows)
                # Close each gzip member so a completed checkpoint is readable.
                with gzip.open(partial, 'at', encoding='utf-8', compresslevel=1) as handle:
                    for (row_ordinal, row), (sentences, reasons) in zip(eligible, pool.map(segment, (row for _, row in eligible), chunksize=32)):
                        document_id = f'aztc:{REVISION}:{Path(entry["path"]).stem}:{row_ordinal}'
                        label = row['source']
                        rejected.update(reasons)
                        retained = []
                        for sentence in sentences:
                            if counts[label] >= cap or total >= MINIMUM_SENTENCES:
                                rejected['source_balance_or_target_cap'] += 1
                                continue
                            tokens = words(sentence)
                            key = hashlib.sha256(' '.join(tokens).encode()).digest()
                            if db.execute('SELECT 1 FROM sentences WHERE key=?', (key,)).fetchone():
                                rejected['normalized_exact_duplicate'] += 1
                                continue
                            grams = {hashlib.sha256(' '.join(tokens[at:at + 6]).encode()).digest() for at in range(len(tokens) - 5)}
                            if grams:
                                placeholders = ','.join('?' for _ in grams)
                                if db.execute(f'SELECT 1 FROM grams WHERE key IN ({placeholders}) AND source != ? LIMIT 1', (*grams, label)).fetchone():
                                    rejected['cross_source_sixgram'] += 1
                                    continue
                            db.execute('INSERT INTO sentences VALUES (?)', (key,))
                            db.executemany('INSERT OR IGNORE INTO grams VALUES (?,?)', ((gram, label) for gram in grams))
                            retained.append(sentence)
                            counts[label] += 1
                            total += 1
                        if retained:
                            record = {'sourceId': 'aztc-' + label, 'documentId': document_id, 'language': 'az', 'sentences': retained, 'protectedTerms': []}
                            canonical = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
                            handle.write(canonical)
                            source_hashes.setdefault(label, hashlib.sha256()).update(canonical.encode())
                            document_counts[label] += 1
                db.commit()
                progress = {'acceptedUniqueSentences': total, 'target': MINIMUM_SENTENCES, 'rowsSeen': rows_seen, 'sourceSentenceCounts': dict(counts), 'rejected': dict(rejected), 'elapsedSeconds': round(time.monotonic()-started, 1)}
                write_json(folder / 'progress.json', progress)
                if rows_seen % 10240 == 0:
                    print(json.dumps(progress, ensure_ascii=False), flush=True)
                if total >= MINIMUM_SENTENCES:
                    break
            if total >= MINIMUM_SENTENCES:
                break
    db.close()
    os.replace(partial, output)
    sources = [{'id': 'aztc-' + label, 'name': f'{DATASET} / {label}', 'url': f'https://huggingface.co/datasets/{DATASET}',
                'license': 'CC-BY-4.0 (dataset publisher declaration; original notices retained)', 'licenseEvidence': CARD,
                'collectedAt': receipts[0]['collectedAt'], 'sha256': digest.hexdigest(),
                'approval': {key: approval[key] for key in ('status', 'by', 'evidence')},
                'provenanceLabel': label, 'recordUnit': 'document-or-passage; source group is the split boundary'} for label, digest in source_hashes.items()]
    metadata = {'inputSHA256': sha256(output), 'sources': sources}
    write_json(folder / 'az-sources.json', metadata)
    report = {**progress, 'dataset': DATASET, 'revision': REVISION, 'inputSHA256': metadata['inputSHA256'],
              'documentCounts': dict(document_counts), 'shards': receipts, 'approval': approval,
              'phase0ReadByCollector': False, 'trainingStarted': False,
              'qualityMeaning': 'Mechanically filtered; not human-reviewed, linguist-certified or guaranteed error-free.',
              'gate': 'not-evaluated', 'completeMinimum': total >= MINIMUM_SENTENCES}
    write_json(folder / 'collection-report.json', report)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error('workers must be 1–8')
    collect(args.folder, workers=args.workers)
