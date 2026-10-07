"""Remove only cross-split synthetic-input ambiguity; never read evaluation data."""
import argparse
from collections import Counter
import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from common import MINIMUM_SENTENCES, read_jsonl, sha256, write_json
from noise import KINDS
from source_index import SourceKeyIndex, SPLITS, text_keys


def guard_source_pairs(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    manifest = json.loads((source / 'MANIFEST.json').read_text())
    if manifest.get('minimumCleanSentences') != MINIMUM_SENTENCES or manifest.get('cleanSentences', 0) < MINIMUM_SENTENCES:
        raise ValueError('Source guard requires the unchanged five-million minimum')
    if output.exists():
        raise ValueError('Do not overwrite an existing corpus')
    if set(manifest.get('assignments', {}).values()) != set(SPLITS):
        raise ValueError('All three independent source splits are required')
    for entry in manifest.get('sources', []):
        approval = entry.get('approval', {})
        if approval.get('status') != 'approved' or approval.get('by') != 'repository-owner' or not approval.get('evidence'):
            raise ValueError('Actual owner source-use approval is required')
    for split in SPLITS:
        for name in (f'{split}.jsonl', f'{split}-pairs.jsonl'):
            path = source / name
            receipt = manifest['files'][name]
            if path.stat().st_size != receipt['bytes'] or sha256(path) != receipt['sha256']:
                raise ValueError(f'Original corpus integrity mismatch: {name}')
    with tempfile.TemporaryDirectory(prefix='sloth-source-guard-') as temporary:
        temporary = Path(temporary)
        counts = Counter()
        row_index = 0
        with SourceKeyIndex(temporary / 'keys') as index:
            for split_number, split in enumerate(SPLITS):
                for pair in read_jsonl(source / f'{split}-pairs.jsonl'):
                    if (not isinstance(pair.get('input'), str) or not isinstance(pair.get('target'), str)
                            or pair.get('text') != pair['target']
                            or manifest['assignments'].get(pair.get('sourceId')) != split
                            or pair.get('category') not in KINDS or pair.get('requestedCategory') not in KINDS
                            or pair.get('errorOrigin') != 'synthetic'):
                        raise ValueError('Invalid original source pair')
                    index.add(text_keys(pair['target']), text_keys(pair['input']), split_number, row_index)
                    row_index += 1
                    counts[split] += 1
                    if row_index % 100000 == 0:
                        print(json.dumps({'stage': 'source-only-key-partitioning', 'rows': row_index}), flush=True)
            if row_index != manifest['cleanSentences'] or dict(counts) != manifest['splitCounts']:
                raise ValueError('Source pair counts disagree with immutable clean corpus')
            def progress(done, total):
                if done % 16 == 0:
                    print(json.dumps({'stage': 'source-only-key-audit', 'partitions': done, 'total': total}), flush=True)
            audit = index.finish(progress=progress)
        if audit['cleanCrossSplitKeys']:
            raise ValueError('Clean targets overlap across splits; do not repair or remove their text')
        affected = audit['affectedRows']
        staged = temporary / 'prepared'
        staged.mkdir()
        requested, realized = Counter(), Counter()
        replacements = []
        row_index = 0
        for split in SPLITS:
            # Share immutable clean files without duplicating gigabytes of text.
            os.link(source / f'{split}.jsonl', staged / f'{split}.jsonl')
            with (staged / f'{split}-pairs.jsonl').open('w', encoding='utf-8') as handle:
                for pair in read_jsonl(source / f'{split}-pairs.jsonl'):
                    if row_index in affected:
                        replacements.append({'id': pair['id'], 'sourceId': pair['sourceId'],
                                             'split': split, 'previousCategory': pair['category']})
                        pair['input'] = pair['target']
                        pair['category'] = 'identity'
                        pair['sourceGuardFallback'] = 'cross-split synthetic input; target preserved'
                    requested[pair['requestedCategory']] += 1
                    realized[pair['category']] += 1
                    handle.write(json.dumps(pair, ensure_ascii=False) + '\n')
                    row_index += 1
        if len(replacements) != len(affected):
            raise ValueError('Not every conflicting synthetic input was replaced')
        updated = copy.deepcopy(manifest)
        updated['createdAt'] = datetime.now(timezone.utc).isoformat()
        updated['sourceGuard'] = {
            'policy': 'Exact source-only sentence/8gram index; foreign synthetic inputs fall back to unchanged target',
            'evaluationDataRead': False, 'originalManifestSHA256': sha256(source / 'MANIFEST.json'),
            'originalCrossSplitCollisions': audit['crossSplitCollisions'],
            'cleanCrossSplitKeys': audit['cleanCrossSplitKeys'], 'identityFallbacks': len(affected),
            'replacements': replacements, 'keyRecords': audit['records'],
            'maximumPartitionBytes': audit['maximumPartitionBytes'], 'examples': audit['examples'],
            'proof': 'Only input keys are removed; added identity keys were already indexed as immutable clean keys. All foreign inputs sharing any clean key and both sides of noise/noise collisions are rejected. A fresh full gate remains mandatory.'}
        updated['noise']['requestedCounts'] = {kind: requested[kind] for kind in KINDS}
        updated['noise']['realizedCounts'] = {kind: realized[kind] for kind in KINDS}
        updated['noise']['realizedShares'] = {kind: realized[kind] / row_index for kind in KINDS}
        updated['files'] = {path.name: {'bytes': path.stat().st_size, 'sha256': sha256(path)}
                            for path in sorted(staged.glob('*.jsonl'))}
        for split in SPLITS:
            name = f'{split}.jsonl'
            if updated['files'][name] != manifest['files'][name]:
                raise ValueError('Immutable clean target file changed during source guarding')
        updated['overlapStatus'] = 'not-checked-after-source-guard'
        updated['gate'] = 'blocked-until-fresh-full-audit'
        write_json(staged / 'MANIFEST.json', updated)
        output.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staged, output)
        return updated['sourceGuard']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args()
    print(json.dumps(guard_source_pairs(args.source, args.output), indent=2))
