# Automatic WordLM and PunctCase — 5 November 2026

WordLM and PunctCase now run automatically for both text and email correction,
in the browser Worker and the optional HTTP API. The activation checkbox and
experimental label have been removed. A legacy `usePunctCase` boolean is accepted
for compatibility but cannot disable inference. Offline ablation options remain
available to development tools, outside the product's request options.

## What runs

- WordLM's existing validation-selected joint policy ranks uncertain spelling
  candidates using context and edit-channel penalties. It preserves established
  words, explicit accents, entities and technical terms. Every request also scores
  editable prose and records actual token/candidate counts. The browser model
  includes all **150,000 selected vocabulary words**, 23 special symbols,
  20,000 retained bigrams and 40,000 retained trigrams. These are the existing
  bounded projection, not every n-gram in the offline SQLite model.
- PunctCase uses the complete original **39,434-parameter float32 checkpoint**.
  Editable prose is checked inside Markdown, HTML, lists and link labels, even
  when other punctuation exists. Code, link destinations, existing marks,
  identifiers and signatures remain protected. Overlapping windows cover gaps
  around the trained 96-token window boundary. Accepted edits must preserve the
  word sequence and be fixed points of both correction and PunctCase.
- Per-request model receipts are returned in metadata and saved with the existing
  browser transform log. Scores and counters describe inference, not correctness
  confidence. Personal lexicon overrides, when present, happen after these receipts.

Examples through the application strategies:

| Input | Automatic result | Model decision |
| --- | --- | --- |
| `gul əkdik` | `Gül əkdik.` | WordLM selects the Azerbaijani flower in planting context. The context-free `gul` remains `Gul.`. |
| `qeyd edək ki bu məsələ hələ araşdırılır` | `Qeyd edək ki, bu məsələ hələ araşdırılır.` | PunctCase adds the comma without an activation option. |
| `**qeyd edək ki bu məsələ hələ araşdırılır**` | `**Qeyd edək ki, bu məsələ hələ araşdırılır**.` | Prose is corrected while Markdown delimiters survive. |

## Training status

PunctCase fitting already completed four full CPU epochs with early stopping
(patience two), selecting epoch two. Epochs three and four did not improve the
selection loss. The selected checkpoint is
`028592bc1db1843f15e73d3eb97d1fc6c69b9e2b7462e46fa9059582bf03c543`.
No missing training step or measured need for more epochs was found. This change
does not retrain or tune its policy on the development cases. JavaScript/PyTorch
parity remains within 0.0000058 over 1,280 fixture logits, below tolerance 0.001.
See the [full training receipt](../training/punctcase-full-2026-11-02.json).

CharSpell's separate full CPU job has completed two epochs and entered epoch
three. It is still running and **has not been promoted** into the application.
Its checkpoints, optimizer/RNG state and recovery instructions continue to be
saved and remotely verified in the
[CharSpell backup Release](https://github.com/Sanan2030/SlothAI/releases/tag/charspell-backup-2026-11-04).
The observed report and backup receipt are preserved in the integration recovery.

## Validation

| Check | Result |
| --- | --- |
| Node suite | 5,582 passed, zero failures, eight pre-existing TODOs; 5,590 total |
| Real Chromium UI tests | Nine passed; both modules, automatic model log receipts, weights loaded, actual comma edit, protected markup, repeat stability |
| Frozen 10,000 development inputs | 9,760 matching approved references, unchanged from previous main; 240 disagreements remain |
| Regression and stability | Zero output differences from previous main on those 10,000 cases in either pass; all 2,712 correct inputs preserved; zero unstable results or exceptions |
| Actual production Worker | 20,000 requests, zero Node output differences or exceptions; both models automatic and loaded in every request; second pass explicitly sends legacy `false` |
| PunctCase acceptance | Holdout 395/500 and preservation 2,000/2,000; zero added regressions or instability |
| Model usage per 10,000-input Node pass | WordLM: 148,078 scored tokens, 23,449 ranked positions, 67,959 candidates. PunctCase: 142,078 tokens. Both models loaded in every request. |
| Standard core latency gate | Passed; 5,000-word p95 5.64 seconds on this CPU |
| Whole application strategy | All sizes passed; 5,000 words across five chunks, worst of three repetitions 5.83 seconds, including both models; CharSpell training shared the CPU |
| Other checks | TypeScript, ESLint, production build and the exact CI language/model reproduction command sequence passed locally |

The 10,000 inputs are the previously frozen assistant-authored compositional
development corpus, not independent real-user or blind acceptance data. Its
original bytes and explicit gold errata are unchanged. Neither model made extra
accepted changes on this corpus after the existing correction stages; its 97.6%
reference agreement does not measure an improvement from this integration or
establish perfect accuracy. The model-specific examples and UI tests separately
prove accepted model decisions. One older unit expectation was linguistically
reviewed for the requested joint mode: `gul əkdik` now restores `Gül`; a separate
context-free abstention assertion remains. No frozen corpus reference was edited.

The source corpus SHA-256 is
`8ba2ebe6562eeae56e6422b0f92ea3dce26c19823002295afc7767c3f07c9eee`.
The evaluated base is `8a7dd0874deb74b2f11e89035f777d32309eb1c2` plus the recorded
runtime file hashes. Recovery packaging verifies those exact files against the
committed source and checks that all runtime JSON models remain unchanged.

## Recovery and reruns

The [integration recovery Release](https://github.com/Sanan2030/SlothAI/releases/tag/automatic-models-2026-11-05)
contains pinned, checksum-verified downloads: exact application source, complete
before/after outputs, the 240-error queue and decision traces, browser receipts,
training status, validation logs and restore instructions. The original six
training gzip archives and bulk prepared training data are excluded. The previous
[10,000-case recovery](https://github.com/Sanan2030/SlothAI/releases/tag/novel-10000-qa-2026-11-04)
remains available as development history.

Use fresh output directories for reruns:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm run punctcase:validate -- --output=/tmp/punctcase-automatic.json
npm run benchmark:check
node --import tsx scripts/qa/benchmark-automatic-models.ts --out=/tmp/automatic-latency.json
node --import tsx scripts/qa/evaluate-novel-10000.ts --out=/tmp/automatic-node
# With the production app already running on localhost:3100:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node --import tsx scripts/qa/browser-novel-10000.ts --url=http://127.0.0.1:3100 --node-results=/tmp/automatic-node/results.jsonl --out=/tmp/automatic-browser --require-automatic --legacy-false
```

Chromium's executable path is environment-specific. The saved Node and browser
passes retain the historical `default` / `punctcase` report keys: both now run
automatically; the second pass checks ignored legacy request fields.
