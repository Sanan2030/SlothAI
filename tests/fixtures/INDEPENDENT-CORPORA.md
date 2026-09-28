# Independent domain and correspondence evaluation

`rsd-it-holdout.json` contains 460 individually authored RSD and IT situations
across 23 domains. `email-holdout.json` contains 340 separate correspondence
scenarios across 17 purposes. Each message has its own situation and business
content; layout variants are assigned once per email rather than expanded into
synthetic duplicates. These cases are distinct from the previous 400-item
general language evaluation and existing small RSD and mail unit tests.

To reproduce the frozen fixtures, run `python scripts/build-independent-corpora.py`.
To evaluate the actual editor and save full outputs and failures, run
`node --import tsx scripts/report-independent-corpora.ts`. CI regenerates the
fixtures, checks that they have not changed, runs the evaluation, and uploads
both JSON reports even if the validation fails.

Checks include distinct inputs, a retained semantic anchor, initial and final
punctuation, idempotence, one mail subject, a recognizable addressed greeting,
the original explicit subject when supplied, and exactly one sign-off. These
checks catch common structural regressions. A pass does **not** establish that
every word or clause is linguistically perfect: the report includes full actual
outputs to make manual review and subsequent corrections possible.
