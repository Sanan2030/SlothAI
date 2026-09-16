# lazy.ai

A single Next.js 16 App Router application for restoring informal Azerbaijani text with Claude Sonnet 5. React 19, TypeScript 5, Tailwind CSS 4, Zod 4 and ESLint 9 are pinned in `package.json`, with a reproducible npm lockfile. The existing SlothAI repository and the supplied lazy-ai implementation were used as the starting point.

## Run locally

Requires Node.js >=20.9.0 (Node 22 LTS recommended).

```sh
npm install
cp .env.example .env.local
```

Set `ANTHROPIC_API_KEY` in `.env.local` to your Anthropic API key, then:

```sh
npm run dev
```

Open http://localhost:3000. The UI and strategy discovery work without a key; transformations require a valid key with access to `claude-sonnet-5`. A missing key produces a controlled `CONFIGURATION_ERROR`. This is an API credential, not a ChatGPT or Claude subscription.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Google fonts are loaded using `next/font/google` (Fraunces + IBM Plex Sans, both latin and latin-ext); the build environment needs access to Google Fonts. Model output is displayed as selectable, read-only plain text that preserves Markdown lists and paragraph breaks. Copy retains that formatting. Gmail Düzəldici creates an email draft and does not connect to Gmail or send messages.

## Architecture and extensions

Both route handlers import **only `getRegistry()` from `lib/strategies/bootstrap.ts`** to obtain strategies. Bootstrap caches an initialization promise, so concurrent requests share one complete initialization within a function instance. Each independently bundled serverless route loads its own full registry. No route populates global state for another route.

To add a mode, create a new file implementing `ITextTransformationStrategy` with an exported class, then add exactly **one line to one existing file**, inside `initialize()` in `bootstrap.ts`:

```ts
registry.register(new (await import('./impl/new-mode')).NewModeStrategy());
```

Literal dynamic imports are statically discoverable by Turbopack. No route, selector, icon map or page changes are necessary. The UI reads descriptors from the API. Registration and strategy constructors must not call the LLM or require credentials.

`lib/strategies/impl/text-corrector.ts` restores contextual diacritics, punctuation, paragraphs, Markdown lists and capitalization, preserving source meaning. `gmail-corrector.ts` adds subject, salutation, business body and sign-off without inventing identities or commitments. Both use a shared prompt and defensively parse and validate the model's JSON contract. Correction counts are model estimates, not a deterministic diff.

The wrapper uses the Anthropic SDK, hardcodes the requested model ID, disables thinking and omits temperature/top_p/top_k. It distinguishes refusals, truncated responses, timeouts, empty output, invalid JSON and invalid result fields. Timeout is 50 seconds with no SDK retries, fitting the 60-second function budget; long inputs may still require retrying in smaller pieces. Raw provider errors and source text are never logged or returned by the app.

## API

`GET /api/strategies` returns:

```json
{"strategies":[{"id":"text-corrector","name":"Mətn Düzəldici","description":"...","icon":"FileText"},{"id":"gmail-corrector","name":"Gmail Düzəldici","description":"...","icon":"Mail"}]}
```

`POST /api/transform` accepts JSON:

```json
{"strategyId":"text-corrector","text":"salam sabah goruse qelirem"}
```

Optional `options` supports `tone` (`default`, `formal`, `casual`), `preserveFormatting` and up to 10 `customRules` (300 characters each). The public UI intentionally uses the default correction behavior. Input must be a nonblank string of at most 10,000 UTF-16 code units, matching the textarea's counter and limit. The server bounds the raw JSON body at 100,000 bytes, including escaped Unicode, before parsing it.

Success shape:

```json
{"transformedText":"Salam, sabah görüşə gəlirəm.","metadata":{"correctionsMade":4,"detectedLanguage":"az","executionTimeMs":1200,"strategyUsed":"text-corrector"}}
```

This is an illustrative response, not a measured model result.

Error shape is always `{"error":{"code":"...","message":"..."}}`; validation errors additionally include `issues` containing field paths and messages from Zod 4's `.issues`.

- **400**: invalid JSON/content type/body length, failed validation, unknown mode, or `LLM_REFUSAL`.
- **429**: `RATE_LIMITED`, with `Retry-After` in seconds.
- **500**: controlled configuration, provider, response parsing or internal failures.

Responses are not cached; transform responses include rate-limit limit, remaining, and Unix-seconds reset headers. `GET /api/health` is a lightweight liveness endpoint, not a live model credential check.

## Vercel

Import this repository as **one Next.js project**, using the repository root. Add `ANTHROPIC_API_KEY` as a server environment variable for the desired deployment environments. No `NEXT_PUBLIC_` prefix and no CORS configuration are needed. Run a local production build before deploying.

`vercel.json` configures Frankfurt (`fra1`), a practical European region near Azerbaijan, and requests 60 seconds / 1024 MB for `app/api/**/route.ts`. The effective memory allocation can depend on Vercel's compute mode and plan. No deployment is performed by this code change.

## Operational limits

The timestamp-based sliding window allows 10 requests per IP per 60 seconds and is checked before body parsing. Expired keys are cleaned up and key cardinality is bounded. It resets per cold start and is not shared across function instances; replace it with Vercel KV / Upstash Redis before relying on global limits at scale. The previous optional Upstash adapter is replaced by this requested first-version limiter.

On Vercel, the limiter trusts the platform-overwritten `x-vercel-forwarded-for` header. On another host, configure a trusted reverse proxy to overwrite `x-forwarded-for`; missing IPs share a fallback bucket. This is a public endpoint without account authentication or a global spending cap. Configure provider spending limits and distributed abuse controls for a broad public launch.

Texts are sent to Anthropic for processing, as disclosed in the UI. The application does not persist them or automatically send email. LLM corrections are probabilistic: review names, numbers and meaning before use. Tests mock model replies; passing them does not establish linguistic accuracy or confirm live account/model access.

## Verification

Tests cover genuine sliding-window expiry, bounded limiter capacity, request length and whitespace validation, malformed JSON, missing result fields, registry initialization through the transform route first, concurrent bootstrap calls, both strategy implementations, exact SDK parameters, refusals, truncation, API error codes and rate-limit ordering. CI runs lint, type checking, those tests and a production build without a real API key.
