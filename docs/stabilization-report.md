# Local editor validation — 2026-09-24

## Git and baseline

Work started on the latest verified `codex/stabilize-main` commit
`0957154e393745f481887a12bbd384735a3faa9f` (the original `main` was
`e67438f15482060dfa6bdbfeffcc343962ee8a00`). The earlier report from
2026-09-23 described a superseded build and must not be used as a baseline.
The initial suite had **338 tests: 337 passed and 1 failed**. The previously
failing workday case left an independent question without a question mark.
All 240 executable regression cases passed at baseline, with exact output and
idempotency checks.

## Changes

- Added a bounded sentence segmenter using finite predicates, dependent-form
  exclusions, conjunction classes, subject/temporal evidence, and a second
  predicate check. Participles before a noun remain attached. The workday
  question and two finite clauses with different subjects now split correctly.
- Added an indexed spelling candidate generator over the pinned local word
  list. Each lookup scans at most 120 entries and returns at most 12 candidates;
  a bounded cache avoids repeated work. Automatic replacement is intentionally
  limited to an unambiguous missing internal vowel in a lower-case word of at
  least six letters. Other edits remain suggestions and cannot rewrite unknown
  names or English technical terms on a nearest-word guess.
- Added productive, bounded noun and verb analysis, generation and suffix
  stripping behind the existing MorphologyEngine contract. The reviewed lemma
  set supports plural, possessive and case combinations as well as common
  finite verb tenses, person, negation, passives and participles. Analysis now
  returns an actual lemma and grammatical features for recognized forms.
- Added a structured email parser for subject, salutation, body, closing and
  signature. The signature remains outside prose correction. The mail subject
  field starts empty and offers a placeholder. Existing dense email behavior
  remains supported.
- CI reports lint, typecheck, tests, corpus, dictionary reproduction, build and
  performance independently, uploads diagnostics and applies a final combined
  gate. Component benchmarks cover segmentation, indexed typo lookup and
  morphology, alongside the editor and UI diff.
- Added 14 separately maintained holdout examples and targeted positive,
  counterexample, name, protected-span, signature and idempotency checks.
  Existing regression expected outputs were not changed. Two unit assertions
  were changed because an independent sentence now correctly starts with a
  capital letter, and a run-on sentence has a boundary.

## Actual validation

| Check | Baseline | Final local |
|---|---:|---:|
| Tests | 337 / 338 pass | 356 / 356 pass |
| Regression corpus | 240 / 240 pass | 240 / 240 pass |
| Holdout corpus | not present | 14 / 14 pass |
| npm ci | pass | pass |
| lint | pass | pass |
| typecheck | pass | pass |
| build | pass | pass |
| benchmark:check | pass | pass |
| dictionary reproduction | pass | pass |

Regression categories: diacritic **5/5**, punctuation **41/41**, typo **21/21**,
context **100/100**, technical **43/43**, morphology **30/30**. The regression
fixture has no email category; two of the 14 holdout examples are emails,
supplemented by the compact mail suite and 1,000 generated mail variants.
All exact outputs and repeat runs are evaluated by the test suite.

## Performance

Warm p95 in milliseconds on Node 24.19.0; baseline commands ran concurrently
with other validation, while final measurements were run separately, so the
comparison is indicative rather than controlled. A 5,000-word document is
split into five production-sized requests because the API limit is 10,000
characters per request.

| Words | Baseline p95 | Final p95 | Final target |
|---:|---:|---:|---:|
| 20 | 21.62 | 2.04 | 50 |
| 100 | 14.60 | 6.94 | 100 |
| 500 | 45.79 | 23.15 | 300 |
| 1,000 | 48.98 | 51.54 | 600 |
| 5,000 | 226.96 | 208.91 | 2,500 |

All separately measured component and UI diff gates passed. At 5,000 words
the component p95 values were **61.01 ms** segmentation, **11.78 ms** cached
typo lookup and **11.18 ms** morphology. Approximate process peak RSS rose
from **183.65 MB** in the baseline measurement to **234.27 MB** in the new
measurement; this is a material memory tradeoff for the additional indexes.
These are Node process readings, not a browser memory profile.

An actual local production server returned **200** for the health route, page,
text transform and mail transform; the text route returned
`Qatar gecikirdi. Sərnişinlər dayanacaqda gözləyirdi.` and the mail route
returned a structured subject, greeting, corrected body and closing.
The CLI browser daemon terminated at startup, so interactive UI, mobile view
and clipboard behavior have **not** been verified in a browser. Vercel preview
and GitHub Actions results still need checking after the remote commit.

## Linguistic limits

The generator does not safely fix every deletion, transposition, typo or
context-dependent homograph. Only reviewed lemmas receive productive feature
analyses; a recognized Hunspell surface form is not automatically assumed to
have a reliable lemma or part of speech. Clause splitting is deliberately
conservative when an independent clause cannot be distinguished from a
dependent phrase. The 14-example holdout is too small to imply general
Azerbaijani accuracy. Text correction uses local code and no model, API key,
network request or runtime model download.
