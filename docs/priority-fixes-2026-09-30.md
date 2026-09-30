# First five language-engine priorities

Scope: API-free editor improvements against main ae6c91d51a1f9527806ac8ea4181cb942ff9d486.

1. Meaning preservation: remove city/morning overcorrections, preserve reviewed
   valid inflections and technical terminology, reject malformed morphology labels.
2. Exact editorial targets: all 800 frozen RSD/IT and email inputs now have exact
   outputs and input hashes. Assistant-reviewed; no independent human certification.
   Targets are excluded from training. A target-hash baseline protects 471 cases.
3. Unified morphology: reviewed stems provide lemma, POS, case, possession,
   passive, imperative and conditional analyses. Correct loanword k retention,
   native softening, future suffixes and vowel-final accusative forms. Coverage is
   intentionally bounded; this is not an exhaustive Azerbaijani parser.
4. Context: a deterministic averaged ordered-context perceptron uses words and
   morphology/POS. Conservative evidence/margin gates allow abstention. Retains
   the existing local classifier. Offline training; TypeScript inference.
5. Sentence boundaries: supervised gap classifier with grammatical constraints,
   dependent-clause scope and morphology-aware conditional commas. Email recipient
   parsing stops at the recipient title rather than swallowing body nouns.

## Measured results

| Evaluation | Result |
|---|---|
| Frozen editorial targets | 599/800 exact (baseline 471/800) |
| Baseline regressions | 0/471 |
| Remaining exact mismatches | 201: 70 RSD/IT, 131 email |
| Fresh separately authored examples | 30/30 text, 30/30 email body |
| Full regression suite | 2762 tests |

Typecheck, ESLint, production Next.js build and enforced warm-latency benchmarks
were run locally. The 5,000-word benchmark uses safe chunks, not one API request.
`gold:exact` deliberately fails until the remaining 201 cases are fixed; CI's
`gold:check` prevents regressions without claiming full corpus correctness.

The targets are assisted editorial assessments, and the fresh corpus is small.
These results do not demonstrate LLM-level understanding or general language
accuracy. No dependency, remote LLM, or automatic unreviewed dictionary ingestion
was added. Broader blinded linguist-reviewed data and held-out evaluation remain
necessary before claiming general semantic correction.
