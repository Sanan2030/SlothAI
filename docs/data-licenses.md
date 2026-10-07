# Stage 1 source and license decisions

The owner selected **5,000,000 accepted clean sentences** on 2026-10-07.
No newly collected source is approved for model training. The checked-in corpus
manifest consequently contains zero approved sentences and fails the gate.
Network metadata access is not training permission. The existing phase0 files,
including calibration-100, are evaluation-only and cannot tune noise, models,
thresholds, or source selection. An overlap failure blocks this corpus version;
do not repeatedly filter against held-out texts to engineer a passing result.

## Options requiring an owner decision

| Option | Required evidence | Current decision |
| --- | --- | --- |
| Owner-authored or commissioned Azerbaijani text | Rights/consent to train and distribute derived artifacts, collection date, document/source IDs | Not supplied |
| Public-domain or explicitly permissive corpus | Actual corpus license and scope, source URLs, attribution obligations, provenance and hashes | Not supplied |
| Wikipedia CC BY-SA/GFDL material | Dataset-specific license evidence, attribution plan; owner/legal decision on training and distributed weights | Pending, not approved |
| News, CC-100/OSCAR/mC4 or GitHub-hosted text | Underlying text rights and redistribution/training scope; a scraper/code license is insufficient | Pending, not approved |

This document makes no legal determination about whether trained weights are
adaptations. Possible paths are to approve a documented CC BY-SA/GFDL plan after
review, use a source with explicit training/artifact rights, or commission original
text. Existing project samples and broad permission to develop code do not settle
third-party text rights. Synthetic pairs are not human-reviewed annotations.

## Exact input contract

Supply `az-corpus.jsonl.gz` and `az-sources.json`, with at least three independently
licensed source groups. Each JSONL row is one complete document (not one sentence):

```json
{"sourceId":"source-a","documentId":"source-a:document-001","language":"az","sentences":["Müəllim yeni dərs materialını hazırladı."],"protectedTerms":["API"]}
```

The example is assistant-authored, not a corpus record and not human-reviewed.
Prefer trusted presegmented sentences; `text` is also supported with heuristic
segmentation. Do not include private messages or documents without the requisite
consent. Names and foreign terms needing protection belong in `protectedTerms`.
The conservative heuristic is not an entity recognizer or language detector.

Metadata schema:

```json
{
  "inputSHA256":"SHA-256 of the exact compressed or uncompressed input file",
  "sources":[{
    "id":"source-a",
    "name":"actual source name",
    "url":"actual source URL",
    "license":"actual text license identifier or grant",
    "licenseEvidence":"URL or signed permission record",
    "collectedAt":"actual ISO-8601 collection timestamp",
    "sha256":"canonical SHA-256 of this source's document records",
    "approval":{"status":"approved","by":"repository-owner","evidence":"actual owner training/artifact-rights decision reference"}
  }]
}
```

Repeat the source object for every actual source, never fabricate approval or dates.
Canonical source hash: visit input documents in original order, retain only that
source's records, serialize each with Python
`json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'`,
UTF-8 encode, then SHA-256 the concatenation. Input SHA covers actual file bytes.

## Reproducible commands

```bash
npm run data:test
python3 scripts/data/prepare.py az-corpus.jsonl.gz az-sources.json data/corpus/az-v1
python3 scripts/data/check-overlap.py data/corpus/az-v1/train.jsonl --out=docs/stage1/train-overlap.json
python3 scripts/data/gate.py data/corpus/az-v1
```

`npm run data:gate` defaults to the checked-in blocked manifest.
The gate checks clean targets and noisy inputs in all three splits against phase0; all source approvals, file hashes,
clean/pair alignment, source/document boundaries, and normalized sentence/8-gram
collisions across splits. It fails on an empty overlap audit. SQLite bounds memory
for cross-split indexes; storage/time at five million sentences is not measured.
No corpus is downloaded or training started by these scripts.

Preparation uses exact deduplication, a fixed synthetic error prior, and seeded
pairs. Accepted lengths are 4–80 words, at most 1000 characters, with terminal
punctuation. Realized error frequencies can differ from requested frequencies;
the prepared manifest records both. No claim of five million accepted sentences
is made until filtering, integrity, and zero-overlap checks finish.

## Remaining owner decisions

Source rights and CC BY-SA/GFDL weight distribution remain unresolved.
Browser input/output logging consent/retention remains a separate owner decision;
this change does not touch localStorage logging or any runtime model.
