# Local context training release — 2026-09-30

## Scope

This release retrains the existing CPU/browser statistical classifiers. It does
not introduce an API, a transformer, or general semantic understanding. Both
text and mail editing use the same bundled model. User review files remain
private test files and are not automatically used for training.

## Data and separation

A new corpus contains 120 assistant-authored full-sentence context examples for
six ambiguous folded spellings: seher, suret, el, et, uc and adi. Each of the 12
canonical meanings has five training, two validation and three test examples.
The split was fixed before evaluation. The new training set has 60 examples;
24 validation and 36 test examples are never passed to a trainer. These are
small lexical exercises, not independently reviewed natural-language evidence.

`contextTrainingTexts()` rejects duplicate IDs or normalized sentences, invalid
labels and overlap with existing held-out seeds, all 1,000 editorial targets,
the separate fresh corpus, and reserved context examples. Existing seed,
supplemental and synthetic expansion texts are also checked against the new
context holdout. This enforces normalized exact separation, not semantic or
near-duplicate independence; the examples intentionally share lexical cues.

The Naive Bayes context model, ordered perceptron and token-gap boundary
classifier are retrained. Existing morphology expansion evidence can merge
with new examples only when canonical word labels agree. Conflicting or
ambiguous expansion labels still fail closed. Artifact and context-corpus hashes
are recorded in the training report; rebuilding is deterministic.

## Measured results

| Evaluation | Before | After |
|---|---:|---:|
| Correct accepted context decisions, 36 reserved examples | 15 | 28 |
| Wrong accepted context decisions | 0 | 0 |
| Abstentions on these examples | 21 | 8 |
| Exact full output, existing 200 synthetic held-out pairs | 57 | 59 |
| Word edit distance on those 200 pairs | 339 | 335 |

The new context test has **24/36 exact full text outputs** and **24/36 exact
mail bodies**. Correct selection of one word does not imply a correct entire
sentence. The 24 validation examples have 14 correct accepted decisions, zero
wrong decisions, ten abstentions, and 15 exact text/mail-body outputs.

Against the previous release, no existing held-out pair increases its word edit
distance; four improve. Against the dictionary/rules baseline, 38 pairs improve
and none regress. The established 1,000 full-output editorial cases and 30
separate fresh text/mail probes remain exact. They are restricted authored
corpora, not a certification of general Azerbaijani editing quality.

All 3,775 regression tests pass. TypeScript, lint, production build and the
performance gate are checked before publication. Browser UI was not exercised
in this training release; no UI component changed.

## Operational fixes and gates

An existing dictionary reproduction test could rewrite a JSON file while
another test imported it, exposing partial JSON. Dictionary and training
artifacts now publish through a complete sibling temporary file and atomic
rename. A concurrent reader/writer test protects this behavior. Each file is
atomic separately; the complete set of model/report files is not a transaction.

CI rebuilds the model and verifies committed artifact hashes, runs the new
context safety/coverage gate, checks the previous release's per-pair distances,
and runs the existing language, regression and performance gates. A retraining
that damages these reserved outputs cannot silently pass.

```
npm run local-ai:train
npm run local-ai:context:check
npm run local-ai:context -- --validation
npm run local-ai:evaluate
npm run local-ai:validate
npm test
npm run build
```

## Remaining limitations

141 of the existing 200 held-out full outputs still differ from their targets.
This model cannot reliably understand arbitrary sentences, restore every typo,
or determine all missing sentence boundaries. Calling it a professional general
AI would be inaccurate. The next major quality gain requires broader licensed,
linguist-reviewed Azerbaijani correction pairs with document/domain-separated
validation, and a separately benchmarked learned sequence correction model.
Increasing repeated synthetic examples alone is not evidence of that gain.
