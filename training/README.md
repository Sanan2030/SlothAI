# Offline training preparation

This is preparation for the accepted `az-v1` corpus, not a trained release.
No smoke/full training has been executed. Existing editor weights, thresholds,
protected spans, browser journal and deployment behavior remain unchanged.
These commands run on a cloud machine or workstation with long-lived jobs;
Vercel serves the editor and is not the place to train this corpus.

The accepted corpus contains **5,000,000 clean sentences and 5,000,000 synthetic
pairs**, not 5,000,000 independently reviewed real corrections. Its source split
is 3,287,357 train, 1,082,532 validation, and 630,111 test sentences/pairs.
Realized identity pairs total 1,058,544 across all three splits; preparation
retains sampled identity sentences and reports the actual training count.

## What is ready

- Read-only status with exact missing filenames and resource information.
- Atomic import of the six original gzip parts, checking compressed and raw
  SHA-256/size against the checked-in accepted receipts. No regeneration,
  alternate corpus, downloads requiring session cookies, or automatic overwrite.
- Full original data gate and a new hash-bound receipt before preparation.
  Every train command checks the corpus and prepared artifact hashes again.
- Deterministic uniform sampling **within** the accepted source splits; bounded
  JSONL streaming, shuffle buffer, SQLite candidate/count indexes and gzip data.
- CharSpell: learned character embedding/CNN and contextual candidate scorer,
  explicit identity, dictionary hard negatives, AdamW and validation stopping.
- WordLM: SQLite interpolated Kneser-Ney 3-gram from clean train text, fixed
  discount and suffix-class backoff for uncommon words. No neural LM is needed
  to run this command. Suffix classes are heuristic, not certified morphology.
- PunctCase: clean-text punctuation/case labels, learned character CNN + BiGRU,
  protected-token labels ignored; ambiguous punctuation is ignored. Existing
  user punctuation is never rewritten by these offline commands.
- CPU/CUDA selection, a parameter ceiling of 5M per neural model, separate
  validation metrics, atomic checkpoints, and a measured smoke report required
  before a full run of the same stage/architecture/corpus.
- Per-run split/count, seed, complete hyperparameters, manifest/dataset/artifact
  hashes, runtime, elapsed time, limitations and model card.

## Start later, step by step

Run commands from the repository root. Accepted-corpus training never runs during
`npm ci`, editor build/start, status, import, verify, prepare or the offline
training-tools CI checks. Production CI separately rebuilds legacy small model
artifacts to check reproducibility; it does not train this five-million corpus.

1. Inspect the missing prerequisites:

   ```sh
   npm run training:status
   ```

   Exit 2 and `status: blocked` are expected while the corpus is missing. This
   command checks presence, not all hashes. Its PyTorch field refers to the
   current Python; the optional `.venv-training` is reported separately.

2. Put the six unchanged `.jsonl.gz` files in a directory accessible to the
   training machine, then import them:

   ```sh
   npm run training:import -- --parts=/path/to/downloaded-parts
   ```

   Needed files: `train.jsonl.gz`, `train-pairs.jsonl.gz`,
   `validation.jsonl.gz`, `validation-pairs.jsonl.gz`, `test.jsonl.gz`,
   `test-pairs.jsonl.gz`. The matching `MANIFEST.json` is copied from the
   accepted repository receipt. The default destination is
   `data/corpus/az-v1/`; an existing directory is preserved. If files are already
   decompressed there with the accepted manifest, skip import. For mounted
   corpora use `--corpus=/absolute/mounted/path` on status/verify/prepare.

   If chat-to-executor transfer rejects files larger than 32 MiB, download and
   open [transfer.html](transfer.html) locally in a browser. Select the original
   gzip file and, if its downloaded name differs, choose the canonical archive
   from the list. The helper accepts only its recorded byte size and produces
   raw 30 MiB `.part000`, `.part001`, … slices with canonical names. It shows
   actual/expected sizes and blocks incomplete, decompressed or otherwise
   differently sized files. It performs no upload, decompression or training.
   Reassemble every archive in numeric order and verify its accepted compressed
   SHA-256 before import; filename/size matching alone is not hash verification.

3. Audit the corpus before any task preparation:

   ```sh
   npm run training:verify
   ```

   This runs the same `scripts/data/gate.py` as `npm run data:gate`, but places
   the fresh report under ignored `artifacts/training/verification/` instead
   of overwriting a tracked historical report. It audits all six files, source
   and document split boundaries, alignment, protected terms, cross-split
   sentence/8-gram collisions and phase0 leakage. Phase0 is used exclusively
   by this leakage audit, never exposed to preparation/model selection.
   Do not lower the five-million minimum or substitute the archived report.

4. Prepare a 100k-sentence smoke experiment:

   ```sh
   npm run training:prepare -- --profile=smoke --out=artifacts/training/smoke-data
   ```

   Preparation reruns the gate and creates one train and one validation file
   for each task, a train-derived candidate index, configuration and receipts.
   Smoke uses 100,000 train and 10,000 validation sentences, seed 20261007.
   It samples all synthetic categories including identity without changing
   the original splits. Test rows never enter task files. Missing candidates,
   unsupported multiword/spacing alignments, long tokens, and protected spans
   are counted instead of silently replaced or injected as ground truth.
   Retrieval hits@5/10/20 are recorded for queried changed training tokens;
   they are conditional offline coverage, not the Stage 3 browser gate.

5. Install the optional training runtime:

   ```sh
   bash training/setup.sh cpu
   npm run training:test:models
   ```

   The CPU environment was installed and its model contracts checked here.
   On a machine with an NVIDIA GPU and a CUDA-12.8-compatible driver, use
   `bash training/setup.sh cuda` instead. CUDA installation/hardware execution
   have **not** been checked here. `--device=auto` uses a usable GPU, otherwise
   CPU; an explicit `--device=cuda` fails if CUDA is unavailable.

6. When the preceding stage gates are satisfied, explicitly start the desired
   smoke training job. These are separate commands; nothing chains stages or
   starts full training automatically:

   ```sh
   npm run training:charspell -- --data=artifacts/training/smoke-data --out=artifacts/training/charspell-smoke --device=auto
   npm run training:wordlm -- --data=artifacts/training/smoke-data --out=artifacts/training/wordlm-smoke
   npm run training:punctcase -- --data=artifacts/training/smoke-data --out=artifacts/training/punctcase-smoke --device=auto
   ```

   CharSpell reads **only pair-derived word examples**. WordLM and PunctCase
   read **only clean-text-derived task files**. Validation performs model
   selection/measurement; calibration and test evaluation are separate later
   steps. Existing output directories are preserved; use a new run name.

7. Review `report.json`, retrieval misses, synthetic validation, resource use
   and the relevant stage gate. A completed smoke demonstrates execution, not
   acceptable real quality. Only then prepare a full dataset and start the
   same stage with its actual successful smoke receipt:

   ```sh
   npm run training:prepare -- --profile=full --out=artifacts/training/full-data
   npm run training:charspell -- --data=artifacts/training/full-data --out=artifacts/training/charspell-full --device=auto --smoke-receipt=artifacts/training/charspell-smoke/report.json
   ```

   Full WordLM/PunctCase use their own corresponding smoke report, not the
   CharSpell report. Both full validation and full training retain the original
   source splits. Only the 3,287,357 train sentences are learned from.

   Neural jobs save the last completed epoch and optimizer state. After an
   interrupted job with at least one completed epoch, repeat its command with
   `--resume` and the same data/output/configuration. Hash and epoch consistency
   are checked before continuation; batches from a partly executed epoch run
   again from the preceding checkpoint. WordLM resumes are unsupported; use a
   new output directory. Successful/completed jobs cannot be resumed implicitly.

## Resources and remaining release gates

Original gzip parts total 935,393,527 bytes; raw JSONL files total
5,884,892,717 bytes. Python models and training batches are bounded, but the
full lexical and n-gram indexes grow with vocabulary/context diversity.
Plan provisionally for **4–8 CPU threads, 8–16 GB RAM, and 50–100 GB free disk**
for the full offline pipeline. An NVIDIA GPU with **8 GB VRAM** is a starting
estimate for these small neural batches. These are estimates, not measured
full-run requirements; CPU training is supported. No GPU is attached here.
No epoch/time or throughput claim can be made before the first actual smoke.
Neural run reports extrapolate training and validation time separately after
the smoke; WordLM records a rough fit extrapolation. Index growth can make
the full run slower and larger than a linear estimate.

These tools prepare independent offline experiments. They do **not** mark Stages
3–7 complete or pass their gates. Before advancing/releasing a stage, retain
the original stage order and separate stage commits with their acceptance reports:

- Stage 3 needs the browser candidate implementation/morphology integration,
  measured retrieval on train/development and controlled paired browser
  latency. The offline SQLite index is not the browser binary artifact.
- Stage 4 needs real corpus smoke/full runs, source-split metrics and the
  TypeScript/int8 export with golden parity ≤1e-3. Checkpoints are Python
  experiment artifacts; they cannot be deployed directly in the editor.
- Stage 5 needs measured correction benefit and no-harm, in addition to
  class-vocabulary perplexity. No noisy-channel lambda is fitted here.
- Stage 6 needs owner-supplied real error pairs and a separate
  `data/calibration/` dataset of at least 5,000 rows. This corpus is not
  calibration. Human-reviewed independent natural-text quality is unmeasured.
- Stage 7 needs punctuation acceptance, span/idempotency properties, lazy
  Worker loading, binary artifacts, ablations and controlled latency.

No script automatically copies weights into `lib/editor` or `public/models`,
updates existing heads/thresholds, changes logging/rights decisions, or enables
the new models. Browser integration must progress shadow → opt-in → default
with the required gates and separate review. The current quality remains the
Stage 2 measured baseline; this preparation makes no accuracy improvement claim.

## Verification without training

```sh
npm run training:test
.venv-training/bin/python -m unittest discover -s training/tests -p 'test_*.py' -v
npm run data:test
npm run typecheck
npm run lint
npm test
npm run build
```

Standard-Python tests skip the two optional PyTorch contracts when PyTorch is
not installed in that Python. The `.venv-training` run must execute them; a
skip is not a model-contract pass. Technical fixtures are explicitly synthetic
unit fixtures. Neural checks use randomly initialized forward/gradient passes
without an optimizer or saved weights; they are not smoke training. Symbolic
n-gram count fixtures are not a language model quality evaluation.
