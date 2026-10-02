# Offline correction: measured release

This release retains the dictionary, productive morphology, POS features, sentence-boundary rules and existing neural heads. A second small attention ranker provides conservative bounded spelling candidates. It is not a generative language model or a general semantic parser. Inference is TypeScript on CPU, with no external model API, GPU, Python service or pretrained download.

## Data integrity and training

300 Azerbaijani Wikipedia articles from the public `wikimedia/wikipedia` 20231101.az snapshot produce 8,503 synthetic pairs: 7,215 train, 840 validation and 448 test. Document/near-duplicate clusters are assigned before augmentation; 64 repeated targets were removed. The v2 manifest verifies partition SHA256, counts, document ownership and cluster isolation before training. Supplied protected terms survive augmentation. Automatically filtered encyclopedic text is not manually reviewed gold.

The error generator covers diacritic removal, deletion, insertion, transposition, keyboard neighbors, whitespace and limited colloquial variants, alongside unchanged examples. Morphology and train-only vocabulary supply candidates for previously unseen typo surfaces. Candidate search is bounded at 1,600 queries and 24 results, with a 4,096-entry cache. Valid words, explicit diacritics, protected terms and entities are guarded. Exact repeated-letter deletion can repair bare noun roots without inserting consonants into already valid words.

Three equal-budget ablations were trained for 16 epochs with seed 719: learned attention, uniform attention and no context. The new head has 1,149 parameters; 92,905 candidate examples were used. One seed does not establish architectural robustness. Cached character/base features improve training speed; learned pooling and gradients are recomputed. The previous attention artifact was reproduced byte-identically.

At a looser 0.98 score threshold, held-out word evaluation showed five false changes for learned attention; that setting was rejected. A fixed conservative 0.9999 floor selected learned attention on validation only: 55 true-positive token edits, zero false edits, compared with 46 for uniform attention and 12 for no context. The score is not a calibrated correctness probability. The deployed head frequently abstains.

## Complete editor evaluation

The baseline includes all previous rules and models, disabling only the new bounded head. False-edit comparisons use exact edit sets, so fixing one error cannot conceal a new error elsewhere.

| Partition | Exact baseline | Exact new | Newly false edit rows | Regressions |
| --- | ---: | ---: | ---: | ---: |
| Validation | 227/840 | 229/840 | 0 | 0 |
| Held-out test | 130/448 | 133/448 | 0 | 0 |
| Fresh documents | 252/869 | 254/869 | 0 | 0 |
| Historical development | 51/56 | 51/56 | 0 | 0 |
| User excerpts, assistant references | 3/12 | 3/12 | 0 | 0 |

The fresh evaluation uses 30 additional articles sampled from page 40 onward, excluded from fitting and threshold selection. Document-ID, exact-target and configured near-duplicate cluster checks found no overlap with training documents. These checks do not prove absence of every semantic overlap. The head alone made 43 correct token edits on held-out test and 58 on fresh data, with no measured false token edits. This is a sample result, not a future accuracy guarantee.

Existing editor errors remain: 18/101 unchanged held-out inputs and 24/191 unchanged fresh inputs were changed against the single source reference. Long sentence grammar and real informal text remain weak; the new spelling head did not improve the 12 user references. Those targets await human review and may have acceptable alternatives. No general meaning-understanding claim is warranted.

## Reproduce

```sh
python scripts/import-wikipedia-corpus.py --help
npm run nlp:data -- data/nlp/wikipedia-documents.jsonl /path/to/splits
npm run nlp:ablation -- --data=/path/to/splits --variants=bounded-edits,bounded-uniform,bounded-no-context --epochs=16 --seeds=719 --sample-groups=20000 --output=/path/to/experiments
npm run nlp:select -- --data=/path/to/splits --models=/path/to/experiments --output=/path/to/selected.json --threshold-floor=0.9999
npm run nlp:compact -- /path/to/selected.json /path/to/compact.json /path/to/splits
npm run nlp:evaluate -- --input=/path/to/splits/test.jsonl --model=/path/to/compact.json --full-editor --threshold-floor=0.9999 --enforce
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

Selection never reads test for choosing a model. Full-editor validation/test and protected-span/identity checks are mandatory after selection. Compaction removed unused edit/split tables and ineligible vocabulary while retaining context counts: all 8,503 predictions were identical. The deployed bundle contains 7,540 words and is approximately 1.7 MiB. See the committed JSON reports in `data/nlp` for counts, hashes and category metrics; source attribution is in `data/nlp/SOURCES.md`.

All 3,940 tests, TypeScript, ESLint and production build passed. Isolated warm CPU benchmark p95 was 769.85 ms for 1,000 words and 3,830.77 ms for a 5,000-word logical document split into API-safe chunks. Peak RSS was approximately 334–344 MB. Cloud cold starts, network latency and arbitrary adversarial inputs are not covered by those timings.

The next highest-value work is human-reviewed real mail/IT/everyday pairs, stronger sentence-boundary supervision, contextual morphology coverage, and precision calibration across multiple seeds and domains. Raising vocabulary counts or epochs alone does not solve those limitations.
