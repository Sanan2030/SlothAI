# Asynchronous document execution

Base: `2dc336543930f83b3a49f90211b8c49c2e7bd091`.

Previously, one pending correction blocked both UI modules, and a speculative
head failure shut down the entire optional pool. Text and mail now have separate
pending state and errors. A user can start a text correction, switch to mail, and
submit that draft while the first request is pending. Results, metadata and log
entries retain the submitting module. Repeated clicks in the same module cannot
submit duplicate work.

## Scheduling

`EditorClient` runs independent documents in a bounded pool. Each worker keeps
the established full-document editor pipeline, including its stage order,
context checks, arbitration and language guards. Dependent model stages within
one document are still sequential. This change adds no models or weights.

The default budget uses browser-reported logical cores, optional `deviceMemory`
and data-saving preferences:

| Resources | Editor workers | Optional expert workers |
| --- | ---: | ---: |
| Fewer than 4 cores, known memory below 4 GB, data saving, or unavailable Worker | 1 attempted on explicit submission | 0 |
| At least 4 cores and no known low-memory/data-saving constraint | 1 | Up to 2 |
| At least 8 cores and known memory of at least 8 GB | 2 | Up to 2 |

Unknown memory never enables the second editor. These are coarse browser
reports, not measurements of available RAM. Bundled dictionaries and models are
copied into worker memory. On smaller devices, independent requests enter a FIFO
queue; the UI thread remains available while the worker computes. The queue
accepts at most four waiting requests in addition to running work.

Every request has an immutable text/options snapshot, a unique ID, and an
execution deadline that starts on dispatch. Responses from another task or a
terminated worker are ignored. A timeout or worker failure rejects only that
worker's active task, and queued work can use a replacement. Disposal rejects
all remaining tasks and terminates all owned workers.

After the existing 400 ms input debounce, preparation warms editor imports and
can run the existing independent spelling and sentence-boundary heads. Loading
state changes no longer invalidate a prepared result; input, module and IME
changes still do. Explicit correction never waits for speculation and reuses
only compatible completed proposals. An expert error or five-second watchdog
disables only that head for the pool's lifetime; its healthy peer continues.
Missing proposals use the existing central inference path.

## Verification

| Check | Result |
| --- | --- |
| Complete Node regression suite | 4,523 passed; no skips or failures |
| Focused editor/expert routing and lifecycle tests | 18 passed |
| TypeScript and ESLint | Passed |
| Production Turbopack build | Passed |
| Existing enforced latency benchmark | Passed; thresholds unchanged |
| Production browser, 8-core / 8 GB profile | Text and mail dispatched to two native workers |
| Production browser, 2-core / 2 GB profile | Both modules accepted; second task queued on the same worker |
| Production browser with one editor failure | Mail completed; text error stayed in the text module |
| Out-of-order delivery and browser-local logs | Correct module outputs and log entries |

The production UI check holds actual worker results until both modules submit,
then delivers them in reverse request order. It also injects a worker error to
exercise isolation. These are controlled scheduling checks, not natural latency
measurements. See [browser-ui.json](browser-ui.json).

The separate native-worker benchmark compared one versus two warmed editor
workers for a 900-word text document plus a 700-word mail document. After four
warm-up pairs per configuration, nine counterbalanced samples had medians of
**414.9 ms serial** and **269.3 ms parallel**, a **1.54×** pair speedup. Outputs
were identical and task intervals overlapped. See the individual samples in
[browser-benchmark.json](browser-benchmark.json).

A second run using the committed reproduction script measured **480.5 ms**
versus **306.5 ms**, a **1.57×** pair speedup, again with identical outputs and
overlapping execution. Its raw samples are in
[browser-benchmark-reproduced.json](browser-benchmark-reproduced.json).

That measurement excludes worker initialization and optional speculative
preparation. Accepted-corpus preparation was also running in the background.
It establishes the benefit for this independent-document workload on this
machine; it does not establish faster single-document execution or the same
speedup on every device.

Reproduce the standard checks from the repository root:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

Browser checks use optional Playwright and esbuild tools, with no changes to the
application dependencies. With Chromium already installed, install those tools
outside the checkout and start the production app in a separate terminal:

```sh
npm install --prefix /tmp/slothai-browser-tools --no-save playwright esbuild
npm run start -- -H 127.0.0.1 -p 3132
```

Then run:

```sh
node scripts/async-editor/check-ui.mjs \
  --tools=/tmp/slothai-browser-tools --browser=/usr/bin/chromium \
  --url=http://127.0.0.1:3132 --out=/tmp/slothai-async-ui.json
node scripts/async-editor/benchmark.mjs \
  --tools=/tmp/slothai-browser-tools --browser=/usr/bin/chromium \
  --out=/tmp/slothai-async-benchmark.json
```

The benchmark builds the actual editor worker into a temporary folder, serves
only its three test assets on a loopback port, and cleans up afterward. It checks
output equality and overlap without enforcing the observed 1.54× as a universal
threshold.

## Cloud training

Implementation and validation used a separate Git worktree. The running cloud
training checkout, corpus, trainer sources and weights were preserved. Full
model training and later artifact evaluation remain separate from this browser
scheduling change; this commit does not promote unfinished model artifacts.
