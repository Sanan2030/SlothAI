import { tokenize } from './local-ai/core';
import { productiveMorphology } from './productive-morphology';
import { SourceInflectionEngine } from './source-inflection';
import { dictionaryCandidates } from './dictionary';

const sourceNouns = new SourceInflectionEngine(surface => dictionaryCandidates(surface)?.has(surface) === true);
const finiteWord=(word:string)=>[...productiveMorphology.analyzeWord(word),...sourceNouns.analyze(word)].some(row=>row.pos==='verb'&&Boolean(row.features.tense||row.features.mood==='necessitative'&&/d[ıiuü]r(?:lar|lər)?$/u.test(word))&&!row.features.derivation?.some(value=>value==='participle'||value==='temporal')&&!row.features.case&&row.features.mood!=='conditional');

/** A retained capital after a complete predicate is evidence supplied by the
 * author. Require an ordinary lexical word and another finite clause; names,
 * participial modifiers and existing punctuation do not establish this cue. */
export function segmentAuthoredSentenceStarts(source:string,text=source):string{
  const tokens=tokenize(text),authored=tokenize(source),insert=new Set<number>();
  if(tokens.length!==authored.length||tokens.some((token,at)=>token.word.toLocaleLowerCase('az-AZ')!==authored[at].word.toLocaleLowerCase('az-AZ')))return text;
  for(let at=2;at<tokens.length-1;at++){
    const previous=tokens[at-1],next=tokens[at];
    if(!/^ +$/u.test(text.slice(previous.end,next.start))||!/^\p{Lu}\p{Ll}/u.test(authored[at].word)||!finiteWord(previous.word))continue;
    if(/^(?:birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı)$/iu.test(next.word))continue;
    const ordinary=sourceNouns.analyze(next.word).some(row=>row.pos==='noun'||row.pos==='adjective');
    if(!ordinary)continue;
    const rest=tokens.slice(at+1,at+25).filter(row=>row.sentence===next.sentence);
    if(rest.some(row=>finiteWord(row.word)))insert.add(previous.end);
  }
  return text.split('').map((letter,at)=>(insert.has(at)?'.':'')+letter).join('');
}

/** Shared veto for proposals from all legacy and learned boundary stages.
 * This is a conservative POS/morphology constraint, not a dependency parser or
 * semantic model. Existing author punctuation is never removed. */
export function guardInsertedBoundaries(source: string, proposed: string): string {
  const before = tokenize(source), after = tokenize(proposed);
  if (before.length !== after.length || before.some((token, at) => token.word.toLocaleLowerCase('az-AZ') !== after[at].word.toLocaleLowerCase('az-AZ'))) return proposed;
  const remove = new Set<number>(),restoreCase=new Map<number,string>();
  for (let at = 0; at < after.length - 1; at++) {
    const gap = proposed.slice(after[at].end, after[at + 1].start);
    if (!/[.!?]/u.test(gap) || /[.!?\n]/u.test(source.slice(before[at].end, before[at + 1].start))) continue;
    const word = after[at].word;
    const left = productiveMorphology.analyzeWord(word);
    const right = productiveMorphology.analyzeWord(after[at + 1].word);
    if(/^\p{Lu}\p{Ll}/u.test(before[at+1].word)&&finiteWord(word)&&!/^(?:birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı)$/iu.test(before[at+1].word))continue;
    const finite = left.some(row => row.pos === 'verb' && row.features.tense && !row.features.mood
      || row.features.derivation?.some(value => value.startsWith('copula-')));
    const nonPredicate = !/^(?:var|yox|deyil)$/iu.test(word) && left.length > 0 && left.every(row => row.pos !== 'verb') && !finite;
    const unknownPast = !left.length && /(?:dı|di|du|dü)$/iu.test(word)
      && right.some(row => row.pos === 'noun' && row.features.case === 'genitive');
    const following = after[at + 2] ? sourceNouns.analyze(after[at + 2].word) : [];
    const rightExtended = [...right, ...sourceNouns.analyze(after[at + 1].word)];
    const classified=sourceNouns.analyze(word);
    const prior=at>0&&before[at-1].sentence===before[at].sentence?sourceNouns.analyze(before[at-1].word):[];
    const nominalCompound=classified.some(row=>row.pos==='noun'&&row.surface===row.lemma&&row.features.case==='nominative')
      &&rightExtended.some(row=>row.pos==='noun'&&row.features.possessivePerson===3&&row.features.case==='nominative')
      &&prior.some(row=>row.pos==='noun'&&(row.features.case==='genitive'||row.features.case==='locative'));
    const greeting=/xeyir$/iu.test(word)&&/(?:sabahınız|axşamınız|vaxtınız)\s+xeyir$/iu.test(source.slice(0,before[at].end));
    const sourceNominal=/(?:dı|di|du|dü|ır|ir|ur|ür)$/iu.test(word)&&!/^(?:var|yox|deyil)$/iu.test(word)&&!greeting&&!left.some(row=>row.pos==='verb')&&classified.some(row=>row.pos==='noun'||row.pos==='adjective')
      && !classified.some(row=>row.pos==='verb'&&row.features.tense&&!row.features.derivation?.includes('participle'));
    const clauseBefore=before.slice(0,at).filter(token=>token.sentence===before[at].sentence);
    const subjectBefore=!clauseBefore.some(token=>/^(?:ilə|üçün|kimi|üzrə|haqqında|barədə)$/iu.test(token.word)||sourceNouns.analyze(token.word).some(row=>row.pos==='noun'&&row.features.case==='dative'))
      &&clauseBefore.some(token=>sourceNouns.analyze(token.word).some(row=>row.pos==='noun'&&row.surface===row.lemma&&row.features.case==='nominative'));
    const ordinalNext=/^(?:birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı)$/iu.test(after[at+1].word);
    const participialModifier = /(?:mış|miş|muş|müş|acaq|əcək)$/iu.test(word)
      && (rightExtended.some(row => row.pos === 'noun'&&(row.features.case==='genitive'||!ordinalNext&&(/(?:mış|miş|muş|müş)$/iu.test(word)||!subjectBefore)))
        || /(?:mış|miş|muş|müş)$/iu.test(word) && rightExtended.some(row => row.pos === 'adjective') && following.some(row => row.pos === 'noun'));
    const nominalOrdinal = sourceNouns.analyze(word).some(row => row.pos === 'noun' && row.features.possessivePerson === 3)
      && /^(?:birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı)$/iu.test(after[at+1].word)
      && following.some(row => row.pos === 'noun' && row.features.case === 'locative');
    const continuingCoordination=before[at+1].word==='həm'&&before[at+2]?.word==='də';
    if (nonPredicate || sourceNominal || nominalCompound || unknownPast || participialModifier || nominalOrdinal || continuingCoordination) {
      for (let offset = after[at].end; offset < after[at + 1].start; offset++) if (/[.!?]/u.test(proposed[offset])) remove.add(offset);
      if(before[at+1].word[0]!==after[at+1].word[0])restoreCase.set(after[at+1].start,before[at+1].word[0]);
    }
  }
  return proposed.split('').map((letter,at)=>remove.has(at)?'':restoreCase.get(at)??letter).join('');
}
