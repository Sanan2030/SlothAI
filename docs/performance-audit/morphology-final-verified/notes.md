# Source morphology and preservation

Pinned Hunspell stem flags supply lexical noun/verb/adjective classes, not contextual POS labels. On-demand harmonic paradigms recover roots, cases, possession, plural forms, comitative/adjectival derivations, and past verb chains; sh/ch/gh input is normalized before lookup. An attested subclass licenses borrowed noun y-buffer possession. Unknown or conflicting analyses abstain. These are linguistic rules over existing source data, not neural retraining or general semantic understanding.

Legacy artifact features and their input-side recognition remain stable. New lexical evidence does not suppress contextual models. Generated, unattested stem-softening guesses are revalidated after contextual and phrase correction; literal accented input is not added to that repair pass. Closed pronoun paradigms and borrowed technical stems are protected. Inflected surət/sürət uses existing semantic cues in a punctuation-independent local word window.

Validation: 4079 tests passed; gold exact/check, fresh 30/30, priorities, typecheck, lint, build and benchmark passed. Additional lazy context evaluation is output-equivalent and covered by the morphology tests; final complete audit remeasures the release.

Model weights: +0 KiB. Build-generated lemma classes: +388.29 KiB (397610 bytes); the previous 100000-form dictionary reproduces byte-for-byte. The attached latency report includes concurrent validation load; use the final isolated report for release timing. Frozen targets and thresholds are unchanged.
