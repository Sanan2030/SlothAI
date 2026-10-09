"""Exact accelerator parity on technical fixtures, never evaluation/training data."""
import itertools
import random
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import training.candidates as candidates


class CandidateDistanceTests(unittest.TestCase):
    def test_python_fallback_preserves_cutoffs_and_adjacent_swaps(self):
        cases = [('', '', 0), ('', 'əç', 2), ('kitb', 'kitab', 1),
                 ('ab', 'ba', 1), ('bə', 'əb', 1), ('əçğ', 'çəğ', 1),
                 ('CA', 'ABC', 3), ('🙂ə', 'ə🙂', 1), ('ə', 'e\u0301', 2)]
        with patch.object(candidates, '_native_osa_distance', None):
            for left, right, expected in cases:
                for cutoff in range(4):
                    with self.subTest(left=left, right=right, cutoff=cutoff):
                        self.assertEqual(candidates.distance(left, right, cutoff),
                                         min(expected, cutoff + 1))

    @unittest.skipIf(candidates._native_osa_distance is None, 'Optional RapidFuzz is not installed')
    def test_native_matches_original_on_unicode_and_cutoffs(self):
        # Exhaustive small strings exercise repeated letters and transpositions.
        words = [''.join(chars) for size in range(4)
                 for chars in itertools.product('aəç', repeat=size)]
        pairs = list(itertools.product(words, repeat=2))
        rng = random.Random(20261007)
        alphabet = 'aəçğıöşüİIqx🙂\u0301'
        pairs.extend((''.join(rng.choices(alphabet, k=rng.randrange(33))),
                      ''.join(rng.choices(alphabet, k=rng.randrange(33))))
                     for _ in range(200))
        pairs.extend([('CA', 'ABC'), ('🙂ə', 'ə🙂'), ('a' * 32, 'a' * 31 + 'ə'),
                      ('ab' * 16, 'ba' * 16), ('ə', 'e\u0301')])
        for left, right in pairs:
            for cutoff in (0, 1, 2, 3, 8):
                expected = candidates._python_distance(left, right, cutoff)
                self.assertEqual(candidates.distance(left, right, cutoff), expected,
                                 (left, right, cutoff))

    @unittest.skipIf(candidates._native_osa_distance is None, 'Optional RapidFuzz is not installed')
    def test_metric_remains_osa_instead_of_unrestricted_damerau(self):
        from rapidfuzz.distance import DamerauLevenshtein
        self.assertEqual(DamerauLevenshtein.distance('CA', 'ABC'), 2)
        self.assertEqual(candidates._python_distance('CA', 'ABC'), 3)
        self.assertEqual(candidates.distance('CA', 'ABC'), 3)

    @unittest.skipIf(candidates._native_osa_distance is None, 'Optional RapidFuzz is not installed')
    def test_candidate_lists_preserve_rank_caps_and_identity_exclusion(self):
        vocabulary = {'kitab': 5, 'kitba': 3, 'ktib': 2, 'kitablar': 1,
                      'günəş': 4, 'güneş': 2, 'gunes': 1,
                      'daş': 4, 'das': 4, 'şad': 4, 'ad': 1}
        sentences = [[word] * frequency for word, frequency in vocabulary.items()]
        dictionary = [*vocabulary, 'kitb', 'qx', 'kh']
        config = {'maxVocabulary': 100, 'prefixLength': 7}
        queries = [(word, limit) for word in ('kitb', 'kitab', 'kitba', 'gunes',
                                            'günəş', 'das', 'daş', 'qx', 'qh', 'yoxdur')
                   for limit in (1, 3, 19, 20)]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'index.sqlite'
            candidates.build_index(path, sentences, dictionary, config)
            index = candidates.CandidateIndex(path)
            try:
                with patch.object(candidates, '_native_osa_distance', None):
                    baseline = {query: index.lookup(*query) for query in queries}
                index.lookup.cache_clear()
                accelerated = {query: index.lookup(*query) for query in queries}
                self.assertEqual(accelerated, baseline)
                self.assertEqual(accelerated[('kitb', 3)], ('kitab', 'kitba', 'ktib'))
                for (word, limit), result in accelerated.items():
                    self.assertNotIn(word, result)
                    self.assertLessEqual(len(result), limit)
                self.assertEqual(index.lookup('kitb', 3), accelerated[('kitb', 3)])
                self.assertGreater(index.lookup.cache_info().hits, 0)
            finally:
                index.close()


if __name__ == '__main__':
    unittest.main()
