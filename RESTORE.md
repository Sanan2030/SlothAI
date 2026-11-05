# Continue candidate correction work

Verify the outer SHA256SUMS, extract this archive, then run `sha256sum -c SHA256SUMS` inside it.
Clone https://github.com/Sanan2030/SlothAI and check out `cec79df940445506d6a0cd9369f216a432f92c74`. The exact source fallback is `application-source.tar.gz`.
Read `docs/qa/candidate-fixes-2026-11-05.md` in the source, comparison/summary.json and final-verification.json here.
Inputs/references are frozen; this assistant-authored compositional development set is not a blind or real-user accuracy benchmark.
Decompress COPIES of results.jsonl.gz with `gzip -dk` before using scripts/qa evaluation/comparison commands. Run Node evaluation into a fresh output directory, build/start the app, then browser-novel-10000.ts --require-automatic --legacy-false with Node results.
Both models run automatically. Source-only WordLM context counts supplement the original model; original17runtimeJSON weights are unchanged. This archive contains application-ready context counts and their script/receipts, NOT original source text. Retraining needs canonical train SHA b92e4edc6cb9eaaf214f35284cc8ec5e23acdb7763e40b281d8f0f9b9c9da8a9.
comparison/remaining-errors.jsonl.gz is the work queue; final/error-traces.jsonl.gz contains observed decisions; final-site-review.json groups the reviewed mechanisms and limits. Retain proper names, correct words, original references and existing training jobs.
CharSpell remains a separate unfinished training run. Do not promote partial weights or restart it blindly. Its rolling recoverable checkpoints, optimizer/RNG and status are at https://github.com/Sanan2030/SlothAI/releases/tag/charspell-backup-2026-11-04 ; inspect current reports before resuming.
Other recoveries: https://github.com/Sanan2030/SlothAI/releases/tag/wordlm-context-backup-2026-11-05 and https://github.com/Sanan2030/SlothAI/releases/tag/punctcase-backup-2026-11-04 .
Original6traininggzip and bulk prepared training data are excluded. Read WORK_LOG.md for rejected variants, provenance and validation scope. Never rewrite gold to fit model outputs.
