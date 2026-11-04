"""Streaming rejection-only novelty audit against the accepted clean source splits."""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import runpy
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('data/corpus/az-v1'))
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Do not overwrite a source novelty receipt')
    helper = runpy.run_path(str(Path(__file__).with_name('build-novel-10000.py')))
    corpus = Path('data/qa/novel-10000-2026-11-04')
    manifest = json.loads((corpus / 'MANIFEST.json').read_text())
    assert helper['digest']((corpus / 'cases.jsonl.gz').read_bytes()) == manifest['gzipSHA256']
    changes = {item['id']: item['after'] for item in json.loads((corpus / 'GOLD_REVIEW.json').read_text())['changes']}
    queries = defaultdict(set)
    for line in gzip.open(corpus / 'cases.jsonl.gz', 'rt'):
        row = json.loads(line)
        for value in (row['input'], changes.get(row['id'], row['expected'])):
            body = value.split('\n\n')[1] if row['module'] == 'mail' else value
            queries[helper['normalized'](body)].add(row['id'])
    keys = sorted(queries)
    triples = [helper['grams'](key.split(), 3) for key in keys]
    index = defaultdict(list)
    for at, grams in enumerate(triples):
        for gram in grams:
            index[gram].append(at)
    own_eight = set().union(*(helper['grams'](key.split(), 8) for key in keys))
    exact, shared_eight, near = set(), set(), set()
    maximum, nearest = 0.0, None
    sources, total = [], 0
    started = time.monotonic()
    for name in ('train.jsonl', 'validation.jsonl', 'test.jsonl'):
        path = args.source / name
        digest, count = hashlib.sha256(), 0
        with path.open('rb') as stream:
            for line in stream:
                digest.update(line)
                row = json.loads(line)
                text = helper['normalized'](row['text'])
                if text in queries:
                    exact.update(queries[text])
                words = text.split()
                common_eight = helper['grams'](words, 8) & own_eight
                if common_eight:
                    shared_eight.update(common_eight)
                grams = helper['grams'](words, 3)
                intersections = Counter(at for gram in grams for at in index.get(gram, ()))
                for at, intersection in intersections.items():
                    score = intersection / (len(grams)+len(triples[at])-intersection)
                    if score > maximum:
                        maximum = score
                        nearest = {'sourceSplit': name, 'sourceID': row.get('id'),
                                   'queryIDs': sorted(queries[keys[at]]), 'score': score}
                    if score >= 0.35:
                        near.update(queries[keys[at]])
                count += 1; total += 1
                if total % 100000 == 0:
                    print(json.dumps({'rows': total, 'seconds': round(time.monotonic()-started, 1),
                                      'maximumTrigramJaccard': maximum, 'exactHitCases': len(exact),
                                      'sharedEightWordSequences': len(shared_eight), 'nearHitCases': len(near)}), flush=True)
        sources.append({'file': name, 'rows': count, 'sha256': digest.hexdigest()})
    receipt = {'scope': 'Rejection-only audit of original frozen inputs and approved targets vs every accepted clean train/validation/test source row; source text never used to author or train on QA targets.',
               'corpusSHA256': manifest['corpusSHA256'],
               'goldReviewSHA256': helper['digest']((corpus / 'GOLD_REVIEW.json').read_bytes()),
               'sourceRows': total, 'sourceFiles': sources, 'uniqueNormalizedQueries': len(queries),
               'normalizedExactHitCases': sorted(exact), 'sharedEightWordSequences': sorted(shared_eight),
               'nearHitCases': sorted(near), 'maximumTrigramJaccard': maximum, 'nearest': nearest,
               'rejectionThreshold': 0.35, 'elapsedSeconds': time.monotonic()-started,
               'status': 'passed' if not exact and not shared_eight and not near else 'overlap-needs-review',
               'sourceCorpusUploaded': False}
    args.out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(receipt, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
