# Recover the 10,000-case audit

Download the four pinned files linked in the GitHub Release. Run
`sha256sum -c SHA256SUMS`, extract `novel-10000-recovery.tar.gz`, then
`cd novel-10000-recovery && sha256sum -c SHA256SUMS`.

The application source commit is `d8a10ec79a498835f1a72655877be47d8e011096`. Source is included in
`application-source.tar.gz`; it contains no credentials or original corpus.
Read `docs/qa/automatic-models-2026-11-05.md` and `RESTORE.md` INSIDE the archive.
Both the original frozen targets and the explicit reference errata are saved.
Use the comparison ledger and remaining errors to continue; do not change
targets to match actual app outputs. No running training process is implied.

The original six uploaded training gzip files and prepared training data are
excluded. Separate model backup Releases remain authoritative for checkpoints.
