# Restore the trained WordLM context profile candidate

Verify outer SHA256SUMS, extract wordlm-context-training.tar.gz, enter
wordlm-context-training, then verify its inner SHA256SUMS.

This snapshot contains trained context counts, their receipt, builder and decoder.
Read STATUS.json: final application validation is still in progress. It is not a
standalone replacement for WordLM or a completed CharSpell model.

The base application source is d8a10ec79a498835f1a72655877be47d8e011096 in
https://github.com/Sanan2030/SlothAI. The decoder's context token IDs require the
exact base WordLM JSON whose SHA256 is recorded in model.json. The builder needs
the accepted canonical data/corpus/az-v1/train.jsonl with SHA256
b92e4edc6cb9eaaf214f35284cc8ec5e23acdb7763e40b281d8f0f9b9c9da8a9.
Original corpus and bulk prepared data are excluded from this save. Inference
uses the saved counts plus the base vocabulary; it does not need training text.

Do not restart or overwrite the separate ongoing CharSpell job. Its backups:
https://github.com/Sanan2030/SlothAI/releases/tag/charspell-backup-2026-11-04
