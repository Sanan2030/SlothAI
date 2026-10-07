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

The fresh evaluation snapshot contains 30 additional articles from the same licensed source, sampled at page 40 onward. Attribution and article/history URLs are retained per document in `fresh-wikipedia-documents.jsonl`; its receipt records the retrieval. It was excluded from fitting and calibration. The derived bounded model retains the CC BY-SA 3.0 / GFDL source attribution in its provenance; this attribution does not relicense unrelated application code.

## Reserved phase 0 evaluation

`data/evaluation/phase0/` is excluded from training by design. SHA-256 sidecars
freeze the 500-sentence assistant-authored holdout, 2,000 dictionary-form mention
probes (MPL-2.0 source above), and 100 reserved calibration rows. The holdout has
25 domains but only 250 clause clusters with two contextual variants each; it is
not 500 independent real documents. Calibration repeats four frames and is not
yet adequate for representative confidence calibration. No targets were obtained
from model outputs, and no calibration rows are scored or used to select a model.
The metadata does not certify dictionary forms as expert linguistic ground truth.
Generation: `python scripts/eval/build-phase0.py` (offline preparation only).
See `docs/baseline-2026-10.md` for disagreements and limitations. Existing
user-input-evaluation.jsonl remains development evaluation; its raw text is not
copied into the new reports. CC BY-SA/GFDL trained-weight licensing is deferred
for explicit owner review in phase 1; no new license determination is implied.
