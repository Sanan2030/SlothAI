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
