/** Bounded on-demand paradigms over the pinned Hunspell source's lemma classes.
 * No model feature extractor is changed; source classes are lexical evidence,
 * not a claim of contextual POS tagging or general semantic understanding. */
import classes from './generated/az-stem-classes.json';
import { foldLetters } from './dictionary';
import type { MorphologicalAnalysis, MorphologicalFeatures } from './contracts/morphology';

type Stem = { lemma: string; pos: 'noun' | 'verb' | 'adjective' };
const index = new Map<string, Stem[]>();
for (const pos of ['noun', 'verb', 'adjective'] as const) for (const lemma of classes[pos].split(' ')) {
  const key = foldLetters(lemma), bucket = index.get(key) ?? [];
  bucket.push({ lemma, pos }); index.set(key, bucket);
}
const lower = (word: string) => word.toLocaleLowerCase('az-AZ');
const normalize = (word: string) => lower(word).replace(/sh/gu, 'ş').replace(/ch/gu, 'ç').replace(/gh/gu, 'ğ');
const last = (stem: string) => stem.match(/[aəeıioöuü]/gu)?.at(-1) ?? 'a';
const low = (stem: string) => /[əeiöü]/u.test(last(stem)) ? 'ə' : 'a';
const high = (stem: string) => ({ a: 'ı', ı: 'ı', o: 'u', u: 'u', ö: 'ü', ü: 'ü', e: 'i', ə: 'i', i: 'i' })[last(stem)]!;
const vocalicVerbStem = (stem:string) => stem.endsWith('t') && (stem==='et'||stem==='get'||(stem.match(/[aəeıioöuü]/gu)?.length??0)>=2) ? stem.slice(0,-1)+'d' : stem;
const vowelEnd = (stem: string) => /[aəeıioöuü]$/u.test(stem);
const infinitiveSurface = (stem:string) => stem+'m'+low(stem)+(low(stem)==='ə'?'k':'q');
// Lexical inflection class: su uses a y buffer in the singular possessive
// paradigm and genitive/accusative cases (suyum, suyun, suyu), not *sum/susu.
// Classify the lemma, rather than listing individual input/output spellings.
const yBufferNouns = new Set(['su']);
export const usesLexicalYBuffer = (lemma: string): boolean => yBufferNouns.has(lemma);
const soften = (stem: string, suffix: string) => /^[aəeıioöuü]/u.test(suffix) && (stem.match(/[aəeıioöuü]/gu)?.length ?? 0) >= 2
  ? stem.replace(/k$/u, 'y').replace(/q$/u, 'ğ') : stem;
const compatible = (raw: string, target: string) => [...raw].every((letter, at) => !/[əçğıöşü]/u.test(letter) || target[at] === letter);

export class SourceInflectionEngine {
  private readonly analyses = new Map<string, readonly MorphologicalAnalysis[]>();
  private readonly paradigms = new Map<string, ReadonlyMap<string, MorphologicalAnalysis[]>>();
  private readonly additional = new Map<string, Stem[]>();
  constructor(private readonly attested: (surface: string) => boolean, reviewedStems: readonly Stem[] = []) {
    for (const stem of reviewedStems) {
      const key = foldLetters(stem.lemma), rows = this.additional.get(key) ?? [];
      rows.push(stem); this.additional.set(key, rows);
    }
  }
  private paradigm(stem: Stem): ReadonlyMap<string, MorphologicalAnalysis[]> {
    const key = stem.pos + ':' + stem.lemma, cached = this.paradigms.get(key);
    if (cached) return cached;
    const result = new Map<string, MorphologicalAnalysis[]>();
    const add = (surface: string, features: MorphologicalFeatures, pos=stem.pos) => {
      const folded = foldLetters(surface), rows = result.get(folded) ?? [];
      rows.push({ surface, lemma: stem.lemma, pos, features, source: 'rule' }); result.set(folded, rows);
    };
    const lemma = stem.lemma;
    add(lemma, {});
    if(stem.pos==='adjective'&&/k[ıi]$/u.test(lemma)){
      for(const [grammaticalCase,ending]of [['genitive','n'+high(lemma)+'n'],['dative','n'+low(lemma)],['accusative','n'+high(lemma)],['locative','nd'+low(lemma)],['ablative','nd'+low(lemma)+'n']]as const)add(lemma+ending,{case:grammaticalCase,derivation:['pronominal-relative']},'noun');
    }
    if (stem.pos === 'noun') for (const plural of [false, true]) {
      const base = lemma + (plural ? 'l' + low(lemma) + 'r' : '');
      if(plural)add(base+'arası',{derivation:['inter-nominal']},'adjective');
      const yBuffer = !plural && yBufferNouns.has(lemma);
      for (const owner of [0, 1, 2, 3] as const) {
        const possession = owner === 0 ? '' : yBuffer ? 'y' + high(base) + (owner === 3 ? '' : owner === 1 ? 'm' : 'n')
          : owner === 3 ? (vowelEnd(base) ? 's' : '') + high(base)
          : (vowelEnd(base) ? '' : high(base)) + (owner === 1 ? 'm' : 'n');
        const owned = soften(base, possession) + possession;
        const alternatives = [owned];
        // Borrowed vowel-final nouns have an attested y-buffer subclass. Never
        // invent that subclass from the suffix alone (şöbə -> şöbəsi remains).
        if (owner === 3 && !plural && vowelEnd(base) && this.attested(base + 'y' + high(base))) alternatives.push(base + 'y' + high(base));
        for (const possessed of alternatives) {
          const endings = { nominative: '', genitive: (yBuffer && !owner ? 'y' : vowelEnd(possessed) ? 'n' : '') + high(possessed) + 'n',
            dative: (owner === 3 ? 'n' : vowelEnd(possessed) ? 'y' : '') + low(possessed),
            accusative: (yBuffer && !owner ? 'y' : owner === 3 || vowelEnd(possessed) ? 'n' : '') + high(possessed),
            locative: (owner === 3 ? 'n' : '') + 'd' + low(possessed),
            ablative: (owner === 3 ? 'n' : '') + 'd' + low(possessed) + 'n' } as const;
          for (const [grammaticalCase, ending] of Object.entries(endings)) add(soften(possessed, ending) + ending, {
            number: plural ? 'plural' : 'singular', case: grammaticalCase as keyof typeof endings,
            ...(owner ? { possessivePerson: owner, possessiveNumber: 'singular' } : {}) });
          const locative = possessed + endings.locative;
          add(locative + 'k' + high(locative), { number: plural ? 'plural' : 'singular',
            case: 'locative', derivation: ['relative'],
            ...(owner ? { possessivePerson: owner, possessiveNumber: 'singular' } : {}) });
          if (!owner) add(base + 'l' + low(base), { number: plural ? 'plural' : 'singular', case: 'nominative', derivation: ['comitative'] });
        }
      }
      // Productive agent/person -lI derivation with plural and dative endings.
      const agent = lemma + 'l' + high(lemma);
      add(agent, { case: 'nominative', number: 'singular', derivation: ['adjectival'] });
      add(agent + 'l' + low(agent) + 'r' + low(agent), { case: 'dative', number: 'plural', derivation: ['agent'] });
    }
    if (stem.pos === 'verb') {
      add(lemma,{mood:'imperative',person:2,number:'singular'});
      add(vocalicVerbStem(lemma)+(vowelEnd(lemma)?'y':'')+high(lemma)+'n',{mood:'imperative',person:2,number:'plural'});
      const personal = (base:string,features:MorphologicalFeatures) => {
        for(const [person,number,ending] of [[1,'singular',(vowelEnd(base)?'y':'')+low(base)+'m'],[2,'singular','s'+low(base)+'n'],[3,'singular',''],
          [1,'plural',(vowelEnd(base)?'y':'')+high(base)+(low(base)==='ə'?'k':'q')],[2,'plural','s'+high(base)+'n'+high(base)+'z'],[3,'plural','l'+low(base)+'r']] as const)
          add(soften(features.tense==='aorist'&&features.polarity==='negative'&&person===1?base.replace(/z$/u,'r'):base,ending)+ending,{...features,person,number});
      };
      const conditional = (base:string,polarity:'positive'|'negative') => {
        const form=base+'s'+low(base);
        for(const ending of ['', 'm','n',low(base)==='ə'?'k':'q','n'+high(form)+'z','l'+low(base)+'r'])add(form+ending,{mood:'conditional',polarity});
      };
      for(const negative of [false,true]){
        const base=lemma+(negative?'m'+low(lemma):''),polarity=negative?'negative':'positive';
        const necessity=base+'m'+low(base)+'l'+high(base);
        personal(necessity,{mood:'necessitative',polarity});
        add(necessity+'d'+high(necessity)+'r',{mood:'necessitative',person:3,number:'singular',polarity});
        add(necessity+'d'+high(necessity)+'rl'+low(necessity)+'r',{mood:'necessitative',person:3,number:'plural',polarity});
        const aorist=negative?base+'z':vocalicVerbStem(base)+(vowelEnd(base)?'y':'')+low(base)+'r';
        personal(aorist,{tense:'aorist',polarity});conditional(aorist,polarity);
        const reported=base+'m'+high(base)+'ş';
        personal(reported,{tense:'reported-perfect',polarity});add(reported,{tense:'reported-perfect',polarity,derivation:['participle']});
        // Negative necessitative is stem-mA-mAlI; both negative morphology and
        // personal endings are generated from the same source-classified stem.
        for(const tense of ['past','future'] as const){
          const form=tense==='past'?base+'d'+high(base):base+(vowelEnd(base)?'y':'')+low(base)+'c'+low(base)+(low(base)==='ə'?'k':'q');
          if(tense==='past'){
            for(const ending of ['', 'm', 'n', low(base)==='ə'?'k':'q','n'+high(base)+'z','l'+low(base)+'r'])add(form+ending,{tense,polarity});
          }else{
            personal(form,{tense,polarity});
            add(form,{tense,polarity,derivation:['participle']});
          }
        }
        conditional(base,polarity);
        const present=negative?lemma+'m'+high(lemma)+'r':vocalicVerbStem(lemma)+(vowelEnd(lemma)?'y':'')+high(lemma)+'r';
        conditional(present,polarity);
        const temporal=base+(vowelEnd(base)?'y':'')+low(base)+'rk'+low(base)+'n';
        add(temporal,{mood:'converb',polarity,derivation:['temporal']});
        const optative=base+(vowelEnd(base)?'y':'')+low(base);
        add(optative,{mood:'optative',polarity});
        add(optative+(low(base)==='ə'?'k':'q'),{mood:'optative',person:1,number:'plural',polarity});
        add(base+'d'+high(base)+(low(base)==='ə'?'k':'q')+'d'+low(base),{mood:'converb',polarity,derivation:['temporal']});
        // A converb/infinitive can precede a modal or postposition.
        add(infinitiveSurface(base)+'l'+low(base),{mood:'infinitive',polarity,derivation:['comitative']});
      }
      for (const [person, number, ending] of [[1, 'singular', 'm'], [2, 'singular', 'n'], [3, 'singular', ''],
        [1, 'plural', low(lemma) === 'ə' ? 'k' : 'q'], [2, 'plural', 'n' + high(lemma) + 'z'], [3, 'plural', 'l' + low(lemma) + 'r']] as const) {
        add(lemma + 'd' + high(lemma) + ending, { tense: 'past', person, number });
        add(lemma + 'm' + high(lemma) + 'şd' + high(lemma) + ending, { tense: 'pluperfect', person, number });
      }
      const infinitive = lemma + 'm' + low(lemma) + (low(lemma)==='ə'?'k':'q');
      add(infinitive,{mood:'infinitive'});
      for(const negative of [false,true]){
        const base=negative?lemma+'m'+low(lemma):vocalicVerbStem(lemma);
        const participle=base+(vowelEnd(base)?'y':'')+low(base)+'n';
        add(participle,{tense:'present',polarity:negative?'negative':'positive',derivation:['participle']});
        add(participle+'d'+low(participle),{tense:'present',case:'locative',polarity:negative?'negative':'positive',derivation:['participle','temporal']});
      }
      const negativeAorist=lemma+'m'+low(lemma)+'z';
      add(negativeAorist+'d'+low(negativeAorist)+'n',{tense:'aorist',polarity:'negative',case:'ablative',derivation:['temporal']});
      for (const negative of [false, true]) {
        const base = lemma + (negative ? 'm' + low(lemma) : '');
        const polarity = negative ? 'negative' : 'positive';
        const participle = base + 'd' + high(base) + (low(base) === 'ə' ? 'y' : 'ğ') + high(base);
        add(participle, { tense: 'past', possessivePerson: 3, polarity, derivation: ['participle'] });
        add(participle + 'n' + high(base), { tense: 'past', case: 'accusative', possessivePerson: 3, polarity, derivation: ['participle'] });
        add(participle + 'n' + high(base) + 'n', { tense: 'past', case: 'genitive', possessivePerson: 3, polarity, derivation: ['participle'] });
        // Present and reported perfect forms use the same classified verb
        // stem; irregular et/get soften only in the positive present.
        const positiveStem = vocalicVerbStem(lemma);
        const present = negative ? lemma + 'm' + high(lemma) + 'r'
          : positiveStem + (vowelEnd(positiveStem) ? 'y' : '') + high(positiveStem) + 'r';
        for (const [person, number, ending] of [[1, 'singular', low(present) + 'm'],
          [2, 'singular', 's' + low(present) + 'n'], [3, 'singular', ''],
          [1, 'plural', high(present) + 'k'], [2, 'plural', 's' + high(present) + 'n' + high(present) + 'z'],
          [3, 'plural', 'l' + low(present) + 'r']] as const) {
          add(present + ending, { tense: 'present', person, number, polarity });
        }
        const perfectBase=negative?base:vocalicVerbStem(base);
        const perfect = perfectBase + (vowelEnd(perfectBase) ? 'y' : '') + high(perfectBase) + 'b';
        add(perfect, { tense: 'perfect', person: 3, number: 'singular', polarity });
      }
    }
    if (this.paradigms.size >= 512) this.paradigms.delete(this.paradigms.keys().next().value!);
    this.paradigms.set(key, result); return result;
  }
  candidates(raw: string): readonly MorphologicalAnalysis[] {
    const literal=lower(raw),digraph=normalize(raw);
    const rows=this.collectCandidates(literal);
    // c+h and s+h can be genuine two-consonant sequences (təchizat).
    // Digraph input is an alternative analysis, never a destructive rewrite.
    return literal===digraph?rows:[...rows,...this.collectCandidates(digraph)];
  }
  private collectCandidates(normalized: string): readonly MorphologicalAnalysis[] {
    if (!/^[a-zəçğıöşü]{2,40}$/u.test(normalized)) return [];
    const cached = this.analyses.get(normalized); if (cached) return cached;
    const query = foldLetters(normalized), rows: MorphologicalAnalysis[] = [];
    const mightMatch=(lemma:string)=>{
      const key=foldLetters(lemma);
      return query.startsWith(key)||/[kq]$/u.test(key)&&query.startsWith(key.slice(0,-1)+(key.endsWith('k')?'y':'g'));
    };
    const collectVerb=(lemma:string,derivation:readonly string[])=>{
      if(!mightMatch(lemma)&&!query.startsWith(foldLetters(vocalicVerbStem(lemma))))return;
      const collect=(entry:Stem,extra:readonly string[])=>{
        if(entry.pos==='noun'&&!mightMatch(entry.lemma))return;
        for(const row of this.paradigm(entry).get(query)??[])if(compatible(normalized,row.surface))rows.push({...row,features:{...row.features,derivation:[...(row.features.derivation??[]),...derivation,...extra]}});
      };
      collect({lemma,pos:'verb'},[]);
      for(const nominal of [lemma+'m'+low(lemma),lemma+'m'+low(lemma)+'m'+low(lemma),vocalicVerbStem(lemma)+(vowelEnd(lemma)?'y':'')+high(lemma)+'c'+high(lemma),...(!vowelEnd(lemma)?[lemma+high(lemma)+'m']:[])])collect({lemma:nominal,pos:'noun'},['verbal-nominal:'+lemma]);
    };
    const passive=(lemma:string)=>vowelEnd(lemma)?lemma+'n':vocalicVerbStem(lemma)+high(lemma)+(lemma.endsWith('l')?'n':'l');
    for (let cut = 2; cut <= query.length; cut++) {
      const prefix = query.slice(0, cut);
      const stemKeys = new Set([prefix]);
      if(prefix.endsWith('d'))stemKeys.add(prefix.slice(0,-1)+'t');
      if (/[yg]$/u.test(prefix)) stemKeys.add(prefix.slice(0, -1) + (prefix.endsWith('y') ? 'k' : 'q'));
      for (const stemKey of stemKeys) for (const stem of [...(index.get(stemKey) ?? []), ...(this.additional.get(stemKey) ?? [])]) {
        rows.push(...(this.paradigm(stem).get(query) ?? []).filter(row => compatible(normalized, row.surface)));
        // Productive nominal -lIq: classified nouns/adjectives license the
        // stem, and ordinary nominal case/possession handles q/ğ alternation.
        if(stem.pos==='noun'||stem.pos==='adjective'){
          const derived=stem.lemma+'l'+high(stem.lemma)+(low(stem.lemma)==='ə'?'k':'q');
          if(mightMatch(derived))for(const row of this.paradigm({lemma:derived,pos:'noun'}).get(query)??[])if(compatible(normalized,row.surface))rows.push({...row,features:{...row.features,derivation:['nominalization:'+stem.lemma]}});
        }
        // Denominative -lAn-dIr is productive, but only a classified noun can
        // license it. Existing observed causative stems retain their own lemma.
        if (stem.pos === 'noun') {
          const derived = stem.lemma + 'l' + low(stem.lemma) + 'nd' + high(stem.lemma) + 'r';
          collectVerb(derived,['denominative:'+stem.lemma,'causative']);
          collectVerb(passive(derived),['denominative:'+stem.lemma,'causative','passive:'+derived]);
        }
        if(stem.pos==='verb'){
          collectVerb(stem.lemma,[]);
          collectVerb(passive(stem.lemma),['passive:'+stem.lemma]);
        }
      }
    }
    const unique = [...new Map(rows.map(row => [row.surface + ':' + row.lemma + ':' + row.pos + ':' + JSON.stringify(row.features), row])).values()];
    if (this.analyses.size >= 4096) this.analyses.clear(); this.analyses.set(normalized, unique); return unique;
  }
  analyze(word: string): readonly MorphologicalAnalysis[] { return this.candidates(word).filter(row => row.surface === lower(word)); }
  restore(word: string): string | undefined {
    const candidates = new Set(this.candidates(word).map(row => row.surface));
    return candidates.size === 1 ? [...candidates][0] : undefined;
  }
  /** A single a/e vowel confusion is tried only after all unchanged-skeleton
   * analyses abstain, and only one verified inflection may survive. */
  restoreVowelConfusion(word: string): string | undefined {
    const raw = normalize(word);
    if (raw.length < 5 || this.candidates(raw).length) return undefined;
    const values = new Set<string>();
    for (let at = 0; at < raw.length - 1; at++) {
      if (raw[at] !== 'a' && raw[at] !== 'e') continue;
      const variant = raw.slice(0, at) + (raw[at] === 'a' ? 'e' : 'a') + raw.slice(at + 1);
      for (const row of this.candidates(variant)) if (compatible(raw, row.surface) && row.surface !== row.lemma) values.add(row.surface);
    }
    return values.size === 1 ? [...values][0] : undefined;
  }
}
