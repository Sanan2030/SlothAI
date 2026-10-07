"""Compare a rejected batching trial on synthetic keys; production gate is unchanged."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import random
import sqlite3
import statistics
import tempfile
import time
def encode_keys(keys):
    return [b'\x00' + bytes.fromhex(key[9:]) if key.startswith('sentence:')
            else b'\x01' + bytes.fromhex(key) for key in keys]


def register_key_counts(db, counts, split):
    """Count every row occurrence against the first split, not just unique keys.

    All rows in a batch belong to one split. New keys within that batch cannot
    create cross-split collisions with each other. Existing foreign keys count
    once per containing row, exactly as sequential registration does.
    """
    encoded = sorted(counts)
    collisions = 0
    for start in range(0, len(encoded), 900):
        chunk = encoded[start:start + 900]
        placeholders = ','.join('?' for _ in chunk)
        collisions += sum(counts[key] for key, old in db.execute(
            f'SELECT hash, split FROM seen WHERE hash IN ({placeholders})', chunk)
            if old != split)
    db.executemany('INSERT OR IGNORE INTO seen VALUES (?,?)',
                   ((key, split) for key in encoded))
    return collisions


def original_register(db, keys, split):
    encoded = encode_keys(keys)
    placeholders = ','.join('?' for _ in encoded)
    collisions = sum(old != split for (old,) in db.execute(
        f'SELECT split FROM seen WHERE hash IN ({placeholders})', encoded))
    db.executemany('INSERT OR IGNORE INTO seen VALUES (?,?)',
                   ((key, split) for key in encoded))
    return collisions


def run(rows, batched, directory):
    db = sqlite3.connect(str(directory / 'index.sqlite'))
    db.execute('PRAGMA cache_size=-131072')
    db.execute('CREATE TABLE seen (hash BLOB PRIMARY KEY, split TEXT) WITHOUT ROWID')
    pending = Counter()
    collisions = 0
    start = time.perf_counter()
    previous_split = None
    for index, (split, keys) in enumerate(rows):
        if batched:
            if previous_split is not None and previous_split != split:
                collisions += register_key_counts(db, pending, previous_split)
                pending.clear()
                db.commit()
            pending.update(encode_keys(keys))
            if (index + 1) % 1000 == 0 or len(pending) >= 50000:
                collisions += register_key_counts(db, pending, split)
                pending.clear()
                db.commit()
        else:
            collisions += original_register(db, keys, split)
            if (index + 1) % 1000 == 0:
                db.commit()
        previous_split = split
    if batched:
        collisions += register_key_counts(db, pending, previous_split)
    db.commit()
    elapsed = (time.perf_counter() - start) * 1000
    ownership = hashlib.sha256()
    for key, split in db.execute('SELECT hash, split FROM seen ORDER BY hash'):
        ownership.update(key + split.encode() + b'\n')
    result = {'ms': elapsed, 'collisions': collisions, 'ownershipSHA256': ownership.hexdigest()}
    db.close()
    return result


def benchmark(count, repetitions):
    rng = random.Random(20261007)
    shared = [hashlib.sha256(f'shared:{i}'.encode()).hexdigest() for i in range(5000)]
    rows = []
    for index in range(count):
        split = ('train', 'validation', 'test')[min(2, index * 3 // count)]
        keys = {hashlib.sha256(f'{index}:{i}'.encode()).hexdigest() for i in range(24)}
        keys.update(rng.sample(shared, 4))
        keys.add('sentence:' + hashlib.sha256(f'sentence:{index}'.encode()).hexdigest())
        rows.append((split, keys))
    results = {'original': [], 'batched': []}
    for repeat in range(repetitions):
        # Alternate order to reduce systematic warm-cache/order advantage.
        for name in (('original', 'batched') if repeat % 2 == 0 else ('batched', 'original')):
            with tempfile.TemporaryDirectory(prefix='sloth-audit-benchmark-') as temporary:
                results[name].append(run(rows, name == 'batched', Path(temporary)))
    reference = results['original'][0]
    equal = all(row['collisions'] == reference['collisions'] and
                row['ownershipSHA256'] == reference['ownershipSHA256']
                for values in results.values() for row in values)
    return {'rows': count, 'repetitions': repetitions, 'seed': 20261007,
            'sqliteVersion': sqlite3.sqlite_version, 'ownersAndCollisionCountsEqual': equal,
            'medianMs': {key: statistics.median(row['ms'] for row in values)
                         for key, values in results.items()}, 'runs': results,
            'scope': 'Synthetic audit-index microbenchmark with intentional split collisions; not corpus leakage, full-gate throughput, app latency or model quality.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--rows', type=int, default=10000)
    parser.add_argument('--repetitions', type=int, default=3)
    parser.add_argument('--out', default='docs/stage1/collection/gate-index-timing.json')
    args = parser.parse_args()
    if args.rows < 3 or args.repetitions < 1:
        parser.error('rows must be >=3 and repetitions >=1')
    report = benchmark(args.rows, args.repetitions)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['ownersAndCollisionCountsEqual'] else 2)
