# Reviewed offline neural training — 3 October 2026

This release retrains the small character/context attention candidate ranker.
It retains dictionary, morphology, POS and the other existing neural heads.
Inference remains TypeScript on CPU with no external LLM API or downloaded model.
The ranker has 1,149 learned parameters; its vocabulary and context counts make
the compact JSON bundle 1,836,958 bytes. It is not a generative language model.

## Data and selection

The existing 300-article licensed Wikipedia snapshot is combined with the 60
owner-approved, assistant-authored examples. Their frozen ownership remains
48 train, five validation, seven test. Only training targets receive unchanged
examples and deterministic diacritic, deletion, insertion, transposition,
keyboard and whitespace corruption. Review approval and timestamps are required.

Cross-source normalized exact targets and token-bigram near duplicates are
checked before augmentation. Seventeen repeated input/target pairs are removed.
The resulting dataset contains 7,867 training, 845 validation and 455 test rows.
The 664 additional rows include the original 60 approved pairs and 604 training
augmentations. They are not 664 independently observed real mistakes.

Two freshly initialized seeds, 719 and 919, each train for 32 epochs on the same
20,000 aligned-word groups. Validation loss retains the checkpoint. Selection
uses validation only: zero wrong token edits, zero new identity changes, at least
30 correct token edits, then the largest correct-edit count. Complete-editor
validation makes the minimum accepted score stricter, 0.99995. Seed 719 gives
248 correct head-only validation edits, seed 919 gives 242; both have zero wrong
edits on that split. This score is not a correctness probability.

Unused edit/split lookup tables are removed after training. Compaction preserves
head predictions on all 9,167 rows. Manifest, lexicon and upstream approval/source
hashes are stored in the artifact and verified against rebuilt data in CI.

## Evaluation

The comparison below changes only the bounded neural fallback; the rest of the
editor is identical on both sides. References are strict single outputs, with
source-derived synthetic errors; these numbers are not arbitrary-text accuracy.

| Dataset | Rows | Previous head exact | New head exact | New incorrect edits | Previously exact regressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 845 | 229 | 231 | 0 | 0 |
| Held-out test | 455 | 137 | 145 | 0 | 0 |
| Additional Wikipedia evaluation | 869 | 256 | 270 | 0 | 0 |

The existing full editor still changes some already clean source references.
On the additional set it changes 23 of 191 identity rows with either head; this
release does not solve that existing weakness. Word-edit precision improves from
0.928824 to 0.930370 and CER from 0.015734 to 0.015156 on that set.

The approved 60-case batch remains 18 exact whole outputs out of 60; its training
partition improves slightly in character error but does not gain whole-output
matches. Its seven untouched test references remain four exact. Training more
candidate-ranking epochs is therefore insufficient for general grammar and
sentence understanding. No test labels were changed to inflate the result.

Two measured application bugs are also fixed: degree phrases after converbs
(`zəng edib bir az ...`) retain their following predicate, and personal initials
(`M.Füzuli`, `R.M.Məmmədov`) retain their spelling/spacing through text and mail
paragraph processing. Existing explicit sentence punctuation wins.

All 3,986 regression tests pass, together with typecheck, lint, production build
and the 24-case priority gate. On the local Node 24 CPU benchmark, warm p95 is
1,373.82 ms for 1,000 words and 9,262.81 ms for a 5,000-word logical document
split into five requests. Each request still permits at most 10,000 characters.
These local measurements exclude network time and are not a universal SLA.

## Reproduction

Run from the repository root; use an output directory outside tracked files.

```sh
npm ci
npm run dictionary:import -- public/dictionaries/az
npm run nlp:data -- data/nlp/wikipedia-documents.jsonl /tmp/slothai-source
npm run nlp:reviewed:data -- --source=/tmp/slothai-source --reviews=data/nlp/reviews/az-batch-001-splits --output=/tmp/slothai-reviewed
npm run nlp:ablation -- --data=/tmp/slothai-reviewed --output=/tmp/slothai-candidates --variants=bounded-edits --seeds=719,919 --epochs=32
npm run nlp:select -- --data=/tmp/slothai-reviewed --models=/tmp/slothai-candidates --output=/tmp/slothai-selected.json --threshold-floor=0.99995
npm run nlp:compact -- /tmp/slothai-selected.json /tmp/slothai-compact.json /tmp/slothai-reviewed
npm run nlp:reviewed:verify -- --data=/tmp/slothai-reviewed --model=/tmp/slothai-compact.json
npm run nlp:evaluate -- --input=/tmp/slothai-reviewed/test.jsonl --model=/tmp/slothai-compact.json --full-editor --enforce
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

For a release-to-release head comparison, supply `--baseline-model` to
`nlp:evaluate --full-editor`. It compares the previous bundled fallback against
the candidate in the same pipeline, and enforces exact-output, false-edit,
identity and precision regression checks. Ordinary CI rebuilds the dataset and
checks fingerprints and inference gates; it does not retrain both 32-epoch
candidates on every push. Training weights and selection reports are committed.

See `data/neural/reviewed-{data-manifest,training-report,selection-report,release-report}.json`
and `data/nlp/reviews/az-batch-001-training-evaluation.json` for the recorded
counts and failures. Source attribution remains in `data/nlp/SOURCES.md` and
the model provenance. Future work needs stronger error candidate coverage,
joint sentence-boundary learning and more independently reviewed real pairs.
