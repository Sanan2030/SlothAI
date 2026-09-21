# SlothAI Hybrid Editor Preparation

Prepared against main commit: d89f6e4e3530bba03878f57d527f2c20dc400fb6

## Goal
Build a deterministic, ultra-light Azerbaijani editor for Vercel that behaves intelligently without external LLM APIs, runtime downloads, Python services, or GPU usage.

## Target runtime pipeline
Input
-> normalize Unicode/newlines
-> protect URLs/emails/code/technical identifiers
-> tokenize + sentence segmentation
-> exact dictionary lookup
-> morphology validation
-> typo/diacritic candidate generation
-> context scoring (unigram + bigram + trigram)
-> grammar/rule engine
-> punctuation/capitalization
-> reconstruction
-> API response

## Core design rules
1. Do not store millions of literal inflected forms.
2. Store lemmas/base words and generate/analyze morphology lazily.
3. Never scan the whole dictionary for every unknown token.
4. Preserve technical terminology and mixed Azerbaijani/English text.
5. Ambiguous corrections must require a meaningful score improvement; otherwise keep the original.
6. No fixture-specific or full-sentence hardcoding.
7. Every real production failure becomes a reusable regression case.

## Proposed modules
- lib/editor/tokenizer.ts
- lib/editor/normalization.ts
- lib/editor/lemma-dictionary.ts
- lib/editor/morphology/analyze.ts
- lib/editor/morphology/generate.ts
- lib/editor/candidates.ts
- lib/editor/ngram.ts
- lib/editor/scoring.ts
- lib/editor/rules/punctuation.ts
- lib/editor/rules/capitalization.ts
- lib/editor/rules/spacing.ts
- lib/editor/rules/grammar.ts
- lib/editor/rules/email.ts
- lib/editor/protection.ts
- scripts/build-lexicon.mjs
- scripts/build-ngrams.mjs

## Dictionary target
Current baseline:
- raw dictionary entries: 42,936
- unique entries: 38,174
- generated/matchable forms: 100,000

Future target:
- 200,000-500,000 useful lemmas/base entries
- productive morphology instead of pre-generating millions of strings
- frequency metadata where available
- part-of-speech/morphological class flags when available

Suggested compact lemma record:
```ts
type LemmaRecord = {
  lemma: string;
  pos?: string;
  morphClass?: string;
  frequency?: number;
  flags?: number;
};
```

## Candidate generation
Candidate narrowing should be indexed by folded spelling, prefix, length and/or compact buckets. Candidate generation may consider:
- Azerbaijani diacritic restoration
- insertion/deletion/substitution
- adjacent transposition
- keyboard-neighbor mistakes
- morphology-compatible alternatives

Never run O(dictionary_size) comparisons per token.

## Context model
Use compact offline-built statistics:
- unigram frequencies
- high-value bigrams
- high-value trigrams

Recommended scoring concept:
```
score =
  unigramLogProb
  + bigramLogProb * W2
  + trigramLogProb * W3
  + morphologyScore
  + spellingScore
  + ruleScore
```

Use smoothing. Keep original text when the best correction does not beat it by a configured minimum margin.

## Performance acceptance criteria
Measure on Node.js 20 using the same production code path.

| Input size | Warm target | Hard ceiling |
|---|---:|---:|
| 20 words | < 50 ms | 150 ms |
| 100 words | < 100 ms | 300 ms |
| 500 words | < 300 ms | 900 ms |
| 1,000 words | < 600 ms | 1.5 s |
| 5,000 words | < 2.5 s | 5 s |

Primary production target: normal 50-500 word input should normally finish below 1 second on Vercel.

Track:
- total latency
- dictionary lookup time
- morphology time
- candidate generation time
- context scoring time
- rule-engine time
- peak/approximate RSS
- average candidate count per unknown token

## Existing API contract to preserve
Endpoint: POST /api/transform

Runtime: nodejs

Request:
```json
{
  "strategyId": "string",
  "text": "non-empty string up to 10000 characters",
  "options": {
    "preserveFormatting": true
  }
}
```

Responses:
- 200: strategy result
- 400: invalid JSON or validation failure
- 404: unknown strategy
- 429: rate limit
- 500: processing failure

Do not change the frontend/API contract during the NLP refactor unless a migration is explicitly planned.

## Regression workflow
For every bad real-world result, record:
1. input
2. current SlothAI output
3. expected output
4. failure category
5. suspected subsystem

Then:
1. reproduce with a test
2. identify linguistic cause
3. fix the general mechanism
4. add/keep regression test
5. run full suite
6. benchmark latency and memory
7. merge/push only when no old test regresses

Do not add one-off full-sentence mappings.

## Test corpus policy
Use tests/fixtures/hybrid-regression-corpus.json as the canonical future-corpus seed. Keep cases diverse:
- informal Azerbaijani
- emails
- narrative prose
- technical/mixed-language text
- punctuation and capitalization
- morphology
- diacritics
- ambiguity/no-change cases

The fixture is intentionally not wired into the current test runner yet; it defines expected behavior for the upcoming hybrid-engine refactor and must not break the current main build before implementation.

## Definition of done for the future refactor
- npm run typecheck passes
- npm test passes
- npm run build passes
- no external LLM/network request during correction
- no runtime model download
- normal 50-500 word warm correction < 1 s
- technical tokens preserved
- ambiguity threshold implemented
- every discovered failure gets a reusable regression case
- final implementation lands on main
