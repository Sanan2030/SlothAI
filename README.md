# SlothAI — local Azerbaijani text editor

Text correction now runs **directly in the browser**, using a bundled, reviewed word list and explicit formatting rules. There is no AI model, AI API, API key, Redis connection, or text upload in the editor flow. Once the page has loaded, editing and correction work without a network connection. A fresh page load still requires the website; this is not an installable offline PWA.

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

## What it does

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

This is a conservative rule-based editor, **not a general grammar checker or language model**. Unknown words remain unchanged. Ambiguous ASCII words such as `yag`, `gul`, `sira`, `et`, and `el` are not guessed. It cannot reliably infer every Azerbaijani suffix, proper name, intended meaning or sentence boundary. Review the output. Tone rewriting and free-form editing instructions have been removed because the local engine cannot honestly fulfill them.

The displayed change count estimates the affected span of whitespace-separated words; it is not an exact linguistic error count. `detectedLanguage: az` identifies the configured editing language, not automatic language detection. Both input and API validation limit source text to 10,000 UTF-16 code units.

## Architecture

The browser imports the same pure Strategy registry used by the optional server routes. `lib/strategies/bootstrap.ts` centrally registers text and email strategies. The transformation functions contain no network or environment access. The page calls `.transform()` directly rather than fetching `/api/transform`; output is rendered as text, not HTML.

Optional compatibility endpoints:

- `GET /api/strategies`: array of strategy descriptors.
- `POST /api/transform`: `{ "strategyId": "text-corrector", "text": "salam", "options": { "preserveFormatting": false } }`.
- `GET /api/health`: liveness check.

The HTTP endpoint has Zod validation and an in-memory sliding-window limiter. This limiter resets on cold start and is per instance. It does not affect browser editing. External callers of that endpoint necessarily submit their text to this server, but the server does not forward it anywhere.

Add reviewed entries to `lib/editor/lexicon.ts` to improve word coverage; do not introduce global single-letter substitutions. Extend `lib/editor/correct.ts` with narrowly scoped, tested rules. New processing modes implement `ITextTransformationStrategy` and register in bootstrap; the selector reads its descriptors automatically.

## Deploy

Deploy branch `codex/fix-llm-provider` in Vercel, or merge its PR into your production branch. No secrets are needed. A successful preview build does not automatically replace your `main` production deployment.

Tests cover the reported example, ambiguity preservation, protected spans, explicit lists, paragraph preservation, repeated processing, email formatting, length limits and both API/strategy modes with all `fetch` calls forced to throw. This verifies that transformations do not rely on AI or other network services.
