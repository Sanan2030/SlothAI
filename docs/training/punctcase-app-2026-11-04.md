# PunctCase application integration — 4 November 2026

The completed PunctCase checkpoint now supplies optional punctuation/case proposals
in both editor modules and the HTTP API. Users explicitly enable **PunctCase —
durğu və registr (sınaq)**; it starts off in each module. For example,
`qeyd edək ki bu məsələ hələ araşdırılır` retains the baseline output by default,
while the option returns `Qeyd edək ki, bu məsələ hələ araşdırılır.` The additional
comma comes from the trained model. No lookup of saved examples is used.

## Completed training and durable recovery

The [full-run receipt](punctcase-full-2026-11-02.json) records four CPU epochs,
with epoch two selected by minimum validation loss and patience two. The job
finished on 2 November at 16:29 Baku. It used all 3,287,357 accepted train and
1,082,532 validation sentences; protected-only chunks were excluded, leaving
3,285,901 training and 1,082,520 validation task rows. Selected validation
punctuation micro-F1 was 0.9355223753 and case accuracy was 0.9989589845.
These are mechanically derived source-split labels, not human-reviewed real-user
accuracy. Test data was not used for fitting or model selection.

The selected Python checkpoint SHA-256 is
`028592bc1db1843f15e73d3eb97d1fc6c69b9e2b7462e46fa9059582bf03c543`.
The [GitHub backup release](https://github.com/Sanan2030/SlothAI/releases/tag/punctcase-backup-2026-11-04)
contains selected/final weights, optimizer/RNG states for epochs 1–4, source,
configuration, reports, logs and restore instructions. Its downloads were read
back and checksum-verified. Corpus and bulk prepared task files were excluded.

The damaged compressed train file was preserved. Its original clean fields
were extracted from the verified redundant train-pairs records; all six raw
files matched the unchanged accepted manifest byte-for-byte. No sentence,
source split or minimum-size requirement was changed.

## Export and numerical agreement

`training/export_punctcase.py` checks a completed full report, accepted corpus
identity, selected checkpoint hash and matching configuration before exporting.
The model has 39,434 parameters: a masked character CNN/max-pool encoder and
bidirectional GRU with punctuation/case heads. Original float32 little-endian
weights are encoded in the dynamically imported weights JSON; no new inference
package or server process is needed.

The [export receipt](punctcase-export-2026-11-04.json) records 157,736 decoded
bytes and 157,361 gzip bytes for the weights JSON alone. Those are not total
Worker-bundle/download measurements. Original weights are retained rather than
quantized. The application checks their decoded SHA-256 before inference and
rejects truncated/corrupted payloads. Failed lazy loads can be retried.

Seven variable-length numerical fixtures cover padding/unknown characters,
Azerbaijani I/İ, long words, a full 96-token chunk and packed-batch bidirectional
GRU behavior. JavaScript matched 1,280 PyTorch logits with maximum absolute
error 0.0000057221, below the required 0.001 tolerance. These engineering
fixtures are not language-quality references. Int8 quantization/parity has not
been implemented or claimed.

Reproduce the export from the verified completed run:

```sh
npm run punctcase:export -- --run=/path/to/punctcase-full
npm run punctcase:validate -- --data=/path/to/full-data
```

## Application policy and preservation

`options.usePunctCase: true` is an optional boolean accepted by both strategies,
the local editor Worker and the HTTP schema. Default/false requests do not import
the model payload. Production Chromium checks confirm that its compiled weight
chunk is absent from Worker resources until an eligible explicit request, then
appears when the learned comma is produced. No transformation API request is
made by the browser editor for this inference.

This first option processes only unpunctuated plain drafts of at least four
words. Requests containing explicit punctuation, literals or structured markup
keep their baseline output. The insertion adapter also protects literal spans,
identifiers, headings, lists, existing marks/whitespace and email signatures.
It adds marks only to whitespace gaps inside 96-token chunks, never across an
unsupported chunk edge. Titles are limited to initials after accepted terminal
boundaries; the case head must support that boundary. Existing capitalization
and lexical choices are preserved. There is no spelling-model replacement.

The punctuation probability threshold is fixed at 0.995; title support is 0.95.
They are conservative engineering guards, not weights fitted on real-error or
test data. Proposals are accepted only as a whole, with an unchanged normalized
word sequence and a fixed-point check through the existing engine. Oversized or
unstable proposals retain the baseline result. The metadata records evaluated
tokens, proposed/applied edits, skip/rejection status and inference time.

User text is processed inside the Worker. Model state is immutable and shared
within that Worker; at most 2,000 word encodings are cached within one request.
The journal/review-file schemas retain the optional model flag. Review identity
distinguishes baseline and opt-in examples, and `review:test` invokes the selected
application strategy so an enabled example is reproducible. Old files remain
valid and default to the baseline mode.

## Measured scope and remaining gates

The [application validation report](punctcase-app-validation-2026-11-04.json)
compares the unchanged frozen engineering sets: holdout 393/500 before and after,
preservation 2,000/2,000 before and after, with no added changes/regressions.
The restrictive policy is part of that result; it is not a claim that the neural
head independently preserves every natural sentence.

The first 512 unchanged validation chunks gave punctuation micro-F1 0.9396433471
and case accuracy 0.9972793743 in the JavaScript tagger. Among the first 128
deliberately depunctuated validation drafts, the application accepted nine
additional edits. This is bounded source-derived smoke evidence, not a blind
natural-text benchmark or an aggregate real-user accuracy improvement.

Production build, typecheck/lint, numerical/preservation/API/review contracts,
the complete Node suite, CPU Python contracts and Chromium checks are recorded
in the verification receipt. The [latency report](punctcase-latency-2026-11-04.json)
measures the opt-in request separately from the enforced baseline benchmark.

Independent human-reviewed real-error calibration/acceptance, int8 export and
default-on promotion remain separate work. The WordLM integration and existing
default heads/thresholds remain active as before. This is a usable experimental
integration, not a declaration that all Stage 3–7 release gates are complete.

## Final CI follow-up

The first pushed commit passed all functional production checks but its final
CI gate caught the existing Zod production advisory GHSA-mrhx-c7xc-m3w5. Zod was
updated from 3.25.76 to the patched 4.6.7 with the lockfile integrity preserved;
production audit reports zero vulnerabilities. API bounds explicitly retain the
public UTF-16-unit contract, including oversized astral/emoji inputs, because
Zod 4 string max counts Unicode code points. Existing regression assertions were
retained.

Final adversarial checks also cover inline Markdown emphasis, blockquotes and
relative-link labels. Structural markers now bypass PunctCase at both request
and insertion levels, preserving the baseline result for those documents.

After these fixes the final production build, typecheck/lint, all 5,572 passing
Node tests (8 existing TODOs), all 9 Chromium tests and production HTTP checks
passed. The CPU Python suite remains 38/38; training source was unchanged by
this follow-up. The refreshed verification receipt binds the final runtime and
test source hashes. Remote CI and deployment status are recorded on the backup
release after the push.
