# SlothAI — local Azerbaijani text editor

Text correction runs **directly in the browser**. The default mode uses Qwen3 1.7B through WebLLM in a dedicated Web Worker. No cloud inference, API key, Redis connection or source-text upload is involved. A separately selected simple-rules mode needs no model download.

## Local model setup

On page entry and window focus the editor checks the real WebLLM weight cache (manifest plus every tensor shard). Complete cached weights show **Modeli işə sal**, missing/partial weights show **Modeli yüklə**, and inaccessible storage shows an explicit unknown-state message. Loading reuses WebLLM's existing disk-backed browser cache; it does not export files to the user's Downloads folder. Persistent browser storage is requested on the user's load click, but browsers may decline. GPU initialization is still necessary on each new page session. Use the same stable site URL and browser profile: caches are origin-specific, so different Vercel deployment URLs do not share model files. Clearing site data or browser eviction requires downloading again. This cache check covers weights; missing supporting tokenizer/config/WASM assets may still be fetched when starting the model.

WebLLM is pinned exactly to **0.2.82** because newer releases introduced a reported ShapeTuple disposal regression on integrated GPUs ([upstream issue #844](https://github.com/mlc-ai/web-llm/issues/844)). Do not replace this pin with a caret range without GPU regression testing. Failed workers are terminated and the load button is restored, so disposed engines cannot be reused. If the GPU driver has already hung, fully restart the browser before retrying. Client diagnostics appear in browser DevTools, not Vercel function logs; they omit source text. This mitigation is tested at the worker-protocol level, not on the affected physical GPU.

Select **Yerli dil modeli**, click **Modeli yüklə**, wait for **Model hazırdır**, then enter text and click **Düzəlt**. Downloads start only on click, from Hugging Face and MLC's model-library CDN. Qwen3 1.7B replaces 4B to reduce compute and GPU memory pressure, using the supported 4096-token context; the library estimates about 2 GB GPU memory, but device requirements vary. It requires a separate initial download even if the previous 4B model is cached. The smaller model can be less accurate. WebGPU and shader-f16 support remain necessary; low-memory devices may still fail. There is no cloud fallback.

Weights may be reused from browser cache, subject to browser eviction/storage policies. A fresh page load still requires the website; this is not an offline PWA. Stop terminates the worker and frees its active model; retry by loading it again. It does not erase cached weights. Closing the page also terminates processing.

Input remains limited to 10,000 UTF-16 code units. Longer text is processed sequentially in chunks of at most 1400 UTF-8 bytes, split at whitespace without dropping input. A 1800-token output ceiling fits alongside each chunk and prompt in the 4096-token context. Chunk boundaries can reduce contextual accuracy and introduce paragraph breaks; extremely long unbroken strings are rejected explicitly. Email prompts restrict greetings to the first part and sign-offs to the last. Streaming reports part count and generated character count, without showing unfinished output as a complete result. The main-thread watchdog terminates workers after 60 seconds without inference activity or 120 seconds without load progress; absolute limits are 10 minutes for a full transformation and 15 minutes for loading. Cancellation and timeouts clear the ready state and permit retry. Thinking is disabled; incomplete output is rejected. Review names, numbers and meaning: actual GPU speed and Azerbaijani quality have not been benchmarked on the user's device.

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
