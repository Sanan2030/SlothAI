# Approved batch 001 and contextual commas

The repository owner explicitly approved all 60 proposed pairs in the conversation
on 2026-10-03 and delegated minor punctuation/pronoun corrections to the editor.
`data/nlp/reviews/az-batch-001-approved.json` preserves the exact targets that were
shown to the user, including the original engine snapshot. They are assistant-authored
synthetic examples approved by the user, not independently certified linguistic gold.
No simulated browser-test decisions were imported.

The effective corpus records one delegated grammar amendment: pair 060 uses
`O, ac idi` because `o` is the subject before a predicative adjective. The
original approved target is retained and the assistant amendment is identified
separately in `az-batch-001-effective.json`. The importer accepted all 60 unique pairs and produced document-clustered
partitions: 48 train, 5 validation, 7 test. The original data remains immutable.
These partitions are available for a future training experiment; **this change does
not fit or replace any neural model weights**. Do not use the entire approved batch
for fitting and then advertise its accuracy as held-out performance. Add future
human-reviewed target amendments with explicit provenance rather than overwriting
the historical approval.

## Grammar implemented

- Subject `o/bu`: insert a comma before a recognized nominal/adjectival predicate
  or unambiguous adverb. Keep determiner phrases (`bu layihə`, `bu gün`, `o zaman`)
  and ambiguous readings (`o evə getdi`, `o kitab oxuyur`) unchanged. Pronouns,
  particles and verbal predicates do not trigger a comma.
- Complement `ki`: recognize reporting/complement verbs using lemma and tense,
  including compound past. Comma follows the complementizer. Particle `ki`,
  temporal `elə ki`, and causal `ona görə ki` do not get this comma automatically.
- Parenthetical stance markers: surround `əlbəttə`, `şübhəsiz`, `məncə` and similar
  unambiguous markers without duplicating supplied commas. Ambiguous lexical
  uses such as `görünür` are not globally treated as parentheticals.
- Do not break the concessive construction `nə olursa olsun` after `olursa`.

Both text and email bodies call the shared punctuation stage. Protected code,
URLs, Markdown and HTML remain handled by the existing structural scanners.
Rules are deliberately bounded: the small POS/morphology inventory is not a full
syntactic parser and cannot disambiguate every subject/determiner reading.

Three development corpus targets were corrected with an explicit grammatical
reason: `punct-003` (Bu, yaxşıdır), `punct-012` (Bu, düzgündür), `punct-021`
(Bu, testdir). The existing development syntax test for `O ac idi` was also corrected, as were
`Mən düşünürəm ki, bu, yaxşıdır` and `Səncə, bu, yaxşıdır?` targets. Frozen independent held-out targets were not edited.

## Sources

- Nizami Cəfərov, AMEA, “Yazı mədəniyyətinin durğu işarələri”:
  https://science.gov.az/az/news/open/7465 — subject/determiner distinctions,
  parentheticals, complement vs particle `ki`, causal compound conjunctions.
- Official Azerbaijani grade-six textbook, “Dil qaydaları”:
  https://www.trims.edu.az/noduploads/book/quot-azarbaycan-dili-quot-tadris-dili-fanni-uzra-6-ci-sinif-ucun-darslik-2-ci-hissa-1747053913-180-backup.pdf
  — pronoun comma rule and the exception for determiner use. Search indexed the
  relevant rule; full PDF retrieval was unavailable in this environment.

## Measurement

27 new grammar tests exercise corrections, counterexamples, idempotence and both
application strategies. The original 60 proposals matched in 18 cases before this change. Against the
effective targets (including the subject comma amendment), the baseline matches
17 and the updated engine matches 18, with zero previously exact effective cases
regressed.
See `data/nlp/reviews/az-batch-001-evaluation.json`. The remaining 42 include
spelling and sentence-boundary limitations outside this specific grammar patch.
Approval records desired output; it does not instantly teach neural weights or
install whole-sentence replay rules in the application.
