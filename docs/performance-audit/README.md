# Offline performance and correction audit

Base: `898ce9a`; measured with Node 24.19 on the same container. This is an engineering evaluation, not linguistic certification or evidence of general semantic understanding. No runtime service, LLM call, Python process or model download was introduced. Existing model weights and frozen targets/baselines are unchanged.

## Final before/after

| Measurement | Base | Final |
| --- | ---: | ---: |
| 200 words, warm median | 398.46 ms | 66.07 ms |
| 900 words, warm median | 1849.50 ms | 244.81 ms |
| Cold import + first 200-word call, one process sample | 2757.56 ms | 2699.51 ms |
| Module import alone, one sample | 1943.94 ms | 2469.99 ms |
| First correction after import, one sample | 813.62 ms | 229.52 ms |
| Existing release holdout exact | 244/300 | 299/300 |
| New diverse holdout exact | 281/300 | 291/300 |
| Existing holdout clean-control false positives | 1/60 | 0/60 |
| New holdout clean-control false positives | 0/60 | 0/60 |
| New holdout changed correct words | 2/1024 | 2/1024 |
| Previously exact fixture outputs broken | — | 0 |
| Second-pass failures across all 4861 audit rows | — | 0 |
| npm test | — | 4092/4092 pass |
| gold:check / gold:exact | — | pass / 1000/1000 |
| local-ai:fresh:check / quality:priorities | — | 30/30 / 24/24 |
| typecheck / lint / build / benchmark:check | — | all pass |

Warm medians improve by 6.03× and 7.55× on this synthetic workload. Cold import remains expensive; its single sample is actually higher after the change, while first-call work is lower. Do not treat the small total-cold difference as a proven improvement or these Node figures as browser latency guarantees.

## Method and reproducibility

The same `scripts/audit-editor-performance.ts` captures outputs, second passes, SHA-256 snapshot hashes, word alignment scores and medians of five warmed calls. Inputs for timing repeat the fixed ten-word sentence `bu gun yeni layiheni yoxladim ve butun senedleri hazirladim`. Fixture evaluation uses text mode, including fixtures whose names refer to emails; actual email behavior is additionally covered by the existing test/gold gates. Some fixtures have inputs without exact targets; those rows only establish output preservation and idempotency.

```sh
npm ci
npm run dictionary:import -- public/dictionaries/az
node --import tsx scripts/audit-editor-performance.ts --out=/tmp/sloth-audit --compare=docs/performance-audit/before/snapshot.json,docs/performance-audit/new-before/snapshot.json
npm test
npm run gold:check
npm run gold:exact
npm run local-ai:fresh:check
npm run quality:priorities
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

`before/` and `new-before/` capture the base before correction tuning. `cache/` confirms byte-for-byte preservation after the behavior-neutral caches/indexing; `routing-per-word/` records conditional routing. Later stage folders contain measured reports for preservation, morphology, title case and adjective mood. `final/` contains all 4861 outputs, scores, differences and regression checks. Exact-match never decreases on any measured fixture; 68 outputs change, with no formerly exact target broken. Older non-release fixtures can still have substantial unresolved errors (for example additional-gold-200 stays 100/200); passing gates is not a claim that every fixture target is correct.

## Ablation: final runtime, warm medians

| Runtime | 200 words, ms | 900 words, ms |
| --- | ---: | ---: |
| default | 66.07 | 244.81 |
| always | 397.15 | 1708.95 |
| noLocal | 38.19 | 169.07 |
| noAttention | 58.69 | 244.24 |
| noBounded | 54.90 | 236.64 |
| noObserved | 54.34 | 232.38 |
| noBoundary | 52.85 | 235.14 |
| rulesOnly | 37.17 | 162.87 |

Models remain available. `modelPolicy: 'always'` exercises the old unconditional scheduling. The default first tries lexical/morphological recovery, then invokes costly spelling models for unresolved candidates. Observed-channel routing is text-level; boundary processing remains available. Fourteen previously trained observed pairs remain 14/14 with the default and 4/14 with all five stages disabled. These are training diagnostics, not independent evidence. On the base engineering fixtures, disabling all five stages preserved outputs; that does not prove they are useless on unseen inputs.

## What changed

1. A bounded fold cache retains the original Azerbaijani lowercase/regex semantics; immutable context vocabularies are reused per model group. Previous-word indexing replaces repeated prefix slicing. All 4861 outputs were byte-identical at this stage.
2. Conditional scheduling retains candidate lookup and contextual model fallback, rather than deleting models. Learned and attention candidate probes avoid expensive inference on known surfaces.
3. Attested accented dictionary words are protected before malformed suffix guessing. A 600-surface preservation test covers more than the reported sərgi example.
4. A source-inflection adapter uses pinned Hunspell stem classes to recover actual source lemmas and selected harmonic noun/verb suffix chains. It supports ASCII digraphs and verified candidate output validation. Context selects copy/speed forms of surət/sürət; uncertain homographs abstain. It is still a partial morphology system, not a complete contextual POS tagger or syntactic parser.
5. Native ASCII I-initial title forms use verified lowercase spelling before Azerbaijani title casing. Technical acronyms and foreign terms are preserved.
6. Attributive əla no longer automatically inserts an interjection comma/exclamation. Explicit authored punctuation is preserved.

The new generated stem-class data is 397610 bytes (388.29 KiB). Model weights grow by **0 KiB**. Total JSON beneath lib/editor, including the generated dictionary and stem-class data, grows from 5236646 to 5634256 bytes. This is not the compressed browser bundle size. Cold loading of existing artifacts remains a priority for future work.

## Held-out quality and provenance

The new corpus was written and hash-frozen before tuning: 300 unique inputs, 24 domains, 239 distinct normalized error pairs, each at most twice, and 60 clean controls. There are 240 unique expected strings because 60 clean controls reuse corrected counterparts. It is labelled **assistant-authored, not human-reviewed**. It has not been used for training. It mainly probes single-word diacritic recovery; it does not represent all natural typo, syntax, punctuation or email failures. The older 300 holdout repeats a small set of error pairs and is also an engineering fixture. Neither is a representative real-user evaluation.

| Word metric | Old holdout before | Old holdout final | New holdout before | New holdout final |
| --- | ---: | ---: | ---: | ---: |
| Precision | 98.49% | 100.00% | 99.12% | 99.15% |
| Recall | 94.06% | 99.90% | 93.33% | 97.08% |
| F0.5 | 97.57% | 99.98% | 97.90% | 98.73% |
| Erroneous words left unchanged | 48/1043 | 1/1043 | 16/240 | 7/240 |
| Error abstention fraction | 4.60% | 0.10% | 6.67% | 2.92% |
| Changed correct words | 1/570 | 0/570 | 2/1024 | 2/1024 |

Word scoring uses case-sensitive minimum-edit alignment against fixed targets; punctuation/spacing are measured by sentence exactness. Abstention is the fraction of erroneous input words left unchanged, not calibrated model confidence. Zero false positives on clean control sentences does **not** mean there are no false positives elsewhere: both wrong changes in the new corpus already existed in the base. The broad no-harm invariant remains incomplete for ambiguous unaccented inflections.

## Remaining failures: not tuned against the new holdout

| Case | Actual output | Frozen expected output |
| --- | --- | --- |
| diverse-021 | Fermerlər yazlıq əkinə hazirlasirlar. | Fermerlər yazlıq əkinə hazırlaşırlar. |
| diverse-062 | API sorğusunun cavabı JSON formatindadir. | API sorğusunun cavabı JSON formatındadır. |
| diverse-103 | Çayın şüyündən nümunə götürüldü. | Çayın suyundan nümunə götürüldü. |
| diverse-144 | Səyahətin proqramı istirakcilara verildi. | Səyahətin proqramı iştirakçılara verildi. |
| diverse-180 | Dinləyicinin sualı cavablandirildi. | Dinləyicinin sualı cavablandırıldı. |
| diverse-196 | Çayın rəngi tunddur. | Çayın rəngi tünddür. |
| diverse-213 | İclasın istirakcilari salonda toplaşmışdı. | İclasın iştirakçıları salonda toplaşmışdı. |
| diverse-236 | Konfransın məruzələri topladı dərc edildi. | Konfransın məruzələri topluda dərc edildi. |
| diverse-238 | Sorğunun iştirakçıları konulludur. | Sorğunun iştirakçıları könüllüdür. |
| release-holdout-295 | Seher planlaşdırma mütəxəssisi sakinlərin müraciətini qeyd etdi. | Şəhər planlaşdırma mütəxəssisi sakinlərin müraciətini qeyd etdi. |

The two incorrect changes are suyundan→şüyündən and topluda→topladı. Seven further new cases abstain on unsupported forms; the older remaining case abstains on Seher/Şəhər. These are explicit release limitations. Future work should broaden attestation and inflection analysis, collect separately reviewed real errors, calibrate abstention and lazy-load artifacts. Full syntactic/semantic rewriting remains outside this small offline model's demonstrated capabilities.
