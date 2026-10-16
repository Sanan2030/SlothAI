# WordLM integration — 17 October 2026

SlothAI now uses a bounded projection of the completed az-v1 WordLM as a
conservative fallback in the shared correction engine. Both browser Workers and
the optional HTTP API use this path. No Python service, SQLite download or API
key is required by users. CharSpell/PunctCase full completion is not claimed.

## Completed offline model

Run `20261016` finished at 2026-10-16 20:00:15 UTC (17 October, 00:00 Baku).
The durable completion state was read back after successful publication.

| Property | Recorded result |
| --- | ---: |
| Clean train sentences | 3,287,357 |
| Train prediction tokens including EOS | 59,080,575 |
| Vocabulary cap / minimum frequency | 150,000 / 2 |
| Discount | 0.75 |
| Derived tables | 4/4 complete |
| Validation sentences | 1,082,532 / 1,082,532 |
| Validation prediction tokens including EOS | 15,538,971 |
| Full-model mapped-class perplexity | 368.94687650171585 |
| Zero-probability tokens | 0 |

The [completion receipt](wordlm-full-2026-10-17.json) binds the accepted manifest
and full SQLite SHA-256 `923a3832c167329d0bf5bb967c1a06bc9aeaf84516d2079308dce0a411cefc7b`.
The 2,913,161,216-byte SQLite artifact and durable recovery parts remain outside
Git; the source text corpus is not shipped in the app. No test split was read
for this fitting, export or validation. These are language-model probabilities,
not measured real-user correction accuracy.

## Browser projection and behavior

`training/export_wordlm.py` retains the entire vocabulary and continuation
unigram distribution, plus the top 20,000 continuation bigrams and 40,000
trigrams. Ties are ordered lexically. No validation examples choose these
limits. For each retained history, missing discounted direct probability mass
returns to lower-order backoff. This deliberately changes the full distribution
while preserving normalization; missing contexts back off completely.
It is a statistical projection, not int8 quantization or a neural export.

The [export receipt](wordlm-browser-2026-10-17.json) records **8,459,691 JSON bytes**,
**1,782,693 gzip bytes** and the exact artifact/exporter hashes. Those gzip bytes
measure this JSON alone, not the total application download. The compiled client
bundle contains the model hash. Maps initialize lazily when a genuine ambiguity
reaches the fallback; the JSON itself remains a bundled asset.

The TypeScript scorer matches the source's NFC/Azerbaijani I/İ rules, suffix OOV
mapping and token boundaries, including non-decimal Unicode number categories.
Its separate [full-split validation](wordlm-browser-validation-2026-10-17.json)
measures the **pruned browser model**: perplexity **1419.0475512630517**, with
**0 zero-probability tokens** over the same **15,538,971 predictions**. This is
worse than the full SQLite model's perplexity. The full-model result must not
be attributed to the export.

The integration only considers unresolved lowercase ASCII words, with 2–8
dictionary alternatives and at most two neighboring words per side. It retains
existing lexical, grammatical, name/identifier, accent and literal guards.
It requires a finite score, retained lexical context and a 20:1 local likelihood
margin over the runner-up. Generic OOV/suffix-class transitions alone do not
count as lexical evidence. Sentence punctuation and protected placeholders break
context. This fixed margin is an engineering guard, not real-error calibration.

Example: `bu seher gozeldir` → `Bu şəhər gözəldir.`; the trace identifies the
WordLM decision. Explicit `səhər` / `şəhər` stay distinct. Existing handling of
`Kamran seher meşəni qoruyur.` stays `Kamran səhər meşəni qoruyur.`; the model
cannot use an unknown-name class as lexical evidence for changing this choice.
Use `correctText(text, false, { useWordLM: false })` for same-code ablation.

## Verification and limitations

- Node suite: **5,546 total, 5,537 pass, 0 fail, 9 existing TODO**; no skipped tests.
  The TODO defects are still unresolved, not successful corrections.
- **23 new WordLM tests**: hashes/export bounds, normalization of all retained
  histories, OOV mapping, Unicode parity, learned contextual choice, abstention,
  ablation and preservation. Export tests check deterministic output, normalized
  pruning and rejection of failed/incomplete/corrupt completion inputs.
- Python: **35 contracts, 30 pass, 5 optional neural tests skipped** because
  PyTorch is absent in this environment. No new neural training is claimed.
- Typecheck, ESLint and production build passed. Production `/`, health and
  strategies returned 200; POST transform returned `Bu şəhər gözəldir.`.
- Enforced warm Node latency budgets passed, including 7,626.39 ms p95 for the
  logical 5,000-word chunked case under the existing 10,000 ms ceiling. Checks
  overlapped other work; this is not a controlled speed comparison, real browser
  Worker startup/download measurement or mobile latency/RAM promise.

The [same-code on/off ablation](wordlm-correction-ablation-2026-10-17.json) leaves
the existing holdout at **393/500** and preservation set at **2,000/2,000**, with
no output changes in either set. There is **no demonstrated aggregate quality
gain on those sets**. The new direct regression confirms an exercised WordLM
path, not representative real-user benefit. The existing 12 user-derived
development references remain 4/12 exact; they are not blind human certification.
See [quality details](wordlm-quality-2026-10-17.json) and
[verification record](wordlm-verification-2026-10-17.json).

## Reproduce without retraining

Supply the exact offline SQLite artifact separately. From the repository root:

```sh
npm ci
npm run wordlm:export -- \
  --model /path/to/wordlm.sqlite \
  --state docs/training/wordlm-full-2026-10-17.json \
  --out /tmp/slothai-wordlm.json --report /tmp/slothai-wordlm-export.json
cmp /tmp/slothai-wordlm.json lib/editor/wordlm/model.json
npm run wordlm:validate -- /path/to/validation.jsonl /tmp/slothai-wordlm-validation.json
npm run wordlm:ablation
npm test
npm run training:test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

Export verifies the full-model SHA and completed finite/zero-error receipt.
Validation verifies the exact accepted manifest and validation bytes before
scoring; the test split is never opened. These tools do not train on evaluation
references or fit the margin. Fresh installation/dev/build does not export or
train anything. Source attribution and the publisher-rights limitations are in
the repository's `THIRD_PARTY_NOTICES.md` and accepted collection records.
