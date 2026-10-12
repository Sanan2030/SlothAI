# WordLM on the GitHub repository snapshot — 12 October 2026

An explicitly requested CPU experiment completed at **18:27:26 Asia/Baku** on
the frozen Wikipedia data already committed to `Sanan2030/SlothAI`. This is a
small repository-data experiment, **not** the five-million-sentence `az-v1`
training run. The existing full-corpus trainer, configuration and job outputs
were not changed. The bulk `az-v1` files are absent from this environment and
are not published in this repository's branches or GitHub releases.

The source manifest was reproduced byte for byte from
`data/nlp/wikipedia-documents.jsonl`. Document and near-duplicate cluster splits
remain fixed. Augmented noisy variants contribute only one clean target each:

| Split | Unique clean sentences | Documents | Use |
| --- | ---: | ---: | --- |
| Train | 1,609 | 250 | Vocabulary and n-gram counts |
| Validation | 188 | 32 | Perplexity measurement only |
| Test | 101 | 16 | Checksum and overlap audit only |

The trained model contains **2,825 vocabulary entries**, **13,983 bigrams** and
**19,704 trigrams**, using the existing interpolated Kneser-Ney implementation,
discount `0.75` and train-only minimum frequency `2`. The fit plus validation
took **0.216 seconds** after preparation. Validation class perplexity was
**116.7224** on 2,800 word/EOS predictions, with no zero-probability predictions.
This measures mapped vocabulary/suffix classes, not correction accuracy.

Word tokenization removes numbers. Consequently, two distinct sentence
templates coincide between train and validation and one between train and test
after tokenization. They are reported without changing the frozen splits or
removing validation rows. This overlap and the small encyclopedic source limit
the interpretation of perplexity. No real-error calibration, correction-benefit
measurement or editor promotion was performed.

The SQLite artifact is **2,494,464 bytes**, with SHA-256
`9b6592a81d99b70229f4758b35cf68fd0afe448bc2a830ba8216843aea291e08`.
It remains under ignored
`artifacts/training/wordlm-repository-20261012/wordlm.sqlite`; the existing editor
models and thresholds are unchanged. See the [machine-readable report](repository-wordlm-2026-10-12.json)
for source and trainer fingerprints. `sourceCodeCommit` identifies the existing
repository base; `trainingSourceSHA256` also binds the new experiment module.
Wikipedia contributors and the CC BY-SA 3.0 / GFDL source declaration remain
attributed in [SOURCES.md](../../data/nlp/SOURCES.md).

Reproduce with Python 3.12 and the repository's installed Node dependencies.
Use new output directories to preserve completed experiments:

```sh
node --import tsx scripts/build-correction-data.ts data/nlp/wikipedia-documents.jsonl artifacts/training/repo-wordlm-source-new
cmp artifacts/training/repo-wordlm-source-new/manifest.json data/nlp/wikipedia-split-manifest.json
python3 -m training.repo_wordlm --source=artifacts/training/repo-wordlm-source-new --out=artifacts/training/wordlm-repository-new
python3 -m unittest discover -s training/tests -p 'test_*.py'
```

This explicit command neither resumes the old cloud job nor requires a full-run
smoke receipt: its separate `repository-snapshot` profile makes no `az-v1`
receipt or release-gate claim. Test text is read only to validate its frozen
partition and audit cross-split overlap; it is never passed to the trainer or
perplexity measurement. The frozen manifest, partition hashes, document/cluster
assignments and exact normalized target separation are checked before fitting.

Validation: training contracts passed **31 tests**, including all five new
repository-experiment checks; **3 optional RapidFuzz contracts were skipped**
because that package is absent. Both PyTorch model contracts passed. The trained
SQLite artifact also passed `PRAGMA integrity_check`, and its hash and trainer
fingerprints matched the report. These checks establish execution and integrity,
not release acceptance or improved editor quality.
