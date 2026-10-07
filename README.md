# SlothAI

A deterministic Azerbaijani text and email editor. The primary UI runs in the
browser after application assets load. There is no LLM, model download, Python
service, API key, GPU requirement or network call during correction.

## Validation status

Name-free document fragments now train a separate small offline spelling ranker; source ownership, synthetic-error provenance, limitations and reproducible results are documented in [document training](docs/document-training.md).

`main` contains the offline editor. Changes must pass typecheck, lint, build,
the full regression suite, 1000 exact frozen gold targets with stable second
passes, and the enforced performance benchmark. Passing these engineering gates
does not certify arbitrary Azerbaijani grammar or full semantic understanding.

See the [latest performance and quality audit](docs/performance-audit/README.md): warm Node medians are 66 ms for 200 words and 245 ms for 900 words; the existing holdout is 299/300 and the new assistant-authored holdout is 291/300. Cold import plus first correction remains about 2.7 seconds. The new holdout still contains two incorrect changes to otherwise correct words. These results do not establish general semantic understanding.

See the [earlier spelling/context evaluation](docs/a-h-release-report.md) for
the separately frozen 300-sentence engineering holdout, before/after metrics,
unresolved cases and provenance. The earlier [stabilization report](docs/stabilization-report.md)
is a historical audit, not the current release status.

The browser worker allows up to 10 minutes per correction, then terminates the
worker with a clear timeout message. This watchdog is independent of the
unchanged performance benchmark budgets and optional server API limits.

See [CI morphology fixes and institutional training](docs/institutional-training/README.md): the unseen suite now passes 400/400; 120 generic state/corporate scenarios train an experimental offline ranker. It remains outside the browser bundle because separate validation/test cases show no additional gains.

## Local development

Node >=20.9 (Node 24 used for validation):

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

Dev, typecheck, tests and build each prepare the dictionary from checked-in,
SHA-256-verified sources. A fresh clone does not need a generated file or an
environment file. Dependency installation requires the npm registry. To run the
benchmark directly after a fresh installation, first run:

```sh
npm run dictionary:import -- public/dictionaries/az
npm run benchmark
npm run benchmark:check
```

`npm run build` creates the production application; `npm start` serves it.
Vercel uses `npm ci`, matching CI's lockfile installation.

## Implemented architecture

`app/page.tsx → EditorClient → central worker → strategy → correctText/formatEmail`

On supported devices, two local expert workers prepare spelling and sentence-boundary
proposals after 400 ms of idle typing. The central worker reuses only accepted results
whose stage context is unchanged; otherwise normal inference runs. Smaller devices
retain one worker. This adds parallel execution, not general semantic understanding;
see [implementation and validation](docs/parallel-inference/README.md).

The optional `POST /api/transform` endpoint uses exactly the same strategies.
Both paths accept at most 10,000 UTF-16 code units; an email's subject and its
separator count toward that limit. API payload:

```json
{"strategyId":"text-corrector","text":"men bu gun mektebe getdim","options":{"preserveFormatting":false}}
```

Statuses: 200 success, 400 malformed/invalid input, 404 unknown strategy, 429
rate limited, 500 unexpected failure. The limiter is bounded but **instance-local,
best-effort**: it resets on cold starts and is not distributed protection.

The correction order is protected spans → lexical spelling → phrase/context
rules → sentence boundaries/punctuation/capitalization → layout → span restoration.
Terminology preparation precedes lexical protection so phrases such as
`open api` can be recognized. Lexical technical terms remain visible to clause
rules; punctuation-bearing terms and code/URLs use opaque placeholders.

Production spelling now passes through `language-services.ts`.
`LanguageServices` exposes lemma, morphology and spelling contracts.
`correctText(input, preserveFormatting, { services, trace })` supports isolated
implementation replacement and optional development tracing. Tracing currently
reports spelling changes only; it is disabled by default. No global per-request
service mutation is needed.

The legacy dictionary adapter retains historical surface-as-lemma records; these
are not linguistic analyses. A separate source-inflection adapter now recovers
source lemmas and selected harmonic noun/verb suffix chains from pinned stem
classes. It is partial morphology, not full contextual POS or syntax analysis.
Generated coverage and engineering test success do not imply human review.

## Dictionary policy

- 42,936 source records (upstream header says 42,937).
- 38,174 unique source entries; 38,172 matchable base entries.
- 100,000 bounded runtime forms: 61,828 single-step generated forms.
- Generated `lib/editor/generated/*.json` files are build artifacts, not tracked.
- The pinned source, license, checksums and generated metadata are tracked.
- Byte-for-byte regeneration is tested.
- FLAG long uses pairs of characters, not a whole multi-flag string.
- Only complete single-step SFX strip/add/condition rules are supported.
- 14 malformed/unsupported rule lines and 11 malformed flag records are skipped.
- Prefixes, compounds, continuation classes and cross products are unsupported.

This is not every Azerbaijani word, nor a guarantee that every upstream form is
linguistically valid. The 100k limit bounds memory; it is not an accuracy metric.
See [third-party notices](THIRD_PARTY_NOTICES.md).

## UI, metadata and performance

The active UI is `app/page.tsx`; unused legacy UI components were removed.
SlothAI is the user-facing brand; repository/Vercel project names are unchanged.
Dark/light theme, copy, clear, keyboard shortcut, emoji and full-word highlights
remain. Reduced-motion users receive a static emoji and non-animated highlights.

Diff uses a 32-token lookahead, O(tokens) memory and bounded O(tokens × 32)
alignment. Changed words and inserted punctuation are highlighted; deletions
have no output glyph. Distant moved passages can conservatively appear changed.
There is no full-document quadratic matrix.

`correctionsMade` is an approximate changed-token estimate, not a grammatical
error count. `processingLanguage: "az"` describes the configured language.
`detectedLanguage` remains a deprecated compatibility alias; no language
detection is performed. The compatibility value `engine: "local-rules"` includes
the deterministic rules and the bundled small local statistical models.

Benchmarks separately report engine and UI diff avg/p50/p95 latency and
approximate process memory. The logical 5,000-word case is split into safe
chunks for the editor; it is not one API request. Hosted-runner timing varies.

## Validation and CI

The workflow installs pinned dependencies, prepares the dictionary once,
typechecks, runs all regressions, builds and enforces benchmarks. Silent npm
invocation preserves machine-readable benchmark JSON. Failure exit codes are
propagated; summary/artifact steps run even after a failure.

All 240 corpus cases execute the real engine with exact expected comparisons
and idempotency checks. Diagnostics include input, expected, actual, mode and
category. `node --import tsx scripts/report-regressions.ts` writes category
counts and detailed failures and exits nonzero if any remain.

A workflow alone does not enforce GitHub branch protection or make Vercel wait
for tests. The inspected main branch was unprotected. Required-check settings
must be configured before calling this a mandatory merge gate.

## Local language engine (September 2026)

The October reviewed training release adds a retrained compact attention
fallback and strict approved-data provenance checks. See
[reviewed neural training](docs/reviewed-neural-training.md) for frozen splits,
measured gains, remaining errors and complete reproduction commands.

The additional compact neural sentence-boundary head restores missing gaps
without changing spelling or deleting user punctuation. See
[sentence-boundary training](docs/neural-sentence-boundaries.md) for the isolated
ablation, checkpoint selection, regression gates and remaining limitations.

The editor combines reviewed dictionary entries, productive morphology, true
lemma/POS analyses for reviewed stems, a conservative ordered-context perceptron,
and a supervised sentence-gap classifier. Training is offline; inference stays
in TypeScript with the bundled JSON model. No paid API or Python runtime is
required in the browser. Ambiguous corrections can abstain instead of guessing.
Correct explicitly accented words and protected technical terms are preserved.

The evaluation corpus contains 1,000 exact editorial targets: the frozen 460
RSD/IT and 340 mail inputs plus 100 new text and 100 new mail cases. The new
200 are compositional synthetic cases, authored before evaluation; they are
not a blind natural-language corpus. All targets are assistant-reviewed, not
independent human linguist certification, and are excluded from model training.
Six explicitly documented errors in the previous targets were corrected,
including dotted Azerbaijani capitals, English identifier capitalization and
missing grammatical punctuation. The original 800 input hashes are unchanged.

The current engine matches all 1,000 targets exactly, and a second processing
pass preserves all 1,000 outputs. Previously correct cases remain protected.
Thirty separately authored fresh inputs also pass both text and email-body
expectations. These datasets do not establish arbitrary-text accuracy.

Run `npm run gold:check` to enforce the frozen input/target hashes and baseline
cases; `npm run gold:exact` requires all 1,000 exact outputs. Both checks are
required in CI. `npm test` includes all 1,000 exact and second-pass checks.
`npm run local-ai:fresh:check` enforces the separate fresh cases. CI also
rebuilds both the synthetic cases and the model and checks reproducibility.

General semantic understanding, exhaustive Azerbaijani morphology/POS,
arbitrary-text punctuation, general technical suffix orthography, distributed
rate limiting and complete Markdown/HTML structural parsing remain future work.
The small classifiers are not a transformer or an LLM. See
[the current 1,000-case report](docs/gold-1000-2026-09-30.md).

Historical proposal/corpus-review documents describe earlier iterations; current
behavior and limitations above take precedence.

## Reviewed examples saved to a file

The feedback action now writes `slothai-reviewed-tests.json`, containing the raw
input, recorded generated output, user-specified expected output, module,
formatting/greeting options and review timestamp. It does not train the model,
confirm personal dictionary rules or replay a saved expected result. Existing
exact-input browser-memory lookup is no longer used by the application.

On browsers supporting the File System Access save picker, select a file once
per page session; subsequent saves read its current contents and append/update
the reviewed example. After reopening the application, select the same file.
Existing unrelated or invalid JSON is rejected before writing. Write failures
are shown inline and do not silently switch to another storage method.

Other browsers download the accumulated corpus. Use “Mövcud test faylını aç”
to load a previous day's JSON before saving additional examples. Downloaded
copies are managed by the browser; they cannot silently overwrite an arbitrary
computer file. The corpus is not uploaded to GitHub or another server.

To rerun a saved file against the current engine:

```bash
npm run review:test -- /path/to/slothai-reviewed-tests.json
```

This writes a sibling `.results.json` report with input, expected and current
actual output and exits nonzero if any case differs. Mail evaluations use the
saved greeting and the application's subject-free mode. No stored target is
used as a correction lookup. To have this assistant inspect the data later,
attach the saved JSON file when requesting the review.

### Context training release

The local classifiers are retrained with 60 additional authored context examples
from a new 120-example corpus; 24 validation and 36 test examples stay reserved.
Correct accepted context decisions improve from 15/36 to 28/36 with no wrong
accepted decisions. Full outputs on those new examples are only 24/36 exact;
the existing 200 synthetic held-out full outputs improve from 57 to 59 exact.
This remains a small statistical editor, not a professional general AI.

`npm run local-ai:context:check` enforces the reserved context safety gate, while
`npm run local-ai:evaluate` also protects previous-release per-pair distances.
Training writes complete artifacts through atomic file replacement. See
[the training report](docs/local-ai-training-2026-09-30.md) for data separation,
results, reproducibility and limitations.
