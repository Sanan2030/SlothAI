# Recover the candidate diagnosis

Download these four pinned files from the Release. Verify SHA256SUMS, extract
candidate-audit-recovery.tar.gz, enter candidate-audit-20261105 and verify the
inner SHA256SUMS. Read REPORT.md, SUMMARY.json, per-site.csv and RESTORE.md there.

The actual production source stays at commit
d8a10ec79a498835f1a72655877be47d8e011096. No production patch or trained model promotion was made in this task.
The archive contains generated diagnostic records from the already-public QA
inputs, not the original six uploaded training files, bulk corpus or checkpoint.
CHARCHECKPOINT_RECOVERY.json links the separate verified checkpoint backup.
