# CI morphology repair and institutional training

Base: `dbcbc8c3269968f0badea8c37c6e9bf8dfef4d67`. Date: 2026-10-07.

## Production repair

The five unseen failures were reproduced without modifying their reference targets. The 400-case unseen suite now passes 400/400, previously 395/400. The four incorrect water-word changes came from missing `su` singular y-buffer morphology; `suretle` was withheld by a lemma-level ambiguity veto even though its whole dictionary surface has a unique `sürətlə` spelling.

The source inflection engine now classifies the exceptional noun paradigm rather than listing input/output words. Valid forms in this lexical class outrank regular suffix guesses. For other source-only inflections, the original valid surface is retained after the established repair path abstains. Whole-surface evidence prevents the excessive ambiguity veto; ambiguous `suretini` still needs context. Seven new regression tests cover the original five cases, the water paradigm, regular vowel-final nouns and speed/copy contrasts.

| Gate | Before | After |
|---|---:|---:|
| Unseen sentences | 395/400 | 400/400 |
| Diverse release holdout | 291/300 | 292/300 |
| Original release holdout | 299/300 | 299/300 |
| Frozen exact gold | 1000/1000 | 1000/1000 |
| Unit/regression tests | 4099 passing | 4109 passing |
| Fixture text-mode second-pass changes | 0/4861 | 0/4861 |

All 4861 fixture rows were compared with a separate unmodified checkout. One output changed: `Çayın suyundan nümunə goturuldu.` now becomes `Çayın suyundan nümunə götürüldü.`; all other snapshot outputs are unchanged. Fixture text-mode results are not substitutes for mode-aware mail evaluations. No frozen gold, holdout, baseline or acceptance threshold was changed.

Typecheck, lint, production build and the enforced warm benchmark pass. The complete CI workflow must still run on GitHub after publication; local checks do not imply deployment readiness on every device.

## Dataset

`data/nlp/institutions/corpus.json` contains 120 original generic sentence scenarios across ten areas: public services, registration, document workflow, public finance, public administration, corporate governance, contracts, personnel, operations and information systems. `terminology.json` contains 30 generic terminology references. These are assistant-authored synthetic examples, **not human-reviewed** and not real user errors. No personal identities, named customers or named organizations are introduced; existing technical product identifiers such as GitHub are explicitly protected and excluded from learned lexical corrections.

Terminology references, not copied training prose or legal advice:

- https://www.taxes.gov.az/az/page/huquqi-sexsler-ucun
- https://www.e-gov.az/az/services/Info/3040/1

Scenario ownership is assigned before corruption: 80 train, 20 validation, 20 test. SHA-256 locks the target corpus; exact and bigram-Jaccard near duplicates at 0.72 are rejected. A separate overlap audit found no exact/near matches at that threshold against existing fixture references. Only training scenarios contribute lexical evidence, typo channels and gradients; validation selects checkpoints; test is not used for fitting or threshold selection.

Corruption modes: identity, ASCII diacritics, ASCII digraphs, one interior vowel deletion, one repeated letter and one adjacent transposition. Acronyms, technical terms and per-scenario protected identifiers survive corruption. Exact input–target duplicates are removed. Generated pairs remain scenario-owned and are built reproducibly, rather than storing thousands of redundant copies.

## Trained candidate and release decision

The model is a 24-input, 12-hidden-unit MLP candidate ranker with 313 parameters. It is **not** a generative model, semantic parser or general grammatical editor. The memorized typo-count feature is withheld consistently in training and inference. Validation selects a checkpoint with no wrong edits; confidence thresholds remain conservative and are not claimed to be calibrated probabilities.

Training produced 459 pairs and 2846 deduplicated neural examples; the vocabulary has 359 words. 120 epochs were attempted, with epoch 8 selected using validation only.

| Split | Pairs | Existing editor exact | Candidate preprocessing + editor exact | New wrong edits |
|---|---:|---:|---:|---:|
| train | 459 | 273 | 285 | 0 |
| validation | 110 | 55 | 55 | 0 |
| test | 112 | 60 | 60 | 0 |

The candidate improves training-set exact output by 12 cases but adds **zero improvements on validation and test**. This is insufficient generalization evidence. It is intentionally stored at `data/experiments/institutional/model.json` and is **not imported by the production editor or Workers**. The evaluation retains precision, recall, CER/WER, identity results, categories, all failing IDs and sampled failed outputs (`--details` reproduces full diagnostics); train fit is not described as an independent test result. A stronger future candidate must demonstrate gains on separate scenarios, no new false edits, frozen-corpus regressions and acceptable inference cost before integration.

Experimental artifact: **76.02 KiB** on disk. Production `lib/editor` JSON total: **5,634,256 bytes**, unchanged (**+0 KiB**); no additional runtime download or inference stage.

## Reproduce

```sh
npm run dictionary:import -- public/dictionaries/az
npm run nlp:institutions:train
npm run nlp:institutions:check
npm test
npm run gold:check
npm run gold:exact
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI rebuilds the institutional artifact and training report into temporary files, compares them byte-for-byte, and evaluates the independent partitions. The new head is available for offline experiments through `createInstitutionalHead`; no Python, LLM, network or runtime training was added.

## Warm speed diagnostic

The same audit script and Node 24.19.0 machine were used; timings are small repeated-vocabulary synthetic samples and may vary under concurrent checks. No speed improvement is claimed.

| Sample | Before median ms | After median ms |
|---|---:|---:|
| words200Ms | 57.5 | 61.5 |
| words900Ms | 240.4 | 257.4 |
