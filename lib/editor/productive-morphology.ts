import type { GenerateFormsRequest, GrammaticalCase, GrammaticalPerson,
  MorphologicalAnalysis, MorphologicalFeatures, MorphologicalStemCandidate,
  MorphologyEngine } from './contracts/morphology';
import { foldLetters } from './dictionary';

const vowels = /[aıoueəiöü]$/u;
// Reviewed stems only: arbitrary dictionary entries cannot safely be passed
// through every paradigm (irregular stems and loanwords need separate rules).
const nouns = 'məktəb müəllim tələbə şəhər kənd küçə otaq sənəd mətn layihə məsələ şirkət müştəri əməkdaş rəhbər görüş sorğu sual cavab dəyişiklik məlumat proqram cümlə səhifə istifadəçi kitab qapı dost ailə iş gün gecə vaxt hava yol park bağ çay dağ meşə ölkə dünya tarix elm təhsil sağlamlıq həkim xəstəxana universitet dərs imtahan fikir qərar plan məqsəd nəticə proses sistem server kod fayl xəta test xidmət məhsul bazar sifariş müqavilə məktub xəbər müraciət tələb təklif həll mənbə mərhələ modul komanda əməkdaşlıq vətəndaş insan həyat ürək idman yemək meyvə ağac ulduz planet kosmos sənət musiqi xəritə dəftər qələm masa pəncərə qatar avtobus dayanacaq liman gəmi təyyarə aeroport kitabxana bağça laboratoriya telefon kompüter ekran klaviatura düymə xəstə müəllif oxucu tamaşaçı rəssam müğənni aktyor oyun idmançı meydan stadion qida tərəvəz çörək çanta paltar mühit təbiət iqlim yağış külək bulud günəş uşaq ana ata bacı qardaş qadın kişi səhra çöl nəqliyyat enerji qayda hüquq qanun fikir mütəxəssis təqdimat hesabat nəticəlik resurs təhlükə sınaq texnika məqalə şəkil rəng təcrübə'.split(' ');
const verbs = 'gəl get düşün gör eşit danış çalış işlə oxu yaz gözlə başla istə bil et göndər düzəlt yoxla araşdır aç bağla yarat hazırla qur seç soruş qoru saxla tap anla paylaş öyrən öyrət göstər dinlə izlə dəyiş bölüş ölç planlaşdır tamamla təmizlə bağışla bildir'.split(' ');
const cases: GrammaticalCase[] = ['nominative', 'genitive', 'dative', 'accusative', 'locative', 'ablative'];
const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('az-AZ');
const vowel = (s: string) => s.match(/[aıoueəiöü]/gu)?.at(-1) ?? 'a';
const a = (s: string) => /[eəiöü]/u.test(vowel(s)) ? 'ə' : 'a';
const i = (s: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[vowel(s)] ?? 'ı';

function soft(stem: string, beforeVowel: boolean): string {
  if (!beforeVowel) return stem;
  if (stem.endsWith('q')) return stem.slice(0, -1) + 'ğ';
  if (stem.endsWith('k')) return stem.slice(0, -1) + 'y';
  return stem;
}

function possessive(stem: string, person: GrammaticalPerson, plural: boolean): string {
  const v = vowels.test(stem);
  const suffix = person === 1 ? (plural ? (v ? 'm' : i(stem) + 'm') + i(stem) + 'z' : (v ? 'm' : i(stem) + 'm'))
    : person === 2 ? (plural ? (v ? 'n' : i(stem) + 'n') + i(stem) + 'z' : (v ? 'n' : i(stem) + 'n'))
      : (v ? 's' : '') + i(stem);
  return soft(stem, /^[aıoueəiöü]/u.test(suffix)) + suffix;
}

function inflectCase(stem: string, grammaticalCase: GrammaticalCase, thirdPossessive: boolean): string {
  if (grammaticalCase === 'nominative') return stem;
  const v = vowels.test(stem);
  const suffix = grammaticalCase === 'genitive' ? (v ? 'n' : '') + i(stem) + 'n'
    : grammaticalCase === 'dative' ? (thirdPossessive ? 'n' : v ? 'y' : '') + a(stem)
      : grammaticalCase === 'accusative' ? (thirdPossessive ? 'n' : v ? 'n' : '') + i(stem)
        : (thirdPossessive ? 'n' : '') + (grammaticalCase === 'locative' ? 'd' + a(stem) : 'd' + a(stem) + 'n');
  return soft(stem, /^[aıoueəiöü]/u.test(suffix)) + suffix;
}

type Form = { lemma: string; features: MorphologicalFeatures; pos: 'noun' | 'verb'; suffixes: string[] };
const index = new Map<string, Form[]>();
function add(surface: string, form: Form): void {
  const records = index.get(surface) ?? [];
  if (!records.some(x => x.lemma === form.lemma && JSON.stringify(x.features) === JSON.stringify(form.features))) records.push(form);
  index.set(surface, records);
}

for (const lemma of nouns) {
  for (const plural of [false, true]) {
    const base = lemma + (plural ? a(lemma) === 'ə' ? 'lər' : 'lar' : '');
    for (const poss of [undefined, 1, 2, 3] as const) {
      for (const ownersPlural of poss === undefined ? [false] : [false, true]) {
        if (poss === 3 && ownersPlural) continue; // same surface for third-person owners
        const possessed = poss === undefined ? base : possessive(base, poss, ownersPlural);
        for (const grammaticalCase of cases) {
          const surface = inflectCase(possessed, grammaticalCase, poss === 3);
          add(surface, { lemma, pos: 'noun', features: { number: plural ? 'plural' : 'singular',
            ...(poss ? { possessivePerson: poss, possessiveNumber: ownersPlural ? 'plural' : 'singular' } : {}),
            case: grammaticalCase }, suffixes: [base.slice(lemma.length), possessed.slice(base.length), surface.slice(possessed.length)].filter(Boolean) });
        }
      }
    }
  }
}

for (const lemma of verbs) {
  const v = vowels.test(lemma);
  for (const passive of [false, true]) {
    const stem = passive ? lemma + (v ? 'n' : i(lemma) + 'l') : lemma;
    for (const negative of [false, true]) {
      for (const tense of ['present', 'past', 'future'] as const) {
        const voiced = !negative && !passive && stem.endsWith('t') ? stem.slice(0, -1) + 'd' : stem;
        const root = tense === 'present'
          ? (negative ? stem + 'm' : voiced + (v && !passive ? 'y' : '')) + i(stem) + 'r'
          : tense === 'past'
            ? (negative ? stem + 'm' + a(stem) : stem) + 'd' + i(stem)
            : (negative ? stem + 'm' + a(stem) + 'y' : voiced + (v && !passive ? 'y' : ''))
              + a(stem) + (a(stem) === 'ə' ? 'cək' : 'caq');
        for (const [person, suffix] of [[1, 'm'], [2, 'n'], [3, ''], [1, 'q'], [2, 'niz'], [3, a(stem) === 'ə' ? 'lər' : 'lar']] as const) {
          const ending = tense === 'present' ? (person === 1 && suffix === 'm' ? a(stem) === 'ə' ? 'əm' : 'am'
            : person === 2 && suffix === 'n' ? 's' + (a(stem) === 'ə' ? 'ən' : 'an')
              : person === 1 && suffix === 'q' ? i(stem) + (a(stem) === 'ə' ? 'k' : 'q')
                : person === 2 && suffix === 'niz' ? 's' + i(stem) + 'n' + i(stem) + 'z' : suffix)
            : tense === 'future' && suffix === 'm' ? a(stem) === 'ə' ? 'əm' : 'am'
              : tense === 'future' && suffix === 'n' ? a(stem) === 'ə' ? 'sən' : 'san'
                : tense === 'future' && suffix === 'q' ? i(stem) + (a(stem) === 'ə' ? 'k' : 'q')
                  : tense === 'past' && suffix === 'q' ? a(stem) === 'ə' ? 'k' : 'q'
                    : suffix === 'niz' ? (tense === 'future' ? 's' : '') + i(stem) + 'n' + i(stem) + 'z' : suffix;
          const futureSoft = tense === 'future' && /^[aıoueəiöü]/u.test(ending)
            ? root.slice(0, -1) + 'y' : root;
          add(futureSoft + ending, { lemma, pos: 'verb', features: { tense, person,
            number: suffix === 'q' || suffix === 'niz' || /lar|lər/u.test(suffix) ? 'plural' : 'singular',
            polarity: negative ? 'negative' : 'positive', ...(passive ? { derivation: ['passive'] } : {}) },
          suffixes: [root.slice(lemma.length), ending].filter(Boolean) });
        }
      }
      if (!passive && !negative) {
        add(lemma, { lemma, pos: 'verb', features: { mood: 'imperative', person: 2 }, suffixes: [] });
        const linker = v ? 'y' : '';
        const converbA = linker + a(lemma) + 'r' + a(lemma) + (a(lemma) === 'ə' ? 'k' : 'q');
        const converbI = linker + i(lemma) + 'b';
        const necessity = 'm' + a(lemma) + 'l' + i(lemma);
        for (const [suffix, mood] of [[converbA, 'converb'], [converbI, 'converb'],
          [necessity, 'necessity'], [necessity + (a(lemma) === 'ə' ? 'dir' : 'dır'), 'necessity']] as const) {
          add(lemma + suffix, { lemma, pos: 'verb', features: { mood }, suffixes: [suffix] });
        }
        for (const [suffix, mood] of [['an', 'participle'], ['mış', 'participle']] as const) {
          const s = lemma + (suffix === 'an' ? a(lemma) + 'n' : 'm' + i(lemma) + 'ş');
          add(s, { lemma, pos: 'verb', features: { mood }, suffixes: [s.slice(lemma.length)] });
        }
      }
    }
  }
}

const foldedIndex = new Map<string, Set<string>>();
for (const surface of index.keys()) {
  const key = foldLetters(surface);
  const forms = foldedIndex.get(key) ?? new Set<string>();
  forms.add(surface);
  foldedIndex.set(key, forms);
}

export class ProductiveMorphologyEngine implements MorphologyEngine {
  findByFoldedForm(word: string): string | undefined {
    const lowerWord = lower(word);
    const matches = [...(foldedIndex.get(foldLetters(lowerWord)) ?? [])].filter(value =>
      [...lowerWord].every((letter, at) => !/[əçğıöşü]/u.test(letter) || value[at] === letter));
    return matches.length === 1 ? matches[0] : undefined;
  }
  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const surface = lower(word);
    return (index.get(surface) ?? []).map(record => ({ surface, lemma: record.lemma,
      pos: record.pos, features: record.features, source: 'rule' }));
  }
  generateForms(request: GenerateFormsRequest): readonly string[] {
    const lemma = lower(request.lemma);
    const limit = Math.max(0, Math.min(request.limit ?? 64, 256));
    if (!limit) return [];
    const output: string[] = [];
    for (const [surface, records] of index) {
      if (records.some(record => record.lemma === lemma
        && (!request.pos || record.pos === request.pos)
        && Object.entries(request.features ?? {}).every(([name, value]) =>
          JSON.stringify(record.features[name as keyof MorphologicalFeatures]) === JSON.stringify(value)))) {
        output.push(surface);
        if (output.length >= limit) break;
      }
    }
    return output;
  }
  isValidWordForm(word: string): boolean { return index.has(lower(word)); }
  stripSuffixes(word: string): readonly MorphologicalStemCandidate[] {
    return (index.get(lower(word)) ?? []).map(record =>
      ({ stem: record.lemma, removedSuffixes: record.suffixes }));
  }
}

export const productiveMorphology = new ProductiveMorphologyEngine();
