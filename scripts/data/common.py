"""Offline data preparation helpers; never imported by browser inference."""
import gzip
import hashlib
import json
import re
import unicodedata
from pathlib import Path

MINIMUM_SENTENCES = 5_000_000  # Owner selected on 2026-10-07; do not lower to pass a gate.


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def az_lower(text):
    return text.translate(str.maketrans({'I': 'ı', 'İ': 'i'})).lower()


def normalized(text):
    return ' '.join(unicodedata.normalize('NFC', text).split())


def words(text):
    # Normalize Azerbaijani dotted-i before extracting Unicode letter runs.
    return re.findall(r'[^\W\d_]+', az_lower(unicodedata.normalize('NFC', text).replace('i\u0307', 'i')))


def read_jsonl(path):
    path = Path(path)
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf-8') as handle:
        for line, text in enumerate(handle, 1):
            if text.strip():
                try:
                    row = json.loads(text)
                except json.JSONDecodeError as error:
                    raise ValueError(f'{path}: malformed JSON on line {line}') from error
                if not isinstance(row, dict):
                    raise ValueError(f'{path}: object required on line {line}')
                yield row


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def source_assignments(ids, seed=20261007):
    ids = sorted(set(ids), key=lambda value: hashlib.sha256(f'{seed}:{value}'.encode()).hexdigest())
    if len(ids) < 3:
        raise ValueError('At least three independently approved source groups are required for source-level train/validation/test splits')
    train_count = min(len(ids) - 2, max(1, int(len(ids) * .8)))
    validation_count = min(len(ids) - train_count - 1, max(1, int(len(ids) * .1)))
    return {source: 'train' if at < train_count else 'validation' if at < train_count + validation_count else 'test' for at, source in enumerate(ids)}
