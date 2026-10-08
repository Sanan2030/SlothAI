"""Compare complete gate reports to the pinned pre-partition SQL implementation.

Tiny assistant-authored unit fixtures and mock approval receipts are not training
data or actual corpus-use approval. The real five-million minimum stays fixed.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import types
from common import sha256, write_json
from gate import gate

REFERENCE = 'c5c850281a0fd3da75620af156c284acc3b0e50b'


def verify():
    original = types.ModuleType('sql_gate_reference')
    original.__file__ = str(Path(__file__).with_name('gate.py').resolve())
    source = subprocess.check_output(['git', 'show', REFERENCE + ':scripts/data/gate.py'], text=True)
    exec(compile(source, original.__file__, 'exec'), original.__dict__)
    scenarios = []
    with tempfile.TemporaryDirectory() as temporary:
        for collision in (False, True):
            directory = Path(temporary) / str(collision)
            directory.mkdir()
            sources = []
            splits = ('train', 'validation', 'test')
            texts = ('Müəllim yeni dərsi diqqətlə hazırladı.',
                     'Bağban ağacın budaqlarını ehtiyatla yoxladı.',
                     'Mühəndis hesabatın strukturunu ayrıca müəyyənləşdirdi.')
            for number, split in enumerate(splits):
                source_id = 'unit-source-' + str(number)
                text = texts[0] if collision else texts[number]
                row = {'id': source_id + ':0', 'documentId': source_id + ':doc',
                       'sourceId': source_id, 'text': text, 'protectedTerms': []}
                pair = {**row, 'input': text, 'target': text, 'category': 'identity',
                        'requestedCategory': 'identity', 'errorOrigin': 'synthetic'}
                for name, value in ((split + '.jsonl', row), (split + '-pairs.jsonl', pair)):
                    (directory / name).write_text(json.dumps(value, ensure_ascii=False) + '\n')
                sources.append({'id': source_id, 'name': 'assistant-authored unit fixture',
                    'url': 'https://example.invalid/unit', 'license': 'unit-fixture-only',
                    'licenseEvidence': 'Not actual source approval', 'collectedAt': '2026-10-08',
                    'sha256': 'a' * 64, 'approval': {'status': 'approved',
                    'by': 'repository-owner', 'evidence': 'Mock unit-test receipt only'}})
            manifest = {'minimumCleanSentences': 5000000, 'cleanSentences': 3,
                'sources': sources, 'assignments': {item['id']: split for item, split in zip(sources, splits)},
                'splitCounts': {split: 1 for split in splits},
                'files': {path.name: {'bytes': path.stat().st_size, 'sha256': sha256(path)}
                          for path in directory.glob('*.jsonl')}}
            write_json(directory / 'MANIFEST.json', manifest)
            before, after = original.gate(directory), gate(directory)
            if before != after:
                raise ValueError('Complete gate report differs from pinned SQL reference')
            scenarios.append({'crossSplitFixture': collision, 'byteEquivalentReport': True,
                              'status': after['status'], 'crossSplitCollisions': after['crossSplitCollisions'],
                              'minimumNotLowered': after['minimumCleanSentences']})
    return {'fixtureProvenance': 'Assistant-authored unit fixtures, not training data or actual approval',
            'referenceCommit': REFERENCE, 'scenarios': scenarios}


if __name__ == '__main__':
    report = verify()
    write_json('docs/stage1/collection/gate-backend-parity.json', report)
    print(json.dumps(report, indent=2))
