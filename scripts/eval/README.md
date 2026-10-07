# Phase 0 offline measurement

Production editor code and frozen release/gold/baseline files are unchanged.
Read `docs/baseline-2026-10.md` before interpreting any result as general accuracy.
Run from the repository root after `npm install` and `npm run dictionary:import -- public/dictionaries/az`:

```
node --import tsx scripts/eval/run.ts
node --import tsx scripts/eval/latency.ts
node --import tsx scripts/eval/latency.ts --policy=default --out=docs/evaluation/phase0/latency-after.json
node --import tsx scripts/eval/ablation.ts
node --import tsx scripts/eval/diagnose.ts
python scripts/eval/check-overlap.py
node --import tsx scripts/eval/snapshot.ts --snapshot-out=/tmp/sloth-phase0-snapshot.json
python scripts/eval/report.py
```

Run latency alone on an idle machine. Each policy uses a separate Node process;
bootstrap percentile intervals use seed 20261007 and 1,000 resamples. Quality
resamples document clusters, not individual words. Zero-event intervals can be
[0,0] and do not establish zero population risk. `errorAbstentionRate` measures
erroneous words left unchanged, not classifier abstention or calibrated confidence.
Metrics are a deterministic single-reference diagnostic, not a linguist audit.

Datasets were frozen before prediction. `build-phase0.py` reproduces them but
must never be used to change targets after seeing output; a future revised
reference requires a new version and a documented reason. Calibration is reserved,
never scored or consumed by phase 0. Keep these datasets out of all training and
threshold selection. The integrity tests verify hashes and exact text/document
split overlap; they do not prove absence of semantic near-duplicates.

Ablation uses only existing CorrectionRuntime flags. It cannot isolate every
legacy head, does not alter runtime to add switches and must not be described as
an independent per-head causal effect where flags disable a composed stage.
No inference service or external data download is used. Latency measures Node,
not the production browser, Worker startup, speculative scheduling, network
transfer or a browser's private-memory cost. Novel probes use unseen folded
word forms in artificial word soup; warm probes are intentionally repetitive.

For output comparisons, run snapshot.ts on both checkouts with identical Node/dependencies and pass `--compare=/path/to/before-snapshot.json` on the second run. Existing CI gates are separate npm commands; checks.json records this audit run, not a portable CI runner. Generate the Markdown report after those gate results exist.
