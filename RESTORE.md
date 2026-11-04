# Recover the 10,000-case audit

Download the four pinned files linked in the GitHub Release. Run
`sha256sum -c SHA256SUMS`, extract `novel-10000-recovery.tar.gz`, then
`cd novel-10000-recovery && sha256sum -c SHA256SUMS`.

The application source commit is `31a4f9fd6d6c7806f85b736b2ebbf9996a0f2777`. Source is included in
`application-source.tar.gz`; it contains no credentials or original corpus.
Read `docs/qa/novel-10000-2026-11-04.md` and `RESTORE.md` INSIDE the archive.
Both the original frozen targets and the explicit reference errata are saved.
Use the comparison ledger and remaining errors to continue; do not change
targets to match actual app outputs. No running training process is implied.

The original six uploaded training gzip files and prepared training data are
excluded. Separate model backup Releases remain authoritative for checkpoints.
