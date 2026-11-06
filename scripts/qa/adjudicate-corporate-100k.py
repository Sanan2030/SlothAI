"""Apply the assistant's reviewed linguistic findings without rewriting frozen inputs/gold."""
import collections,difflib,gzip,hashlib,json,re,unicodedata
from pathlib import Path
ROOT=Path('artifacts/qa/corporate-100k-20261106');CORPUS=Path('data/qa/corporate-100k-2026-11-06')
read=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
lower=lambda s:unicodedata.normalize('NFC',s).replace('I','ı').replace('İ','i').lower()
comparable=lambda s:' '.join(unicodedata.normalize('NFC',s).split())
tokens=lambda s:list(re.finditer(r'\w+(?:[-’\x27]\w+)*',s))
manifest=read(CORPUS/'MANIFEST.json');raw=gzip.decompress((CORPUS/'cases.jsonl.gz').read_bytes());assert sha(raw)==manifest['corpusSHA256']
cases=[json.loads(line) for line in raw.splitlines()];results={r['id']:r for r in map(json.loads,(ROOT/'node/results.jsonl').read_text().splitlines())}
lexical=read(ROOT/'lexical-patterns.json');punctuation=read(ROOT/'punctuation-patterns.json');assert len(lexical)==412 and len(punctuation)==150
policy={'reviewer':'Assistant, explicitly authorized by the user to judge correctness','reviewMethod':'Reviewed all412unique lexical replacement patterns and all150unique punctuation/case patterns with contexts. Applied findings to all1000complete outputs; unchanged reference spans retain their authored meaning. Not independent human review.','frozenInputOrGoldRewritten':False,'modelOrThresholdChanges':False,'referenceErratum':{'before':'istisna varsa onun','after':'istisna varsa, onun','reason':'Şərt budaq cümləsinin sonu vergüllə ayrılmalıdır. Tətbiqin bu vergülü əlavə etməsi düzgündür; ilkin istinadda vergül buraxılıb. Orijinal istinad dəyişdirilmir, düzəliş qiymətləndirmə qeydində saxlanılır.'},'lexicalReview':'All412observed lexical substitutions are unresolved letter/diacritic errors or inappropriate contextual word changes; none was accepted as a valid synonym.','punctuationReview':'Accepted conditional-comma repair only when the entire remaining output matches. Rejected false sentence splits inside noun/participle phrases, missing sentence boundaries, missing required punctuation and unjustified mid-sentence capitals.','lexicalPatternSHA256':sha((ROOT/'lexical-patterns.json').read_bytes()),'punctuationPatternSHA256':sha((ROOT/'punctuation-patterns.json').read_bytes())}
(ROOT/'ADJUDICATION_POLICY.json').write_text(json.dumps(policy,ensure_ascii=False,indent=2)+'\n')
meaning_pairs={('verməli','vərəmli'),('borcu','boruçu'),('açıq','acıq'),('açıqlanıldı','acıqlanıldı'),('sürəti','surəti'),('şərtlər','sərtlər'),('şərtləri','sərtləri'),('adı','adi'),('təşkilati','təşkilatı'),('əl','el'),('neçə','necə'),('üçün','uçun'),('dəyər','deyər'),('də','de')}
ledgers=[];primary=collections.Counter();tags=collections.Counter();domains={};variants={};formats={};literal_cases=0;literal_ok=0;correct=0;strict=0;alternatives=0;unstable=[];identity={ 'authoredIdentityCases':0,'assistantCorrectOutput':0,'referenceConditionalOmissionCases':0,'unambiguouslyCorrectInputs':0,'correctInputsDamaged':0}
for row in cases:
 result=results[row['id']];actual=result['actual'];expected=row['expected'];reviewed=expected.replace('istisna varsa onun','istisna varsa, onun')
 exact=comparable(actual)==comparable(expected);accepted=not result.get('error') and comparable(actual)==comparable(reviewed)
 assert not exact or accepted  # No exact-match output contains the identified gold omission.
 strict+=exact;correct+=accepted;alternatives+=accepted and not exact
 a,b=tokens(reviewed),tokens(actual);al,bl=[lower(w[0]) for w in a],[lower(w[0]) for w in b]
 edits=[];case_tags=set();has_lexical=al!=bl
 if has_lexical:
  case_tags.add('yazılış-və-ya-səhv-söz')
  for op,i,j,k,l in difflib.SequenceMatcher(None,al,bl,autojunk=False).get_opcodes():
   if op!='equal':
    left,right=al[i:j],bl[k:l];edit={'expected':' '.join(left),'actual':' '.join(right),'expectedContext':' '.join(w[0] for w in a[max(0,i-3):min(len(a),j+3)])};edits.append(edit)
    if len(left)==len(right) and any(pair in meaning_pairs for pair in zip(left,right)):case_tags.add('kontekstə-uyğun-olmayan-söz-seçimi')
 else:
  for i in range(len(a)):
   ga=reviewed[a[i].end():a[i+1].start() if i+1<len(a) else len(reviewed)];gb=actual[b[i].end():b[i+1].start() if i+1<len(b) else len(actual)]
   if re.sub(r'\s+','',ga)!=re.sub(r'\s+','',gb):case_tags.add('durğu-və-cümlə-sərhədi')
   if a[i][0]!=b[i][0]:case_tags.add('registr')
 literal_cases+=bool(row['protectedLiterals']);literal_ok+=bool(row['protectedLiterals']) and all(v in actual for v in row['protectedLiterals'])
 if not all(v in actual for v in row['protectedLiterals']):case_tags.add('qorunan-məzmun')
 if result.get('error'):category='texniki-xəta'
 elif accepted:category='düzgün'
 elif 'qorunan-məzmun' in case_tags:category='qorunan-məzmun'
 elif 'kontekstə-uyğun-olmayan-söz-seçimi' in case_tags:category='səhv-söz-seçimi'
 elif has_lexical:category='yazılış-və-şəkilçi'
 elif 'durğu-və-cümlə-sərhədi' in case_tags:category='durğu-və-cümlə-sərhədi'
 elif 'registr' in case_tags:category='registr'
 else:category='sənəd-quruluşu'
 primary[category]+=1
 if not accepted:tags.update(case_tags)
 if not result['repeatStable']:unstable.append(row['id'])
 if row['variant']=='identity':
  identity['authoredIdentityCases']+=1;identity['assistantCorrectOutput']+=accepted;identity['referenceConditionalOmissionCases']+=reviewed!=expected
  if reviewed==expected:identity['unambiguouslyCorrectInputs']+=1;identity['correctInputsDamaged']+=not accepted
 reason='İstinaddakı düzgün yazılış, məna və quruluş saxlanılır.' if exact else policy['referenceErratum']['reason'] if accepted else 'Ən azı bir yazılış, söz seçimi, durğu və ya registr xətası qalıb; bütün mətn tam düzgün hesab edilmir.'
 ledger={**row,'actual':actual,'repeated':result['repeated'],'assistantVerdict':'correct' if accepted else 'incorrect','strictReferenceMatch':exact,'acceptedReferenceErratum':accepted and not exact,'referenceContainsConditionalOmission':reviewed!=expected,'primaryCategory':category,'errorTags':sorted(case_tags) if not accepted else [],'lexicalDifferences':edits,'reason':reason,'repeatStable':result['repeatStable'],'literalPreserved':result['literalPreserved'],'metadata':result['metadata']};ledgers.append(ledger)
 for destination,key in [(domains,row['domain']),(variants,row['variant']),(formats,row['format'])]:
  total=destination.setdefault(key,{'requests':0,'correct':0,'incorrect':0,'strictExact':0});total['requests']+=1;total['correct']+=accepted;total['incorrect']+=not accepted;total['strictExact']+=exact
content=('\n'.join(json.dumps(r,ensure_ascii=False) for r in ledgers)+'\n').encode();(ROOT/'adjudicated-results.jsonl.gz').write_bytes(gzip.compress(content,mtime=0));errors=('\n'.join(json.dumps(r,ensure_ascii=False) for r in ledgers if r['assistantVerdict']=='incorrect')+'\n').encode();(ROOT/'errors.jsonl.gz').write_bytes(gzip.compress(errors,mtime=0))
browser=read(ROOT/'browser-accepted/summary.json');node=read(ROOT/'node/summary.json');assert browser['nodeParityDifferences']==0 and browser['cases']==len(ledgers)==1000
summary={'scope':'Assistant-judged, newly authored compositional corporate100k-word audit. User delegated linguistic judgment. Not independent human/real-user accuracy. All cases retained; inputs/references/model/policies unchanged. One reference punctuation omission is disclosed and adjudicated separately.','sourceCommit':manifest['sourceCommit'],'inputWords':100000,'expectedWords':manifest['expectedWords'],'primaryRequests':1000,'correct':correct,'incorrect':1000-correct,'technicalErrors':node['totals']['exceptions'],'correctPercent':correct/10,'strictReferenceMatches':strict,'acceptedCorrectConditionalCommaRepairs':alternatives,'referenceConditionalOmissionCases':sum(r['referenceContainsConditionalOmission'] for r in ledgers),'primaryErrorCategories':dict(primary),'nonexclusiveErrorTags':dict(tags),'domains':domains,'variants':variants,'formats':formats,'identityControl':identity,'repeatStable':node['totals']['repeatStable'],'unstableCaseIds':unstable,'protectedLiteralCases':literal_cases,'protectedLiteralCasesPreserved':literal_ok,'allThreeModelsAutomaticPrimaryRequests':browser['allThreeAutomatic'],'modelCounters':{k:node['totals'][k] for k in ['charRankedTokens','charCandidates','punctCaseProposed','punctCaseApplied']},'browserNodeParityDifferences':0,'physicalTransformationCalls':browser['physicalTotalTransformationCalls'],'additionalVerificationCalls':browser['additionalVerificationCallsBeyond1000PrimaryCases'],'requestAccounting':browser,'novelty':manifest['novelty'],'previousQANormalizedReferences':manifest['previousQA']['normalizedReferences'],'composition':manifest['composition'],'corpusSHA256':manifest['corpusSHA256'],'adjudicationPolicySHA256':sha((ROOT/'ADJUDICATION_POLICY.json').read_bytes()),'adjudicatedResultsSHA256':sha(content),'errorsSHA256':sha(errors),'trainingPerformed':False,'appOrWeightsChanged':False}
(ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
