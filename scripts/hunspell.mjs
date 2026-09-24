/** A deliberately restricted, auditable subset, not a Hunspell implementation. */
export function splitLongFlags(flags) {
  if (flags.length % 2) throw new Error(`Invalid FLAG long sequence: ${flags}`);
  return flags.match(/../gu) ?? [];
}

export function parseSuffixRules(aff) {
  if (!/^FLAG long\s*$/m.test(aff)) throw new Error('Only FLAG long is supported');
  const rules = new Map();
  let skippedRules = 0;
  for (const line of aff.split(/\r?\n/)) {
    const fields = line.split('#')[0].trim().split(/\s+/);
    if (fields[0] !== 'SFX') continue;
    if (fields.length === 4 && /^[YN]$/.test(fields[2]) && /^\d+$/.test(fields[3])) continue;
    const [, flag, strip, add, condition] = fields;
    if (fields.length !== 5 || flag.length !== 2 || add.includes('/')) {
      skippedRules++;
      continue;
    }
    try { new RegExp(`${condition}$`, 'u'); } catch { skippedRules++; continue; }
    const rule = { strip: strip === '0' ? '' : strip, add: add === '0' ? '' : add, condition };
    rules.set(flag, [...(rules.get(flag) ?? []), rule]);
  }
  return { rules, skippedRules };
}
