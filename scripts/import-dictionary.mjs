import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSuffixRules, splitLongFlags } from './hunspell.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commit = '7f484fc96126919ccdb1f65908558b36a5b43301';
const files = {
  'dictionaries/az.dic': '9d21f073f7cd8a7b67131b4edc165878579f699ac66eea86d9d5459a65dd16bb',
  'dictionaries/az.aff': 'a2a9a85dcdf83f21d463c6da527d90d306d7f7f0f9f3f479618dc6e02e889aae',
  LICENSE: '1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5',
};
const collected = {};
for (const [path, digest] of Object.entries(files)) {
  let bytes;
  // A local source directory points at public/dictionaries/az; its files do
  // not retain the upstream dictionaries/ prefix.
  if (process.argv[2]) bytes = await readFile(resolve(process.argv[2], path.replace(/^dictionaries\//, '')));
  else {
    const response = await fetch(`https://raw.githubusercontent.com/mozillaz/spellchecker/${commit}/${path}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Dictionary download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error(`Checksum mismatch: ${path}`);
  collected[path] = bytes;
}
// Every download is verified before writing any source or generated data.
const output = resolve(root, 'public/dictionaries/az');
await mkdir(output, { recursive: true });
for (const [path, bytes] of Object.entries(collected)) await writeFile(resolve(output, path.split('/').at(-1)), bytes);
const lines = collected['dictionaries/az.dic'].toString('utf8').trim().split(/\r?\n/);
const declaredEntries = Number(lines.shift());
const entries = lines.map(line => {
  const [word, flags = ''] = line.trim().normalize('NFC').split('/');
  return { word, flags };
});
const rawBaseWords = [...new Set(entries.map(({ word }) => word))];

// Hunspell supplies productive Azerbaijani suffix rules. We apply only SFX
// rules from the same pinned dictionary and stop at a modest browser-safe
// 100,000-form upper bound. IT roots are expanded first so terminology receives the
// same coverage as ordinary Azerbaijani nouns.
const { rules: suffixRules, skippedRules } = parseSuffixRules(collected['dictionaries/az.aff'].toString('utf8'));
const technicalRoot = /(komp|proqram|şəbək|məlumat|sistem|server|verilən|alqoritm|kod|informasiya|texnolog|inteqra|təhlükəsiz|veri|bulud|platform|əməliyyat|sorğu|baza|interfeys|istifadəçi|parametr|konfiqur|protokol|rabit|kiber|rəqəmsal|analitik)/iu;
const validWord = word => /^[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[- ’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*$/u.test(word);
const baseWords = rawBaseWords.filter(validWord);
const targetForms = 100_000;
const words = new Set(baseWords);
for (const entry of [...entries.filter(entry => technicalRoot.test(entry.word)), ...entries]) {
  if (words.size >= targetForms) break;
  if (entry.flags.length % 2) continue; // Malformed source flags are not guessed.
  for (const rule of splitLongFlags(entry.flags).flatMap(flag => suffixRules.get(flag) ?? [])) {
    if (words.size >= targetForms) break;
    if (!new RegExp(`${rule.condition}$`, 'u').test(entry.word)) continue;
    const stem = rule.strip && entry.word.endsWith(rule.strip)
      ? entry.word.slice(0, -rule.strip.length) : rule.strip ? null : entry.word;
    if (!stem) continue;
    const form = (stem + rule.add).normalize('NFC');
    if (validWord(form)) words.add(form);
  }
}
const wordList = [...words];
const metadata = {
  source: 'https://github.com/mozillaz/spellchecker', commit,
  attribution: 'Mozilla Azerbaijan; word list provided by azerdict.com', license: 'MPL-2.0',
  declaredEntries, actualEntries: lines.length, uniqueEntries: rawBaseWords.length,
  matchableBaseEntries: baseWords.length,
  generatedForms: wordList.length - baseWords.length,
  targetForms,
  generationPolicy: 'bounded single-step SFX; FLAG long; no continuation, prefix, compound or cross-product rules',
  skippedMalformedOrUnsupportedRules: skippedRules,
  skippedMalformedFlagEntries: entries.filter(entry => entry.flags.length % 2).length,
  matchableEntries: wordList.filter(validWord).length,
  checksums: files,
};
await mkdir(resolve(root, 'lib/editor/generated'), { recursive: true });
await writeFile(resolve(root, 'lib/editor/generated/az-words.json'), JSON.stringify(wordList) + '\n');
await writeFile(resolve(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
