# Neural expansion and main audit

Base main commit: `7c96784953db719393fd6bad3deb5035c4df7afd`.

## Training and measurement

Added 48 authored exercises covering mail, IT, science, daily life, business,
education and service contexts: 24 training, 8 validation, 16 frozen test rows.
The new test file was evaluated against the previous published artifact before
training. It is stored in `data/neural/expansion-baseline.json` and is never
updated by CI. Targets and contexts are not used in gradient updates or
threshold calibration. The spelling families do overlap with training: this
checks transfer to another sentence, not unseen-lemma semantic understanding.
These are assistant-authored synthetic errors, not human-certified user data.

Current corpus has 272 lexical exercises, including 128 natural contexts, and
216 unique grammar feature vectors. NFC/folding and bigram-Jaccard checks found
zero exact duplicates, near duplicates at the configured 0.8 cutoff, or split
leaks. This is a lexical similarity check, not a semantic deduplication model.
The immutable v1 seed still contains evidence from its original template corpus.

Rebuild uses the existing deterministic schedule: 72 epochs then 24 continuation
epochs. Both lexical stages improved validation loss and were retained; grammar
updates were rejected because they did not improve validation loss. Active
lexical head reached 120 cumulative epochs, grammar stayed at 24. There are still
795 total parameters including the frozen lexical anchor; no new dependency,
GPU, hosted API or larger hidden layer was added.

On the new frozen 16 sentences the complete editor improved from 6/16 to 16/16
exact outputs; neural spelling alone improved from 5/16 to 16/16. The previous
20 development contexts remain 20/20 in the complete editor (19/20 neural-only),
and the earlier 14 probes remain 14/14. The larger lexical exercise evaluation
was 53/66 exact at this release, leaving 13 unresolved exercises. Those were
subsequently fixed; see [neural-thirteen-fix.md](neural-thirteen-fix.md). Grammar feature classification
and correction remain 50/50, but these are symbolic synthetic tests. These
numbers do not establish general grammar or meaning comprehension.

## Regression found and corrected

Full regression tests found that the newly trained head changed valid `qrupa`
to `qrupu` in a correspondence sentence. Both are plausible noun forms; a
spelling score must not choose the grammatical case. Raising the threshold to
0.9 alone did not solve it (the incorrect proposal scored about 0.935).

The morphology seam now conservatively abstains when raw and proposed words are
two vowel-harmonized regular case endings of the same exact dictionary stem.
It checks consonant-ending stems, dative, accusative, genitive, locative and
ablative endings and leaves case choice to the grammar stages. It does not
infer arbitrary dictionary POS, accept misspelled roots, or fabricate full
loanword paradigms. Existing reviewed morphology and explicit-letter guards
remain active. Tests cover unrelated stems, malformed endings and valid clauses.

## What is unnecessary in main?

A static local import graph from all five App Router entrypoints reaches 76
library/component/model files. Follow-up reference searches distinguish
runtime code from offline tooling. No unused production dependency was found:
React/Next power the app, lucide-react supplies UI icons, Zod validates requests,
and Tailwind/PostCSS/autoprefixer compile CSS. TypeScript, tsx and ESLint are
build/test tooling. No Anthropic/OpenAI SDK or LLM API client exists in this main.

| Item | Evidence and action |
| --- | --- |
| Logistic optimization inside `scripts/train-neural.ts` | Neural training previously called `trainPaired()` and discarded its learned weights, split rules and calibration. It now calls shared `collectPairedEvidence()` instead, avoiding the unused 30-epoch logistic fit. Evidence stays identical; the legacy paired trainer still performs its full training. |
| `lib/editor/entities/sources.ts` | No code imports its exported object. It is a provenance catalog referenced by entity documentation/types, so it has no runtime cost. It could be moved into documentation rather than maintained as a TS module; deleting provenance is not recommended. |
| `docs/*-results.json` and historical `docs/*-verification.json` | Historical diagnostics, not runtime inputs. CI already uploads fresh diagnostics. They could be archived or kept as CI artifacts to reduce repository noise, preserving frozen baselines and reproducibility records. They do not slow correction requests. |
| `lib/editor/error-categories.ts` | Test-corpus schema only, not an unused runtime module. Keep for corpus validation. |
| `lib/editor/local-ai/expand.ts` | Offline trainer and regression tests use it. Keep for rebuilding established context evidence. |
| `lib/editor/local-ai/reliability.ts` | Evaluation script and tests use it. Keep for reliability measurement; it is not loaded by the app. |

Rule dictionaries, productive morphology, POS, paired/context/boundary models and
neural heads are all currently part of the hybrid correction flow. Removing
these simply because a neural head exists would remove behavior covered by
regression tests. Python corpus builders, source dictionaries, licenses, frozen
checkpoints and baseline fixtures also remain necessary for reproduction and
honest evaluation, even though they do not run for user requests.

## Remaining work

The primary limitation is still linguistic coverage, not unused libraries.
Prioritize genuinely reviewed error/correction pairs, broader morphology,
validation examples where the correct action is to change nothing, and a
larger frozen real-world holdout. The current hashed-context MLP cannot infer
arbitrary meaning or rewrite a sentence like a general language model.
See `neural-expansion-verification.json` for actual checks, artifact size and
local latency. Timings are local warm measurements, not a Vercel latency SLA.
