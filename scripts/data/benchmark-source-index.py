"""Measure complete index construction/finalization on synthetic keys only."""
import argparse
import hashlib
import random
import sqlite3
import statistics
import tempfile
import time
from pathlib import Path
from common import write_json
from gate import register_keys
from source_index import SourceKeyIndex, SPLITS


def benchmark(rows_count, repetitions):
    rng = random.Random(20261007)
    pool = [b'\x01' + hashlib.sha256(str(at).encode()).digest() for at in range(40000)]
    rows = [(set(rng.sample(pool, 8)), set(rng.sample(pool, 8)), min(2, at // ((rows_count + 2) // 3)))
            for at in range(rows_count)]
    times, collisions = {'sqlite': [], 'partitioned': []}, {}
    for _ in range(repetitions):
        with tempfile.TemporaryDirectory() as temporary:
            started = time.perf_counter()
            with sqlite3.connect(str(Path(temporary) / 'db')) as db:
                db.execute('CREATE TABLE seen (hash BLOB PRIMARY KEY, split TEXT) WITHOUT ROWID')
                count = 0
                for clean, noisy, split in rows:
                    count += register_keys(db, {key[1:].hex() for key in clean | noisy}, SPLITS[split])
                db.commit()
            times['sqlite'].append((time.perf_counter() - started) * 1000)
            collisions['sqlite'] = count
        with tempfile.TemporaryDirectory() as temporary:
            started = time.perf_counter()
            with SourceKeyIndex(Path(temporary) / 'index') as index:
                for at, (clean, noisy, split) in enumerate(rows):
                    index.add(clean, noisy, split, at)
                result = index.finish()
            times['partitioned'].append((time.perf_counter() - started) * 1000)
            collisions['partitioned'] = result['crossSplitCollisions']
        if len(set(collisions.values())) != 1:
            raise ValueError('Index collision semantics differ')
    return {'scope': f'{rows_count} assistant-authored synthetic index rows; not corpus or runtime timing',
            'seed': 20261007, 'repetitions': repetitions, 'milliseconds': times,
            'medianMs': {key: statistics.median(values) for key, values in times.items()},
            'crossSplitCollisions': collisions}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--rows', type=int, default=10000)
    parser.add_argument('--repetitions', type=int, default=3)
    parser.add_argument('--out', default='docs/stage1/collection/source-index-benchmark.json')
    args = parser.parse_args()
    if args.rows < 3 or args.repetitions < 1:
        parser.error('At least three rows and one repetition required')
    write_json(args.out, benchmark(args.rows, args.repetitions))
