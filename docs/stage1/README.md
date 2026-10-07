# Stage 1 — source-approved corpus preparation and diagnostics

Base: `9bd4531fa05fb64866cfbedd588bdeadc253c483`. Branch:
`phase1-licensed-data`. No browser/editor runtime, model weights, thresholds,
protected spans, logging, frozen phase0/gold references, or baselines changed.
The owner selected a five-million-clean-sentence minimum. **Stage 1 has not passed.**
Stages 2–7 have not started. This is a draft infrastructure/diagnosis PR, not a
claim that a new trained language model exists.

## Current acquisition update — 2026-10-07

Exactly 5,000,000 mechanically filtered unique source sentences and 5,000,000
deterministic synthetic pairs are now prepared. Owner acceptance concerns the
pinned publisher CC BY 4.0 declaration/restricted use plan, not independently
verified underlying-publication rights or human linguistic review. Sources,
hashes, actual splits and noise shares are in `collection/README.md` and
`collection/MANIFEST.json`. The clean-only phase0 audit passed 5,000,000 rows
with zero overlaps; the full clean/noisy/cross-split gate is still running.
Training has not begun; do not advance to Stage 2 until `collection/gate.json`
is a full pass. Earlier empty-input figures below are historical infrastructure
measurements, not the current collection size.

## Changes

- Streaming document JSONL/gzip preparation, explicit source-rights receipts,
  source-level splits and canonical source/file SHA-256 verification.
- SQLite exact deduplication, atomic staging (late hash failures publish no corpus).
- Seeded Azerbaijani error generator: diacritics, q/k and x/h, deletion/insertion,
  swaps, AZ/ASCII keyboard neighborhoods, digraphs, spacing/hyphen, punctuation,
  and case. Identity prior is 20%; realized counts are recorded, never advertised
  as empirical user error frequencies.
- Fail-closed gate: 5,000,000 accepted clean rows, aligned synthetic pairs,
  approved source provenance, nonempty train/validation/test, protected spans,
  exact normalized sentence and 8-word ngram audits against phase0 and across
  splits. Both clean targets and noisy inputs are audited. The builder never
  reads phase0; only final evaluation/firewall checks do.
- Nine stdlib unit tests and a CI step. Samples are assistant-authored unit
  fixtures; mock source approvals are not real source approvals.
- npm evaluation aliases and alternate output directories preserve phase0 reports.
  Per-target candidate/ranker/fallback diagnostics and a scoped CPU sample report.

`docs/data-licenses.md` defines the input files and unresolved owner decisions.
The Hugging Face Wikipedia metadata request returned HTTP 200 and declared
CC BY-SA 3.0/GFDL. This establishes metadata access, not corpus size, rights to
train/distribute weights, or owner approval. At the initial infrastructure measurement, no new corpus had been downloaded
or trained: the archived root template/gate recorded **0 / 5,000,000** and
overlap **not exercised**. That is a historical failed empty-input gate, not
the current collected corpus. `npm run data:gate` now verifies `data/corpus/az-v1`
and writes `collection/gate.json`; missing corpus files still fail closed.

## Diagnosis of the 12 targets

Command: `npm run eval:targets`. Full numbers: `evaluation/targets.json`.
The probe is a neutral “Mətndə … sözü işlənir.” sentence; it is not a semantic
benchmark for a naturally occurring intended sense. Scores are uncalibrated ranker
scores, not correctness probabilities. Instrumented fallback outputs are asserted
byte-identical to the corresponding default/always production outputs.

| Input | Target in bounded candidate list | Primary target score | Main obstruction |
| --- | --- | --- | --- |
| qəubl | qəbul | 0.626181 | Below 0.99995 acceptance threshold |
| məəsləni | məsələni | 0.055868 | Below threshold/margin |
| löhədə | Absent | 0.001095 | Target not in active indexed/validated candidate sources |
| bəpa | bərpa | 0.969190 | Below threshold |
| məqşin | Absent | 0.000199 | Target not in active indexed/validated candidate sources |
| haırladı | hazırladı | 0.001821 | Identity wins primary ranking |
| çədi | çəkdi | 0.884951 | Below threshold |
| müəhrrikin | mühərrikin | 0.000376 | Identity wins primary ranking |
| oxtdu | Absent | 0.001108 | Different candidate oxudu offered; target absent |
| çadırdı | çatdırdı | 0.002210 | Default established-surface routing skips fallback; primary prefers çağırdı |
| kaeblin | Absent | 0.001548 | Target absent |
| tuutmunu | Absent | 0.002582 | Target absent |

The starting claim “all twelve words are available in the dictionary” is not true
for the **active queried candidate sources**: three targets occur in the imported
surface dictionary and four additional targets are productive-morphology forms.
Five are not available to these paths. Presence of a stem/string elsewhere in JSON
is not active candidate availability.

`MAX_LOOKUPS=1600` cannot bind on these short words: even the conservative
54×folded-length+31 upper bound is below 1600 for every target. It is not the
cause demonstrated here. No edit-distance-2 implementation is shipped in Stage 1.
Seven targets are generated; five are absent. All twelve pass the explicit
`preservesDiacritics` check. All lowercase direct heads abstain. The uppercase
`\p{Lu}` guard rejects uppercase probes before scoring; that guard is not the
cause of these lowercase failures.

Default fallback is observed for 11/12 inputs. For `çadırdı`, it is absent under
default and present under `modelPolicy: 'always'`, while `isEstablishedSurface`
is true. This proves routing suppression, not an attention rejection. “Çadırdı”
can itself be a valid form, so an unconditional rewrite would threaten no-harm;
a useful contextual decision requires licensed training and separate calibration.
The always path also abstains. Domain scoring at threshold 0.7 does not recover
these targets, and its interior-vowel/repeated-consonant category is narrower
than arbitrary missing consonants. Thresholds are left unchanged.

Command for the recorded CPU sample:

```bash
node --cpu-prof --cpu-prof-name=stage1-targets.cpuprofile --cpu-prof-dir=/tmp --import tsx scripts/eval/targets.ts
```

`evaluation/profile.json` contains sampled functions from the diagnostic process
including module load. Samples are not elapsed milliseconds or isolated inference
self-time. Candidate generation milliseconds per head are in `targets.json`;
these include cache differences and are diagnostic, not a release latency gate.

## Measurements

Same existing scripts, same Node v24.19.0 environment, unchanged inference. These
are **baseline versus rerun**, not an optimization experiment. Timing differences
are measurement variation; no speedup is claimed. CPU latency is dictionary-derived
ASCII word soup, not browser download/Worker timing or natural prose.

| Metric | Phase0 baseline | Stage 1 rerun |
| --- | ---: | ---: |
| Holdout-500 exact | 393/500 (78.60%) | 393/500 (78.60%) |
| Word recall | 83.125% [78.965, 86.234] | 83.125% [78.965, 86.234] |
| Word precision | 99.439% | 99.439% |
| No-harm probe forms changed | 5/2000 (0.25%) | 5/2000 (0.25%) |
| No-harm sentences changed | 6/2000 | 6/2000 |
| Novel 200-word median | 392.19 ms | 372.66 ms |
| Novel 900-word median | 1768.61 ms | 1716.16 ms |
| Cold import + first transform median | 2661.30 ms | 2737.67 ms |
| Fixture output changes / idempotency failures | 0 / 0 | 0 / 0 (4861 compared) |
| Runtime model/editor JSON | 5,634,256 bytes | Unchanged; growth 0 KB |
| New trained models | None | None |
| Clean sentences at initial infrastructure baseline | No qualifying corpus | Historical 0; current collected/prepared 5,000,000, full gate pending |

The no-harm probe rate **fails the new ≤0.05% gate already at baseline**. It
includes proper-name/case disputes; these references remain frozen. The actual
`qadir→qadır` harm and unwanted “Mətndə, yoxsa…” punctuation also remain unresolved.
The 12 target corrections remain unresolved. Lowering a threshold using these
phase0-derived targets is forbidden; no such tuning occurred.

All eight ablation quality results are identical to phase0. Default 393 exact;
always 395; noLocal/noAttention 387; noBounded 391; noObserved/noBoundary 393;
rulesOnly 387. This measured benefit is a reason not to delete the old heads.
Ablation flags do not independently isolate every document/log/agreement head.

Commands and machine-readable results:

```bash
npm run eval:phase0       # evaluation/quality.json
npm run eval:ablation     # evaluation/ablation.json
npm run eval:latency      # evaluation/latency.json; 15 trials, 10 cold processes
npm run eval:targets      # evaluation/targets.json
npm run eval:fixtures -- --compare=/tmp/phase0-snapshot.json
npm run data:test
npm run data:gate         # current az-v1 data gate; requires the separately saved corpus files
```

The fixture comparison input is an earlier local baseline snapshot, not a new
training source. Its baseline output hash equals the rerun hash in
`evaluation/fixtures.json`. Frozen file/runtime integrity is verified with
`git diff --exit-code -- data/evaluation/phase0 docs/baseline-2026-10.md tests/fixtures lib/editor app`.

`checks.json` records final validation command exits and output tails, including
npm test, typecheck, lint, gold:check, gold:exact, local-ai:fresh:check,
quality:priorities, build and benchmark:check. Unit/regression gates passing does
not override the deliberately failed data gate.

## Next required input

Provide the documented `az-corpus.jsonl.gz` plus `az-sources.json`, with enough
unique rights-approved Azerbaijani documents to retain **at least five million
clean sentences** after filtering, and at least three independent source groups.
Alternatively choose and document a source-license/weight-distribution plan first.
Source approvals, independent language/segmentation quality, domain balance, real
error data, and five-million-row preparation costs are not established by this PR.
Logging consent/retention is an owner decision and remains unchanged. No Stage 2
work or CharSpell/WordLM/PunctCase training should start until the gate passes.
