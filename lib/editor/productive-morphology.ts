import type { GenerateFormsRequest, GrammaticalCase, GrammaticalPerson,
  MorphologicalAnalysis, MorphologicalFeatures, MorphologicalStemCandidate,
  MorphologyEngine } from './contracts/morphology';
import type { PartOfSpeech } from './contracts/lemma';
import { foldLetters } from './dictionary';
import additionalStems from '../../data/local-ai/reviewed-stems.json';
import posArtifact from './local-ai/pos-model.json';

const vowels = /[aıoueəiöü]$/u;
// Reviewed stems only: arbitrary dictionary entries cannot safely be passed
// through every paradigm (irregular stems and loanwords need separate rules).
const nouns = 'məktəb müəllim tələbə şəhər səhər surət sürət kənd küçə otaq sənəd mətn layihə məsələ şirkət müştəri əməkdaş rəhbər görüş sorğu sual cavab dəyişiklik məlumat proqram cümlə səhifə istifadəçi kitab qapı dost ailə iş gün gecə vaxt hava yol park bağ çay dağ meşə ölkə dünya tarix elm təhsil sağlamlıq həkim xəstəxana universitet dərs imtahan fikir qərar plan məqsəd nəticə proses sistem server kod fayl xəta test xidmət məhsul bazar sifariş müqavilə məktub xəbər müraciət tələb təklif həll mənbə mərhələ modul komanda əməkdaşlıq vətəndaş insan həyat ürək idman yemək meyvə ağac ulduz planet kosmos sənət musiqi xəritə dəftər qələm masa pəncərə qatar avtobus dayanacaq liman gəmi təyyarə aeroport kitabxana bağça laboratoriya telefon kompüter ekran klaviatura düymə xəstə müəllif oxucu tamaşaçı rəssam müğənni aktyor oyun idmançı meydan stadion qida tərəvəz çörək çanta paltar mühit təbiət iqlim yağış külək bulud günəş uşaq ana ata bacı qardaş qadın kişi səhra çöl nəqliyyat enerji qayda hüquq qanun mütəxəssis təqdimat hesabat nəticəlik resurs təhlükə sınaq texnika məqalə şəkil rəng təcrübə adam quş bildiriş qeydiyyat status icra əsl müddət ad qeyd görünüş kart soyad əlavə yükləmə addım sətir bənd field qəbz qrafik buraxılış baxış şəbəkə düzəliş vəzifə jurnal operator mod bank hadisə səbəb log qalıq saxlanma yoxlama kağız indeks icraçı nümunə production sıra saniyə şöbə sütun nömrə katiblik imza dərkənar təhlil alternativ açar limit yük kabinet variant paylanma'.split(' ');
const verbs = 'çıx keç sürüş yayıl aşkarlan köçür birləşdir qop axtar gözlə yüklə gəl get düşün gör eşit danış çalış işlə oxu yaz başla istə bil et göndər düzəlt yoxla araşdır aç bağla yarat hazırla qur seç soruş qoru saxla tap anla paylaş öyrən öyrət göstər dinlə izlə dəyiş bölüş ölç planlaşdır tamamla təmizlə bağışla bildir uç qayıt ol de ye dəy yolla maskala təsdiqlə razılaşdır yenilə qaytar al çat düş bit çoxal çağır çatdır yönləndir görün art ayır yaşa doğrula poz sına sal dəqiqləşdir rica itir sil azal blokla'.split(' ');
const cases: GrammaticalCase[] = ['nominative', 'genitive', 'dative', 'accusative', 'locative', 'ablative'];
const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('az-AZ');
const vowel = (s: string) => s.match(/[aıoueəiöü]/gu)?.at(-1) ?? 'a';
const a = (s: string) => /[eəiöü]/u.test(vowel(s)) ? 'ə' : 'a';
const i = (s: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[vowel(s)] ?? 'ı';

function soft(stem: string, beforeVowel: boolean): string {
  if (!beforeVowel) return stem;
  if (stem.endsWith('q')) return stem.slice(0, -1) + 'ğ';
  // Only reviewed native stems soften k; park and other loanwords retain it.
  if (/^(?:ürək|çörək|yemək|külək|dəyişiklik|kömək)$/.test(stem)) return stem.slice(0, -1) + 'y';
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

const voiceT = (stem: string) => /^(?:et|get|eşit|düzəlt|yarat|qayıt)$/.test(stem)
  ? stem.slice(0, -1) + 'd' : stem;

type Form = { lemma: string; features: MorphologicalFeatures; pos: PartOfSpeech; suffixes: string[] };
const index = new Map<string, Form[]>();
const formsByLemma = new Map<string, Map<string, Form[]>>();
function add(surface: string, form: Form): void {
  const records = index.get(surface) ?? [];
  if (!records.some(x => x.lemma === form.lemma && JSON.stringify(x.features) === JSON.stringify(form.features))) {
    records.push(form);
    const forms = formsByLemma.get(form.lemma) ?? new Map<string, Form[]>();
    const lemmaRecords = forms.get(surface) ?? [];
    lemmaRecords.push(form);
    forms.set(surface, lemmaRecords);
    formsByLemma.set(form.lemma, forms);
  }
  index.set(surface, records);
}

for (const lemma of new Set([...nouns, ...additionalStems.nouns])) {
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

for (const lemma of new Set([...verbs, ...additionalStems.verbs])) {
  const v = vowels.test(lemma);
  for (const passive of [false, true]) {
    const passiveStem: Record<string, string> = { et: 'edil', get: 'gedil', de: 'deyil', ye: 'yeyil', ol: 'olun' };
    const stem = passive ? passiveStem[lemma] ?? voiceT(lemma) + (v ? 'n' : i(lemma) + (lemma.endsWith('l') ? 'n' : 'l')) : lemma;
    if (passive) {
      const ending = (vowels.test(stem) ? 'y' : '') + i(stem) + 'b';
      add(stem + ending, { lemma, pos: 'verb', features: { tense: 'evidential-past',
        person: 3, number: 'singular', polarity: 'positive', derivation: ['passive'] }, suffixes: [ending] });
    }
    for (const negative of [false, true]) {
      const conditional = stem + (negative ? 'm' + a(stem) : '') + 's' + a(stem);
      for (const [person, number, ending] of [[1, 'singular', 'm'], [2, 'singular', 'n'], [3, 'singular', ''],
        [1, 'plural', a(stem) === 'ə' ? 'k' : 'q'], [2, 'plural', 'n' + i(stem) + 'z'],
        [3, 'plural', a(stem) === 'ə' ? 'lər' : 'lar']] as const) {
        add(conditional + ending, { lemma, pos: 'verb', features: { mood: 'conditional', person, number,
          polarity: negative ? 'negative' : 'positive', ...(passive ? { derivation: ['passive'] } : {}) },
          suffixes: [conditional.slice(lemma.length), ending].filter(Boolean) });
      }
      for (const tense of ['present', 'past', 'future'] as const) {
        const voiced = !negative && !passive ? voiceT(stem) : stem;
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
            ? root.slice(0, -1) + (root.endsWith('q') ? 'ğ' : 'y') : root;
          add(futureSoft + ending, { lemma, pos: 'verb', features: { tense, person,
            number: suffix === 'q' || suffix === 'niz' || /lar|lər/u.test(suffix) ? 'plural' : 'singular',
            polarity: negative ? 'negative' : 'positive', ...(passive ? { derivation: ['passive'] } : {}) },
          suffixes: [root.slice(lemma.length), ending].filter(Boolean) });
        }
      }
      if (!passive && !negative) {
        const infinitive = lemma + 'm' + a(lemma) + (a(lemma) === 'ə' ? 'k' : 'q');
        add(infinitive, { lemma, pos: 'verb', features: { mood: 'infinitive' }, suffixes: [infinitive.slice(lemma.length)] });
        add(lemma, { lemma, pos: 'verb', features: { mood: 'imperative', person: 2 }, suffixes: [] });
        const commandStem = voiceT(lemma);
        const commandSuffix = (v ? 'y' : '') + i(lemma) + 'n';
        add(commandStem + commandSuffix, { lemma, pos: 'verb', features: { mood: 'imperative',
          person: 2, number: 'plural' }, suffixes: [commandSuffix] });
        const linker = v ? 'y' : '';
        const converbA = linker + a(lemma) + 'r' + a(lemma) + (a(lemma) === 'ə' ? 'k' : 'q');
        const converbI = linker + i(lemma) + 'b';
        const necessity = 'm' + a(lemma) + 'l' + i(lemma);
        for (const [suffix, mood] of [[converbA, 'converb'], [converbI, 'converb'],
          [necessity, 'necessity'], [necessity + (a(lemma) === 'ə' ? 'dir' : 'dır'), 'necessity']] as const) {
          const surface = (mood === 'converb' ? voiceT(lemma) : lemma) + suffix;
          add(surface, { lemma, pos: 'verb', features: { mood }, suffixes: [suffix] });
          if (suffix === converbI) add(surface, { lemma, pos: 'verb', features: { tense: 'evidential-past',
            person: 3, number: 'singular', polarity: 'positive' }, suffixes: [suffix] });
        }
        for (const [suffix, mood] of [['an', 'participle'], ['mış', 'participle']] as const) {
          const s = (suffix === 'an' ? voiceT(lemma) : lemma) + (suffix === 'an' ? (v ? 'y' : '') + a(lemma) + 'n' : 'm' + i(lemma) + 'ş');
          add(s, { lemma, pos: 'verb', features: { mood }, suffixes: [s.slice(lemma.length)] });
        }
      }
    }
  }
}

for (const lemma of 'elektron rəsmi yeni köhnə ilkin ikinci əlavə tam yekun daxili xarici həqiqi kritik böyük kiçik fərqli əvvəlki avtomatik'.split(' ')) {
  add(lemma, { lemma, pos: 'adjective', features: {}, suffixes: [] });
}

const foldedIndex = new Map<string, Set<string>>();
for (const surface of index.keys()) {
  const key = foldLetters(surface);
  const forms = foldedIndex.get(key) ?? new Set<string>();
  forms.add(surface);
  foldedIndex.set(key, forms);
}

/** Analyze productive nominal predicates without mutating frozen model features. */
function nominalPredicate(surface: string): MorphologicalAnalysis[] {
  const endings: [number, 'singular' | 'plural', string[]][] = [
    [1, 'singular', ['yam', 'yəm', 'am', 'əm']], [2, 'singular', ['san', 'sən']],
    [1, 'plural', ['yıq', 'yik', 'yuq', 'yük', 'ıq', 'ik', 'uq', 'ük']],
    [2, 'plural', ['sınız', 'siniz', 'sunuz', 'sünüz']],
    [3, 'singular', ['dır', 'dir', 'dur', 'dür']],
  ];
  const result: MorphologicalAnalysis[] = [];
  for (const [person, number, suffixes] of endings) for (const suffix of suffixes) {
    if (!surface.endsWith(suffix)) continue;
    const base = surface.slice(0, -suffix.length), front = a(base) === 'ə', roundedI = i(base);
    const expected = person === 1 ? number === 'singular' ? (vowels.test(base) ? 'y' : '') + (front ? 'əm' : 'am')
      : (vowels.test(base) ? 'y' : '') + roundedI + (front ? 'k' : 'q')
      : person === 2 ? number === 'singular' ? (front ? 'sən' : 'san') : 's' + roundedI + 'n' + roundedI + 'z'
        : 'd' + roundedI + 'r';
    if (suffix !== expected) continue;
    for (const record of index.get(base) ?? []) if (record.pos === 'noun' || record.pos === 'adjective') {
      result.push({ surface, lemma: record.lemma, pos: record.pos,
        features: { ...record.features, tense: 'present', person: person as GrammaticalPerson,
          // Predicate number differs from an inflected noun's lexical plural.
          derivation: [...(record.features.derivation ?? []), 'copula-' + number] }, source: 'rule' });
    }
  }
  return result;
}

const nominalSuffixes = ['yam', 'yəm', 'am', 'əm', 'san', 'sən', 'yıq', 'yik', 'yuq', 'yük', 'ıq', 'ik', 'uq', 'ük', 'sınız', 'siniz', 'sunuz', 'sünüz', 'dır', 'dir', 'dur', 'dür'].map(suffix => ({ suffix, folded: foldLetters(suffix) }));
function foldedNominalPredicates(raw: string): string[] {
  if (!/^[a-zəçğıöşü]{5,32}$/u.test(raw)) return [];
  const input = foldLetters(raw), found = new Set<string>();
  for (const { suffix, folded } of nominalSuffixes) {
    if (!input.endsWith(folded)) continue;
    const stem = input.slice(0, -suffix.length);
    for (const base of foldedIndex.get(stem) ?? []) {
      if (!(index.get(base) ?? []).some(row => row.pos === 'noun' || row.pos === 'adjective')) continue;
      const surface = base + suffix;
      if (nominalPredicate(surface).length && foldLetters(surface) === input) found.add(surface);
    }
  }
  return [...found];
}

export class ProductiveMorphologyEngine implements MorphologyEngine {
  constructor(private readonly nominalPredicates = true) {}
  private readonly analyses = new Map<string, readonly MorphologicalAnalysis[]>();
  private readonly folded = new Map<string, string | undefined>();
  findByFoldedForm(word: string): string | undefined {
    const lowerWord = lower(word);
    if (this.folded.has(lowerWord)) return this.folded.get(lowerWord);
    const established = foldedIndex.get(foldLetters(lowerWord));
    const matches = [...(established?.size ? established : this.nominalPredicates ? foldedNominalPredicates(lowerWord) : [])].filter(value =>
      [...lowerWord].every((letter, at) => !/[əçğıöşü]/u.test(letter) || value[at] === letter));
    const selected = matches.length === 1 ? matches[0] : undefined;
    if (this.folded.size >= 4096) this.folded.clear();
    this.folded.set(lowerWord, selected);
    return selected;
  }
  correctMalformedForm(word: string): string | undefined {
    // A vowel-final nominal accusative uses -nI, not the dative buffer -y.
    const raw = lower(word);
    if (!/yi$/u.test(foldLetters(raw))) return undefined;
    const stem = this.findByFoldedForm(raw.slice(0, -2));
    if (!stem || !vowels.test(stem) || !this.analyzeWord(stem).some(record =>
      record.pos === 'noun' && record.features.case === 'nominative' && !record.features.possessivePerson)) return undefined;
    return stem + 'n' + i(stem);
  }
  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const surface = lower(word);
    const cached = this.analyses.get(surface);
    if (cached) return cached;
    const records = index.get(surface);
    if (!records) {
      const nominal = this.nominalPredicates ? nominalPredicate(surface) : [];
      if (nominal.length) { if (this.analyses.size >= 4096) this.analyses.clear(); this.analyses.set(surface, nominal); return nominal; }
      const words = posArtifact.words as Record<string, Record<string, number>>;
      const lemmas = posArtifact.lemmas as Record<string, string[]>;
      const labels: Record<string, PartOfSpeech> = { NOUN: 'noun', VERB: 'verb', AUX: 'verb', ADJ: 'adjective',
        ADV: 'adverb', PRON: 'pronoun', NUM: 'numeral', ADP: 'postposition', CCONJ: 'conjunction',
        SCONJ: 'conjunction', PART: 'particle', INTJ: 'interjection', PROPN: 'proper-noun' };
      const lexical = Object.keys(words[surface] ?? {}).filter(tag => labels[tag]);
      return lexical.flatMap(tag => (lemmas[surface] ?? [surface]).map(lemma => ({ surface, lemma,
        pos: labels[tag], features: {}, source: 'lexicon' as const })));
    }
    const analyses: readonly MorphologicalAnalysis[] = records.map(record => ({ surface, lemma: record.lemma,
      pos: record.pos, features: record.features, source: 'rule' }));
    if (this.analyses.size >= 4096) this.analyses.clear();
    this.analyses.set(surface, analyses);
    return analyses;
  }
  generateForms(request: GenerateFormsRequest): readonly string[] {
    const lemma = lower(request.lemma);
    const limit = Math.max(0, Math.min(request.limit ?? 64, 256));
    if (!limit) return [];
    const output: string[] = [];
    for (const [surface, records] of formsByLemma.get(lemma) ?? []) {
      if (records.some(record => (!request.pos || record.pos === request.pos)
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
/** Exact indexed + POS analysis used to train the deployed spelling/boundary
 * artifacts before nominal predicates were added. Freeze train and inference together. */
export const artifactMorphology = new ProductiveMorphologyEngine(false);

/** Frozen feature vocabulary for established classifiers. New POS/lemma data
 * must not silently change the features used by an already-trained artifact. */
const legacyRoots = new Set([...nouns, ...verbs,
  ...'elektron rəsmi yeni köhnə ilkin ikinci əlavə tam yekun daxili xarici həqiqi kritik böyük kiçik fərqli əvvəlki avtomatik'.split(' ')]);
export const legacyModelMorphology = {
  analyzeWord(word: string): readonly MorphologicalAnalysis[] {
    const surface = lower(word);
    return (index.get(surface) ?? []).filter(record => legacyRoots.has(record.lemma)).map(record =>
      ({ surface, lemma: record.lemma, pos: record.pos, features: record.features, source: 'rule' as const }));
  },
  findByFoldedForm(word: string): string | undefined {
    const raw = lower(word);
    const choices = [...(foldedIndex.get(foldLetters(raw)) ?? [])].filter(surface =>
      (index.get(surface) ?? []).some(record => legacyRoots.has(record.lemma))
      && [...raw].every((letter, at) => !/[əıçğöşü]/u.test(letter) || surface[at] === letter));
    return choices.length === 1 ? choices[0] : undefined;
  },
};
