"""Seeded synthetic errors, not an empirically fitted user-error distribution."""
import argparse
import hashlib
import random
import re
import unicodedata
from collections import Counter
from common import az_lower, read_jsonl

KINDS = ('identity', 'diacritics_all', 'diacritics_partial', 'qk_xh', 'deletion', 'insertion', 'transpose',
         'keyboard_az', 'keyboard_ascii', 'digraph', 'space_split', 'space_join', 'hyphen', 'punctuation', 'case')
FOLD = str.maketrans({'ə': 'e', 'ı': 'i', 'ö': 'o', 'ü': 'u', 'ç': 'c', 'ş': 's', 'ğ': 'g',
                     'Ə': 'E', 'İ': 'I', 'Ö': 'O', 'Ü': 'U', 'Ç': 'C', 'Ş': 'S', 'Ğ': 'G'})
TECHNICAL = ('API', 'REST', 'gRPC', 'JSON', 'SQL', 'Git', 'GitHub', 'Vercel', 'backend', 'frontend',
             'database', 'commit', 'deploy', 'framework', 'Python', 'TypeScript', 'JavaScript')
AZ_ROWS = ('qüertyuiopöğ', 'asdfghjklıə', 'zxcvbnmçş')
ASCII_ROWS = ('qwertyuiop', 'asdfghjkl', 'zxcvbnm')
WORD = re.compile(r'[^\W\d_]+', re.UNICODE)
PROTECTED = re.compile(r'```[\s\S]*?```|`[^`\n]*`|https?://[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|<[^>]*>|\d+(?:[.,:/%-]\d+)*')


def protected_ranges(text, protected_terms=()):
    ranges = [(match.start(), match.end()) for match in PROTECTED.finditer(text)]
    for term in set(TECHNICAL) | set(protected_terms):
        if not isinstance(term, str) or not term:
            raise ValueError('Protected terms must be nonempty strings')
        ranges.extend((match.start(), match.end()) for match in re.finditer(r'(?<!\w)' + re.escape(term) + r'(?!\w)', text))
    for match in WORD.finditer(text):
        # Conservative name/acronym heuristic, not NER. Sentence-initial names need explicit metadata.
        if len(match.group()) > 1 and (match.group().isupper() or match.start() > 0 and match.group()[0].isupper()):
            ranges.append((match.start(), match.end()))
    return ranges


def overlaps(start, end, ranges):
    return any(start < right and end > left for left, right in ranges)


def keyboard_neighbours(char, rows):
    result = set()
    for row_index, row in enumerate(rows):
        if char not in row:
            continue
        column = row.index(char)
        for other_row in range(max(0, row_index - 1), min(len(rows), row_index + 2)):
            for other_column in range(max(0, column - 1), min(len(rows[other_row]), column + 2)):
                candidate = rows[other_row][other_column]
                if candidate != char:
                    result.add(candidate)
    return sorted(result)


def corrupt(text, seed, kind=None, protected_terms=()):
    text = unicodedata.normalize('NFC', text)
    rng = random.Random(seed)
    if kind is None:
        kind = 'identity' if rng.random() < .2 else rng.choice(KINDS[1:])
    if kind not in KINDS:
        raise ValueError('Unknown error category')
    if kind == 'identity':
        return {'input': text, 'target': text, 'category': 'identity', 'requestedCategory': kind}
    ranges = protected_ranges(text, protected_terms)
    choices = [match for match in WORD.finditer(text) if not overlaps(match.start(), match.end(), ranges)]
    rng.shuffle(choices)
    result = text
    if kind in ('space_join', 'hyphen'):
        gaps = list(re.finditer(r'(?<=[^\W\d_]) (?=[^\W\d_])', text))
        rng.shuffle(gaps)
        for gap in gaps:
            left = next((m for m in WORD.finditer(text) if m.end() == gap.start()), None)
            right = WORD.match(text, gap.end())
            if left and right and not overlaps(left.start(), right.end(), ranges):
                result = text[:gap.start()] + ('' if kind == 'space_join' else '-') + text[gap.end():]
                break
    elif kind == 'punctuation':
        choices_punct = [match for match in re.finditer(r'[,.;:!?]', text) if not overlaps(match.start(), match.end(), ranges)]
        if choices_punct:
            match = rng.choice(choices_punct)
            result = text[:match.start()] + text[match.end():]
    else:
        for match in choices:
            word = match.group()
            replacement = word
            if kind == 'diacritics_all':
                replacement = word.translate(FOLD)
            elif kind == 'diacritics_partial':
                positions = [i for i, char in enumerate(word) if char.translate(FOLD) != char]
                if positions:
                    at = rng.choice(positions)
                    replacement = word[:at] + word[at].translate(FOLD) + word[at + 1:]
            elif kind == 'qk_xh':
                alternatives = {'q': 'k', 'k': 'q', 'x': 'h', 'h': 'x'}
                positions = [i for i, char in enumerate(word) if char in alternatives]
                if positions:
                    at = rng.choice(positions)
                    replacement = word[:at] + alternatives[word[at]] + word[at + 1:]
            elif kind == 'deletion' and len(word) >= 4:
                at = rng.randrange(len(word))
                replacement = word[:at] + word[at + 1:]
            elif kind == 'insertion' and len(word) >= 2:
                at = rng.randrange(len(word))
                replacement = word[:at] + word[at] + word[at:]
            elif kind == 'transpose' and len(word) >= 3:
                positions = [i for i in range(len(word) - 1) if word[i] != word[i + 1]]
                if positions:
                    at = rng.choice(positions)
                    replacement = word[:at] + word[at + 1] + word[at] + word[at + 2:]
            elif kind in ('keyboard_az', 'keyboard_ascii'):
                neighbours = [(i, keyboard_neighbours(char, AZ_ROWS if kind == 'keyboard_az' else ASCII_ROWS)) for i, char in enumerate(word)]
                neighbours = [(i, values) for i, values in neighbours if values]
                if neighbours:
                    at, values = rng.choice(neighbours)
                    replacement = word[:at] + rng.choice(values) + word[at + 1:]
            elif kind == 'digraph':
                replacement = word.replace('ş', 'sh').replace('ç', 'ch').replace('ğ', 'gh').replace('Ş', 'Sh').replace('Ç', 'Ch').replace('Ğ', 'Gh')
            elif kind == 'space_split' and len(word) >= 5:
                at = rng.randrange(2, len(word) - 1)
                replacement = word[:at] + ' ' + word[at:]
            elif kind == 'case':
                replacement = az_lower(word) if word[0].isupper() else word[0].translate(str.maketrans({'i': 'İ', 'ı': 'I'})).upper() + word[1:]
            if replacement != word:
                result = text[:match.start()] + replacement + text[match.end():]
                break
    # Verify protected occurrences remain byte-exact, independently of shifted offsets.
    for start, end in ranges:
        value = text[start:end]
        if result.count(value) != text.count(value):
            result = text
            break
    return {'input': result, 'target': text, 'category': kind if result != text else 'identity', 'requestedCategory': kind}


def pair_seed(seed, document_id, sentence_index):
    return int.from_bytes(hashlib.sha256(f'{seed}:{document_id}:{sentence_index}'.encode()).digest()[:8], 'big')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input')
    parser.add_argument('output')
    parser.add_argument('--seed', type=int, default=20261007)
    args = parser.parse_args()
    import json
    counts = Counter()
    with open(args.output, 'w', encoding='utf-8') as handle:
        for at, row in enumerate(read_jsonl(args.input)):
            pair = corrupt(row['text'], pair_seed(args.seed, row['documentId'], at), protected_terms=row.get('protectedTerms', []))
            counts[pair['category']] += 1
            handle.write(json.dumps({**row, **pair}, ensure_ascii=False) + '\n')
    print(json.dumps({'realizedCounts': dict(counts), 'origin': 'synthetic, not observed or human-reviewed'}))
