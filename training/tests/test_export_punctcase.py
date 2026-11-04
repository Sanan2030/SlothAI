"""Random-weight technical export fixtures; no optimizer or corpus fitting."""
import importlib.util
import tempfile
from pathlib import Path
import unittest

from training.common import ROOT, read_json, receipt, sha256, write_json


@unittest.skipUnless(importlib.util.find_spec('torch'), 'Install optional CPU PyTorch for export contracts')
class PunctCaseExportTests(unittest.TestCase):
    def fixture(self, root):
        import torch
        from training.punctcase.model import PunctCase
        torch.manual_seed(1)
        config = read_json(ROOT / 'training/configs/full.json')
        accepted, manifest = receipt()
        run = root / 'run'
        run.mkdir()
        model = PunctCase(config)
        torch.save({'state_dict': model.state_dict(), 'config': config, 'stage': 'punctcase',
                    'epoch': 1, 'manifestSHA256': accepted['manifestSHA256']}, run / 'best.pt')
        write_json(run / 'report.json', {'fixturePurpose': 'Unit-only, not measured training',
            'status': 'completed', 'stage': 'punctcase', 'profile': 'full', 'testRead': False,
            'manifestSHA256': accepted['manifestSHA256'],
            'sentences': {s: manifest['splitCounts'][s] for s in ('train', 'validation')},
            'selectedEpoch': 1, 'hyperparameters': config, 'artifactSHA256': sha256(run / 'best.pt')})
        return run

    def test_export_is_deterministic_and_preserves_checkpoint_identity(self):
        from training.export_punctcase import export
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.fixture(root)
            first = export(run, root / 'a', root / 'golden-a.json')
            second = export(run, root / 'b', root / 'golden-b.json')
            self.assertEqual(first, second)
            self.assertEqual(first['parameters'], 39434)
            self.assertEqual(first['bytes'], 39434 * 4)
            self.assertEqual(first['sourceCheckpointSHA256'], sha256(run / 'best.pt'))
            self.assertEqual(sha256(root / 'a/weights.json'), sha256(root / 'b/weights.json'))
            self.assertFalse(first['trainingStarted'])

    def test_corrupt_checkpoint_is_rejected_before_creating_export(self):
        from training.export_punctcase import export
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.fixture(root)
            with (run / 'best.pt').open('ab') as output:
                output.write(b'corrupt fixture')
            with self.assertRaisesRegex(ValueError, 'hash-matching'):
                export(run, root / 'out', root / 'golden.json')
            self.assertFalse((root / 'out').exists())
