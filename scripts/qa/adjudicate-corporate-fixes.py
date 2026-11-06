"""Compare unchanged corporate inputs with the reviewed original audit.

Reference omissions are explicit judgments; no input, gold, model or runtime
file is rewritten. This script is evaluation-only and never imported by the app.
"""
import argparse
import collections
import csv
import difflib
import gzip
import hashlib
import json
import re
import unicodedata
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--baseline', type=Path, default=Path('artifacts/qa/corporate-100k-20261106/adjudicated-results.jsonl.gz'))
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
corpus = Path('data/qa/corporate-100k-2026-11-06')
raw = gzip.decompress((corpus / 'cases.jsonl.gz').read_bytes())
manifest = json.loads((corpus / 'MANIFEST.json').read_text())
assert hashlib.sha256(raw).hexdigest() == manifest['corpusSHA256']
cases = [json.loads(line) for line in raw.decode().splitlines()]
before = {row['id']: row for row in map(json.loads, gzip.open(args.baseline, 'rt'))}
after = {row['id']: row for row in map(json.loads, (args.node / 'results.jsonl').open())}
assert len(cases) == len(before) == len(after) == 1000
assert sum(row['inputWords'] for row in cases) == 100000
assert sum(row['assistantVerdict'] == 'correct' for row in before.values()) == 297
errata = [
    {'before': 'istisna varsa onun', 'after': 'istisna varsa, onun', 'review': 'Previously documented conditional-clause omission; the original audit already accepted this repair.'},
    {'before': 'tələb yaranarsa ayrıca', 'after': 'tələb yaranarsa, ayrıca', 'review': 'Newly reviewed conditional-clause omission: yaranarsa closes the condition; ayrıca qərar alınmalıdır is its following main clause. The comma is a valid repair, not damage to a correct sentence.'},
]
policy = {'corpusSHA256': manifest['corpusSHA256'], 'inputsOrGoldRewritten': False, 'judgingAuthority': 'User requested assistant judgment of correctness.', 'referenceErrata': errata, 'otherAlternativesAccepted': False, 'warning': 'Assistant-authored compositional development corpus; these judgments are not blind human or real-user accuracy.'}
(args.out / 'ADJUDICATION_POLICY.json').write_text(json.dumps(policy, ensure_ascii=False, indent=2) + '\n')
norm = lambda value: ' '.join(unicodedata.normalize('NFC', value).split())
records = []
for row in cases:
    old, new = before[row['id']], after[row['id']]
    expected = row['expected']
    for erratum in errata:
        expected = expected.replace(erratum['before'], erratum['after'])
    correct = norm(new['actual']) == norm(expected)
    was_correct = old['assistantVerdict'] == 'correct'
    status = 'preserved' if was_correct and correct else 'fixed' if correct else 'regressed' if was_correct else 'remaining'
    wanted = re.findall(r'[^\W\d_]+', expected, re.UNICODE)
    actual = re.findall(r'[^\W\d_]+', new['actual'], re.UNICODE)
    differences = []
    for tag, a, b, c, d in difflib.SequenceMatcher(None, wanted, actual, autojunk=False).get_opcodes():
        if tag != 'equal':
            differences.append({'expected': ' '.join(wanted[a:b]), 'actual': ' '.join(actual[c:d])})
    category = None
    if not correct:
        category = 'punctuation-or-boundary' if wanted == actual else 'case' if [w.lower() for w in wanted] == [w.lower() for w in actual] else 'lexical-or-inflection'
    records.append({**row, 'before': old['actual'], 'actual': new['actual'], 'repeated': new['repeated'], 'status': status, 'correct': correct, 'strictReferenceMatch': new['strictExact'], 'acceptedReferenceRepair': correct and not new['strictExact'], 'remainingCategory': category, 'remainingLexicalDifferences': differences, 'beforePrimaryCategory': old['primaryCategory'], 'repeatStable': new['repeatStable'], 'literalPreserved': new['literalPreserved'], 'metadata': new['metadata']})
summary = {'scope': policy['warning'], 'corpusSHA256': manifest['corpusSHA256'], 'requests': 1000, 'inputWords': 100000, 'beforeCorrect': 297, 'beforeIncorrect': 703, 'afterCorrect': sum(r['correct'] for r in records), 'afterIncorrect': sum(not r['correct'] for r in records), 'statuses': dict(collections.Counter(r['status'] for r in records)), 'strictReferenceMatches': sum(r['strictReferenceMatch'] for r in records), 'acceptedReferenceRepairs': sum(r['acceptedReferenceRepair'] for r in records), 'remainingCategories': dict(collections.Counter(r['remainingCategory'] for r in records if not r['correct'])), 'repeatStable': sum(r['repeatStable'] for r in records), 'unstableIds': [r['id'] for r in records if not r['repeatStable']], 'unstableCorrectFirstOutputs': [r['id'] for r in records if not r['repeatStable'] and r['correct']], 'literalCases': sum(bool(r['protectedLiterals']) for r in records), 'literalFailures': [r['id'] for r in records if not r['literalPreserved']], 'allThreeAutomatic': json.loads((args.node / 'summary.json').read_text())['totals']['allThreeAutomatic'], 'technicalErrors': json.loads((args.node / 'summary.json').read_text())['totals']['exceptions']}
for name, rows in [('comparison.jsonl.gz', records), ('remaining-errors.jsonl.gz', [r for r in records if not r['correct']])]:
    (args.out / name).write_bytes(gzip.compress(('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n').encode(), mtime=0))
with (args.out / 'all-results.csv').open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=['id', 'domain', 'module', 'status', 'input', 'expected', 'before', 'actual', 'remainingCategory', 'repeatStable'])
    writer.writeheader()
    writer.writerows({key: r[key] for key in writer.fieldnames} for r in records)
summary['comparisonSHA256'] = hashlib.sha256((args.out / 'comparison.jsonl.gz').read_bytes()).hexdigest()
(args.out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False, indent=2))
