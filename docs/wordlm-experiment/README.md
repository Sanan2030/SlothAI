**Integrity, editor lists and local WordLM diagnostics — 23 October 2026**

The normal application retains the established correction policy. The new joint
WordLM ranker is explicitly experimental, enabled only through `CorrectionRuntime`
or the local diagnostic CLI. No model weights or frozen reference texts changed.

**Changes**

- Core correction, final numeric/context rules, personal rules and speculative
  proposal validation share code/URL shielding. `www.` and naked-domain paths,
  query strings, inline code and fenced code remain opaque. Composite HTML/link
  protection uses a single scan to avoid nested placeholders. Code is also
  shielded before Markdown-label rewriting, OCR detection and email-section
  parsing, including greetings/closings embedded in a fenced example.
- Nested HTML block wrappers preserve paragraph boundaries and semantic marks.
  Pasted lists remain lists. Native paragraph line breaks map to separate blocks.
- Numbered/bullet commands operate on logical selected blocks, preserve inline
  formatting, support a collapsed caret, switch type and toggle back to paragraphs.
  CSS explicitly restores list markers hidden by the Tailwind reset. Generated
  textual list prefixes become semantic list items without duplicate markers.
- An emptied output remains editable. Range bookmarks live only in detached DOM
  clones; paste/drop splice the rich document without invalid nested paragraphs.
- Next and its ESLint configuration are 16.4.2, sharp is 0.35.5 and source-map-js
  is 1.2.2. Production dependency auditing and Chromium list/edit checks were added
  to the existing CI gate. The remote GitHub workflow itself was not run here.

**Local decision diagnostics**

```sh
npm run editor:diagnose -- --input=/path/to/input.txt --out=/tmp/editor-decisions.json
```

This explicitly invoked local command reports the same input under four modes:
`rules`, `wordlm` (rules + WordLM), `full`, and `experimental`. Rules mode still
uses morphology and artifact-derived lexical evidence; it is not an independent
linguistic rules baseline. Explicit `useWordLM: true` can now enable WordLM while
the other bundled inference stages are disabled.

Stage events identify the rule/model/format stage, its input/output and a changed
interval. Outer document/layout events summarize nested stages, so events must
not be summed as independent error counts. Candidate events retain the raw word,
preceding pipeline result, spelling-rule proposal, baseline fallback proposal,
dictionary/morphology/edit alternatives, retain-input choice, LM log score,
OOV adjustment, edit-channel score, selected output and acceptance/abstention
reason. Model and rule decisions within the contextual spelling stage are labeled
separately. Raw offsets refer to the literal-shielded spelling snapshot; stage
offsets refer to that stage's input, not the original document globally.

The engine never stores or uploads diagnostics. Reports contain the submitted
document text and are written only to the caller's explicit output path/stdout.
Protected spans can appear as opaque internal markers in stage snapshots.

**Experimental joint selection**

```ts
correctText(input, false, { wordLMMode: 'experimental', diagnostics: onDecision });
```

Raw spelling evidence is captured before model/rule rewrites, after literal
shielding. Bounded monotone token alignment reconnects unambiguous one-word
repairs. Ambiguous multiword rewrites are skipped. At most eight candidates
include the original input, preceding decision, dictionary, morphology and
bounded edit proposals. Explicit valid inputs, names, terms and original
diacritics retain guards. Context never crosses punctuation or opaque spans.

The ranking combines LM context with existing synthetic edit-channel counts,
structural edit penalties and a change penalty. OOV class mass is not treated
as the probability of one unseen surface: a vocabulary-size adjustment distributes
that mass heuristically. This and all joint scores are engineering estimates,
not calibrated real-error probabilities. The original spelling remains a choice.
Insufficient evidence or margin retains the existing pipeline/fallback result.

**Validation and acceptance**

```sh
npm run wordlm:select -- --out=docs/wordlm-experiment
```

Eight configurations are compared only on the existing 100 validation pairs
from 20 target families plus their 20 identity references. The chosen policy is
written before opening either frozen acceptance dataset. Validation rejects
previous-exact regressions, additional false edits per row and increased aggregate
harm. A failed validation gate leaves the policy unchanged and does not open
acceptance sets. Acceptance failures exit nonzero without retuning on those sets.
No reserved calibration, test or phase0 targets fit any weights or thresholds.

Selected weights: LM 1, edit penalty 4, change penalty 1, minimum joint margin
`log(100)`. Validation exact outputs increase **61/120 → 62/120**; false token
edits decrease **39 → 38**, with no newly harmed correct words or previous-exact
regression. These are correlated assistant-authored synthetic development cases.

| Frozen acceptance | Baseline | Experimental | New false-edit rows | Unstable outputs |
| --- | ---: | ---: | ---: | ---: |
| holdout-500 | 393/500 | 393/500 | 0 | 0 |
| no-harm-2000 | 2000/2000 | 2000/2000 | 0 | 0 |

The acceptance gate passes but demonstrates **no aggregate held-out improvement**.
`promotionEligible` is false and the application default remains unchanged.
See [validation](validation.json) and [acceptance](acceptance.json). Real-error
calibration and a new independently reviewed evaluation remain necessary.

**Verification**

Local verification: **5,560 Node passes, 0 failures, 8 existing language TODOs**;
**7 Chromium checks passed**. ESLint, TypeScript, production build and enforced
performance checks passed. HTTP home/health/strategies and transform smoke checks
returned 200. See [verification](verification.json) and [HTTP examples](http-smoke.json).

The [standard warm Node benchmark](benchmark.json) measured p95 **830.75 ms**
at 1,000 words and **3,418.17 ms** for a 5,000-word document in five requests.
In the separate [paired experimental profile](latency.json), 1,000-word p95 was
**1,012.88 ms** for the normal pipeline and **1,310.54 ms** for experimental
selection. The profiles use different synthetic texts and are not directly
comparable. Experimental ranking adds work; these are local engine measurements,
not browser/mobile/network guarantees.

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run test:browser
npm run benchmark:check
node --import tsx scripts/benchmark-wordlm-selection.ts --out=/tmp/wordlm-latency.json
npm audit --omit=dev
```

Browser tests use the production build. Install Chromium with
`npx playwright install chromium`; an existing executable can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Seven Chromium checks cover
selection, list toggle/type switching, partial selection, pasted wrappers/marks,
empty output, plain-text numbered paste, line breaks and adding a next list item. Firefox/WebKit and physical
mobile devices have not been tested in this change.

The existing URL TODO is now a blocking regression assertion. Eight unrelated
language TODOs remain with their original references. The full dependency audit
also still reports development-tool advisories (7 high, 2 moderate), including
the unpatched braces 3.0.3 chain through Tailwind/fast-glob and selector parsing.
Production dependency audit reports zero vulnerabilities. A separate build-tool
migration/patch is needed; a clean production audit is not a clean all-dependency
audit.
