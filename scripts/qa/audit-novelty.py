"""Recheck frozen inputs and approved targets against the pinned legacy corpus."""
import gzip
import json
from pathlib import Path
import runpy


def main():
    helper = runpy.run_path(str(Path(__file__).with_name('build-novel-10000.py')))
    root = helper['ROOT']
    directory = root / 'data/qa/novel-10000-2026-11-04'
    content = (directory / 'cases.jsonl.gz').read_bytes()
    manifest = json.loads((directory / 'MANIFEST.json').read_text())
    assert helper['digest'](content) == manifest['gzipSHA256']
    raw = gzip.decompress(content)
    assert helper['digest'](raw) == manifest['corpusSHA256']
    rows = [json.loads(line) for line in raw.splitlines()]
    review = json.loads((directory / 'GOLD_REVIEW.json').read_text())
    assert review['baseCorpusSHA256'] == manifest['corpusSHA256']
    changes = {item['id']: item for item in review['changes']}
    old, refs, tri, eight, index, files = helper['legacy']()
    assert helper['digest']('\n'.join(old).encode()) == manifest['legacyNormalizedReferenceSHA256']
    assert files == manifest['legacyReferenceFiles']
    maximum = 0.0
    normalized_targets, normalized_inputs = set(), set()
    for row in rows:
        if row['id'] in changes:
            change = changes.pop(row['id'])
            assert row['expected'] == change['before']
            row['expected'] = change['after']
        # Mail greeting/signature boilerplate is not semantic scenario content.
        body = lambda value: value.split('\n\n')[1] if row['module'] == 'mail' else value
        for value in (body(row['input']), body(row['expected'])):
            valid, score, reason = helper['novelty'](value, refs, tri, eight, index)
            assert valid, (row['id'], reason, score)
            maximum = max(maximum, score)
        normalized_targets.add(helper['normalized'](body(row['expected'])))
        normalized_inputs.add(row['input'])
    assert not changes and len(normalized_targets) == len(normalized_inputs) == 10000
    report = {
        'scope': 'Assistant-authored compositional development scenarios vs pinned repository tests and evaluation data; not all texts on the internet or all raw training corpus.',
        'corpusSHA256': manifest['corpusSHA256'],
        'goldReviewSHA256': helper['digest']((directory / 'GOLD_REVIEW.json').read_bytes()),
        'legacyReferenceCommit': helper['BASE'], 'legacyReferences': len(old),
        'uniqueInputs': len(normalized_inputs), 'uniqueNormalizedTargets': len(normalized_targets),
        'normalizedExactOverlap': 0, 'sharedEightWordSequence': 0,
        'maximumTrigramJaccard': maximum, 'rejectionThreshold': 0.35,
        'retrieval': 'Shared word trigrams; grams in more than 512 references are excluded from retrieval, not from scoring.',
        'excludedCommonGrams': len(set().union(*tri)-set(index)),
        'intraSet': 'Event/continuation pairs are unique; authored clauses recur across combinations. No independent-scenario claim.',
    }
    (directory / 'NOVELTY_REVIEW.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
