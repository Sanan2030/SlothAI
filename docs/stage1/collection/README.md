# AzTC-full acquisition — Stage 1 data gate passed

Current result: see [accepted-2026-10-08.md](accepted-2026-10-08.md). The fresh
full audit passed five million clean sentences plus five million noisy inputs,
with zero phase0 overlaps and zero cross-split collisions. The earlier HTTP 403
and failed original gate described below are historical. No model training began.

The owner requested collection after the pinned source/use plan was presented.
`owner-approval.json` records the actual conversation instruction and restricted
scope. This owner decision accepts the publisher's CC BY 4.0 declaration for the
proposed use plan; it does not grant independent rights in underlying publications.
Attribution: LocalDoc / Azerbaijan Text Corpus Full Version and retained collection
labels. Original notices remain applicable; no claim that trained weights have
received independent legal approval.

Pinned revision: `4ea07271d4a2c9746759547264a5e4310bc2956e`.
`source-card.md` is the unmodified pinned provider card; `files.json` is the provider
parquet tree including byte lengths and LFS SHA-256 values. Downloading an accessible
file does not by itself establish permission.

Accepted collection labels: ANL, apasport, medeniyyet, marja, oxuaz, axar, report,
musavat. Wikipedia, unknown labels, azadlig and muselmanlar are quarantined based
on the provenance/use review, not evaluation targets. No publisher contributes
more than 1,250,000 of the required 5,000,000 sentences.

## Reproduce outside git

```sh
python3 -m pip install -r scripts/data/requirements.txt
mkdir -p data/corpus/az-v1-download
cp docs/stage1/collection/files.json data/corpus/az-v1-download/
cp docs/stage1/collection/owner-approval.json data/corpus/az-v1-download/
python3 scripts/data/acquire_aztc.py data/corpus/az-v1-download
python3 scripts/data/check-overlap.py data/corpus/az-v1-download/az-corpus.jsonl.gz --documents --out=docs/stage1/collection/overlap.json
```

Do not invent a different owner's approval receipt. The script checks the exact
source, pinned revision, authentic approval, and full provider file size/hash.
It refuses to overwrite any prior partial or complete collection. Gzip members
close after each batch; `.partial.gz` and `progress.json` are checkpoints, not a
completed corpus or passing manifest. A reset of transient storage loses these
checkpoints unless a separate durable artifact was saved.

Normalization is NFC plus collapsed whitespace. Filtering requires 4–80 word
runs, at most 1,000 characters, terminal punctuation, a capital at the beginning,
at least one Azerbaijani function word, and 98% Azerbaijani/Latin script. Contact
fragments, markup and invalid characters are rejected. Initials are masked only
for segmentation. Original text is not linguistically rewritten.

Case/punctuation-insensitive exact sentence hashes remove duplicates. A fixed,
evaluation-independent six-word-span guard prevents repeated spans across source
groups; it may reject valid common phrases and is not semantic deduplication.
Publisher-sourced sentences are mechanically filtered, **not human-reviewed,
linguist-certified or guaranteed error-free**. OCR and source spelling errors can
remain. Original records may be passages rather than whole books; source groups
are the split boundary, not fabricated document-level independence.

The collector never reads phase0. The subsequent auditor reads immutable phase0
only to test leakage. A failure blocks this corpus version; do not remove held-out
matches to force zero. No training, threshold choice or runtime change occurs.
Only after this audit passes, run preparation and the full gate:

```sh
python3 scripts/data/prepare.py data/corpus/az-v1-download/az-corpus.jsonl.gz data/corpus/az-v1-download/az-sources.json data/corpus/az-v1
python3 scripts/data/gate.py data/corpus/az-v1 --out=docs/stage1/collection/gate.json
```

The completed collection report, source hashes, split/pair manifest and gate report
must supply actual counts. A progress count alone never authorizes Stage 2.
Bulk data and indexes are ignored by git and stay out of the application bundle.
Python/pyarrow are offline preparation dependencies only.

## Five-million-row preparation safeguards

Synthetic pair preparation conservatively protects the first capitalized token
as well as existing names/acronyms/technical spans. This avoids damaging an initial
name without claiming a trained NER system; it also reduces sentence-initial case
noise for ordinary words. The generator is still synthetic, not human-reviewed.
The leakage gate stores its exact SHA-256 keys in compact binary form and batches
per-sentence SQL lookups. Sentence keys and ngram keys have distinct prefixes.
An equivalence test compares cross-split collision counts to the original SQL
algorithm; no overlap rule, minimum or frozen dataset is relaxed.

For a full approved corpus, preparation accepts `--workers 6`. The queue is bounded
to 1,024 rows, output order is preserved, and each seed derives from the unchanged
document ID and sentence index. Unit tests compare the complete file hashes and
noise counts of serial and parallel runs. A 5,000-row source-text sample also
produced identical pair objects: 1,131.53 ms serial versus 328.03 ms with six workers
including pool startup. This is offline noise-generation timing, not model quality
or browser performance; extrapolating it to the full pipeline is unsupported.

The archived `latency.json` was measured while collection was running. CPU, page
cache and I/O contention make it an uncontrolled comparison to the original
baseline; no application speed change is claimed. A final isolated measurement
is required before declaring any performance gate passed.

## Completed acquisition and clean-only audit (2026-10-07)

`collection-report.json` records exactly 5,000,000 mechanically filtered unique
sentences from 1,090,872 scanned source records. `sources.json` contains canonical
source-record hashes and the pinned publisher declaration/use-plan approval.
`uniqueness-index.json` independently verifies 5,000,000 retained sentence hashes.
The closed gzip SHA-256 is
`5c28420ea979c411f52902cd217c165145eb1c8b6f7045fca58bf26d2058e7f5`.

| Collection | Retained sentences | Source-group split |
| --- | ---: | --- |
| ANL | 1,250,000 | train |
| axar | 1,250,000 | train |
| medeniyyet | 668,903 | train |
| marja | 118,454 | train |
| apasport | 1,082,532 | validation |
| musavat | 630,111 | test |

Command: `python3 scripts/data/check-overlap.py data/corpus/az-v1-download/az-corpus.jsonl.gz --documents --out=docs/stage1/collection/overlap.json`.
Measured result: 5,000,000 compared clean rows; zero exact-sentence/normalized
8-word-span overlaps against the read-only frozen phase0 references. This clean-only
result does not replace the full clean/noisy/cross-split gate. No phase0 target was
used to filter the collection or tune the noise generator. Training has not begun.

Application checks: `npm run test` passed all 4,111 tests; `npm run typecheck`,
`npm run lint`, and `npm run build` passed. The first build failed because the local
node_modules symlink was outside Turbopack's filesystem root; copying identical
installed dependencies into a physical directory resolved it without tracked
application/configuration changes. `checks.json` retains the failed attempt and
successful retry; retry duration was not measured.

## Unchanged editor quality and release checks

`npm run eval:phase0` and `npm run eval:ablation` reproduce the previously
published quality and ablation JSON byte for byte. The runtime, weights and frozen
references are unchanged. Training on the acquired text has not occurred.

| Measure | Baseline | After acquisition |
| --- | ---: | ---: |
| Phase0 holdout exact | 393/500 | 393/500 |
| Holdout word recall | 83.125% | 83.125% |
| No-harm changed sentences (including punctuation) | 6/2,000 | 6/2,000 |
| No-harm harmed words | 5/8,000 | 5/8,000 |
| No-harm target-only probe, wrapper excluded | 5/2,000 | 5/2,000 |
| Editor JSON bytes | 5,634,256 | 5,634,256; growth 0 KiB |

The current no-harm word FP is 0.0625%, above the later model acceptance target
of 0.05%; corpus acquisition does not resolve this. The target-only probe has a
different denominator and must not be presented as the full-text word metric.
The holdout is assistant-authored, not human-reviewed. Neither these references
nor their metrics were used for acquisition or noise choices.

`release-checks.json` records successful `gold:check`, `gold:exact`,
`local-ai:fresh:check`, and `quality:priorities` commands. Concurrent data preparation
makes their elapsed times unsuitable for app performance claims.

## Historical original preparation (before the source guard)

`MANIFEST.json` records exactly 5,000,000 accepted clean rows and 5,000,000
synthetic pairs; preparation rejected no retained collection sentence. Source-group
counts are train 3,287,357, validation 1,082,532 and test 630,111. These are actual
sentence ratios, not a claim of exactly 80/10/10 sentence proportions.

Seed 20261007 is derived per document/sentence. Requested identity count is
1,001,052 (approximately 20%); realized identity is 1,058,542 (21.17084%) because
ineligible edits fall back to unchanged input. The other 14 requested kinds have
individual realized counts and shares in the manifest. Names/technical/protected
spans are conservatively preserved. Pair errors are synthetic, not human-reviewed.
The source text remains mechanically filtered, not certified grammatical ground
truth. News/book genre bias and residual OCR/source spelling errors remain.

`compressed-parts.json` records all six standalone gzip sizes/hashes; each was
saved successfully. Decompress each `.jsonl.gz` into the same `az-v1` directory
alongside the original `MANIFEST.json` to verify its uncompressed hashes and rerun
the gate. The larger combined tar failed to save; it is not the delivery route.
`archive.json` records that failed persistence attempt rather than claiming it
succeeded. Gzip compression is packaging, not quantization or a trained model.

The first full gate failed with two cross-split key collision occurrences; it covered both clean targets and generated noisy
inputs, protected-span preservation, file alignment/integrity, source/document
split boundaries, normalized cross-split sentence/8-gram collisions, and phase0
leakage. No model training has begun. Only `gate.json` with status `passed` may
authorize the next data-dependent stage; the clean-only audit alone may not.

## Rejected audit-index batching trial

Command: `python3 scripts/data/benchmark-gate.py --rows=10000 --repetitions=3 --out=docs/stage1/collection/gate-index-timing.json`.
The benchmark uses seeded synthetic hash keys with intentional cross-split
collisions; it does not read phase0, the corpus or model outputs. Collision counts
and first-owner hashes matched in all six runs. Original median was 1,182.79 ms;
the trial's median was 1,329.17 ms, so the batching trial was **not applied**.
At that historical checkpoint the production `gate.py` remained unchanged.
The later parity-tested partition index is documented in `audit-index-2026-10-08.md`. This is an audit-index microbenchmark
under concurrent load, not a claim about full-gate or application performance.
The rejected implementation remains only inside the benchmark for reproduction.
