# SlothAI

An Azerbaijani text and email editor built with Next.js 16, React and TypeScript.
It corrects spelling, punctuation, capitalization and layout using a dictionary,
partial morphology, rules and small bundled statistical/neural classifiers.
Correction runs locally in browser Workers after application assets load.
It requires no API key, Python service or GPU to use the editor.

**Current status — 9 October 2026:** the editor uses the Stage 2 preservation
guard. All six accepted corpus archives passed integrity checks and a fresh
full data gate. CharSpell, WordLM and PunctCase completed **100k-train/10k-validation
CPU smoke runs**; their offline artifacts await calibration and browser integration.
See the [measured training results](docs/training/smoke-2026-10-09.md) and
[code audit and prioritized fixes](docs/current-state-2026-10-08.md).

## What you can do

| Function | Current behavior |
| --- | --- |
| Text correction | Azerbaijani spelling, selected contextual rules, sentence boundaries, punctuation and capitalization; optional formatting preservation. |
| Email formatting | Corrects the body and adds the selected greeting and closing. The UI omits a subject. `gmail-corrector` is the formatter's strategy ID; it does not connect to Gmail or send mail. |
| Review changes | Word/punctuation highlights, editable output, copy, clear and keyboard shortcut. Deletions have no output glyph. |
| Personal lexicon | Suggests rules from edited output; rules take effect after explicit confirmation and can be removed. Stored in this browser. |
| Reviewed examples | Saves input, generated output, expected output and options to `slothai-reviewed-tests.json` for later regression checks. |
| Local journal | Automatically keeps up to 50 successful input/output records in browser `localStorage`, when storage is available. JSON export is a user action. |
| Appearance | Dark/light themes and reduced-motion support. |

Editor correction does not call the server API. Personal rules, the journal
and reviewed examples are not automatically uploaded or used to train a model.
Loading the site initially requires its assets; there is no guaranteed offline
installation/cache for reopening it without a network connection.

### Reviewed examples

With File System Access support, select a JSON file once per page session;
later saves read it and append/update the example. Select the same file after
reopening the page. Invalid/unrelated JSON and write failures are reported.
Other browsers download the accumulated file; open a previous file through
“Mövcud test faylını aç” before adding more examples.

To compare a saved file with the current engine:

```sh
npm run review:test -- /path/to/slothai-reviewed-tests.json
```

This writes a sibling `.results.json` and exits nonzero on differences. Expected
outputs are regression references, not correction lookups or automatic training.

## Run locally

Node **>=20.9**, with Node 24 used in this cloud environment:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Production:

```sh
npm run build
npm start
```

Dev, typecheck, tests and build regenerate the dictionary from checked-in,
SHA-256-verified sources. A fresh clone needs no environment file, generated
dictionary commit or training corpus to run the editor. Installing dependencies
requires access to the npm registry.

## How correction runs

```text
app/page.tsx → EditorClient → central Worker → strategy → correctText / formatEmail
```

The pipeline protects literal spans, applies lexical/context corrections,
restores sentence boundaries and punctuation, formats layout and restores spans.
Exact established words immediately before linguistic labels such as `sözü`
or `termini` receive the Stage 2 preservation guard. This is a limited guard,
not a guarantee that every correct word in arbitrary prose stays unchanged.

After 400 ms of idle typing, devices reporting at least four logical CPUs and
no data-saving preference can prepare proposals in two additional expert
Workers. The central Worker accepts only proposals with matching stage context.
Other devices retain one Worker. Selection currently does not check RAM.
The central correction watchdog is 10 minutes; it is not a latency target.
See [parallel inference](docs/parallel-inference/README.md).

`LanguageServices` exposes replaceable lemma, morphology and spelling contracts.
The source-inflection adapter covers selected suffix chains; legacy surface-as-lemma
records are not linguistic analyses. Development tracing covers spelling changes.
The bundled classifiers are compact local models; this project is not a general
language model or a guarantee of arbitrary Azerbaijani grammar/semantic accuracy.

### Limits and dictionary

- Maximum request size: **10,000 UTF-16 code units**. An API email's subject and
  separator count toward this limit. The logical 5,000-word benchmark uses chunks.
- The pinned dictionary has 42,936 source records, 38,174 unique entries and
  100,000 bounded runtime forms, including 61,828 generated single-step forms.
- Dictionary membership/generated coverage does not certify linguistic validity.
  Prefixes, compounds, continuation classes and cross products are unsupported.
- Literal protection covers selected code, URL, email and terminology patterns;
  complete Markdown/HTML parsing and Unicode email support remain incomplete.
- `correctionsMade` estimates changed tokens. `processingLanguage: "az"` is
  configured, not detected; `detectedLanguage` is a compatibility alias.
  `engine: "local-rules"` also includes the small bundled models.

See [third-party notices](THIRD_PARTY_NOTICES.md) for sources and licenses.

## Optional HTTP API

The Node.js API uses the same core strategies; browser personal rules are applied
by the UI and are not supplied to this API automatically.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/transform` | Correct text or format an email. |
| `GET /api/strategies` | List available strategies. |
| `GET /api/health` | Service liveness and timestamp; does not verify engine/model readiness. |

Example request to `/api/transform`:

```json
{"strategyId":"text-corrector","text":"men bu gun mektebe getdim","options":{"preserveFormatting":false}}
```

The current engine returns `transformedText: "Mən bu gün məktəbə getdim."` plus
metadata. For subject-free mail, use `strategyId: "gmail-corrector"` with
`options: {"emailGreeting":"Salam,","omitSubject":true}`. Greeting values come
from [email-greetings.ts](lib/editor/email-greetings.ts).

Statuses: **200** success, **400** invalid JSON/input/options, **404** unknown
strategy, **429** rate limited, **500** unexpected failure. Rate limiting is
30 requests per 60 seconds per client identifier, held in instance-local memory.
It resets on cold starts and is not shared across server instances.

## Current verification and quality

The recorded 8 October runtime/preparation commit `0bf77b9` passed GitHub production validation,
offline training contracts and its Vercel preview build. The recorded local suite
passed **4,515 Node tests, 18 data-tool tests and 16 training contracts**, plus
typecheck, lint, production build and enforced performance budgets. The training
contracts check infrastructure and model forward/gradient behavior, not trained
model quality. These are historical editor checks, not a fresh full application
suite for the later offline training changes. See [verification record](training/verification.json).

Archived [Stage 2 acceptance results](docs/stage2/README.md):

| Evaluation | Result | Interpretation |
| --- | --- | --- |
| Frozen editorial gold | 1,000/1,000 exact and stable | Assistant-reviewed engineering references; not independent human certification. |
| Phase0 holdout | 393/500 exact; precision 99.44%, recall 83.125% | Templated/synthetic errors, not representative real user quality; one correct word was harmed. |
| Phase0 preservation set | 0/8,000 harmed words; 0/2,000 changed sentences | Dictionary-word mention contexts, not arbitrary prose. |
| Stage 2 development | 400/400 exact before and after | Assistant-authored preservation check; no demonstrated accuracy gain on this set. |
| Existing user-derived diagnostic cases | 4/12 exact | Small development set with assistant targets; not a blind or representative test. |

These reports are existing measurements, not a new evaluation of the five-million
models. Stage 2 warm Node p95 was 651.6 ms at 1,000 words and 3,305.22 ms for a
logical 5,000-word chunked document. These are not browser/mobile latency promises
or a measured speedup from training preparation. Older reports below are historical.

## Five-million corpus: verified import and offline training

The accepted `az-v1` receipt describes **5,000,000 mechanically filtered clean
sentences and 5,000,000 synthetic pairs**. Identity pairs total 1,058,544 across
all splits. The accepted bulk files are outside Git. A **complete local corpus
must pass a fresh data gate before training**; tracked manifests/receipts alone
do not establish the presence or integrity of the bulk files.

| Split | Sentences / aligned pairs | Use |
| --- | ---: | --- |
| Train | 3,287,357 | Learn model parameters/counts. |
| Validation | 1,082,532 | Early stopping and model selection. |
| Test | 630,111 | Final measurement only; excluded from task preparation. |

Accepted manifest SHA-256:

```text
dcfbaf41c84d3eb1c92ad47ff3a633d5fae692a6075597ac579298f48cccb2fd
```

Check readiness without starting training:

```sh
npm run training:status
```

Exit 2 / `status: blocked` is expected until the exact files are supplied.
For uploads exceeding the 32 MiB executor transfer limit, use the offline
[browser transfer helper](training/transfer.html) to produce 30 MiB raw-byte
parts. It supports renamed files through explicit archive selection; the
reassembled original archive still needs its accepted hash checked.
The [training guide](training/README.md) covers verified import, the full data
gate, deterministic preparation, optional CPU/CUDA setup, 100k-sentence smoke
jobs, checkpoints and explicit full-run commands. The CPU training runtime was
checked here and all three smoke jobs completed on CPU. GPU execution has not
been checked and no GPU is attached. See the [run report](docs/training/smoke-2026-10-09.md)
for actual timings, memory, counts, configuration and synthetic validation.

| Offline experiment | Training input | Integration status |
| --- | --- | --- |
| CharSpell | Synthetic noisy→clean pairs plus identity examples | CPU smoke completed; character-CNN candidate scorer, Python checkpoint, browser export pending. |
| WordLM | Clean train text only | CPU smoke completed; SQLite Kneser-Ney 3-gram, correction benefit/lambda unmeasured. |
| PunctCase | Punctuation/case labels from clean train text | CPU smoke completed; character-CNN + BiGRU, browser export pending. |

Smoke used 100,000 train and 10,000 validation sentences, seed 20261007. CharSpell
completed in 32m47s, WordLM in 29s and PunctCase in 7m18s, including command startup
and hash guards. CharSpell changed-word top-1 was 64.92% when the target was
retrieved, or 60.63% including retrieval misses; it falsely changed 307/91,028
unchanged validation words. Its 97.95% aggregate top-1 includes many unchanged
words and is not overall correction quality. Full training remains a separate run.

Training is explicit. Editor installation/build/start never trains this corpus;
offline tools never automatically replace active app weights. Full training
requires a successful same-stage 100k–500k smoke receipt. Stage acceptance,
real-error calibration, TypeScript/int8 parity and browser integration are still
separate work. Calibration needs its own `data/calibration/` real-error set,
not the five-million corpus, test split or phase0 references.

The corpus has residual OCR/spelling/segmentation risk, limited email coverage
and synthetic errors. Synthetic validation must not be presented as real-text
accuracy. Source approval and rights limits are in the
[accepted corpus report](docs/stage1/collection/accepted-2026-10-08.md) and
[receipt](docs/stage1/collection/accepted-corpus.json).

## Development checks and delivery

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark:check
npm run data:test
npm run training:test
```

For benchmarks alone after a fresh install, first run
`npm run dictionary:import -- public/dictionaries/az`. Optional PyTorch contracts
use `npm run training:test:models` after installing the training environment.

[Production CI](.github/workflows/performance.yml) checks editor regressions,
dictionary/model reproducibility, build and performance. It rebuilds legacy
small model artifacts for comparison; it does not train `az-v1`.
[Training-tools CI](.github/workflows/training-tools.yml) runs offline contracts
without corpus training. Completed changes are delivered to **`main`** after
applicable checks, with normal pushes that preserve upstream history.

Vercel's existing Git integration builds the Next.js editor with `npm ci` and
`npm run build`; Vercel is not a training-job host. The inspected `main` branch
is unprotected. GitHub CI and Vercel deployment are separate: a workflow does not
by itself make deployment wait for CI.

Historical details: [reviewed neural models](docs/reviewed-neural-training.md),
[sentence boundaries](docs/neural-sentence-boundaries.md),
[document ranker](docs/document-training.md),
[performance audit](docs/performance-audit/README.md),
[gold references](docs/gold-1000-2026-09-30.md).
