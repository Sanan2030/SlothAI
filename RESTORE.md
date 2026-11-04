# CharSpell recovery

Check out application/training source commit `ec966e2f42799d1ea9c4de10d92227bd1b6d62f8`.
Latest checkpoint archive: `charspell-save.tar.gz`; state: `RECOVERY.json`.
Verify the four recovery files with `sha256sum -c SHA256SUMS`, extract the
archive and verify its inner `charspell-save/SHA256SUMS`. It contains code,
configuration, reports, log tails and the latest available best/last checkpoints.
Earlier completed-epoch saves remain reachable through the immutable Git tags
and pinned commit links in RECOVERY.json / this release's checkpoint history.

The accepted original corpus and bulk prepared task data are EXCLUDED.
For continuation they must be available separately at their original paths
under `/workspace/SlothAI`. Never substitute data or regenerate synthetic pairs.
The exact corpus manifest and prepared/configuration/gate receipts are in the
archive. Reconstructed task files must match every saved hash before use;
restore the original preparation metadata when restoring that exact dataset.
Run `training.common.verify_prepared` before invoking any resume command.

Inspect report/progress files and verify Linux PID start identities before
claiming a process is alive. The stored running flag is historical after a
machine stops. Original supervisor: `/workspace/SlothAI/artifacts/training/sessions/20261104-charspell/supervise-charspell.py`.
Preserve partial outputs; existing output directories are never overwritten.
Interrupted preparation needs a NEW output directory. A partial first epoch
has no resumable optimizer checkpoint yet; restart fitting in a new run directory.
After a completed epoch, use the existing trainer's guarded `--resume` with the
SAME prepared dataset, configuration, runtime and best/last checkpoints:

```
.venv-training/bin/python -m training.cli train charspell \
  --data=/path/to/original-data --out=/path/to/restored-run --device=cpu \
  --resume --smoke-receipt=/path/to/charspell-smoke/report.json
```

The smoke receipt is required for full training. Partially executed epochs
repeat from the last completed-epoch optimizer/RNG state. If no checkpoints
exist, this is a launch/preparation save, not evidence of learned weights.
Successful smoke permits the supervised full prepare/train sequence. Inspect
and deliberately continue remaining phases after interruption; do not start
another supervisor over an existing job. CPU processes require a running instance.
WordLM and PunctCase are already complete; this job never retrains them.
Validation is synthetic/source-derived; no real-user acceptance or automatic
app promotion is claimed.
