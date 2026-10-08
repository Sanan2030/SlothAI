# Source-only synthetic-input guard

Current result: the full five-million repair and audit passed; see
[accepted-2026-10-08.md](accepted-2026-10-08.md). Historical failures below are retained
for provenance and do not describe the accepted version.

## Historical status, 2026-10-07

The preceding full audit of the original five-million corpus failed with two
cross-split normalized sentence/8-word collision occurrences (the number of
distinct keys is not yet measured). Its phase0 comparisons completed
with zero overlaps: train 6,574,714, validation 2,165,064, test 1,260,222
clean/noisy rows (10,000,000 total). These results come from the preceding run,
not a newly completed audit in this continuation. The transient original report
and corpus directory were lost when the execution workspace was replaced;
previously published receipts and separately saved bulk artifacts remain.

The saved training gzip recovery failed twice with HTTP 403. No recovered bytes
were accepted, no source hashes were changed, and no replacement corpus or
successful full gate is claimed. Training and Stage 2 remain blocked.

## Generic repair

`scripts/data/guard_source_pairs.py` checks original manifest sizes/SHA-256,
the fixed 5,000,000 minimum, and actual owner source-use approvals. It builds a
source-only index over **all** clean targets and synthetic inputs; it does not
import the gate, read phase0, consult held-out targets, or tune a noise threshold.

Full typed SHA-256 keys are partitioned into 256 temporary files. No key is
sampled or truncated. One partition is inspected at a time; malformed or
unexpectedly oversized partitions fail closed. First-owner collision counts
preserve the original gate's multiplicity, rather than counting just unique
colliding keys.

- A key in clean targets of multiple splits aborts the repair. Targets are not
  rewritten, moved or removed.
- A noisy key shared with another split's clean target rejects only foreign
  synthetic inputs, even if the clean owner occurs later in file order.
- A noise/noise collision with no clean owner rejects both sides.
- Rejected inputs become their unchanged target (identity); requested error
  categories, IDs, source assignments, order and the clean corpus remain intact.
  Actual noise shares, input hashes, fallback IDs and key evidence are recorded.

Every added identity key was already present as a clean target key. Removing
all foreign noisy owners therefore cannot introduce a new cross-split key.
This argument is not a substitute for the unchanged full leakage gate.
The full source-only repair has now completed: exactly two noisy inputs became
identity pairs, and every clean file remains byte-identical. The 2026-10-08
full gate and receipts supersede the historical recovery block above.

## Reproduction after bulk-file access is restored

Restore the original six JSONL files and the published original MANIFEST.json
under `data/corpus/az-v1/`. Gzip download parts must be decompressed, with the
uncompressed SHA-256/byte lengths checked against that manifest. Then run:

```sh
npm run data:test
python3 scripts/data/guard_source_pairs.py data/corpus/az-v1 data/corpus/az-v1-guarded
python3 scripts/data/gate.py data/corpus/az-v1-guarded --out=docs/stage1/collection/gate-guarded.json
```

The repair refuses to overwrite an existing output. A failed fresh gate blocks
the repaired version. Do not filter out phase0 matches, lower the minimum, or
train from a version without an actual passing full report. The gate now uses the parity-tested exact partition index described in
`audit-index-2026-10-08.md`; its acceptance rules are unchanged. The runtime
editor is unchanged; this is offline preparation only.

## Tests and measurements

The added unit cases are assistant-authored, not human-reviewed training data.
They cover typed hashes, Azerbaijani normalization, 1,200 seeded random index
rows against the original SQL owner/collision algorithm, clean/noisy ownership
in either order, noise/noise ambiguity, immutable clean collisions, malformed
partitions and refusal of an undersized corpus. All 18 data tests passed.

`source-index-benchmark.json` records three trials on 10,000 synthetic index
rows (`python3 scripts/data/benchmark-source-index.py --rows=10000 --repetitions=3`),
including insertion and finalization: SQLite median 773.70 ms versus
partitioned median 297.84 ms; both counted 88,937 foreign-owner occurrences.
This microbenchmark is not natural prose, full-corpus timing or editor latency.
It does not establish a speedup for the full gate; production gate code was
not replaced. No model JSON or browser bundle changed (growth 0 KiB).

## Runtime verification in the recovered workspace

`npm ci --ignore-scripts` restored dependencies. The initial `eval:phase0`
attempt failed because generated dictionary files were missing; running the
existing `npm run dictionary:import -- public/dictionaries/az` rebuilt them
from the pinned, checked, locally committed Hunspell source. The successful
retry and initial failure are recorded separately. No dictionary source or
reference threshold was edited.

Phase0 quality and ablation JSON match the previous branch version byte for
byte. Runtime size includes regenerated editor JSON, not just tracked files.

| Measurement | Immutable baseline | Continuation rerun |
| --- | ---: | ---: |
| Holdout-500 exact | 393/500 | 393/500 |
| Word recall | 83.125% | 83.125% |
| No-harm harmed words | 5/8,000 | 5/8,000 |
| No-harm changed sentences | 6/2,000 | 6/2,000 |
| Editor JSON | 5,634,256 bytes | 5,634,256 bytes; growth 0 KiB |
| 200 novel tokens, median | 392.19 ms | 896.13 ms |
| 900 novel tokens, median | 1,768.61 ms | 4,950.70 ms |
| Cold Node import + first call, median | 2,661.30 ms | 6,194.39 ms |

`npm run eval:latency` produced `continuation-latency.json`, with raw values,
trial counts and bootstrap intervals. Timing is slower despite byte-identical
runtime code/weights and identical quality. The current workspace is not a
controlled paired machine comparison to the archived baseline. Do not hide
these timings or label the later latency acceptance target passed. Novel tokens
are shuffled dictionary-derived ASCII word soup, not natural prose; Node cold
import is not a browser/Worker startup measurement. `benchmark:check` passed its
existing warm-p95 gate; that is a different metric from the novel-token target.

All 13 application/data verification commands completed with exit 0:
`data:test`, `eval:phase0`, `eval:ablation`, `eval:latency`, `benchmark:check`,
`test`, `gold:check`, `gold:exact`, `local-ai:fresh:check`,
`quality:priorities`, `typecheck`, `lint`, `build` (each via `npm run`).
There were 4,111 passing application tests, 18 passing data unit tests,
and 1,000/1,000 exact gold targets. `continuation-verification.json` records
commands, exit codes, durations, output tails and the initial environment failure.
All 32 frozen/fixture files compared remained byte-identical.

This is not a Stage 1 pass: `npm run data:gate` separately exited 2 because
`data/corpus/az-v1/MANIFEST.json` could not be recovered with the saved corpus.
`gate-recovery.json` is this missing-corpus result, **not** the preceding full
five-million audit. No collision fallback count or repaired-corpus phase0 result
has been invented. Main is unchanged; the repair and evidence remain on the
draft `phase1-licensed-data` branch pending restored access and a full passing
gate. The separately saved initial data/download index is marked non-passing.
