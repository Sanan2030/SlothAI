"""Assistant-authored unit fixtures; not training or human-reviewed data."""
import hashlib
import random
import sqlite3
import tempfile
from pathlib import Path
import unittest
from gate import overlap, register_keys
from source_index import SourceKeyIndex, SPLITS, text_keys


def encode(keys):
    return {b'\x00' + bytes.fromhex(key[9:]) if key.startswith('sentence:')
            else b'\x01' + bytes.fromhex(key) for key in keys}


class SourceGuardTests(unittest.TestCase):
    def audit(self, rows):
        with tempfile.TemporaryDirectory() as temporary:
            with SourceKeyIndex(Path(temporary) / 'index') as index:
                for row, (clean, noisy, split) in enumerate(rows):
                    index.add(clean, noisy, split, row)
                return index.finish(collect_owners=True)

    def test_normalization_is_identical_to_gate(self):
        for text in ['İnsan Işıq.', 'Bir iki üç dörd beş altı yeddi səkkiz doqquz.',
                     'API `x=1` 2026 https://example.org/ş', 'i\u0307ş məktəb', '',
                     'Məktəblərdə — dərslər, başlanır!']:
            expected = overlap.ngrams(text, 8) | {'sentence:' + overlap.sentence_key(text)}
            self.assertEqual(text_keys(text), encode(expected))

    def test_randomized_exact_owners_and_multiplicity(self):
        rng = random.Random(20261007)
        keys = [bytes([kind]) + hashlib.sha256(str(at).encode()).digest()
                for at in range(150) for kind in (0, 1)]
        rows, expected = [], 0
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE seen (hash BLOB PRIMARY KEY, split TEXT) WITHOUT ROWID')
            for _ in range(1200):
                clean, noisy = set(rng.sample(keys, rng.randrange(1, 15))), set(rng.sample(keys, rng.randrange(1, 15)))
                split = rng.randrange(3)
                rows.append((clean, noisy, split))
                typed = {'sentence:' + key[1:].hex() if key[0] == 0 else key[1:].hex()
                         for key in clean | noisy}
                expected += register_keys(db, typed, SPLITS[split])
            original_owners = dict(db.execute('SELECT hash, split FROM seen'))
        result = self.audit(rows)
        self.assertEqual(result['crossSplitCollisions'], expected)
        self.assertEqual(result['owners'], original_owners)

    def test_clean_noisy_collision_preserves_clean_owner(self):
        a, b = text_keys('Birinci müstəqil cümlə.'), text_keys('İkinci fərqli cümlə.')
        result = self.audit([(a, a, 0), (b, a, 1)])
        self.assertEqual(result['affectedRows'], {1})
        self.assertEqual(result['cleanCrossSplitKeys'], 0)
        self.assertEqual(self.audit([(a, a, 0), (b, b, 1)])['crossSplitCollisions'], 0)

    def test_later_clean_owner_rejects_earlier_foreign_noise(self):
        a, b = text_keys('Ayrı başlanğıc.'), text_keys('Saxlanılan hədəf.')
        result = self.audit([(a, b, 0), (b, b, 1)])
        self.assertEqual(result['affectedRows'], {0})

    def test_noisy_noisy_rejects_both_sides(self):
        a, b, noisy = map(text_keys, ['Fərqli hədəf bir.', 'Başqa hədəf iki.', 'Ortaq sintetik giriş.'])
        result = self.audit([(a, noisy, 0), (b, noisy, 2)])
        self.assertEqual(result['affectedRows'], {0, 1})
        self.assertEqual(self.audit([(a, a, 0), (b, b, 2)])['crossSplitCollisions'], 0)

    def test_clean_clean_is_reported_not_repaired(self):
        a = text_keys('Eyni təmiz hədəf.')
        result = self.audit([(a, a, 0), (a, a, 1)])
        self.assertEqual(result['cleanCrossSplitKeys'], 1)
        self.assertEqual(result['affectedRows'], set())

    def test_typed_keys_do_not_collide(self):
        digest = hashlib.sha256(b'unit').digest()
        result = self.audit([({b'\x00' + digest}, {b'\x00' + digest}, 0),
                             ({b'\x01' + digest}, {b'\x01' + digest}, 1)])
        self.assertEqual(result['crossSplitCollisions'], 0)

    def test_malformed_partition_fails_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            with SourceKeyIndex(Path(temporary) / 'index') as index:
                (index.directory / '000.keys').write_bytes(b'bad')
                with self.assertRaises(ValueError):
                    index.finish()

    def test_guard_still_requires_real_minimum(self):
        import json
        from guard_source_pairs import guard_source_pairs
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'MANIFEST.json').write_text(json.dumps({'minimumCleanSentences': 5000000, 'cleanSentences': 3}))
            with self.assertRaises(ValueError):
                guard_source_pairs(root, root / 'output')
            self.assertFalse((root / 'output').exists())


if __name__ == '__main__':
    unittest.main()
