"""Shared Azerbaijani text conventions for offline data and inference parity."""
import re
import unicodedata

WORD = re.compile(r'[^\W\d_]+', re.UNICODE)
PUNCTUATION = ['NONE', ',', '.', '?', '!', ':']
CASES = ['lower', 'title', 'upper', 'mixed']
SUFFIXES = ('lardan', 'lərdən', 'larının', 'lərinin', 'ları', 'ləri', 'ların', 'lərin',
            'lara', 'lərə', 'dan', 'dən', 'da', 'də', 'lar', 'lər', 'dır', 'dir', 'dur', 'dür')


def lower(text):
    return unicodedata.normalize('NFC', text).translate(str.maketrans({'I': 'ı', 'İ': 'i'})).lower()


def fold(text):
    return lower(text).translate(str.maketrans('əçğıöşüqx', 'ecgiosukh'))


def word_matches(text):
    return list(WORD.finditer(unicodedata.normalize('NFC', text)))


def tokens(text):
    return [lower(m.group()) for m in word_matches(text)]


def suffix_class(word):
    # Conservative spelling class only, not a certified morphological analysis.
    for suffix in SUFFIXES:
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            return '<suffix:' + suffix + '>'
    return '<unk>'


def case_label(word):
    if word == lower(word):
        return 0
    if word.isupper():
        return 2
    if word[0].isupper() and word[1:] == lower(word[1:]):
        return 1
    return 3


def tag_sentence(text, protected):
    matches = word_matches(text)
    words, punctuation, case = [], [], []
    for at, match in enumerate(matches):
        end = matches[at + 1].start() if at + 1 < len(matches) else len(text)
        gap = text[match.end():end].strip()
        label = PUNCTUATION.index(gap) if gap in PUNCTUATION[1:] else 0 if not gap else -100
        shielded = any(match.start() < right and match.end() > left for left, right in protected)
        words.append(lower(match.group()))
        punctuation.append(-100 if shielded else label)
        case.append(-100 if shielded else case_label(match.group()))
    return {'words': words, 'punctuation': punctuation, 'case': case}
