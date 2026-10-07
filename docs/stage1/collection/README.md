# AzTC-full acquisition — Stage 1 remains gated

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
