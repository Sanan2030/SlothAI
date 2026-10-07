# Concrete corpus-source review — 2026-10-07

This is a metadata and rights-plan review, not a prepared corpus. Approved clean
sentences remain **0/5,000,000** and Stage 1 remains blocked. No source approval,
collection size after filtering, source-level license, or zero-overlap result has
been fabricated. The existing corpus manifest and evaluation references are unchanged.

## Sources actually inspected

| Candidate | Publisher declaration / access | Decision |
| --- | --- | --- |
| LocalDoc/AzTC-full | Hugging Face card declares CC BY 4.0; info API reports 4,404,338 document/passage rows, 4,628,433,880 compressed bytes; schema `text`, `source` | Strongest volume candidate, pending owner source/weight-distribution decision |
| azcorpus/azcorpus_v0 | GitHub repository says Apache-2.0; HF dataset metadata says OpenRAIL; raw dataset card request returned HTTP 401 | Not approved; no attempt to bypass access restrictions |
| aznlp/butabytes | HF metadata says OpenRAIL; raw dataset card request returned HTTP 401 | Not approved; no access or license assumptions |

Publisher-reported rows are **not unique clean sentences**. AzTC-full is an
expanded document/passage dataset, unlike the older AzTC sentence corpus. The older
AzTC license is CC BY-NC-ND 4.0; it must not be substituted as if it had the full
version's license. The public full-version card mentions news, books, legislation,
and Wikipedia; it does not establish separate rights for each underlying collection.
The `source` field is a collection label, not a guaranteed original document URL
or independently documented license grant. API accessibility is not permission.

Primary evidence:

- https://huggingface.co/datasets/LocalDoc/AzTC-full
- https://huggingface.co/datasets/LocalDoc/AzTC-full/blob/4ea07271d4a2c9746759547264a5e4310bc2956e/README.md
- https://datasets-server.huggingface.co/info?dataset=LocalDoc%2FAzTC-full
- https://github.com/azcorpus/azcorpus_v0/blob/main/README.md
- https://creativecommons.org/licenses/by/4.0/

Machine-readable receipts in this directory pin dataset revisions and metadata
hashes. No actual corpus shard has been downloaded. Source record SHA-256 values
and accepted sentence counts therefore remain unknown, rather than placeholders
masquerading as measured evidence.

## Reviewable acquisition plan

1. Use pinned **LocalDoc/AzTC-full revision
   `4ea07271d4a2c9746759547264a5e4310bc2956e`** as the proposed bulk source;
   retain provider/source attribution and all relevant original notices.
2. Owner chooses whether the publisher's CC BY 4.0 declaration is sufficient for
   their planned training and artifact distribution, or requires written
   source-level confirmation first. This engineering change makes no such legal
   decision. CC BY-SA/GFDL Wikipedia use remains an explicit owner decision under
   the original task, not an automatic CC BY relicensing assumption.
3. Keep Wikipedia-derived and unidentified/provenance-insufficient collections
   quarantined unless their actual license/use plan is explicitly approved.
   This exclusion is selected from source rights, never phase0 errors.
4. After a documented decision, download approved shards outside git. Record
   actual file SHA-256, collection timestamp and source mapping. Group by real
   originating collection/publisher, never random rows to manufacture three
   independent sources. If origin/rights cannot be established, stop that source.
5. Normalize and segment whole documents/passages, preserve immutable original
   IDs/source labels, deduplicate without looking at evaluation targets, and
   run the existing preparation pipeline with authentic owner approval receipts.
6. Count clean accepted unique sentences only after filtering. Five million
   might be available, but this is **unmeasured**. Do not inflate counts by
   synthetic rewrites, duplicates, or calling documents sentences.
7. Audit train/validation/test targets and synthetic inputs against phase0 and
   across splits. A collision blocks that corpus version; do not tune/filter
   against phase0 to force the count to zero. No model training until the full
   gate passes.

## Exact decision needed

Approve the above pinned source/use plan with its original-license/attribution
conditions, or provide a rights-approved document corpus and `az-sources.json`
according to `docs/data-licenses.md`. Broad permission to develop the application
is not recorded as approval of a newly discovered third-party dataset.
A plan approval does not cure inaccessible shards or missing publisher rights;
those remain separate blockers if encountered. No external messages or permission
requests have been sent to dataset publishers.

## Repeated evaluation, unchanged runtime

Commands: `npm run eval:phase0`, `npm run eval:ablation`, `npm run eval:latency`, `npm run data:test`, `npm run data:gate`.

| Measure | Phase0 baseline | Source review rerun |
| --- | ---: | ---: |
| Holdout exact | 393/500 | 393/500 |
| Word recall | 83.125% | 83.125% |
| No-harm probe changes | 5/2000 | 5/2000 |
| 200-word novel median | 392.19 ms | 497.46 ms |
| 900-word novel median | 1768.61 ms | 2310.92 ms |
| Cold import + first call | 2661.30 ms | 3352.13 ms |
| Approved clean sentences | No qualifying corpus | 0/5,000,000 |
| Overlap | Not exercised | Not exercised |

Quality/ablation JSON structures exactly match the frozen baseline. All five
data unit tests pass; the corpus gate intentionally exits 2. The new measurement
file is `latency.json`; no inference change or speedup is claimed. This rerun
exceeds the requested 392/1769 ms latency limits; it is not a passing performance
gate. The current process/container differs from the original measurement, and
no controlled code-performance improvement has been attempted. Source review
is not a successful data gate, and it does not fix the existing no-harm failures.
No Stage 2 or training work started. Runtime/baseline integrity is checked with
`git diff --exit-code -- lib/editor app data/evaluation/phase0 docs/baseline-2026-10.md tests/fixtures`.
