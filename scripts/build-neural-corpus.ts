import { agreementForms } from '../lib/editor/neural/morphology';
import { createHash } from 'node:crypto';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { agreementFeatures, subjects } from '../lib/editor/neural/features';
import { fold } from '../lib/editor/local-ai/core';
import diverse from '../data/neural/diverse-pairs.json';
import { auditPairs, uniqueExamples } from './neural-data-quality';
import { atomicWriteSync } from './atomic-files.mjs';
const nouns = ['məktəb', 'kitab', 'sənəd', 'məktub', 'qovluq', 'müəllim', 'tələbə', 'müştəri', 'əməkdaş', 'şirkət', 'məlumat', 'hesabat'];
const frames = ['Redaktor «{word}» formasını yoxladı.', 'Lövhədə «{word}» yazılıb.', 'Mən «{word}» sözünü axtardım.', 'Siyahıya «{word}» əlavə edildi.', 'Burada «{word}» nümunəsi göstərilir.', 'Kitabda «{word}» formasına rast gəldik.'];
const split = (group: string) => { const n = parseInt(createHash('sha256').update(group).digest('hex').slice(0, 8), 16) % 10; return n < 2 ? 'test' : n === 2 ? 'validation' : 'train'; };
const lexical = nouns.flatMap(lemma => productiveMorphology.generateForms({ lemma, pos: 'noun', features: { number: 'plural' }, limit: 12 }).flatMap((word, at) => {
  const frame = frames[at % frames.length];
  const target = frame.replace('{word}', word), group = `lexical:${lemma}:${word}:${at}`;
  const ascii = fold(word), confusions = ascii.replace(/e/gu, 'a');
  return [[ascii, confusions, ascii.slice(0, 2) + ascii.slice(3), ascii.slice(0, 2) + ascii[2] + ascii.slice(2)][at % 4]].map((raw, variant) => ({ id: `${group}:${variant}`, groupId: group, split: split(group), input: frame.replace('{word}', raw), target }));
}));
lexical.push(...diverse.rows);
const verbs = ['yaz', 'oxu', 'göndər', 'hazırla', 'yoxla', 'tamamla', 'işlə', 'gəl', 'get'];
const agreementCandidates = verbs.flatMap(lemma => ['past', 'present', 'future'].flatMap(tense => [false, true].flatMap(negative => Object.entries(subjects).flatMap(([pronoun, subject]) => {
  const group = `agreement:${lemma}:${tense}:${negative}:${pronoun}`;
  const common = { tense, polarity: negative ? 'negative' as const : 'positive' as const };
  const correct = agreementForms({ lemma, pos: 'verb', features: { ...common, ...subject }, limit: 3 })[0];
  if (!correct) return [];
  return Object.values(subjects).flatMap(person => {
    const raw = agreementForms({ lemma, pos: 'verb', features: { ...common, ...person }, limit: 3 })[0];
    if (!raw) return [];
    const compatible = person.person === subject.person && (person.number === subject.number || subject.person === 3 && subject.number === 'plural' && person.number === 'singular');
    return [{ id: `${group}:${person.person}:${person.number}`, groupId: group, split: split(group), subject, verb: { ...common, ...person }, compatible,
      input: `${pronoun} ${raw}.`, target: `${pronoun} ${compatible ? raw : correct}.` }];
  });
}))));
// Different verb lemmas can supply the same symbolic training signal.
// Keep each feature vector exactly once across the entire current corpus.
const agreement = uniqueExamples(agreementCandidates.map(row => ({ ...row,
  x: agreementFeatures(row.subject, row.verb), y: Number(row.compatible) }))).map(({ x, y, ...row }) => {
  void y;
  const group = `agreement-features:${JSON.stringify(x)}`;
  return { ...row, groupId: group, split: split(group) };
});
const audit = auditPairs(lexical);
if (audit.duplicates.length || audit.nearDuplicates.length || audit.splitLeaks.length) throw new Error('Duplicate or near-duplicate lexical data: ' + JSON.stringify(audit));
atomicWriteSync('data/neural/corpus.json', JSON.stringify({ source: diverse.source, lexical, agreement }, null, 2) + '\n');
atomicWriteSync('data/neural/data-quality.json', JSON.stringify({ lexical: audit,
  originalLexicalRows: 2760, originalAgreementRows: 1944, agreementRows: agreement.length,
  agreementFeatureDuplicates: 0, agreementFeatureSplitLeaks: 0,
  naturalContexts: diverse.rows.length, domains: [...new Set(diverse.rows.map(row => row.domain))].sort(),
  nearDuplicateDefinition: 'NFC + Azerbaijani folding + token-bigram Jaccard >= 0.8; not a semantic equivalence guarantee',
}, null, 2) + '\n');
console.log({ lexical: lexical.length, agreement: agreement.length });
