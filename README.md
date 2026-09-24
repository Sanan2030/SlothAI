# SlothAI

A deterministic Azerbaijani text and email editor. The primary UI runs in the
browser after application assets load. There is no LLM, model download, Python
service, API key, GPU requirement or network call during correction.

## Stabilization status

The production baseline inspected was `e67438f` on `main`. The new full
240-case corpus runner exposes substantial previously untested language gaps.
**This stabilization branch is not yet a production-ready release.**
See [validation report](docs/stabilization-report.md) and the machine-readable
[case diagnostics](docs/stabilization-regressions.json). Do not merge while the
correctness gate is red.

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

`app/page.tsx → strategy bootstrap → strategy → correctText/formatEmail`

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

The legacy dictionary adapter exposes surface forms through the historical
lemma interface; it is **not true lemmatization**. Legacy morphology recognizes
reviewed generated forms, marked `source: "legacy"`; it does not parse suffix
chains. Do not interpret its surface-as-lemma records as linguistic analyses.

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
detection is performed. `engine: "local-rules"` accurately describes execution.

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

## Roadmap, not implemented

Productive morphology/true lemmas, indexed typo generation, frequency/ngram
context, general grammatical parsing, arbitrary-text punctuation accuracy,
general technical suffix orthography, distributed rate limiting and complete
Markdown/HTML structural parsing remain future work. Candidate-generator
contracts provide an extension seam, not an implementation claim.

Historical proposal/corpus-review documents describe earlier iterations; current
behavior and limitations above take precedence.
