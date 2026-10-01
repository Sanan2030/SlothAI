import { agreementForms } from '../lib/editor/neural/morphology';
import { createHash } from 'node:crypto';
import { productiveMorphology } from '../lib/editor/productive-morphology';
import { subjects } from '../lib/editor/neural/features';
import { fold } from '../lib/editor/local-ai/core';
import { atomicWriteSync } from './atomic-files.mjs';
const nouns = ['məktəb', 'kitab', 'sənəd', 'məktub', 'qovluq', 'müəllim', 'tələbə', 'müştəri', 'əməkdaş', 'şirkət', 'məlumat', 'hesabat'];
const frames = ['Müəllim «{word}» sözünü lövhəyə yazdı.', 'İclasda «{word}» sözünün yazılışını müzakirə etdik.', 'Redaktor «{word}» sözünün yazılışını yoxladı.', 'Bu sənəddə «{word}» sözü göstərilib.', 'Komanda «{word}» sözünün formasını yoxladı.'];
const split = (group: string) => { const n = parseInt(createHash('sha256').update(group).digest('hex').slice(0, 8), 16) % 10; return n < 2 ? 'test' : n === 2 ? 'validation' : 'train'; };
const lexical = nouns.flatMap(lemma => productiveMorphology.generateForms({ lemma, pos: 'noun', features: { number: 'plural' }, limit: 12 }).flatMap(word => frames.flatMap((frame, at) => {
  const target = frame.replace('{word}', word), group = `lexical:${lemma}:${word}:${at}`;
  const ascii = fold(word), confusions = ascii.replace(/e/gu, 'a');
  return [...new Set([ascii, confusions, ascii.slice(0, 2) + ascii.slice(3), ascii.slice(0, 2) + ascii[2] + ascii.slice(2)])].map((raw, variant) => ({ id: `${group}:${variant}`, groupId: group, split: split(group), input: frame.replace('{word}', raw), target }));
})));
const verbs = ['yaz', 'oxu', 'göndər', 'hazırla', 'yoxla', 'tamamla', 'işlə', 'gəl', 'get'];
const agreement = verbs.flatMap(lemma => ['past', 'present', 'future'].flatMap(tense => [false, true].flatMap(negative => Object.entries(subjects).flatMap(([pronoun, subject]) => {
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
atomicWriteSync('data/neural/corpus.json', JSON.stringify({ source: 'Assistant-authored morphology/template exercises, not real user or human-certified language data', lexical, agreement }, null, 2) + '\n');
console.log({ lexical: lexical.length, agreement: agreement.length });
