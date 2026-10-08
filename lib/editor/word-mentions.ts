/** A recognized word used as a linguistic object is literal data, not prose.
 * Only exact established forms are shielded; an unknown spelling still uses
 * normal correction. This rule has no word-specific exceptions or model tuning.
 */
const labels = [
  'sözü', 'sözünü', 'sözünün', 'sözünə', 'sözündə', 'sözündəki', 'sözündən',
  'termini', 'terminini', 'termininin', 'termininə', 'terminində', 'terminindən',
];
const mention = new RegExp(`(?<![\\p{L}\\p{N}_])([\\p{L}]+(?:[-’'][\\p{L}]+)*)([ \\t]+)(?=(?:${labels.join('|')})(?![\\p{L}\\p{N}_]))`, 'gu');

export function protectWordMentions(text: string, protect: (value: string) => string,
  established: (word: string) => boolean): string {
  return text.replace(mention, (match, word: string, gap: string) =>
    established(word) ? protect(word) + gap : match);
}
