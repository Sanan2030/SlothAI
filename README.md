# SlothAI — local Azerbaijani text editor

Text correction runs **directly in the browser**. The default mode uses Qwen3 4B through WebLLM in a dedicated Web Worker. No cloud inference, API key, Redis connection or source-text upload is involved. A separately selected simple-rules mode needs no model download.

## Local model setup

WebLLM is pinned exactly to **0.2.82** because newer releases introduced a reported ShapeTuple disposal regression on integrated GPUs ([upstream issue #844](https://github.com/mlc-ai/web-llm/issues/844)). Do not replace this pin with a caret range without GPU regression testing. Failed workers are terminated and the load button is restored, so disposed engines cannot be reused. If the GPU driver has already hung, fully restart the browser before retrying. Client diagnostics appear in browser DevTools, not Vercel function logs; they omit source text. This mitigation is tested at the worker-protocol level, not on the affected physical GPU.

Select **Yerli dil modeli**, click **Modeli yüklə**, wait for **Model hazırdır**, then enter text and click **Düzəlt**. Model downloads begin only after clicking the load button. The first download is several GB from Hugging Face and MLC's model-library CDN. WebGPU, shader-f16 support and several GB of available GPU memory are required; the 32K context allocation needs more memory than the model's default 4K configuration. Low-memory/mobile devices may fail. Errors are shown inline; choose simple rules explicitly if the device cannot run the model. There is no hidden cloud fallback.

Weights may be reused from browser cache, subject to browser eviction/storage policies. A fresh page load still requires the website; this is not an offline PWA. Stop terminates the worker and frees its active model; retry by loading it again. It does not erase cached weights. Closing the page also terminates processing.

The full input is sent to the local model in one request to retain sentence context. Input is limited to 10,000 UTF-16 code units, with a 32,768-token context and 8,192-token output ceiling. Context/memory errors and incomplete generations are surfaced rather than silently truncating the result. Very long or token-dense text may need manual splitting. Thinking is explicitly disabled. Model instructions preserve meaning, restore diacritics, fix punctuation/capitalization, form paragraphs/lists and format business emails. These are goals, not guarantees: Azerbaijani quality has not been benchmarked here, and names, numbers and facts must be reviewed. Model outputs are escaped text. No invented correction count is displayed for model output.

References: [WebLLM](https://webllm.mlc.ai/docs/user/basic_usage.html), [Qwen3 4B model card and Apache 2.0 license](https://huggingface.co/Qwen/Qwen3-4B), [MLC quantized model](https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC).

## Start

```sh
npm install
npm run dev
```

Open http://localhost:3000. No `.env.local` setup is required. Old `LLM_PROVIDER`, `OPENAI_*`, `ANTHROPIC_*` and `UPSTASH_*` settings are ignored, including empty or invalid values. You can remove these unused variables from Vercel.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

## Simple-rules mode

- Restores known Azerbaijani spellings and diacritics, including selected inflected forms, from `lib/editor/lexicon.ts`.
- Applies explicit conversational rules, conjunction commas, sentence capitalization and ending punctuation.
- Keeps existing paragraphs and inserts paragraph breaks at selected explicit topic transitions.
- Formats consecutive `1) ... 2) ...` or `birinci: ... ikinci: ...` items into numbered Markdown lists. Unmarked prose is kept as prose.
- Preserves recognized URLs, email addresses, numeric dates/times/decimals, fenced/inline code, identifiers and acronyms.
- Formats an email draft with a subject, salutation, original corrected body and sign-off. If no subject exists it uses the neutral `Mövzu: Müraciət`; it does not invent people, facts or commitments and never sends email.

Example:

```text
salam necesen mende yaxsiyam amma bu aralar pisem
```

becomes:

```text
Salam, necəsən? Mən də yaxşıyam, amma bu aralar pisəm.
```

## Limits

Simple-rules mode is **not a general grammar checker**. Unknown words remain unchanged. Ambiguous ASCII words such as `yag`, `gul`, `sira`, `et`, and `el` are not guessed. It cannot reliably infer every Azerbaijani suffix, proper name, intended meaning or sentence boundary. Review either engine's output.

The displayed change count estimates the affected span of whitespace-separated words; it is not an exact linguistic error count. `detectedLanguage: az` identifies the configured editing language, not automatic language detection. Both input and API validation limit source text to 10,000 UTF-16 code units.

## Architecture

The browser imports the same Strategy registry used by the optional server routes. `lib/strategies/bootstrap.ts` centrally registers text and email strategies. Each strategy delegates to the selected engine; prompts and local worker lifecycle live in `lib/local-model`. The page calls `.transform()` directly rather than fetching `/api/transform`; output is rendered as text, not HTML. Only initial model asset retrieval uses the network in model mode. API routes support rules only; requesting a model engine through HTTP fails strict validation with status 400.

Optional compatibility endpoints:

- `GET /api/strategies`: array of strategy descriptors.
- `POST /api/transform`: `{ "strategyId": "text-corrector", "text": "salam", "options": { "preserveFormatting": false } }`.
- `GET /api/health`: liveness check.

The HTTP endpoint has Zod validation and an in-memory sliding-window limiter. This limiter resets on cold start and is per instance. It does not affect browser editing. External callers of that endpoint necessarily submit their text to this server, but the server does not forward it anywhere.

Add reviewed entries to `lib/editor/lexicon.ts` to improve word coverage; do not introduce global single-letter substitutions. Extend `lib/editor/correct.ts` with narrowly scoped, tested rules. New processing modes implement `ITextTransformationStrategy` and register in bootstrap; the selector reads its descriptors automatically.

## Deploy

Deploy branch `codex/fix-llm-provider` in Vercel, or merge its PR into your production branch. No secrets are needed. A successful preview build does not automatically replace your `main` production deployment.

Tests cover the reported rules example, ambiguity preservation, protected spans, explicit lists, paragraphs, repeated processing, emails, length limits and rules API/strategies with network calls forbidden. Model tests cover prompt construction, incomplete/invalid output rejection and worker lifecycle with a mock worker. Type checking, lint and production build must also pass. Actual GPU inference and Azerbaijani correction quality require verification on a WebGPU-capable device; mocked tests do not establish linguistic accuracy.
