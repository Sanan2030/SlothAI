# Stabilization validation — 2026-09-23

## Release decision

**Incomplete; do not promote this branch to production.** The 240-case corpus
previously validated only metadata, not corrections. The baseline failed 180
exact comparisons. The executable suite now passes 65 and fails 175, including
stability checks. The expectations were not rewritten to make tests green.
All 89 pre-existing tests now pass; 9 new non-corpus tests also pass.

Working branch: `codex/stabilize-main`, based on freshly fetched main
`e67438f15482060dfa6bdbfeffcc343962ee8a00`. This report does not claim that all
requirements in the stabilization request have been completed.

## Fixed issues

- Silent npm benchmark invocation produces valid JSON and preserves failure
  status. CI now runs all tests and build as well as typecheck and benchmarks.
- Next.js 14.2.35 → 16.3.6, React 18.3.1 → 19.3.0, ESLint 8 → 9.39.5, matching
  Next ESLint config and React types. Migration through 15.5.26 still retained
  a vulnerable bundled PostCSS chain, so the supported 16.3.6 release was used.
  No affected async request APIs, Server Actions, images or middleware were found.
- Old audit: 4 high + 1 critical (Next, bundled PostCSS, Next lint plugin/glob).
  New audit: **zero advisories reported**. No forced audit fix or overrides.
- Vercel installation now uses `npm ci`. Typecheck regenerates dictionary data,
  fixing the fresh-clone dependency on a local generated artifact.
- Generated dictionary is excluded from git; preparation reconstructs 100,000
  forms from pinned, checksummed inputs. Byte-for-byte reproduction passes.
- FLAG long parsing handles two-character flags; malformed and unsupported SFX
  lines are skipped and counted. Full Hunspell semantics are not claimed.
- UI diff no longer allocates a document-size matrix; full words and inserted
  punctuation are highlighted using bounded lookahead.
- Production spelling really uses replaceable lemma/morphology/spelling
  services. Contract tests swap each service on the production path. Optional
  spelling event tracing requires no allocation when disabled.
- Email section normalization recognizes inline closings before prose editing.
  Unicode-aware closing boundaries fix detection of `Hörmətlə`.
- Technical preparation now precedes protection; lexical terms remain visible
  to clause rules. This repairs existing OpenAPI and technical-boundary tests.
- Removed five unused legacy UI components, utility helper, clsx and
  tailwind-merge. Emoji animation lives in a separate component so its timer
  does not rerender the complete editor, and it observes reduced-motion changes.
- Input limits are shared, including mail subject length. Textarea is labelled,
  brand matches metadata, and metadata no longer claims real language detection
  or an exact grammatical error count in the UI.

## Actual tests

| Check | Result |
|---|---|
| npm ci | Pass |
| dictionary import | Pass |
| typecheck | Pass |
| ESLint | Pass |
| npm test | **163 pass / 175 fail / 338 total** |
| production build | Pass, Next.js 16.3.6 |
| benchmark and benchmark:check | Pass |
| benchmark:json --enforce | Valid JSON, all engine/diff gates pass |
| deterministic placeholder stress | Pass, 30 collision-like inputs |
| malformed/blank/oversized API payloads, unknown strategy | Pass |
| API/direct strategy parity and no-network legacy tests | Pass |

Corpus breakdown:

| Category | Pass | Fail |
|---|---:|---:|
| diacritic | 3 | 2 |
| punctuation | 18 | 23 |
| typo | 5 | 16 |
| context | 20 | 80 |
| technical | 16 | 27 |
| morphology | 3 | 27 |

Full input/expected/actual/idempotency diagnostics are recorded in
`stabilization-regressions.json`. Original expected texts remain unchanged.
An attempted broad suffix/punctuation implementation was removed after it
changed valid meanings and introduced regressions; it is not part of this branch.

## Performance

Node 24.19.0, warm measurements. Milliseconds; process memory includes Node,
tsx, runtime and indexes, not browser-only memory.

| Words | Engine avg | Engine p50 | Engine p95 | RSS peak MB | Diff avg | Diff p50 | Diff p95 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 1.63 | 1.59 | 1.93 | 156.36 | 0.24 | 0.11 | 1.56 |
| 100 | 4.02 | 3.92 | 4.55 | 156.36 | 0.59 | 0.55 | 0.74 |
| 500 | 13.67 | 12.8 | 17.23 | 156.48 | 2.81 | 2.77 | 2.99 |
| 1000 | 24.67 | 24.3 | 26.59 | 156.86 | 5.53 | 5.48 | 6.12 |
| 5000 | 118.27 | 118.33 | 120.3 | 158.61 | 29.5 | 29.82 | 31.52 |

5000 words are a logical document of 37,528 characters split into **5** engine
chunks; this is not a single request. A separate 5,000-short-token diff test
also verifies bounded execution. These timings are measurements, not guarantees.

## Production and remaining work

The existing Vercel production deployment was inspected: `READY`,
`dpl_FTxUvZK9NbvoKSBk8qTmZZoTsqBR`, main commit `e67438f...`,
https://sloth-ai.vercel.app. It does **not** contain these branch changes.

Main was unprotected when inspected. CI correctness checks alone cannot stop a
direct push or force Vercel to wait; repository protection/integration settings
are still required. No such account setting was changed.

Remaining blockers: 175 corpus mismatches, productive suffix restoration,
generic typo candidates, contextual ambiguity resolution and general sentence
segmentation. Broad technical-suffix orthography is also not implemented.
The new candidate interface is only an extension contract. Linguistic quality
must be repaired with reusable rules and reviewed sources before promotion.

Browser automation could not start its daemon in this environment; no claim is
made about a completed visual/mobile/copy/animation end-to-end verification.
Production server startup with explicit localhost binding reported Ready, but
the subsequent HTTP request could not connect. HTTP smoke verification therefore
also remains incomplete.

Security sources reviewed: https://nextjs.org/blog/nextjs-security-update-september-22-2026
and https://nextjs.org/docs/app/guides/upgrading/version-16 .
