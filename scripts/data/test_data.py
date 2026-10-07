import unittest
import json
import hashlib
import tempfile
from pathlib import Path
from prepare import prepare
from gate import gate
from common import sha256
from common import az_lower, source_assignments
from noise import corrupt, KINDS, pair_seed
from gate import overlap


class DataTests(unittest.TestCase):
    def test_az_case(self):
        self.assertEqual(az_lower('İnsan Işıq'), 'insan ışıq')

    def test_split(self):
        ids = ['news-a', 'book-b', 'archive-c', 'journal-d']
        self.assertEqual(source_assignments(ids), source_assignments(reversed(ids)))
        self.assertEqual(set(source_assignments(ids).values()), {'train', 'validation', 'test'})
        with self.assertRaises(ValueError):
            source_assignments(['one'])

    def test_noise_categories_and_protection(self):
        text = 'Müəllim məktəblərin hazırlığını ölçərək, çətin məşqin nəticələrini araşdırdı. API https://example.org/a test@example.org 2026 `const x=1`'
        for kind in KINDS:
            changed = False
            for seed in range(100):
                pair = corrupt(text, seed, kind)
                self.assertEqual(pair, corrupt(text, seed, kind))
                self.assertEqual(pair['target'], text)
                for term in ['API', 'https://example.org/a', 'test@example.org', '2026', '`const x=1`']:
                    self.assertIn(term, pair['input'])
                changed |= pair['input'] != text
            self.assertEqual(changed, kind != 'identity', kind)
        self.assertNotEqual(pair_seed(1, 'doc-a', 0), pair_seed(1, 'doc-b', 0))

    def test_overlap(self):
        report = overlap.compare([{'text': 'Bir iki üç dörd beş altı yeddi səkkiz doqquz.'}], ['Bir iki üç dörd beş altı yeddi səkkiz on.'])
        self.assertEqual(report['overlapRows'], 1)
        self.assertEqual(overlap.compare([], [])['status'], 'not-exercised')
        self.assertEqual(overlap.compare([{'text': 'Tamamilə ayrı müstəqil cümlə.'}], ['Digər sözlər burada yerləşir.'])['status'], 'passed')
        documents = [{'documentId': 'unit:1', 'sentences': ['Tamamilə ayrı müstəqil cümlə.', 'Digər sözlər burada yerləşir.']}]
        self.assertEqual(overlap.compare(overlap.document_sentences(documents), ['Digər sözlər burada yerləşir.'])['overlapRows'], 1)
        with self.assertRaises(ValueError):
            list(overlap.document_sentences([{'sentences': 'not an array'}]))

    def test_prepare_integrity_and_fail_closed_gate(self):
        # Tiny assistant-authored unit fixtures are not training data or approval receipts.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            documents = [{'sourceId': source, 'documentId': source + ':1', 'language': 'az', 'sentences': [text]}
                         for source, text in [('a', 'Müəllim yeni dərsi diqqətlə hazırladı.'),
                                              ('b', 'Tədqiqatçı nəticələri ayrıca cədvəldə təqdim etdi.'),
                                              ('c', 'Bağban səhər ağacların budaqlarını yoxladı.')]]
            corpus = root / 'input.jsonl'
            corpus.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in documents))
            metadata = {'inputSHA256': sha256(corpus), 'sources': []}
            for row in documents:
                canonical = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
                metadata['sources'].append({'id': row['sourceId'], 'name': 'mock source '+row['sourceId'], 'url': 'https://example.invalid/unit-fixture',
                    'license': 'unit-fixture-only', 'licenseEvidence': 'unit-test not actual permission',
                    'collectedAt': '2026-10-07T00:00:00Z', 'sha256': hashlib.sha256(canonical.encode()).hexdigest(),
                    'approval': {'status': 'approved', 'by': 'repository-owner', 'evidence': 'mock unit receipt only'}})
            sources = root / 'sources.json'
            sources.write_text(json.dumps(metadata))
            manifest = prepare(corpus, sources, root / 'out')
            self.assertEqual(manifest['cleanSentences'], 3)
            self.assertEqual(gate(root / 'out')['status'], 'failed')  # Never relax the five-million gate.
            with self.assertRaises(ValueError):
                prepare(corpus, sources, root / 'out')
            metadata['sources'][0]['sha256'] = '0' * 64
            sources.write_text(json.dumps(metadata))
            with self.assertRaises(ValueError):
                prepare(corpus, sources, root / 'bad')
            self.assertFalse((root / 'bad').exists())
            metadata['sources'][0]['approval']['status'] = 'pending'
            sources.write_text(json.dumps(metadata))
            with self.assertRaises(ValueError):
                prepare(corpus, sources, root / 'unapproved')


if __name__ == '__main__':
    unittest.main()
