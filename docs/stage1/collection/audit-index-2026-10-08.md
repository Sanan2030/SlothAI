# Exact source-split audit index, 2026-10-08

Bulk recovery now succeeded: six original JSONL files were decompressed and
matched the unchanged manifest's complete SHA-256 and byte lengths. The saved
manifest is byte-identical to the published original. The HTTP 403 block on
2026-10-07 is historical; `recovery-2026-10-08.json` records this recovery.

The source-only guard completed in 593.689 seconds. Two synthetic inputs fell
back to identity; all 5,000,000 clean rows and their file hashes remain unchanged.
The fresh full audit passed with zero cross-split and phase0 overlaps; see
`accepted-2026-10-08.md` for the measured full result. No model training has begun.

## Audit backend change

`gate.py` now uses `SourceKeyIndex` for normalized cross-split keys. Each row's
clean and noisy exact sentence/8-word SHA-256 keys are combined, typed with a
separate sentence/ngram byte, and written to 256 disk partitions. All keys are
retained at full 256-bit width. First-owner collision multiplicity matches the
previous SQL algorithm, including repeated foreign rows. `register_keys` remains
as the reference implementation used by tests and the microbenchmark.

The approved-source checks, fixed 5,000,000 minimum, file integrity, clean/pair
alignment, protected spans, source/document splits, frozen phase0 hash checks,
and full clean/noisy comparisons are unchanged. The document index remains
SQLite. Invalid or oversized partitions fail closed. No evaluation target is
used for selection, filtering or tuning, and no runtime editor/model code changes.

## Reproducible parity

```sh
python3 -m unittest discover -s scripts/data -p 'test_*.py'
python3 scripts/data/verify-gate-backend.py
python3 scripts/data/benchmark-source-index.py --rows=10000 --repetitions=3 --out=docs/stage1/collection/source-index-benchmark-2026-10-08.json
```

18 unit tests passed. A 1,200-row seeded property test matches full key ownership
and collision counts to SQL. The separate complete-report comparison loads the
pre-change gate from pinned commit `c5c850281a0fd3da75620af156c284acc3b0e50b`.
Both three-row fixtures return exactly the same reports (0 and 2 cross-split
collisions); both still fail the real five-million minimum. Unit-fixture mock
approval receipts are not actual source approval, training data or human review.

| Same 10,000 synthetic index rows, three trials | SQL reference | Partitioned |
| --- | ---: | ---: |
| Median construction + finalization | 561.36 ms | 410.52 ms |
| Foreign-owner collision occurrences | 88,937 | 88,937 |

The timing was measured while the corpus guard was active; it is an offline
index microbenchmark, not a controlled application-latency result. Full previous
SQL-audit duration is not measured. Do not extrapolate a full-corpus speedup
from this table. Raw trials and complete-report parity are saved separately.
Editor/model JSON growth remains 0 KiB; no neural head or inference path changes.
