"""Repository experiment guards; fixtures are not az-v1 training evidence."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from training.common import sha256
from training.repo_wordlm import load_snapshot, train
from training.wordlm import WordLM


class RepositoryWordLMTests(unittest.TestCase):
    def snapshot(self, root, targets=None):
        source = root / 'source'
        source.mkdir()
        manifest = {'version': 2, 'documents': [], 'partitions': {}}
        targets = targets or {'train': 'Kitab burada kitab burada.',
                              'validation': 'Məktəb buradadır.', 'test': 'Sınaq sözü.'}
        for split in ('train', 'validation', 'test'):
            row = {'documentId': split, 'split': split, 'target': targets[split],
                   'source': 'unit-fixture', 'license': 'unit-fixture-only'}
            path = source / (split + '.jsonl')
            # Synthetic variants must not multiply the count of clean training sentences.
            path.write_text(json.dumps(row) + '\n' + json.dumps({**row, 'input': 'noise'}) + '\n')
            manifest['documents'].append({'documentId': split, 'cluster': split, 'split': split})
            manifest['partitions'][split] = {'rows': 2, 'sha256': sha256(path)}
        frozen = root / 'frozen.json'
        frozen.write_text(json.dumps(manifest))
        (source / 'manifest.json').write_bytes(frozen.read_bytes())
        return source, frozen

    def test_deduplicates_variants_and_never_returns_test_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, frozen = self.snapshot(Path(tmp))
            clean, summaries, _, overlap = load_snapshot(source, frozen)
            self.assertEqual(set(clean), {'train', 'validation'})
            self.assertEqual(summaries['train']['uniqueCleanSentences'], 1)
            self.assertEqual(summaries['train']['augmentedRows'], 2)
            self.assertEqual(clean['train'], [['kitab', 'burada', 'kitab', 'burada']])
            self.assertEqual(overlap['train/test'], 0)

    def test_manifest_and_partition_tampering_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, frozen = self.snapshot(Path(tmp))
            (source / 'manifest.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'frozen'):
                load_snapshot(source, frozen)
            (source / 'manifest.json').write_bytes(frozen.read_bytes())
            (source / 'train.jsonl').write_text('{}\n')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                load_snapshot(source, frozen)

    def test_exact_target_crossing_splits_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, frozen = self.snapshot(Path(tmp), {'train': 'Kitab burada.',
                                                       'validation': 'Kitab burada.', 'test': 'Başqa mətn.'})
            with self.assertRaisesRegex(ValueError, 'clean target crosses splits'):
                load_snapshot(source, frozen)

    def test_numeric_templates_are_reported_without_changing_splits(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, frozen = self.snapshot(Path(tmp), {'train': 'Burada 20 nəfər yaşayır.',
                                                       'validation': 'Burada 30 nəfər yaşayır.', 'test': 'Başqa mətn.'})
            clean, summaries, _, overlap = load_snapshot(source, frozen)
            self.assertEqual(overlap['train/validation'], 1)
            self.assertEqual(summaries['validation']['uniqueCleanSentences'], 1)
            self.assertEqual(clean['train'], clean['validation'])

    def test_training_uses_train_vocabulary_and_preserves_existing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, frozen = self.snapshot(root)
            output = root / 'model'
            with patch('training.repo_wordlm.FROZEN_MANIFEST', frozen):
                report = train(source, output)
                model = WordLM(output / report['artifact'])
                try:
                    self.assertEqual(model.vocabulary, {'kitab', 'burada'})
                finally:
                    model.close()
                self.assertEqual(report['trainSentences'], 1)
                self.assertTrue(report['validation']['infinitePerplexity'])
                self.assertEqual(report['artifactSHA256'], sha256(output / 'wordlm.sqlite'))
                self.assertFalse(report['testUsedForTrainingOrSelection'])
                with self.assertRaisesRegex(ValueError, 'already exists'):
                    train(source, output)


if __name__ == '__main__':
    unittest.main()
