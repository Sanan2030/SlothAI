# SlothAI — Azerbaijani text editor without an LLM

Text correction runs directly in the browser using the project's own TypeScript code. There is no model download, WebGPU requirement, API key, or text upload in the editor flow. Both text correction and email formatting use the same dynamic strategy registry as the optional HTTP API.

## Run

```sh
npm install
npm run dev
```

No environment variables are required. Open http://localhost:3000. Old LLM_PROVIDER, OPENAI, ANTHROPIC and UPSTASH settings are ignored.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## Editor pipeline

The complete pinned Mozilla Azerbaijan/Azerdict word list is now bundled locally: **42,936 source records / 38,174 unique words and expressions**. This extends the reviewed vocabulary without any AI calls. See [third-party attribution, limitations and regeneration instructions](THIRD_PARTY_NOTICES.md). The source files, full MPL-2.0 license and checksums are included. Imported homographs are not blindly resolved: for example, unaccented “seher” can mean “səhər” or “şəhər”. This is broad dictionary coverage, not every possible Azerbaijani inflection or a guarantee of contextual grammar accuracy.

1. Validate nonblank input and a maximum of 10,000 UTF-16 code units.
2. Protect URLs, email addresses, numeric dates/times/decimals, code, identifiers and common abbreviations.
3. Restore reviewed Azerbaijani spellings and known typos using the lexicon and generated regular noun/verb forms.
4. Apply explicit phrase and adjacent subject/verb agreement rules.
5. Normalize spacing and repeated punctuation, add sentence boundaries for reviewed clause patterns, and capitalize sentence beginnings.
6. Convert explicit consecutive enumerations into Markdown lists and separate named topic transitions into paragraphs, unless preserving layout.
7. Restore protected content unchanged and estimate the changed word span.

The email mode adds a subject, greeting and sign-off without sending email. User text and output remain in page memory; the editor does not persist them or send them to an external service.

## Implementation

- `lib/editor/lexicon.ts`: reviewed words, aliases, ambiguity guard and name handling.
- `lib/editor/morphology.ts`: constrained vowel-harmony forms for reviewed noun stems and present-tense verbs.
- `lib/editor/context.ts`: auditable phrase and sentence rules.
- `lib/editor/correct.ts`: protection, punctuation, paragraphs, lists and email composition.
- `lib/strategies/bootstrap.ts`: central strategy registration; the UI discovers registered descriptors.

This is a rule-based Azerbaijani editor, not human-level semantic understanding. Unknown or ambiguous words remain unchanged. It cannot guarantee correction of every misspelling, inflection, proper noun, or sentence boundary. Generated morphology is deliberately restricted to reviewed stems. Review output before use. The change count is an estimate, not an exact count of linguistic errors; `detectedLanguage: az` identifies the configured language.

Examples:

```text
salam necesen mende yaxsiyam amma bu aralar pisem
→ Salam, necəsən? Mən də yaxşıyam, amma bu aralar pisəm.

biz gedirem sen gelirem
→ Biz gedirik. Sən gəlirsən.

zehmet olmasa senedleri gonderin tesekur edirem
→ Zəhmət olmasa, sənədləri göndərin. Təşəkkür edirəm.
```

## API and deployment

`GET /api/strategies` lists modes. `POST /api/transform` accepts `{ "strategyId": "text-corrector", "text": "salam", "options": { "preserveFormatting": false } }`; it validates requests and uses an in-memory per-instance sliding-window limiter. Browser editing calls the engine directly; only callers explicitly using the HTTP endpoint send text to the server.

Deploy `codex/fix-llm-provider` to Vercel or merge its PR into the production branch. No model service is needed. Existing model caches from older versions are unused; clearing site data removes them. After the page loads, editing works without a network connection; a fresh page load still needs the website.

Tests cover reported examples, morphology, contextual rules, idempotence, ambiguous and protected text, layout preservation, full input limits and both API modes with network access prohibited.
