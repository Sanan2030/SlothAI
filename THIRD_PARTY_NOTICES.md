# Azerbaijani dictionary

Source: https://github.com/mozillaz/spellchecker
Pinned revision: 7f484fc96126919ccdb1f65908558b36a5b43301
Authors/maintainers: Mozilla Azerbaijan. The upstream README attributes the word list to azerdict.com.
License: Mozilla Public License 2.0; full text at public/dictionaries/az/LICENSE.

The unmodified upstream az.dic and az.aff files are redistributed in public/dictionaries/az. Their hashes are recorded in metadata.json. The generated lib/editor/generated/az-words.json is a derived word list under the same MPL-2.0 license: Hunspell flags are removed, text is NFC-normalized and duplicate spellings are removed. It is not a list of definitions. These covered files and the generation script are available in this repository; the original source and license are also served by the deployed app under /dictionaries/az/.

The upstream header declares 42,937 records, but the file contains 42,936 data lines. These yield 38,174 distinct entries. Generation excludes two non-word entries (a bare number and a trailing-hyphen prefix), leaving 38,172 matchable base entries. Two multiword entries are retained, and their component words use the normal word-matching path.

This is the full pinned source dictionary, not every Azerbaijani word. Build preparation executes a restricted single-step SFX subset with two-character FLAG long parsing, strip/add and terminal conditions. It does not execute prefix, compound, continuation or cross-product rules. Fourteen malformed/unsupported rule lines and eleven malformed flag entries are skipped, rather than guessed. Runtime forms are capped at 100,000 to bound memory; reaching this cap does not certify linguistic completeness or correctness. Reviewed spelling choices take priority; imported ambiguities are preserved. Imported one/two-letter forms are not used for automatic correction.

Reproduce with npm run dictionary:import -- public/dictionaries/az (offline), or omit the argument to explicitly download the pinned source. All three inputs are SHA-256-checked before output is written. Generated JSON is excluded from git and recreated by dev, test, typecheck and build preparation. Normal correction uses bundled application assets and performs no dictionary download. Generated output remains covered by MPL-2.0.
