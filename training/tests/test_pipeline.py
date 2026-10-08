import gzip
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from training.common import ROOT, CORPUS, PREPARED_FILES, gzip_writer, import_parts, indices, inspect_corpus, receipt, safe_output, sha256, verify_files, verify_prepared
from training.candidates import CandidateIndex, build_index, distance
from training.prepare import prepare, selected_rows, spelling_examples, eligible_words
from training.run import batches, resume_report, validate_full_smoke
from training.text import fold, lower, tag_sentence
from training.wordlm import WordLM, build
from collections import Counter


class PipelineTests(unittest.TestCase):
    def test_accepted_receipt_and_missing_files_fail_closed(self):
        accepted, _ = receipt()
        self.assertEqual(accepted['manifestSHA256'], 'dcfbaf41c84d3eb1c92ad47ff3a633d5fae692a6075597ac579298f48cccb2fd')
        with tempfile.TemporaryDirectory() as tmp:
            state = inspect_corpus(tmp)
            self.assertEqual(state['status'], 'blocked')
            self.assertEqual(len(state['missingFiles']), 7)
            self.assertFalse(state['trainingStarted'])
            with self.assertRaisesRegex(ValueError, 'Missing accepted'):
                verify_files(tmp)
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_sampling_is_reproducible_and_within_split(self):
        a = indices(1000, 100, 123)
        self.assertEqual(a, indices(1000, 100, 123))
        self.assertNotEqual(a, indices(1000, 100, 124))
        self.assertEqual(len(a), 100)
        self.assertTrue(all(0 <= value < 1000 for value in a))
        self.assertIsNone(indices(1000, None, 123))

    def test_output_cannot_replace_corpus_or_application(self):
        for path in [CORPUS, CORPUS / 'run', ROOT, ROOT / 'public/models/az-v1', ROOT / 'lib/editor']:
            with self.assertRaises(ValueError):
                safe_output(path)
        self.assertEqual(safe_output(ROOT / 'artifacts/training/test'), ROOT / 'artifacts/training/test')

    def test_selected_rows_enforce_alignment_and_source_split(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            clean = {'id': 'unit:0', 'sourceId': 'mock-train', 'text': 'a b'}
            pair = {**clean, 'target': 'a b', 'input': 'a c', 'errorOrigin': 'synthetic'}
            manifest = {'splitCounts': {'train': 1}, 'assignments': {'mock-train': 'train'}}
            (root / 'train.jsonl').write_text(json.dumps(clean) + '\n')
            path = root / 'train-pairs.jsonl'
            path.write_text(json.dumps(pair) + '\n')
            self.assertEqual(len(list(selected_rows(root, 'train', None, manifest))), 1)
            pair['sourceId'] = 'mock-validation'
            path.write_text(json.dumps(pair) + '\n')
            with self.assertRaisesRegex(ValueError, 'alignment'):
                list(selected_rows(root, 'train', None, manifest))
            path.write_text('')
            with self.assertRaisesRegex(ValueError, 'Unaligned'):
                list(selected_rows(root, 'train', None, manifest))

    def test_atomic_import_checks_compressed_and_raw_integrity(self):
        # Local mocked receipts test the importer, never the accepted corpus gate.
        with tempfile.TemporaryDirectory() as tmp:
            root, payload = Path(tmp), b'{"fixture":"unit-only"}\n'
            source, metadata = root / 'parts', root / 'receipt'
            source.mkdir(); metadata.mkdir()
            gz = source / 'train.jsonl.gz'
            gz.write_bytes(gzip.compress(payload, mtime=0))
            manifest_path = metadata / 'MANIFEST.json'
            manifest_path.write_text('{"fixture":"not-a-corpus"}')
            accepted = {'manifestSHA256': sha256(manifest_path)}
            manifest = {'files': {'train.jsonl': {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}}, 'splitCounts': {}}
            parts = {'parts': [{'file': gz.name, 'uncompressedFile': 'train.jsonl', 'bytes': gz.stat().st_size, 'sha256': sha256(gz)}]}
            (metadata / 'compressed-parts.json').write_text(json.dumps(parts))
            with patch('training.common.receipt', return_value=(accepted, manifest)), patch('training.common.ACCEPTED', metadata):
                destination = root / 'out'
                import_parts(source, destination)
                self.assertEqual((destination / 'train.jsonl').read_bytes(), payload)
                with self.assertRaisesRegex(ValueError, 'already exists'):
                    import_parts(source, destination)
                gz.write_bytes(b'wrong bytes')
                with self.assertRaisesRegex(ValueError, 'Gzip integrity'):
                    import_parts(source, root / 'bad')
                self.assertFalse((root / 'bad').exists())

    def test_preparation_routes_clean_text_and_does_not_read_test_rows(self):
        # Miniature assistant-authored fixture with mocked receipts/audit.
        # It never starts an optimizer and must not be represented as a data gate/smoke run.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            corpus = root / 'corpus'; corpus.mkdir()
            for split, source, text, noisy in [('train', 'unit-train', 'Kitab burada.', 'Kitb burada.'),
                                               ('validation', 'unit-val', 'Dünya gözəldir!', 'Dunya gozeldir!')]:
                clean = {'id': 'unit:' + split, 'sourceId': source, 'text': text, 'protectedTerms': []}
                pair = {**clean, 'input': noisy, 'target': text, 'category': 'deletion', 'errorOrigin': 'synthetic'}
                (corpus / f'{split}.jsonl').write_text(json.dumps(clean, ensure_ascii=False) + '\n')
                (corpus / f'{split}-pairs.jsonl').write_text(json.dumps(pair, ensure_ascii=False) + '\n')
            (corpus / 'test.jsonl').write_text('INVALID TEST DATA MUST NOT BE READ')
            config = json.loads((ROOT / 'training/configs/smoke.json').read_text())
            config['maxVocabulary'] = 16  # Keep the routing fixture independent of dictionary size.
            project = root / 'project'
            dictionary = project / 'lib/editor/generated/az-words.json'
            dictionary.parent.mkdir(parents=True)
            dictionary.write_text(json.dumps(['kitab', 'burada', 'dünya', 'gözəldir'], ensure_ascii=False))
            manifest = {'splitCounts': {'train': 1, 'validation': 1}, 'assignments': {'unit-train': 'train', 'unit-val': 'validation'}}
            with patch('training.prepare.receipt', return_value=({'manifestSHA256': 'mock-only'}, manifest)), \
                 patch('training.common.verify_files'), patch('training.prepare.run_gate'), patch('training.prepare.ROOT', project):
                result = prepare(corpus, root / 'prepared', config)
            self.assertFalse(result['trainingStarted'])
            self.assertEqual(set(result['splits']), {'train', 'validation'})
            self.assertEqual(result['splits']['train']['sentences'], 1)
            with gzip.open(root / 'prepared/wordlm-train.jsonl.gz', 'rt') as stream:
                self.assertEqual(json.loads(stream.readline())['words'], ['kitab', 'burada'])
            with gzip.open(root / 'prepared/punctcase-train.jsonl.gz', 'rt') as stream:
                labels = json.loads(stream.readline())
                self.assertEqual(labels['words'], ['kitab', 'burada'])
                self.assertEqual(labels['punctuation'], [0, 2])

    def test_az_fold_and_distance_cover_edit_categories(self):
        self.assertEqual(lower('İŞIQ IŞIQ'), 'işıq ışıq')
        self.assertEqual(fold('əçğıöşüqx'), 'ecgiosukh')
        for a, b, value in [('kitb', 'kitab', 1), ('kitabb', 'kitab', 1), ('kitaab', 'kitab', 1),
                            ('ktib', 'kitab', 2), ('kita', 'duman', 3), ('guneş', 'günəş', 0)]:
            self.assertEqual(distance(fold(a), fold(b)), value, (a, b))

    def test_candidate_identity_misses_and_protection(self):
        config = json.loads((ROOT / 'training/configs/smoke.json').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'index.sqlite'
            build_index(path, [['kitab', 'günəş', 'kitab']], ['kitab', 'günəş'], config)
            index = CandidateIndex(path)
            try:
                self.assertIn('kitab', index.lookup('kitb'))
                self.assertIn('günəş', index.lookup('gunes'))
                clean = {'id': 'unit:0', 'sourceId': 'mock-train', 'text': 'kitab', 'protectedTerms': []}
                stats = Counter()
                rows = list(spelling_examples(clean, {'input': 'kitb', 'target': 'kitab', 'category': 'deletion'}, index, config, stats))
                self.assertEqual(rows[0]['candidates'][0], 'kitb')
                self.assertEqual(rows[0]['label'], rows[0]['candidates'].index('kitab'))
                identity = list(spelling_examples(clean, {'input': 'kitab', 'target': 'kitab', 'category': 'identity'}, index, config, Counter()))
                self.assertEqual(identity[0]['label'], 0)
                missed = Counter()
                rows = list(spelling_examples(clean, {'input': 'kitb', 'target': 'qeyriadi', 'category': 'deletion'}, index, config, missed))
                self.assertEqual(rows, [])
                self.assertEqual(missed['candidateMisses'], 1)
                clean['protectedTerms'] = ['kitab']
                self.assertEqual(eligible_words(clean), [])
            finally:
                index.close()

    def test_clean_punctuation_labels_and_existing_punctuation(self):
        value = tag_sentence('Salam, dünya! API', [(14, 17)])
        self.assertEqual(value['words'], ['salam', 'dünya', 'apı'])
        self.assertEqual(value['punctuation'], [1, 4, -100])
        self.assertEqual(value['case'], [1, 0, -100])
        self.assertEqual(tag_sentence('Söz... növbəti', [])['punctuation'][0], -100)

    def test_deterministic_gzip_and_bounded_shuffle_no_loss(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = [Path(tmp) / f'{i}.gz' for i in (1, 2)]
            for path in paths:
                with gzip_writer(path) as stream:
                    for i in range(101):
                        stream.write(json.dumps({'id': i}) + '\n')
            self.assertEqual(sha256(paths[0]), sha256(paths[1]))
            result = list(batches(paths[0], 7, 9, 12, True))
            flat = [row['id'] for batch in result for row in batch]
            self.assertEqual(sorted(flat), list(range(101)))
            self.assertNotEqual(flat, list(range(101)))
            self.assertEqual(result, list(batches(paths[0], 7, 9, 12, True)))

    def test_prepared_artifact_tamper_is_rejected(self):
        # Mocked receipt/file metadata is a technical fixture, not a passing corpus gate.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            accepted = {'manifestSHA256': 'm', 'cleanSentences': 5000000}
            manifest = {'files': {}, 'splitCounts': {'train': 1, 'validation': 1}}
            (root / 'data-gate.json').write_text(json.dumps({'status': 'passed', 'cleanSentences': 5000000, 'crossSplitCollisions': 0}))
            (root / 'data-gate-receipt.json').write_text(json.dumps({'manifestSHA256': 'm', 'files': {}, 'corpus': tmp,
                                                                 'reportSHA256': sha256(root / 'data-gate.json')}))
            (root / 'config.json').write_text(json.dumps({'seed': 1}))
            payload = root / 'charspell-train.jsonl.gz'
            payload.write_bytes(b'unit only')
            for name in PREPARED_FILES:
                if not (root / name).exists():
                    (root / name).write_bytes(b'unit-only-artifact')
            metadata = {'status': 'prepared', 'corpus': tmp, 'manifestSHA256': 'm', 'seed': 1, 'hyperparameters': {'seed': 1},
                        'splits': {'train': {'sentences': 1}, 'validation': {'sentences': 1}},
                        'files': {name: {'bytes': (root / name).stat().st_size, 'sha256': sha256(root / name)} for name in PREPARED_FILES}}
            (root / 'prepared.json').write_text(json.dumps(metadata))
            with patch('training.common.verify_files', return_value=(accepted, manifest)):
                self.assertEqual(verify_prepared(root)['status'], 'prepared')
                payload.write_bytes(b'tampered!')
                with self.assertRaisesRegex(ValueError, 'artifact integrity'):
                    verify_prepared(root)

    def test_resume_guard_binds_data_and_checkpoints(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'prepared.json').write_text('technical fixture only')
            (root / 'last.pt').write_bytes(b'not-a-trained-model')
            (root / 'best.pt').write_bytes(b'not-a-trained-model')
            metadata = {'hyperparameters': {'seed': 1}, 'manifestSHA256': 'unit-only'}
            report = {'status': 'interrupted', 'stage': 'charspell', **metadata,
                      'preparedSHA256': sha256(root / 'prepared.json'), 'epochs': [{'epoch': 1}], 'selectedEpoch': 1,
                      'lastCheckpointSHA256': sha256(root / 'last.pt'), 'bestCheckpointSHA256': sha256(root / 'best.pt')}
            (root / 'report.json').write_text(json.dumps(report))
            self.assertEqual(resume_report('charspell', root, root, metadata)['status'], 'interrupted')
            report['status'] = 'completed'
            (root / 'report.json').write_text(json.dumps(report))
            with self.assertRaisesRegex(ValueError, 'Resume requires'):
                resume_report('charspell', root, root, metadata)
            report['status'] = 'interrupted'
            (root / 'report.json').write_text(json.dumps(report))
            (root / 'last.pt').write_bytes(b'tampered checkpoint')
            with self.assertRaisesRegex(ValueError, 'Resume requires'):
                resume_report('charspell', root, root, metadata)

    def test_full_training_requires_same_stage_successful_smoke(self):
        metadata = {'profile': 'full', 'manifestSHA256': 'm'}
        with self.assertRaisesRegex(ValueError, 'smoke-receipt'):
            validate_full_smoke('charspell', metadata, None)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'report.json'
            path.write_text(json.dumps({'status': 'failed', 'profile': 'smoke', 'stage': 'charspell'}))
            with self.assertRaisesRegex(ValueError, 'successful run'):
                validate_full_smoke('charspell', metadata, path)

    def test_kn_probability_mass_continuation_counts_and_unseen_class(self):
        # Symbolic count fixture, not a language training run or smoke receipt.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'lm.sqlite'
            build(path, [['a', 'b'], ['a', 'c'], ['b', 'c']], {'a', 'b', 'c'})
            lm = WordLM(path)
            try:
                for context in [('<s>', '<s>'), ('<s>', 'a'), ('a', 'b'), ('unseen', 'unseen')]:
                    mass = sum(lm.probability(*context, word) for word in ['a', 'b', 'c', '</s>'])
                    self.assertAlmostEqual(mass, 1.0)
                self.assertGreater(lm.probability('<s>', 'a', 'b'), 0)
                self.assertFalse(lm.perplexity([['a', 'b']])['infinitePerplexity'])
                self.assertTrue(lm.perplexity([['unseen']])['infinitePerplexity'])
            finally:
                lm.close()


if __name__ == '__main__':
    unittest.main()
