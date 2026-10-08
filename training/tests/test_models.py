"""Random-initialized forward/gradient checks; no optimizer, corpus or saved weights."""
import importlib.util
import unittest

from training.common import ROOT, read_json


@unittest.skipUnless(importlib.util.find_spec('torch'), 'Install optional CPU PyTorch for model contract checks')
class ModelTests(unittest.TestCase):
    def setUp(self):
        import torch
        torch.set_num_threads(1)
        torch.manual_seed(123)
        self.torch = torch
        self.config = read_json(ROOT / 'training/configs/smoke.json')

    def test_charspell_candidate_mask_identity_and_gradients(self):
        from training.charspell.model import CharSpell, collate, loss, measure
        from collections import Counter
        model = CharSpell(self.config)
        self.assertLess(sum(p.numel() for p in model.parameters()), 5000000)
        rows = [{'input': 'kitb', 'left': 'yeni', 'right': 'burada', 'candidates': ['kitb', 'kitab'], 'label': 1},
                {'input': 'kitab', 'left': '', 'right': '', 'candidates': ['kitab'], 'label': 0}]
        batch = collate(rows, self.config, 'cpu')
        logits = model(batch)
        self.assertEqual(tuple(logits.shape), (2, 2))
        self.assertLess(logits[1, 1], -1000)
        value = loss(logits, batch)
        self.assertTrue(self.torch.isfinite(value))
        value.backward()  # Check trainability, without updating any weight.
        self.assertGreater(model.encoder.embedding.weight.grad.abs().sum(), 0)
        self.assertEqual(model.encoder.embedding.weight.grad[0].abs().sum(), 0)
        stats = Counter()
        measure(logits.detach(), batch, stats)
        self.assertEqual(stats['identityExamples'], 1)
        self.assertEqual(stats['identityFalsePositives'], 0)

    def test_punctcase_packing_ignores_padding_and_protected_labels(self):
        from training.punctcase.model import PunctCase, collate, loss
        model = PunctCase(self.config).eval()
        self.assertLess(sum(p.numel() for p in model.parameters()), 5000000)
        short = {'words': ['salam'], 'punctuation': [1], 'case': [1]}
        rows = [short, {'words': ['dünya', 'api'], 'punctuation': [4, -100], 'case': [0, -100]}]
        batch = collate(rows, self.config, 'cpu')
        logits = model(batch)
        alone = model(collate([short], self.config, 'cpu'))
        self.torch.testing.assert_close(logits[0][0, 0], alone[0][0, 0])
        self.assertEqual(batch['case'][0, 1].item(), -100)
        self.assertTrue(self.torch.isfinite(loss(logits, batch)))
        protected = collate([{'words': ['api'], 'punctuation': [-100], 'case': [-100]}], self.config, 'cpu')
        with self.assertRaisesRegex(ValueError, 'no unprotected'):
            loss(model(protected), protected)


if __name__ == '__main__':
    unittest.main()
