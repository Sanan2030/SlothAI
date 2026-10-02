# Thirteen lexical test failures

Base main: `55bb0c38e5265cbbb6e87f74631a044672a55372`.
The prior evaluator reported 53/66 neural-only lexical successes. Seven of its
13 failures already passed in the complete editor; six were actual end-to-end
misses. The frozen former failures are in `tests/fixtures/neural-thirteen.json`.

## Causes and fixes

- The explicit-diacritic preservation DP counted each ASCII-to-Azerbaijani accent
  restoration toward a four-edit cap. Long inflections with many restored accents
  were rejected even with only one structural typo. Equivalent folded letters
  now have zero substitution cost for an ASCII source; explicitly supplied
  Azerbaijani letters still cannot be erased or replaced. Structural edits remain
  bounded and preserve alignment through inserted/deleted letters.
- Nominal root lookup could recover a doubled consonant or supported vowel swap,
  but could not propose a root with one dropped consonant. A bounded deletion
  signature index over reviewed, learned noun roots now supplies those candidates.
  Insertion channels must have at least two training observations; the original
  suffix must validate under the same lemma, and competing roots still abstain.
- Neural candidate vocabulary did not cover every inflection, and spelling
  selection intentionally delegated diacritics-only changes to the older stages.
  The isolated neural path now also accepts the unique folded form of a reviewed
  productive paradigm. Ambiguous surfaces and already valid words stay protected.

The missing-consonant extension initially exposed a verb/noun ambiguity:
`çatanda` could be read as a damaged `çantanda`. The same issue affected
`çatandan`. Converb endings are excluded from the new missing-consonant index;
existing dependent-clause handling retains the author's verb. Regression tests
cover both forms and full diary/correspondence behavior.

## Evidence

Lexical exercise outputs: 66/66; grammar exercises: 50/50; old correction probes:
14/14; original natural contexts: 20/20 in both editor and neural-only execution;
new expansion holdout: 16/16. Eight additional sentences with other suffixes and
contexts pass in neural spelling, the complete editor and email formatting.
The evaluation gate now requires all lexical outputs to remain exact.

No training/test split, expected output, network weight, parameter count or model
threshold was changed to obtain this result. These are general morphology and
alignment fixes rather than an exact-input replacement table. The 13 formerly
failing cases are now development regressions, not evidence of unseen-language
accuracy. This improves the specialized editor; it does not supply general
semantic comprehension. `neural-thirteen-verification.json` records the full
checks and local performance; local timings are not a deployment SLA.
