"""Exact, disk-partitioned source keys. This module never reads evaluation data."""
import hashlib
from pathlib import Path
import struct
from common import words

SPLITS = ('train', 'validation', 'test')
RECORD = struct.Struct('<33sI')
MAX_ROWS = 1 << 28


def text_keys(text):
    tokens = words(text)
    keys = {b'\x00' + hashlib.sha256(' '.join(tokens).encode()).digest()}
    keys.update(b'\x01' + hashlib.sha256(' '.join(tokens[at:at + 8]).encode()).digest()
                for at in range(max(0, len(tokens) - 7)))
    return keys


class SourceKeyIndex:
    """Keep full 256-bit hashes, process one of 256 partitions at a time.

    Metadata stores the row, source split and clean/noisy membership. Hash type
    is separate, so a sentence hash cannot be confused with an eight-word hash.
    File order preserves original first-owner collision semantics.
    """
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=False)
        self.handles = [None] * 256
        self.records = 0
        self.finished = False

    def __enter__(self):
        return self

    def close(self):
        for at, handle in enumerate(self.handles):
            if handle is not None:
                handle.close()
                self.handles[at] = None

    def __exit__(self, *_):
        self.close()

    def add(self, clean, noisy, split, row):
        if self.finished or not 0 <= split < len(SPLITS) or not 0 <= row < MAX_ROWS:
            raise ValueError('Invalid source index state or row metadata')
        for key in clean | noisy:
            if len(key) != 33 or key[0] not in (0, 1):
                raise ValueError('Full typed SHA-256 key required')
            partition = key[1]
            handle = self.handles[partition]
            if handle is None:
                handle = (self.directory / f'{partition:03d}.keys').open('wb', buffering=131072)
                self.handles[partition] = handle
            flags = int(key in clean) | (int(key in noisy) << 1)
            handle.write(RECORD.pack(key, (row << 4) | (split << 2) | flags))
            self.records += 1

    def finish(self, collect_owners=False, progress=None):
        if self.finished:
            raise ValueError('Index can only be finalized once')
        self.close()
        self.finished = True
        affected, examples = set(), []
        collisions = colliding_keys = clean_collisions = maximum_bytes = 0
        owners = {} if collect_owners else None
        for partition in range(256):
            path = self.directory / f'{partition:03d}.keys'
            grouped = {}
            if path.exists():
                size = path.stat().st_size
                maximum_bytes = max(maximum_bytes, size)
                # Fail closed on malformed or unexpectedly skewed partitions.
                if size % RECORD.size or size > 256 * 1024 * 1024:
                    raise ValueError('Malformed or oversized source key partition')
                with path.open('rb') as handle:
                    for chunk in iter(lambda: handle.read(RECORD.size * 65536), b''):
                        for key, packed in RECORD.iter_unpack(chunk):
                            old = grouped.get(key)
                            if old is None:
                                grouped[key] = packed
                            elif isinstance(old, int):
                                grouped[key] = [old, packed]
                            else:
                                old.append(packed)
                for key, values in grouped.items():
                    values = [values] if isinstance(values, int) else values
                    owner = (values[0] >> 2) & 3
                    if owners is not None:
                        owners[key] = SPLITS[owner]
                    foreign = sum(((value >> 2) & 3) != owner for value in values)
                    if not foreign:
                        continue
                    collisions += foreign
                    colliding_keys += 1
                    clean_splits = {(value >> 2) & 3 for value in values if value & 1}
                    if len(clean_splits) > 1:
                        clean_collisions += 1
                    else:
                        for value in values:
                            if value & 2 and ((value >> 2) & 3) not in clean_splits:
                                affected.add(value >> 4)
                    if len(examples) < 100:
                        examples.append({'type': 'sentence' if key[0] == 0 else '8gram',
                                         'sha256': key[1:].hex(),
                                         'rows': [{'row': value >> 4, 'split': SPLITS[(value >> 2) & 3],
                                                   'clean': bool(value & 1), 'noisy': bool(value & 2)}
                                                  for value in values[:100]]})
                path.unlink()
            if progress:
                progress(partition + 1, 256)
        return {'crossSplitCollisions': collisions, 'collidingKeys': colliding_keys,
                'cleanCrossSplitKeys': clean_collisions, 'affectedRows': affected,
                'owners': owners, 'examples': examples, 'records': self.records,
                'maximumPartitionBytes': maximum_bytes}
