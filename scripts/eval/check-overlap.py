"""Exact prior target overlap diagnostic, not semantic leakage certification."""
import hashlib
import collections
import unicodedata
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
new = json.loads((root / 'data/evaluation/phase0/holdout-500.json').read_text())['cases']
targets = {row['expected'].casefold(): [] for row in new}


def walk(value, filename):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ('target', 'expected', 'text', 'correct') and isinstance(child, str):
                normalized = child.strip().casefold()
                if normalized in targets:
                    targets[normalized].append(filename)
            elif isinstance(child, (dict, list)):
                walk(child, filename)
    elif isinstance(value, list):
        for child in value:
            walk(child, filename)


for folder in ['data/nlp', 'data/local-ai', 'data/neural', 'tests/fixtures']:
    for path in (root / folder).rglob('*'):
        if path.suffix not in ('.json', '.jsonl'):
            continue
        text = path.read_text()
        try:
            if path.suffix == '.jsonl':
                for line in text.splitlines():
                    if line.strip():
                        walk(json.loads(line), str(path.relative_to(root)))
            else:
                walk(json.loads(text), str(path.relative_to(root)))
        except (UnicodeError, json.JSONDecodeError):
            raise RuntimeError(f'Cannot audit overlap: {path}') from None

report = {
    'exactTargetOverlapRows': [row['id'] for row in new if targets[row['expected'].casefold()]],
    'matchedSources': {hashlib.sha256(target.encode()).hexdigest(): sorted(set(files)) for target, files in targets.items() if files},
    'scope': 'Exact casefolded target match in explicit target/expected/text/correct fields in data/nlp, data/local-ai, data/neural, tests/fixtures. Not a near-duplicate or semantic leakage guarantee; source filenames do not determine whether a row was actually trained on.',
}
(root / 'docs/evaluation/phase0/overlap.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))

# Diversity is measured on targets/inputs only, not model predictions.
pairs = collections.Counter()
def letter_words(text):
    tokens, current = [], ''
    for char in text:
        if unicodedata.category(char)[0] in ('L', 'M'):
            current += char
        elif current:
            tokens.append(current)
            current = ''
    if current:
        tokens.append(current)
    return tokens

for row in new:
    left = letter_words(row['input'])
    right = letter_words(row['expected'])
    if len(left) != len(right):
        raise RuntimeError('Positional diversity diagnostic requires equal token counts')
    for source, target in zip(left, right):
        if source != target:
            pairs[(source, target)] += 1
diversity = {
    'distinctWordErrorPairs': len(pairs),
    'maximumPairFrequency': max(pairs.values(), default=0),
    'topRepeatedPairs': [{'input': a, 'expected': b, 'count': n} for (a, b), n in pairs.most_common(10)],
    'convention': 'Same-token-count authored corruptions; Unicode letter+mark tokens paired positionally. This is a diversity diagnostic, not a quality score or leakage guarantee.',
}
(root / 'docs/evaluation/phase0/diversity.json').write_text(json.dumps(diversity, ensure_ascii=False, indent=2) + '\n')
