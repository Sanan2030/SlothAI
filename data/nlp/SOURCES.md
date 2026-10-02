# Source corpus and evaluation attribution

`wikipedia-documents.jsonl` contains selected Azerbaijani Wikipedia excerpts from
`wikimedia/wikipedia`, `20231101.az`. Every row records the source article URL
and CC BY-SA 3.0 / GFDL license declaration. Wikipedia contributors are credited
through those links; article histories list authors. Whitespace was normalized
and paragraphs automatically filtered. Synthetic error pairs preserve attribution.

- Dataset: https://huggingface.co/datasets/wikimedia/wikipedia
- CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
- GFDL: https://www.gnu.org/licenses/fdl-1.3.html
- Receipt: `wikipedia-documents.receipt.json`, including batch response and source
  hashes. Public row responses cannot pin revisions; the committed snapshot is
  the reproducible source. No gated AzCorpus data was used.

These 300 articles are source-derived synthetic training material, not manually
reviewed erroneous texts. Proper names, spelling and encyclopedic style can be
imperfect. Near-duplicate clustering and hashes detect specified forms of overlap;
they do not prove semantic independence of every topic or sentence.

`user-input-evaluation.jsonl` uses actual user messages or contiguous excerpts
from this conversation, with assistant reference corrections awaiting human
review. It never participates in training or threshold selection. Exact-output
scoring is intentionally strict and can reject alternative acceptable wording.
These are development references, not blind human-reviewed ground truth.
