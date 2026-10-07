---
license: cc-by-4.0
language:
- az
task_categories:
- text-generation
- fill-mask
tags:
- azerbaijan
- text
- corpus
- news
- books
- legislation
- wikipedia
- localdoc
size_categories:
- 1M<n<10M
---

# AzTC — Full Version (Azerbaijan Text Corpus)

The expanded version of [LocalDoc/AzTC](https://huggingface.co/datasets/LocalDoc/AzTC),
and one of the largest text corpora in the Azerbaijani language.

## Overview

The corpus contains approximately **2.4 billion tokens** of Azerbaijani text,
compiled and cleaned from a wide range of sources including news portals, books,
Wikipedia, and legislation. Text is organized at the document / passage level so
that each row is a coherent unit rather than an isolated fragment.

## Format

Provided as parquet with the following fields:

- `text` — the document or passage
- `source` — provenance label indicating which collection the text came from


## Contact

For questions or issues, please contact LocalDoc at v.resad.89@gmail.com

## Citation

```
@misc{aztc_full,
  title  = {Azerbaijan Text Corpus — Full Version (AzTC)},
  author = {LocalDoc},
  howpublished = {\url{https://huggingface.co/datasets/LocalDoc/AzTC}},
  note   = {Licensed under CC BY 4.0}
}
```