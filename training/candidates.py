"""Disk-backed deletion candidate index for offline experiments, not live edits."""
import functools
import sqlite3
from collections import Counter
from pathlib import Path
from training.text import fold

try:
    from rapidfuzz.distance.OSA import distance as _native_osa_distance
except ImportError:
    _native_osa_distance = None


def deletions(word, distance=2):
    found, layer = {word}, {word}
    for _ in range(distance):
        layer = {value[:at] + value[at + 1:] for value in layer for at in range(len(value))}
        found.update(layer)
    return found


def distance(left, right, maximum=2):
    """Restricted Damerau-Levenshtein (optimal string alignment), capped at maximum+1."""
    if abs(len(left) - len(right)) > maximum:
        return maximum + 1
    if _native_osa_distance is not None:
        return _native_osa_distance(left, right, score_cutoff=maximum)
    return _python_distance(left, right, maximum)


def _python_distance(left, right, maximum=2):
    """Original exact fallback for environments without the optional native wheel."""
    if abs(len(left) - len(right)) > maximum:
        return maximum + 1
    previous = list(range(len(right) + 1))
    older = previous
    for i, char in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1):
            value = min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (char != other))
            if i > 1 and j > 1 and char == right[j - 2] and left[i - 2] == other:
                value = min(value, older[j - 2] + 1)
            current.append(value)
        older, previous = previous, current
    return min(previous[-1], maximum + 1)


def add_counts(db, counts):
    db.executemany('INSERT INTO counts VALUES (?,?) ON CONFLICT(word) DO UPDATE SET n=n+excluded.n',
                   counts.items())
    db.commit()
    counts.clear()


def build_index(path, sentences, dictionary, config):
    db = sqlite3.connect(path)
    db.execute('PRAGMA cache_size=-32768')
    db.execute('CREATE TABLE counts(word TEXT PRIMARY KEY, n INTEGER NOT NULL) WITHOUT ROWID')
    counts = Counter()
    for sentence in sentences:
        counts.update(sentence)
        if len(counts) >= 20000:
            add_counts(db, counts)
    add_counts(db, counts)
    db.executemany('INSERT OR IGNORE INTO counts VALUES (?,0)', ((word,) for word in dictionary))
    db.execute('CREATE TABLE words(id INTEGER PRIMARY KEY, word TEXT UNIQUE, folded TEXT, n INTEGER)')
    db.execute('CREATE TABLE deletes(key TEXT, id INTEGER, PRIMARY KEY(key,id)) WITHOUT ROWID')
    # Frequency is train-only; deterministic lexical ties. No validation vocabulary.
    rows = db.execute('SELECT word,n FROM counts ORDER BY n DESC,word LIMIT ?',
                      (config['maxVocabulary'],))
    for index, (word, frequency) in enumerate(rows, 1):
        folded = fold(word)
        db.execute('INSERT INTO words VALUES (?,?,?,?)', (index, word, folded, frequency))
        db.executemany('INSERT INTO deletes VALUES (?,?)',
                       ((key, index) for key in sorted(deletions(folded[:config['prefixLength']]))))
        if index % 5000 == 0:
            db.commit()
    db.execute('DROP TABLE counts')
    db.commit()
    db.execute('VACUUM')
    db.close()


class CandidateIndex:
    def __init__(self, path, prefix=7):
        self.db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
        self.prefix = prefix

    @functools.lru_cache(maxsize=4096)
    def lookup(self, word, limit=20):
        query = fold(word)
        keys = sorted(deletions(query[:self.prefix]))
        placeholders = ','.join('?' for _ in keys)
        rows = self.db.execute(f'SELECT DISTINCT w.word,w.folded,w.n FROM deletes d '
                               f'JOIN words w ON w.id=d.id WHERE d.key IN ({placeholders}) '
                               'ORDER BY w.n DESC,w.word LIMIT 4096', keys)
        found = []
        for candidate, folded, frequency in rows:
            if candidate == word:
                continue
            edit = distance(query, folded)
            if edit <= 2:
                found.append((edit, -frequency, candidate))
        return tuple(value[2] for value in sorted(found)[:limit])

    def close(self):
        self.lookup.cache_clear()
        self.db.close()
