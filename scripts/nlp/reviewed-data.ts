import { parseReviewCorpus } from '../../lib/editor/review-corpus';
import { checksum, splitDocuments, type Split } from './data';
const folded = (text: string) => text.normalize('NFC').toLocaleLowerCase('az-AZ').replace(/[əıçğöşü]/gu, letter => ({ ə: 'e', ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' })[letter]!).replace(/\s+/gu, ' ').trim();
/** Explicitly approved target with caller-supplied provenance. Inputs can be
 * real or synthetic; user approval does not turn synthetic text into real data.
 * Machine output is never silently relabeled as approved gold.
 */
export function reviewedDataset(raw: string, provenance: string, reviewedBy: string, license: string, excludedTargets: readonly string[] = []) {
  if (!provenance.trim() || !reviewedBy.trim() || !license.trim()) throw new Error('Provide provenance, reviewedBy and license for your own review file.');
  const corpus = parseReviewCorpus(raw);
  const blocked = new Set(excludedTargets.map(folded)), seen = new Set<string>();
  const targets = new Map<string, Set<string>>();
  for (const row of corpus.cases) {
    if (row.reviewStatus !== 'user-approved' || row.module !== 'text') continue;
    const key = folded(row.input), set = targets.get(key) ?? new Set<string>();
    // Diacritics distinguish meaning: ac/aç must not collapse into one target.
    set.add(row.expected.normalize('NFC').replace(/\s+/gu, ' ').trim()); targets.set(key, set);
  }
  const rejected: { id: string; reason: string }[] = [];
  const accepted = corpus.cases.filter(row => {
    let reason = '';
    if (row.reviewStatus !== 'user-approved') reason = 'No explicit user approval';
    else if ((targets.get(folded(row.input))?.size ?? 0) > 1) reason = 'Conflicting reviewed targets for the same input';
    else if (row.module !== 'text') reason = 'Mail layout targets must be reviewed as body-only spelling pairs before token training';
    else if (!row.preserveFormatting && (/[ \t]{3,}/u.test(row.expected) || /\n[ \t]+/u.test(row.expected))) reason = 'Target needs whitespace review before training';
    else if (row.input.length > 1200 || row.expected.length > 1200) reason = 'Split long reviewed documents into aligned sentence-sized pairs first';
    else if (blocked.has(folded(row.expected))) reason = 'Overlaps excluded evaluation target';
    const key = checksum(folded(row.input) + '\n' + folded(row.expected));
    if (!reason && seen.has(key)) reason = 'Duplicate pair';
    if (reason) { rejected.push({ id: row.id, reason }); return false; }
    seen.add(key); return true;
  });
  const documents = accepted.map(row => ({ documentId: row.id, text: row.expected, source: provenance, license }));
  const assignments = splitDocuments(documents).documents;
  // Identical targets share one retained source document, preserving different error variants.
  const exact = new Map(assignments.map(doc => [folded(doc.text), doc]));
  const rows = accepted.map(row => {
    const doc = assignments.find(item => item.documentId === row.id) ?? exact.get(folded(row.expected));
    if (!doc) throw new Error('Missing clustered review assignment.');
    return { id: checksum(row.id + ':' + row.input).slice(0, 24), documentId: doc.documentId, split: doc.split,
      input: row.input, target: row.expected, category: row.input === row.expected ? 'identity' : 'reviewed',
      source: provenance, provenance, license, reviewedBy, reviewedAt: row.reviewedAt, annotationStatus: 'user-attested' };
  });
  const partitions = Object.fromEntries((['train', 'validation', 'test'] as Split[]).map(split => {
    const selected = rows.filter(row => row.split === split), contents = selected.map(row => JSON.stringify(row)).join('\n') + (selected.length ? '\n' : '');
    return [split, { rows: selected.length, contents, sha256: checksum(contents) }];
  }));
  const manifest = { version: 2, sourceSHA256: checksum(raw), documents: assignments.map(doc => ({ documentId: doc.documentId, cluster: doc.cluster, split: doc.split })),
    partitions: Object.fromEntries(Object.entries(partitions).map(([key, value]) => [key, { rows: value.rows, sha256: value.sha256 }])),
    review: { provenance, reviewedBy, license, accepted: rows.length, rejected, certification: 'User-attested targets, not independently certified linguistic gold', excludedTargets: excludedTargets.length } };
  return { partitions, manifest };
}
