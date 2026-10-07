"""Read-only evaluation firewall. Never filters/tunes training against held-out targets."""
import argparse
import hashlib
import json
from pathlib import Path
from common import read_jsonl, sha256, words, write_json

ROOT = Path(__file__).resolve().parents[2]


def sentence_key(text):
    return hashlib.sha256(' '.join(words(text)).encode()).hexdigest()


def ngrams(text, size):
    tokens = words(text)
    return {hashlib.sha256(' '.join(tokens[at:at + size]).encode()).hexdigest() for at in range(len(tokens) - size + 1)}


def compare(rows, references, size=8):
    exact, grams = set(), set()
    for text in references:
        exact.add(sentence_key(text))
        grams.update(ngrams(text, size))
    failures, count, overlap_count = [], 0, 0
    for row in rows:
        count += 1
        text = row.get('text', row.get('target'))
        if not isinstance(text, str):
            raise ValueError('Training row requires text or target')
        whole = sentence_key(text) in exact
        shared = ngrams(text, size) & grams
        if whole or shared:
            overlap_count += 1
            if len(failures) < 100:
                failures.append({'documentId': row.get('documentId'), 'exactSentence': whole, 'sharedNgramCount': len(shared)})
    return {'comparedRows': count, 'ngramSize': size, 'overlapRows': overlap_count, 'failures': failures,
            'status': 'not-exercised' if not count else 'failed' if overlap_count else 'passed'}


def phase0_references():
    result = []
    for name in ('holdout-500', 'calibration-100', 'no-harm-2000'):
        path = ROOT / 'data/evaluation/phase0' / (name + '.json')
        expected = path.with_suffix('.sha256').read_text().split()[0]
        if sha256(path) != expected:
            raise ValueError(f'Frozen evaluation integrity mismatch: {name}')
        for row in json.loads(path.read_text())['cases']:
            result.extend((row['input'], row['expected']))
    return result


def document_sentences(rows):
    """Read-only collection audit; do not generate pairs or filter on references."""
    for row in rows:
        sentences = row.get('sentences')
        if not isinstance(sentences, list) or any(not isinstance(text, str) for text in sentences):
            raise ValueError('Collected document requires an array of sentences')
        for index, text in enumerate(sentences):
            yield {'text': text, 'documentId': row.get('documentId'), 'sentenceIndex': index}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('corpus')
    parser.add_argument('--out', default='docs/stage1/overlap.json')
    parser.add_argument('--documents', action='store_true')
    args = parser.parse_args()
    rows = read_jsonl(args.corpus)
    report = compare(document_sentences(rows) if args.documents else rows, phase0_references())
    write_json(args.out, report)
    print(json.dumps(report))
    raise SystemExit(0 if report['status'] == 'passed' else 2)
