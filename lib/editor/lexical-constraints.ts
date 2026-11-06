import {hasAttestedSpelling} from './wordlm/lexical-evidence';
import {isEstablishedSurface} from './lexicon';
import {dictionaryCandidates,foldLetters} from './dictionary';
import {SourceInflectionEngine} from './source-inflection';
import type {LanguageServices} from './language-services';
/** Reviewed lexeme/POS constraints. These use word families and local grammatical
 * relations, never sentence IDs, evaluation lookups or fitted probabilities. */
const lexemes=['surət','sürət','açar','ad','şərt','quş','kök','pərdə','nəşr','çəngəl','qayış','şəhər','qış','saat','damcı'].map(lemma=>({lemma,pos:'noun' as const}));
const forms=new SourceInflectionEngine(()=>false,[...lexemes,{lemma:'aşıl',pos:'verb'}]);
const knownLexeme=(word:string)=>dictionaryCandidates(word)?.has(word.toLocaleLowerCase('az-AZ'))||hasAttestedSpelling(word)||isEstablishedSurface(word);
const words=(s:string)=>s.toLocaleLowerCase('az-AZ').match(/\p{L}+/gu)??[];
const family=(word:string,roots:readonly string[])=>roots.some(root=>word.startsWith(root));
export interface LexicalConstraint {word:string;reason:string}
export function constrainedSpelling(raw:string,current:string,leftText:string,rightText:string,services:LanguageServices):LexicalConstraint|undefined{
 const lower=raw.toLocaleLowerCase('az-AZ'),key=foldLetters(lower),currentKey=foldLetters(current);
 const left=words(foldLetters(leftText)).slice(-14),right=words(foldLetters(rightText)).slice(0,14),near=[...left,...right],prior=left.at(-1)??'',next=right[0]??'';
 const any=(roots:readonly string[])=>near.some(w=>family(w,roots));
 const after=(roots:readonly string[])=>right.some(w=>family(w,roots));
 let lemma:string|undefined,target:string|undefined;
 const reason='reviewed lexical/POS relation';
 if(key.startsWith('suret')){
  const speed=(key.endsWith('li')&&right.slice(0,3).some(w=>family(w,['toxunus','hereket','reaksiya','inkisaf','deyis','axin','isleme','cavab']))&&!any(['sekil','portret','fotograf'])) || (family(prior,['verme','verilme'])&&any(['cavab','reaksiya'])) || (key.endsWith('le')&&after(['calin','ifa'])&&any(['ritm','musiqi','temp'])) || family(prior,['yazi','oxu','hereket','yukle','gedis','internet','sebeke','isle','axtaris','oturul']) || after(['artir','azal','yavas','yukselt']);
  const copy=any(['sened','esl','foto','reqemsal','nusxe','qeyd','sekil','cild','qovluq','sertifikat','imza','huquq']);
  if(speed)lemma='sürət';else if(copy)lemma='surət';
 }
 if(key.startsWith('asil')&&any(['tutum','limit','hedd','imkan','miqdar','mebleg','norma']))lemma='aşıl';
 if(key.startsWith('saat')&&any(['qebul','vaxt','gorus','zeng','teqvim','rejim']))lemma='saat';
 if(key==='damci'&&family(next,['suvar','su','yagis']))lemma='damcı';
 if(key.startsWith('acar')&&any(['tehvil','qapi','kilid','sifre','menzil','baglanti','qovluq','nomre','dolab']))lemma='açar';
 if(key==='adi'){
  const genitive=/(?:nin|nun|in|un)$/u.test(prior);
  const naming=family(next,['gizled','yazil','deyis','qeyd','goster','icaze','tanim','deqiqles']);
  if(genitive&&naming)lemma='ad';
 }
 if(key.startsWith('sert')&&!after(['disk','metal','cisim','seth','material','agac','plastik','daş','das','hava','xasiyyet'])){
  if(any(['muqavile','sigorta','zemanet','odenis','tapsiriq','teleb','sifaris','qiymet','qebul','serhed','legv','qaytar','bitme','ferq','imtiyaz','dasinma','dasima','saxlanma','saxlanilma','catdirilma']))lemma='şərt';
 }
 if(key==='qus'&&(family(next,['yuva','qanad','ses','civilt','ucus'])||any(['budaq','ucur','yarali','zedelen','tuk','dimdik'])))lemma='quş';
 if(key.startsWith('kok')&&any(['bitki','ting','agac','torpaq','suvar','ekil','bagban','ciçə','cice','budaq']))lemma='kök';
 if(key.startsWith('perde')&&any(['pencere','olcu','parca','asma','ev','otaq','tul','qaytar','tikil']))lemma='pərdə';
 if(key.startsWith('nesr')&&any(['cild','naxis','cap','tiraj','redaktor','nesriyyat','buraxilis']))lemma='nəşr';
 if(key.startsWith('cengel')&&any(['dest','yemek','qab','bicaq','qasiq','satici','sufre']))lemma='çəngəl';
 if(key.startsWith('qayis')&&any(['canta','kemer','saat','bagla','deri','tokka','idman']))lemma='qayış';
 // A possessed urban-place noun licenses the nominal compound şəhər parkı,
 // unlike the temporal adjunct səhər parkda. Explicit morning uses survive.
 if(key==='seher'&&family(next,['parkinda','kucelerinde','merkezinde','serhedinde','bagcasinda'])&&!after(['axsam','gunorta']))lemma='şəhər';
 if(key==='qis'&&any(['teker','soyuq','qar','buz','qislaq','movsum','don','avadanliq']))lemma='qış';
 if(key==='aciq'&&after(['yazil','bildir','goster','xeta','soruş','sorus','aydın','aydin','elan']))target='açıq';
 if(key.startsWith('aciqlan')&&!/(?:anda|ende|arken|erken)$/u.test(prior)&&any(['sert','meqsed','qayda','qiymet','vaxt','menbe','meyar','tesir','tapş','taps','gosteris','secim']))target='açıqlan'+current.toLocaleLowerCase('az-AZ').slice(7);
 if(key==='aciq'&&any(['melumat','izah','hisse','ferq','qeyd','teqdimat'])&&after(['saxla','qeyd','teqdim']))target='açıq';
 if(key==='elde'&&family(next,['ol','et','ed']))target='əldə';
 if(key==='deyer'&&any(['qebul','hesab','gosterici','mebleg','qiymet','olcu'])&&after(['qaytar','veril','yoxla','goster','olc']))target='dəyər';
 if(key.startsWith('deyis')&&family(prior,['saat','istiqamet','unvan','adinin','qiymet','olcu']))target='dəyiş'+current.toLocaleLowerCase('az-AZ').slice(5);
 if(key==='nece'&&family(next,['gun','il','ay','hefte','defe','nefer','eded','deqiqe','saat']))target='neçə';
 if(key==='ucun'&&prior&&!after(['azad','uzaq','yuxari'])&&right.some(w=>/(?:ilir|ilir|ulur|unur|inir|ir|ar|er)$/u.test(w))){
  const previous=words(leftText).at(-1);
  if(previous&&(services.morphology.analyzeWord(previous).some(r=>r.pos==='noun'||r.features.case!==undefined)||knownLexeme(previous)))target='üçün';
 }
 if(key==='de'){
  const previous=words(leftText).at(-1);
  if(previous&&services.morphology.analyzeWord(previous).some(r=>r.pos==='noun'||r.features.case!==undefined)&&after(['qebul','qeyd','goster','qorun','yazil','veril','muqayise','nezere']))target='də';
 }
 if(key==='oturulur'&&any(['hadise','siqnal','melumat','paket'])&&!any(['stul','skamya','divan']))target='ötürülür';
 if(lemma){const values=[...new Set(forms.candidates(raw).filter(r=>r.lemma===lemma).map(r=>r.surface))];if(values.length===1)target=values[0];}
 if(!target)return undefined;
 // Structural edits to unrelated stems cannot be inferred from weak cues.
 if(foldLetters(target)!==key && key!==currentKey && key!=='oturulur')return undefined;
 return {word:target,reason};
}
