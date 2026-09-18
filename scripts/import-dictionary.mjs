import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  if (process.argv[2]) bytes = await readFile(resolve(process.argv[2], path));
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
const words = [...new Set(lines.map(line => line.split('/')[0].trim().normalize('NFC')))];
const metadata = {
  source: 'https://github.com/mozillaz/spellchecker', commit,
  attribution: 'Mozilla Azerbaijan; word list provided by azerdict.com', license: 'MPL-2.0',
  declaredEntries, actualEntries: lines.length, uniqueEntries: words.length,
  matchableEntries: words.filter(word => /^[A-Za-zƏəÇçĞğİıÖöŞşÜü]+(?:[- ’'][A-Za-zƏəÇçĞğİıÖöŞşÜü]+)*$/.test(word)).length,
  checksums: files,
};
await mkdir(resolve(root, 'lib/editor/generated'), { recursive: true });
await writeFile(resolve(root, 'lib/editor/generated/az-words.json'), JSON.stringify(words) + '\n');
await writeFile(resolve(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
