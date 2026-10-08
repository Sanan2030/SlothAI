# Stage 2: preserve explicit word mentions

Base: `dcfd12baad2c18c5996f57d7ca1aed96b1155ee1`, branch
`phase2-no-harm`. No model was trained. Model weights, thresholds, browser
logging, source approvals, frozen gold and phase0 references are unchanged.

## Change and cause

The archived no-harm failures have three causes, reproduced by isolated existing
layer calls in `cause-categories.json`: four entity capitalization changes, one
lexical folded-form replacement, and one conjunction punctuation insertion.
`scripts/eval/diagnose.ts` was also executed with its output redirected to a
temporary directory; its existing word/head diagnostics do not isolate those
six failures by themselves.

An exact established form directly preceding an explicit linguistic label
(`sözü`, possessed case forms, or `termini` and its case forms) is now shielded
as a literal before spelling, entity and punctuation processing. The guard uses
dictionary/morphology evidence and grammatical labels, with no token-specific
exception, learned threshold, calibration, or phase0-derived target lookup.
Unknown forms retain the normal correction path. Nearby ordinary prose remains
editable, and existing quoted-word behavior is unchanged.

Personal lexicon rules now also respect ASCII email addresses, HTML comments
and unfinished fenced code. For example, a confirmed context-sensitive rule
learned from `ali example` → `veli example` cannot rewrite `ali@example.az`.
The owner-controlled browser journal and storage behavior were not changed.

## Development references

`development.json` contains 400 assistant-authored, compositional correct
sentences: 120 linguistic mentions, 240 ordinary prose sentences, and 40
contact/URL contexts. References were fixed and SHA-256 recorded before their
first engine evaluation. No phase0/gold inputs were used in construction.
No random sampling or training occurred; the construction is deterministic
and has no random seed or training hyperparameters. `trainingAllowed: false`.

This small templated set is not independently reviewed natural text, human
linguistic certification, or calibration. Its baseline was already 400/400;
the after result checks preservation and does not demonstrate new-model gains.

## Measured acceptance

| Check | Before | After |
| --- | ---: | ---: |
| Assistant-authored development exact | 400/400 | 400/400 |
| Development harmed words | 0/1,644 | 0/1,644 |
| Phase0 no-harm harmed words | 5/8,000 (0.0625%) | 0/8,000 (0%) |
| Phase0 no-harm changed sentences | 6/2,000 | 0/2,000 |
| Phase0 holdout exact | 393/500 | 393/500 |
| Phase0 recall | 83.125% | 83.125% |
| Recall bootstrap 95% CI | [78.9649%, 86.2342%] | [78.9649%, 86.2342%] |
| Phase0 unstable outputs | 0 | 0 |
| Existing fixture outputs changed | — | 0/4,861 |
| Existing fixture unstable outputs | 0 | 0 |
| Mode-aware frozen gold | 1,000/1,000 | 1,000/1,000 |
| Node tests passed | 4,111 | 4,515; none failed/skipped |

The final phase0 run is acceptance-only. Its targets and hashes were untouched.
The development and acceptance reports are kept separately. Bootstrap uses the
existing document-cluster convention, 1,000 resamples, seed 20261007. A zero-event
bootstrap interval is degenerate and is not proof of zero future risk.

Typecheck, lint, production build, production home/API smoke requests, and the
existing enforced benchmark passed. Benchmark warm p95 was 651.6 ms at 1,000
words and 3,305.22 ms for a logical 5,000-word document split into five requests.
It ran after the other CPU-intensive checks completed. These are current Node
measurements against the existing budgets, not a controlled before/after
speedup, natural browser latency, or evidence of the later training gates.

## Reproduce

Run from `/workspace/SlothAI`, with installed lockfile dependencies and generated
dictionary:

```sh
node --import tsx scripts/eval/stage2-development.ts --enforce
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark:check
node --import tsx scripts/eval/run.ts --out=/tmp/sloth-stage2-acceptance
node --import tsx scripts/eval/snapshot.ts --compare=/tmp/sloth-stage2-before.json --snapshot-out=/tmp/sloth-stage2-after.json --out=/tmp/sloth-stage2-fixtures
```

Create the `before` fixture snapshot on the base version with the same snapshot
command, omitting `--compare`, before changing runtime code. The development
baseline was run with `--editor` pointing to an unmodified export of the base
library plus its retained dictionary and data files, outside the checkout.
Both development runs completed with exit 0.

To avoid overwriting the tracked gold report, create a temporary directory with
an empty `docs` subdirectory and a `tests` symlink to this checkout. From that
directory run:

```sh
node --import /workspace/SlothAI/node_modules/tsx/dist/loader.mjs /workspace/SlothAI/scripts/evaluate-independent-gold.ts --require-exact --enforce-baseline
```

## Scope and remaining blockers

This guard protects explicit linguistic mentions. It does not resolve arbitrary
contextual false positives, validate all imported forms linguistically, improve
holdout recall, calibrate classifier scores, or introduce CharSpell/WordLM.
Legacy model heads remain active. No broader semantic-quality claim is made.

The accepted five-million corpus is not present in this cloud machine. The
user supplied a download-link document, whose six gzip metadata entries match
the repository receipt. Actual downloads are blocked: the proxy rejects the
`chatgpt.com` CONNECT request with HTTP 403. Only the accepted manifest and
archived report hashes could be verified locally. `data:gate` fails with exit 2
because the canonical corpus manifest and six JSONL files are absent.

Draft network additions `chatgpt.com` and `api.github.com` were saved for review;
they do not by themselves update runtime access. The Git push route works, but
the GitHub API request currently also returns Forbidden. No alternate corpus
was created, no credentials were extracted, and full or smoke training has not
started. Training remains on hold until the exact corpus can be accessed and
passes its gate. CPU training is authorized; no GPU is attached. Real user-error
calibration data and independent human-reviewed evaluation are still required
for later stages and have not been supplied.
