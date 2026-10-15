# Additional 1000 application contract scenarios

This tests-only change adds exactly 1000 registered Node tests. Each scenario
has a unique title and a unique fingerprint of its category, input, reference
and operation parameters, independently of its numeric ID. These are 1000
distinct scenarios across ten areas, not 1000 unrelated natural-language
sentences or a blind accuracy benchmark. Boundary matrices intentionally vary
types, Unicode, formatting and context for the same feature.

| Area | Tests |
| --- | ---: |
| ASCII Azerbaijani restoration, exact reference and second pass | 100 |
| Correct Azerbaijani preservation and zero corrections | 100 |
| Full-editor URL, email, inline code and fenced code preservation | 100 |
| Structural literal shielding, including private-use marker collisions | 100 |
| Clipboard HTML escaping across five semantic marks | 100 |
| Diff reconstruction, insertions, deletions, whitespace and Unicode | 100 |
| Personal lexicon consent, context, sentence boundaries and code exclusion | 100 |
| Invalid personal lexicon storage shapes, types and lengths | 100 |
| Expected-result round trips and module/format/greeting isolation | 100 |
| Real in-process API handler validation and successful responses | 100 |

The language references were authored before execution. The generator does not
import the application. HTML references use Python's standard HTML escaper.
The fixtures are deterministic; regenerate with:

```sh
python3 tests/fixtures/generate_unique_regression_1000.py
```

## Initial result and known defects

The strict first run had **991 passes and 9 failures**, without skips. Eight
failures concern missing ASCII restoration or homograph disambiguation. The
ninth changes a `www.` URL's path/query even though its domain is protected.
The fixture's `knownIssues` maps all nine exact IDs to their reasons.

These nine tests retain their correct references and execute as `TODO` in the
default regression command so this tests-only commit does not silently change
production behavior or break the existing gate. A TODO is an unresolved defect,
not a passing test. All other failures remain blocking. Run the strict audit to
make all nine blocking as well:

```sh
SLOTH_STRICT_UNIQUE_1000=1 node --import tsx --test tests/unique-regression-1000.test.ts
```

Default focused run:

```sh
node --import tsx --test tests/unique-regression-1000.test.ts
```

Fixing a known defect requires removing its TODO entry and updating the count
guard. Do not rewrite the expected sentence to match a wrong output.

No training corpus, model weights, calibration, runtime code or browser E2E
claim is part of this commit. A route-handler test directly invokes the real
handler; it does not verify deployment routing or distributed rate limiting.
The 100 language examples and safety checks cannot establish real-user accuracy.
