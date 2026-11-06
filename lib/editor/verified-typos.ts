import {dictionaryCandidates} from './dictionary';
import {analyzeSourceInflection,sourceSpellingCandidates} from './lexicon';
import {hasAttestedSpelling,attestedSpellingCandidates} from './wordlm/lexical-evidence';
import {isCanonicalEntity} from './entities/resolver';
import {canonicalProtectedTerm} from './protected-terminology';
const lower=(s:string)=>s.toLocaleLowerCase('az-AZ');
const exact=(s:string)=>dictionaryCandidates(s)?.has(s)||hasAttestedSpelling(s)||analyzeSourceInflection(s).length>0;
/** Whole-word lexical/source proof, not the permissive legacy suffix guess. */
export function repeatedKeyCandidates(word:string,vowelsOnly=false):readonly string[]{
 const raw=lower(word);
 if(raw.length<6||raw.length>40||!/^\p{L}+$/u.test(raw)||isCanonicalEntity(word)||canonicalProtectedTerm(word)||exact(raw)||attestedSpellingCandidates(raw).length>0||sourceSpellingCandidates(word).length>0||Boolean(dictionaryCandidates(raw)?.size))return [];
 const found=new Set<string>();
 for(let i=1;i<raw.length;i++)if(raw[i]===raw[i-1]&&(!vowelsOnly||/[aəeıioöuü]/u.test(raw[i]))){
  const candidate=raw.slice(0,i)+raw.slice(i+1);if(exact(candidate)&&!isCanonicalEntity(candidate))found.add(candidate);
 }
 return [...found];
}
export function repairRepeatedVowel(word:string):string{
 const values=repeatedKeyCandidates(word,true);if(values.length!==1)return word;
 const value=values[0];return /^\p{Lu}/u.test(word)?value[0].toLocaleUpperCase('az-AZ')+value.slice(1):value;
}
