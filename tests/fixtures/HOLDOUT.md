# Frozen independent holdout

The 265 expected outputs in `holdout-corpus.json` were fixed before the final validation. Sources include two Azerbaijani text corpora supplied by the user, a set of independently authored technical statements, and previously frozen examples. The source corpus provides complete, punctuated gold sentences. In noisy cases, one accent was removed from a source sentence; its original sentence remains the gold output. Complete emails use the independently supplied business sentences as body text with fixed mail structure. Gold text is never calculated from the editor's output.

The six new groups contain 42 informal, 42 business, 42 email, 42 technical, 42 narrative and 41 noisy examples. Earlier groups contribute 14 additional cases. Preserve existing expected values; fix reusable rules when a case fails. Some informal sentences are already correct and verify that correction does not damage natural text.
