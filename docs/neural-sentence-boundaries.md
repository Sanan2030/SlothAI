# Compact neural sentence boundaries — October 2026

The API-free editor now includes a separate sentence-gap MLP. It runs in both
text and email bodies through the shared correction engine; it does not download
another model or call an LLM service. The earlier spelling, attention, morphology,
POS and deterministic punctuation modules retain their existing artifacts.

## Architecture and safeguards

The head has 166 inputs, 12 tanh hidden units and a sigmoid output: 2,017 learned
parameters, 56,205 bytes of JSON. Features combine local character n-grams,
reviewed morphological analyses, predicates, connector scope and nearby clauses.
Six local token vectors and bounded predicate lookahead are used; this is not a
Transformer or a model with general semantic understanding.

It can only insert punctuation at eligible space-only gaps between independent
clauses. Existing punctuation and words are retained. Converbs, subordinate
clauses, indirect questions, technical terms and protected spans remain guarded
by the shared engine. A runtime option disables only this head for comparisons.
The 0.97 acceptance threshold is selected on validation data and is not a
calibrated 97% correctness probability.

## Data and training

Frozen source document splits and the approved 48/5/7 training/validation/test
references remain unchanged. Wikipedia excerpts retain their attribution and
CC BY-SA 3.0 / GFDL provenance in `data/nlp/SOURCES.md`. Approved references are
assistant-authored synthetic text attested by the owner, not real-user errors.

Whole document ownership precedes augmentation. Exact and token-bigram near
duplicates are checked across splits; the existing source manifests also check
source clusters. Only missing punctuation, partial punctuation and identity
variants are generated. Structured documents are excluded from this gap corpus.
No independent RSD/IT, email gold fixtures or fresh Wikipedia documents are
added to training. Candidate gaps are deduplicated deterministically.

Training uses 1,800 eligible gaps from 230 documents. Validation uses 205 gaps
from 28 documents. The held-out gap test contains 149 gaps from 18 documents.
These are eligible-gap counts, not the total number of source documents.

Both seeds 1201 and 2201 were trained for 64 epochs. Lowest validation loss
retained epoch 8 for both; later checkpoints overfit. Seed 2201 was selected by
validation-only accepted-correct gaps, with 18 accepted and no incorrect gaps
across at least five documents. After freezing selection, the gap test accepted
9 boundaries, all 9 correct. This small sample does not establish error-free
performance on arbitrary texts. Checkpoints and the report reproduce byte for
byte from the frozen input files.

## Complete-editor ablation

Only this head changes; the full preceding editor and references stay fixed.
Three variants per eligible document are evaluated: unpunctuated, partial and
identity. Evaluation partial masks use a different seed from training.

| Dataset | Cases | Correct token edits before / after | False token edits before / after | Exact outputs before / after |
|---|---:|---:|---:|---:|
| Validation | 111 | 100 / 109 | 214 / 214 | 27 / 27 |
| Frozen test | 63 | 55 / 62 | 103 / 103 | 14 / 14 |
| Fresh source documents | 90 | 114 / 128 | 107 / 107 | 20 / 20 |

The two test sets therefore gain 21 correct boundary token edits. No new wrong
token edit, exact-output regression or additional identity change was observed.
CER decreases on all three sets. These are single-reference deterministic
alignment metrics, not independent linguistic certification. On the fresh set,
character-alignment false edits change from 129 to 130 even though all newly
punctuated tokens match their references; earlier text differences can change
character alignment. That counter is retained in the release report.

The unchanged low complete-output accuracy and existing identity changes show
that the overall editor still needs better lexical, grammatical and preservation
work. This release improves clause separation, not every remaining error.
Full metrics and input fingerprints are in
`data/neural/sentence-boundary-release-report.json`; training metadata is in
`data/neural/sentence-boundary-training-report.json`.

## Reproduce

```bash
npm ci
npm run dictionary:import -- public/dictionaries/az
npm run nlp:data -- data/nlp/wikipedia-documents.jsonl /tmp/slothai-boundary-source
npm run neural:boundaries:train -- --source=/tmp/slothai-boundary-source --output=/tmp/slothai-boundary-run
cmp /tmp/slothai-boundary-run/selected.json lib/editor/neural/sentence-boundary-model.json
cmp /tmp/slothai-boundary-run/report.json data/neural/sentence-boundary-training-report.json
npm run neural:boundaries:check -- --source=/tmp/slothai-boundary-source --split=validation --output=/tmp/boundary-validation.json
npm run neural:boundaries:check -- --source=/tmp/slothai-boundary-source --split=test --output=/tmp/boundary-test.json
npm run neural:boundaries:check -- --source=/tmp/slothai-boundary-source --input=data/nlp/fresh-wikipedia-documents.jsonl --output=/tmp/boundary-fresh.json
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI reproduces the selected model and runs the full-editor regression gates.
Tests explicitly check clause dependencies under artificially high confidence,
feature dimensions, corruption rejection, document ownership, deduplication and
new wrong edits hidden by other improvements.

## Release verification

All 3,992 regression tests, typecheck, lint, production build and 24 priority
checks passed locally. The previous spelling-head held-out regression gate also
passed. An isolated warm benchmark on Node v24.19.0 measured 1,000 words at
p95 875.91 ms and a 5,000-word logical document in five requests at
p95 3897.26 ms. All benchmark gates passed under the user-approved
10-second ceiling. Measurements are local engine timings, not a guarantee of
network or cold-start latency on every device. Full measurements are in
`data/neural/sentence-boundary-benchmark.json`.
