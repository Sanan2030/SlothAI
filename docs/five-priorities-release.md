# Five editor priorities: implementation and measured limits

This release improves the existing API-free hybrid editor. It does not replace it with a general language model. No pretrained model, paid API, GPU requirement or Python inference service was introduced, and the neural weights were not retrained in this release.

## 1. Approved real examples

Saving an expected result now records explicit `user-approved` status. The portable review file can be imported into the existing training format with reviewer, provenance and license fields. Raw output logs and old exports without explicit approval are rejected, as are conflicting targets, repeated pairs, excluded evaluation targets and overlong pairs. Targets differing in meaningful diacritics are not treated as identical approvals.

Identical and configured near-duplicate target documents are clustered before train/validation/test assignment. Error variants of the same target stay in the same partition. Identity examples are retained. The SHA256 manifest records partition ownership and counts. These are user-attested examples, not independently certified linguistic gold. Exclusion by target is a conservative exact folded check; it does not guarantee semantic isolation from every external evaluation corpus.

```sh
npm run nlp:reviewed -- --input=/path/to/review.json --output=/path/to/reviewed-splits --provenance="Own consented drafts" --reviewed-by="Reviewer name" --license="Private training permission" --exclude=/path/to/held-out.jsonl
```

Mail layout targets are rejected for token training: first review aligned body-only spelling pairs as text-mode examples. Split documents exceeding 1,200 characters into aligned examples before import. Import does not train or deploy a model automatically. No new human-approved real dataset was available for fitting in this release; the importer is ready for those files. Browser records remain local until the user exports them.

## 2. Clause boundaries

Runtime clause analysis recognizes reviewed nominal predicates and copulas without changing the original feature function used by frozen classifiers. Independent nominal subjects and completed causal transitions can start a new sentence; open reported and conditional clauses remain guarded. A numeral before a counted noun does not become a false verb boundary: `iyirmi dörd saat, yeddi gün` retains its meaning.

These are conservative contextual rules, not a trained full dependency parser. Unseen long mail syntax still needs reviewed boundary supervision.

## 3. Morphology and ambiguity

Nominal predicates recover a reviewed lemma, case and person using vowel harmony: `muellimem` → `müəlliməm`, `mektebdeyem` → `məktəbdəyəm`. Unknown roots and invalid suffix harmony abstain. Existing indexed spellings take priority over newly generated variants; the morphology cache remains bounded.

Scoped context distinguishes hunger `ac idi` from imperative `aç`, and contrasting `sabah isə` from dative `işə getdim`. This is limited contextual disambiguation, not universal POS or semantic understanding. Reviewed canonical spellings cannot be overwritten by a later neural spelling guess.

## 4. Decision and formatting safety

Both modes use the same correction engine. A lossless scanner separates supported Markdown structure from editable prose: heading and list markers, task checkboxes, table delimiters, CRLF, link destinations, inline code and closed/unclosed code fences are preserved. HTML block tags, quoted attributes and comments are retained; code, pre, script and style content is opaque. Malformed or excessive-depth HTML is left unchanged rather than reconstructed.

The scanners cover the tested structures, not every extension of CommonMark or HTML. Correction is not HTML sanitization. Unknown ambiguous forms can still be handled incorrectly by older rules; the new guard does not make every stage a calibrated confidence system.

## 5. Responsiveness and release checks

The page loads the engine lazily in a Web Worker, leaving the UI thread available. Text and mail use one reusable worker. A 10-second deadline terminates stalled work and permits a fresh retry; stale replies, overlapping requests, worker failures and unmount disposal have tests. The API remains independently functional with request validation and rate limits.

CI additionally runs the development regression targets and the source-held-out full-editor bounded-head gate, alongside existing tests, reproducibility, lint, typecheck, production build and performance checks.

## Results

The baseline is commit `bb1ec235e175c9c6f067f2daf0c16d70c5d27beb`. No fitting or threshold selection used these new development or fresh evaluation files.

| Corpus | Baseline exact | Current exact | Previously exact outputs lost |
| --- | ---: | ---: | ---: |
| Authored development targets | 7/24 | 24/24 | 0 |
| Source-held-out synthetic pairs | 133/448 | 133/448 | 0 |
| Fresh source documents, synthetic pairs | 254/869 | 255/869 | 0 |

The 24 targets are assistant-authored development references, not independent certification. Wikipedia-derived targets and synthetic errors are not manually reviewed real-user gold. Whole-pipeline held-out edit precision remains about 83.67%; fresh precision is about 92.51%. Exact-match accuracy on these broad sets is only about 30%, so the product still needs real reviewed training and general syntax improvements. Fresh CER is approximately 0.01579. No claim of professional-editor parity is supported.

All 3,953 tests, TypeScript, ESLint and the Turbopack production build passed. An isolated Node 24 warm benchmark measured p95 817.82 ms for 1,000 words and 3,907.98 ms for a 5,000-word logical document split into five size-safe requests. Peak process RSS was approximately 348 MB. These timings do not guarantee every device or cold start finishes within 10 seconds.

A production-build Chromium check verified text output, default and selected mail greetings, zero browser API requests during correction, one reused worker, successful API responses and invalid-input HTTP 400. A 1,000-word browser input took 1,613 ms with 73 UI heartbeat ticks while processing. No console or page errors were observed. The test used temporary verification tooling, not a new application dependency.

The committed `data/nlp/five-priorities-validation.json` records the measurements and source checksums; `data/nlp/priority-quality-report.json` includes the development category metrics.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run quality:priorities
npm run nlp:data -- data/nlp/wikipedia-documents.jsonl /tmp/slothai-release-splits
npm run nlp:evaluate -- --input=/tmp/slothai-release-splits/test.jsonl --model=lib/editor/neural/bounded-model.json --full-editor --threshold-floor=0.9999 --output=/tmp/slothai-release-quality.json --enforce
npm run build
npm run benchmark:check
```

Next work should fit approved real sentence pairs, evaluate against a separate reviewer-checked real set, and measure sentence-boundary and false-change precision before increasing model size. Adding forms or epochs alone is not proof of better language understanding.
