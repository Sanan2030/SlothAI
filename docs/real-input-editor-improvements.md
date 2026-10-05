# Real-input spelling and syntax improvements

This release addresses the five audited areas without adding an LLM API or promising general semantic understanding.

| Area | Implemented change | Limit |
| --- | --- | --- |
| Correct-text preservation | Known surfaces and established diacritic restoration veto structural guesses; preserve existing casing of foreign descriptive terms; retain nominal field-label layout | Unknown names and genuinely ambiguous forms still need broader evaluated coverage |
| More error categories | Existing domain neural head accepts a missing repeated consonant in a verified noun; learned observed edit channels handle contextual substitutions/insertions/deletions; morphology proposes conservative space joins/splits | Not an unrestricted character-to-character language model; competing candidates abstain |
| Morphology | Runtime-only reviewed noun paradigms, plural/possessive/case chains, relative locative and comitative analyses | Restricted reviewed stems; not a complete Azerbaijani morphological analyzer |
| Sentence boundaries | One POS/morphology veto checks proposals from all existing boundary stages, retaining original punctuation and blocking adjective/noun fragments | No dependency parser or full meaning analysis; legacy proposal stages remain |
| Real evaluation | Observed user spelling spans, document-separated development references, identity cases, CER/WER and edit precision/recall/F0.5; indentation-damaged approved references quarantined | One training source document and four evaluation document groups are too small for a general accuracy claim |

## Source and training discipline

The three uploaded log exports contained 17 records but many repeated inputs. Stored application output was never used as a gold reference. From the long memo, 57 minimal spelling spans were manually reviewed under the user's delegated authorization. The complete corporate document is not published. `data/nlp/real/observed-spelling.json` records the original file SHA256, provenance, review status and the common training document ID.

`npm run nlp:observed:train` deterministically learns 49 contextual edit rules and three explicitly observed accent-confusion rules plus a target vocabulary. This is a statistical error channel, **not new neural weights or a general semantic model**. Production combines it with existing neural heads and dictionary/morphology validation. At most two channel edits and 128 proposals are considered per unknown word; ambiguous candidates are left unchanged. Existing valid words and recognized ASCII inflections take precedence. Foreign terms and acronyms remain protected.

A descriptive training-span replay matched 53/57 normalized word references; `təwkilati`, `səbəbinən`, `baw`, and `dovürde` remain unresolved as isolated words. This is training coverage, not independent accuracy; abstention is retained instead of forcing ambiguous or accent-destroying candidates.

The unchanged neural domain weights now additionally allow a lost repeated consonant in a verified noun, preserving both word edges. Arbitrary consonant insertion that changes active/passive voice remains prohibited. Nominal root repair also allows a witnessed vowel omission with a verified unchanged suffix. Classifier feature extractors continue using their original frozen morphology engines; the runtime extension does not modify the old paradigm index.

## Development evaluation

Nine distinct real inputs from the other log records were manually referenced, in four document groups. Their nine correctly written target versions were also replayed through the complete text/mail pipeline. This set is excluded from channel training, but was inspected during implementation; **it is development evaluation, not a blind benchmark**. Near-duplicate field-label and mail variants share document IDs.

Previous `main` (`df0d84d`) matched 13/18 complete outputs and changed 2/9 correct reference inputs. This release matched 18/18 outputs and changed 0/9 correct inputs; CER/WER were zero on this small set. References, outputs and exact edit metrics are in `data/nlp/real/development-report.json`. These results cannot be extrapolated to arbitrary Azerbaijani text.

The uploaded approved example contained large accidental spaces and an unresolved attached-particle form. The importer now rejects such unformatted targets for whitespace review; it does not silently teach those mistakes or overwrite the user's saved reference. A linguistically valid, reviewed replacement is still needed before training on that case.

Additional new tests cover previously untrained inflections and sentence contexts, dropped consonants/vowels, split and merged tokens, homographs, foreign casing, preserved author punctuation, Unicode offsets, and mail/text parity. Existing domain evaluation also ran with zero new false-edit rows or exact-output regressions relative to its corresponding model ablation. Those older sets are developmental and partly synthetic.

## Reproduction

```bash
npm ci
npm run nlp:observed:train -- data/nlp/real/observed-spelling.json /tmp/slothai-observed-channel.json
cmp /tmp/slothai-observed-channel.json lib/editor/observed-channel-model.json
npm run nlp:observed:evaluate -- --output=/tmp/slothai-real-evaluation.json --enforce
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI regenerates the observed artifact and compares it byte-for-byte, then enforces the development evaluation and existing release gates. A larger independently annotated real test corpus, particularly unknown names, meaning-sensitive alternatives and long unpunctuated clauses, is the next requirement. It cannot be replaced by generating more synthetic examples or treating machine outputs as gold.

Linguistic design references: [Azerbaijani Universal Dependencies](https://universaldependencies.org/az/index.html), [nominal dependencies](https://universaldependencies.org/u/overview/nominal-syntax.html), and [official Azerbaijani orthography norms](https://frameworks.e-qanun.az/42/c_f_42073.html). These inform the constraints; this release does not train a dependency parser from those pages.
