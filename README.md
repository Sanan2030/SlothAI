# SlothAI — Ultra-Light Azerbaijani Editor

SlothAI is a lightweight Azerbaijani text correction application designed to run on **Vercel with very low CPU/RAM usage and no external LLM API**.

The long-term goal is not to imitate a generative LLM with a huge dictionary. The editor is being evolved into a hybrid language engine built from:

**dictionary + morphology + typo candidates + diacritic restoration + statistical context + deterministic grammar rules**

The application remains fully compatible with the existing Next.js frontend and `/api/transform` API.

---

## Current status

The current production engine is still primarily rule-based.

Current capabilities include:

- Azerbaijani diacritic restoration
- reviewed typo corrections
- punctuation normalization
- capitalization
- sentence-boundary heuristics
- email formatting
- basic Azerbaijani morphology
- protected URLs, email addresses, code and technical terminology
- text and mail correction modes
- local processing without an external AI provider

Current dictionary baseline:

- **42,936** source dictionary records
- **38,174** unique dictionary entries
- approximately **100,000** generated/matchable forms

The current implementation does **not yet contain the complete future hybrid engine described below**.

---

## Target architecture

The planned runtime pipeline is:

```text
Input
  ↓
Unicode / whitespace normalization
  ↓
URL / email / code / technical-term protection
  ↓
Tokenizer + sentence segmentation
  ↓
Exact dictionary lookup
  ↓
Morphological analysis
  ↓
Typo + diacritic candidate generation
  ↓
Context scoring
  ↓
Grammar / punctuation / capitalization rules
  ↓
Final reconstruction
  ↓
Output
```

The target engine must stay:

- fast
- deterministic
- auditable
- Vercel-compatible
- CPU-only
- small in memory
- free from runtime model downloads
- free from OpenAI, Gemini, Claude or other external LLM dependencies

---

## 1. Lemma-based dictionary

Instead of storing millions of pre-generated word forms, SlothAI will move toward a lemma-oriented dictionary.

Target record concept:

```ts
type LemmaRecord = {
  lemma: string;
  pos?: string;
  morphClass?: string;
  frequency?: number;
  flags?: number;
};
```

Future capacity target:

- **200,000–500,000 lemmas/base entries**
- millions of theoretically valid forms generated or analyzed lazily
- compact runtime indexes rather than giant JSON word-form lists

The runtime must never need to load 5–10 million strings into memory.

---

## 2. Azerbaijani morphology

The morphology engine will validate and generate Azerbaijani forms dynamically.

Planned coverage includes:

- plural
- possessive suffixes
- grammatical cases
- personal endings
- tense
- negation
- question particles
- common derivational suffixes
- vowel harmony
- consonant alternation
- buffer consonants
- Azerbaijani orthographic rules

Example:

```text
kitab
kitablar
kitabın
kitaba
kitabı
kitabda
kitabdan
kitabım
kitabımız
```

Target API shape:

```ts
analyzeWord(word)
generateForms(lemma, requestedFeatures)
isValidWordForm(word)
stripSuffixes(word)
```

Forms should be generated only when needed.

---

## 3. Stable lemma/morphology contracts

Before the productive morphology refactor, SlothAI defines stable TypeScript contracts for the future language engine:

```text
lib/editor/contracts/lemma.ts
lib/editor/contracts/morphology.ts
lib/editor/adapters/legacy-language.ts
lib/editor/language-services.ts
```

The public service seam is:

```ts
lemmaDictionary: LemmaDictionary
morphologyEngine: MorphologyEngine
```

Future implementations must be swapped behind `lib/editor/language-services.ts` instead of rewriting the UI, API routes or `correctText()` contract.

The lemma contract provides:

```ts
getByLemma(lemma)
findByFoldedForm(word)
hasSurfaceForm(word)
```

The morphology contract provides:

```ts
analyzeWord(word)
generateForms(request)
isValidWordForm(word)
stripSuffixes(word)
```

The current implementation is a conservative legacy adapter around the existing generated dictionary and reviewed morphology forms. It intentionally does not fake a true lemma/suffix analysis where the current engine has no such information.

Migration rule for Astra/new engines:

1. implement `LemmaDictionary` and/or `MorphologyEngine`;
2. keep the method signatures stable;
3. switch the implementation in `language-services.ts`;
4. do not change `/api/transform`, UI payloads or regression fixture formats;
5. run contract tests, the full regression suite and benchmarks before replacing the legacy adapter.

`tests/language-contracts.test.ts` locks this compatibility boundary.

---

## 4. Typo candidate generation

Unknown words must not be compared against the full dictionary.

Candidate generation will use compact indexes and a bounded search space.

Planned signals:

- Damerau-Levenshtein distance
- insertion
- deletion
- substitution
- adjacent transposition
- keyboard-neighbour errors
- Azerbaijani character restoration
- word-length buckets
- folded spelling
- prefixes
- morphology compatibility

Example target behavior:

```text
xyir
→ xeyir
```

This correction must come from reusable candidate logic, not from a hardcoded `xyir -> xeyir` sentence-specific rule.

---

## 5. Azerbaijani diacritic restoration

The engine must restore common Azerbaijani characters:

```text
c → ç
g → ğ
i → ı / i
o → ö
s → ş
u → ü
e → ə
```

Examples:

```text
men   → mən
cox   → çox
ucun  → üçün
gorus → görüş
```

Ambiguous spellings must not be blindly replaced.

---

## 6. Context scoring

The future engine will rank correction candidates with a compact local language model based on:

- unigram frequencies
- bigram frequencies
- trigram frequencies
- spelling distance
- morphology compatibility
- deterministic rule bonuses/penalties

Conceptual score:

```text
score =
  unigramLogProbability
  + bigramLogProbability * W2
  + trigramLogProbability * W3
  + morphologyScore
  + spellingScore
  + ruleScore
```

Unseen combinations must use smoothing rather than receiving zero probability.

A word should only be replaced if the best candidate beats the original by a minimum score margin.

If confidence is insufficient, SlothAI should keep the original text.

---

## 7. Compact offline corpus build

Large corpora must be processed **offline/build-time**, never during a user request.

Planned generated resources:

```text
lemma-frequency
unigrams
bigrams
trigrams
candidate indexes
morphology metadata
```

Only useful high-frequency statistical data should remain in the production bundle.

Rare/noisy n-grams should be discarded.

---

## 8. Grammar and formatting rules

Deterministic rules remain an important part of SlothAI.

Planned modular structure:

```text
lib/editor/rules/
  punctuation.ts
  capitalization.ts
  spacing.ts
  grammar.ts
  email.ts
```

Rules cover areas such as:

- repeated spaces
- repeated punctuation
- sentence capitalization
- punctuation spacing
- greetings
- email formatting
- lists
- frequent Azerbaijani constructions
- suffix-spacing mistakes

No rule should exist only to make one fixture pass.

---

## 9. Protected terminology

SlothAI has a runtime protected-terminology registry in:

```text
lib/editor/protected-terminology.ts
```

Protected terms are canonicalized and replaced with internal placeholders before normal lexical correction, then restored unchanged. This prevents the Azerbaijani correction pipeline from translating, respelling or splitting reviewed technical and banking terminology.

Groups include:

- **Programming:** API, REST API, JSON, Java, Python, TypeScript, Next.js, Spring Boot, FastAPI, PostgreSQL, MySQL, MongoDB, Redis, GraphQL and others.
- **Infrastructure/security:** Docker, Kubernetes, Vercel, GitHub, GitLab, CI/CD, DevOps, OAuth, JWT, TLS, RBAC, Prometheus, Grafana and others.
- **Banking/FinTech:** IBAN, SWIFT, BIC, ATM, POS, OTP, PIN, CVV, KYC, AML, SEPA, PCI DSS, PSD2, ISO 20022, Open Banking, Core Banking, Visa, Mastercard and others.
- **Business/product:** CRM, ERP, BPMN, UML, UAT, KPI, Jira, Confluence, Figma, Agile, Scrum and Product Owner.

Examples:

```text
api       → API
github    → GitHub
vercel    → Vercel
iban      → IBAN
swift     → SWIFT
kyc       → KYC
pci dss   → PCI DSS
next.js   → Next.js
```

The registry is shared with the lexical technical-spelling layer, so canonical terminology has one source of truth. Tests verify both the registry and full-editor integration.

Technical terms must not be translated or incorrectly Azerbaijani-ized.

---

## 10. Performance targets

The main deployment target is Vercel.

Expected warm-performance goals:

| Input | Target |
|---|---:|
| 20 words | < 50 ms |
| 100 words | < 100 ms |
| 500 words | < 300 ms |
| 1,000 words | < 600 ms |
| 5,000 words | < 2.5 s |

Primary application target:

**ordinary 50–500 word text should normally be corrected in under 1 second.**

Benchmarks should track:

- total latency
- dictionary lookup time
- morphology time
- candidate-generation time
- context-scoring time
- rule-engine time
- memory usage
- average candidates per unknown token

No runtime path should perform an O(text × dictionary_size) full scan.

---

## 11. Performance benchmark

Run the editor benchmark locally with:

```bash
npm run benchmark
```

It measures **20 / 100 / 500 / 1,000 / 5,000-word** logical documents and reports:

- average latency
- p50 latency
- p95 latency
- process RSS baseline/peak/delta
- heap delta
- request/chunk count
- PASS/FAIL against the latency targets above

Because the production editor currently accepts at most **10,000 characters per request**, the 5,000-word benchmark automatically splits the logical document into production-safe chunks and reports the combined latency.

Useful commands:

```bash
npm run benchmark
npm run benchmark:check
npm run benchmark:json
```

`benchmark:check` exits with a failure code when p95 latency exceeds the configured target.

The repository also contains `.github/workflows/performance.yml`. GitHub Actions automatically runs the performance gate on every **push** and **pull request**, with optional manual execution through `workflow_dispatch`. The workflow rebuilds the local dictionary, runs TypeScript validation, executes the enforced benchmark, publishes a Markdown summary, and uploads `benchmark-results.json` as a 30-day artifact. A p95 threshold failure makes the workflow fail.

Memory measurements are process-level approximations. Compare commits using the same Node version and machine for meaningful regression analysis.

---

## 12. Error categories

Every regression case now has a required primary `errorCategory`.

Supported categories:

| Category | Purpose |
|---|---|
| `typo` | Missing/extra/substituted/transposed characters and general misspellings |
| `diacritic` | Azerbaijani character restoration such as `c → ç`, `e → ə`, `u → ü` |
| `morphology` | Suffixes, inflection, agreement and valid Azerbaijani word forms |
| `context` | Ambiguity, sentence meaning, email/business structure and context-dependent decisions |
| `punctuation` | Punctuation, spacing, capitalization, lists and numeric/date formatting |
| `technical` | Technical vocabulary, URLs, email addresses, code, identifiers and mixed AZ/EN text |

Canonical definitions live in:

```text
lib/editor/error-categories.ts
```

The 240-case regression corpus stores both its more specific domain `category` and one primary `errorCategory`. Corpus integrity tests require all six categories and verify the stored category counts.

Current primary-category distribution:

```text
typo:        21
diacritic:    5
morphology:  30
context:    100
punctuation: 41
technical:   43
```

These categories are intended for future failure reports, benchmark breakdowns and production regression analysis.

---

## 13. Regression-first development

Every real-world failure should become a regression case.

Required workflow:

```text
bad input
→ reproduce failure
→ record current output
→ define expected output
→ identify failing subsystem
→ fix the general rule/algorithm
→ add regression test
→ run full suite
→ benchmark performance
→ merge to main
```

Never solve failures using:

- exact full-sentence mappings
- test filename detection
- fixture-specific conditions
- stored expected responses

The repository contains a curated hybrid regression corpus with **240 text/mail cases** for this transition. `tests/hybrid-regression-corpus.test.ts` protects the corpus count, unique IDs, required fields and core risk-category coverage.

---

## Project structure

Important current files:

```text
lib/editor/dictionary.ts
lib/editor/lexicon.ts
lib/editor/morphology.ts
lib/editor/context.ts
lib/editor/correct.ts
lib/editor/business.ts
lib/editor/technical.ts
lib/editor/expository.ts
lib/editor/narrative.ts
lib/strategies/
tests/
public/dictionaries/az/
```

Planned modules:

```text
lib/editor/tokenizer.ts
lib/editor/normalization.ts
lib/editor/lemma-dictionary.ts
lib/editor/candidates.ts
lib/editor/ngram.ts
lib/editor/scoring.ts
lib/editor/protection.ts
lib/editor/morphology/
lib/editor/rules/
scripts/build-lexicon.mjs
scripts/build-ngrams.mjs
```

---

## UI

The current UI contains two primary modules:

- **Mətn Düzəldici**
- **Mail Düzəldici**

The interface uses a responsive workspace layout with dark/light themes.

The NLP refactor must not unnecessarily break the existing UI or API contract.

---

## API

### GET `/api/strategies`

Returns the registered correction strategies.

### POST `/api/transform`

Example:

```json
{
  "strategyId": "text-corrector",
  "text": "men bu gun mektebe getdim",
  "options": {
    "preserveFormatting": false
  }
}
```

Input limit: **10,000 characters**.

The API contract should remain stable throughout the editor-engine refactor.

---

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run typecheck
npm test
npm run build
```

No external LLM API key is required.

---

## Deployment

Production is deployed from:

```text
main
```

The final implementation of each completed refactor must land on `main`.

Temporary branches may be used during development, but production documentation and completed work must not remain only on an old feature branch.

---

## Design principle

SlothAI is intentionally **not** becoming a large generative LLM.

The objective is to get as much Azerbaijani correction quality as possible from an ultra-light architecture:

```text
large lemma vocabulary
+ productive morphology
+ efficient typo search
+ contextual n-gram scoring
+ deterministic grammar rules
= fast local Azerbaijani editor
```

Priority order:

**accuracy → speed → memory efficiency → maintainability → Vercel compatibility**
