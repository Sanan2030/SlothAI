"""Freeze 100,000 input words of fresh authored corporate scenarios before inference."""
import argparse,collections,gzip,hashlib,itertools,json,random,re,subprocess,tarfile,unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
POOL=Path(__file__).with_name('corporate-100k-pools.txt')
FOLD=str.maketrans('əçıöüşğƏÇIÖÜŞĞİ','eciousgECIOUSGI')
FIELDS={'input','expected','target','text','noisy','clean','sourceText','inputText','output','corrected','before','after'}
SEED=202611061117
def sha(b):return hashlib.sha256(b).hexdigest()
def normalized(s):return ' '.join(re.findall(r'[a-z]+|<n>',re.sub(r'\d+','<n>',unicodedata.normalize('NFC',s).translate(FOLD).lower())))
def grams(s,n):
 w=s.split();return frozenset(' '.join(w[i:i+n]) for i in range(len(w)-n+1))
def count(s):return sum(any(c.isalnum() for c in token) for token in s.split())
def strings(x):
 if isinstance(x,dict):
  for k,v in x.items():
   if k in FIELDS and isinstance(v,str):yield v
   elif isinstance(v,(dict,list)) and k not in {'weights','tensors','parameters','vectors','counts','runtimeSHA256'}:yield from strings(v)
 elif isinstance(x,list) and (not x or not isinstance(x[0],(int,float))):
  for v in x:
   if isinstance(v,(dict,list)):yield from strings(v)

def legacy():
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();refs=set();files=[]
 proc=subprocess.Popen(['git','archive',commit,'tests','data/qa','data/evaluation','data/nlp','data/neural','data/local-ai'],cwd=ROOT,stdout=subprocess.PIPE)
 with tarfile.open(fileobj=proc.stdout,mode='r|') as archive:
  for item in archive:
   if not item.isfile() or not item.name.endswith(('.json','.jsonl','.jsonl.gz','.ts')):continue
   data=archive.extractfile(item).read();files.append({'path':item.name,'sha256':sha(data)})
   if item.name.endswith('.gz'):data=gzip.decompress(data)
   text=data.decode();values=[]
   if item.name.endswith(('.jsonl','.jsonl.gz')):values=itertools.chain.from_iterable(strings(json.loads(line)) for line in text.splitlines() if line.strip())
   elif item.name.endswith('.json'):values=strings(json.loads(text))
   else:values=(m[1].replace('\\n','\n') for m in re.findall(r"(['\"`])((?:\\.|(?!\1).)*?)\1",text,re.S))
   for value in values:
    norm=normalized(value)
    if len(norm.split())>=5:refs.add(norm)
 if proc.wait():raise RuntimeError('Cannot read legacy inputs')
 ordered=sorted(refs);tri=[grams(s,3) for s in ordered];eight=set().union(*(grams(s,8) for s in ordered));index=collections.defaultdict(set)
 for i,g in enumerate(tri):
  for key in g:index[key].add(i)
 return commit,ordered,refs,tri,eight,{k:v for k,v in index.items() if len(v)<=512},files

def novelty(text,refs,tri,eight,index):
 norm=normalized(text)
 if norm in refs:return False,1.,'exact'
 if grams(norm,8)&eight:return False,1.,'shared-eight-word-sequence'
 own=grams(norm,3);ids=set().union(*(index.get(k,()) for k in own));score=max((len(own&tri[i])/len(own|tri[i]) for i in ids),default=0.)
 return score<.35,score,'near' if score>=.35 else 'novel'

def sections():
 result={};key=''
 for line in POOL.read_text().splitlines():
  if line.startswith('['):key=line[1:-1];result[key]=[]
  elif line and not line.startswith('#'):result[key].append(line)
 return result

def protected_ranges(s,literals):
 ranges=[]
 for literal in literals:
  for m in re.finditer(re.escape(literal),s):ranges.append((m.start(),m.end()))
 return ranges
def corrupt(body,kind,literals,rng):
 def transform(s,fn):
  ranges=protected_ranges(s,literals)
  def apply(m):
   if any(m.start()<b and m.end()>a for a,b in ranges) or len(m[0])>1 and m[0].isupper():return m[0]
   return fn(m[0])
  return re.sub(r'[A-Za-zƏəÇçĞğİıÖöŞşÜü]+',apply,s)
 if kind=='identity':return body,[]
 if kind in {'ascii','mixed-ascii-typo'}:body=transform(body,lambda w:w.translate(FOLD))
 if kind=='partial-diacritics':return transform(body,lambda w:''.join(c.translate(FOLD) if rng.random()<.48 else c for c in w)),[]
 if kind=='lower-case':
  ranges=protected_ranges(body,literals)
  return re.sub(r'(^|[.!?]\s+|\n\n)([A-ZƏÇĞİÖŞÜ][a-zəçğıöşü])',lambda m:m[1]+m[2][0].replace('İ','i').lower()+m[2][1],body),[]
 if kind=='punctuation':
  ranges=protected_ranges(body,literals)
  return ''.join(c for i,c in enumerate(body) if c not in ',.;!?' or any(a<=i<b for a,b in ranges)),[]
 if kind in {'missing-letter','transposition','mixed-ascii-typo'}:
  ranges=protected_ranges(body,literals);eligible=[m for m in re.finditer(r'[a-zəçğıöşü]{6,}',body) if not any(m.start()<b and m.end()>a for a,b in ranges)]
  if not eligible:raise ValueError('No eligible typo word')
  match=rng.choice(eligible);word=match[0];at=rng.randrange(1,len(word)-2)
  if kind=='missing-letter':changed=word[:at]+word[at+1:]
  elif kind=='mixed-ascii-typo':changed=word[:at]+word[at]+word[at:]
  else:
   choices=[i for i in range(1,len(word)-1) if word[i]!=word[i+1]];at=rng.choice(choices);changed=word[:at]+word[at+1]+word[at]+word[at+2:]
  return body[:match.start()]+changed+body[match.end():],[{'before':word,'after':changed,'wordOffset':match.start(),'kind':kind}]
 return body,[]

def completion(pool,remaining,rng):
 # Full natural sentences only. No chopped text or word-count padding fragments.
 candidates=[('followup',s) for s in pool['followups']]+[('short',s) for s in pool['short']];rng.shuffle(candidates)
 memo={}
 def solve(at,left,longs,shorts):
  if left==0:return []
  if left<0 or at==len(candidates) or longs>3 or shorts>1:return None
  key=(at,left,longs,shorts)
  if key in memo:return None
  kind,s=candidates[at];n=count(s)
  if (kind=='followup' and longs<3) or (kind=='short' and shorts<1):
   tail=solve(at+1,left-n,longs+(kind=='followup'),shorts+(kind=='short'))
   if tail is not None:return [s]+tail
  tail=solve(at+1,left,longs,shorts)
  if tail is None:memo[key]=True
  return tail
 return solve(0,remaining,0,0)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=ROOT/'data/qa/corporate-100k-2026-11-06');args=parser.parse_args()
 if args.out.exists():raise ValueError('Frozen corpus already exists')
 pool=sections();domains=[k[:-7] for k in pool if k.endswith('.events')];assert len(domains)==16
 print('Indexing prior repository QA and previous10000 corpus, rejection only...',flush=True)
 commit,old,refs,tri,eight,index,files=legacy();print('Prior normalized references:',len(old),flush=True)
 bad=[];seed_scores=[]
 for section,values in pool.items():
  for at,text in enumerate(values):
   if count(text)<8:continue
   ok,score,why=novelty(text,refs,tri,eight,index);seed_scores.append(score)
   if not ok:bad.append({'section':section,'index':at,'text':text,'why':why,'score':score})
 if bad:print(json.dumps(bad,ensure_ascii=False,indent=2));raise ValueError('Rewrite overlapping authored seeds before freezing')
 rng=random.Random(SEED);budgets=[]
 for _ in range(500):n=rng.randrange(0,11);budgets.extend([100-n,100+n])
 rng.shuffle(budgets);variants=['identity']*200+['ascii']*200+['partial-diacritics']*150+['lower-case']*100+['punctuation']*100+['missing-letter']*75+['transposition']*75+['mixed-ascii-typo']*100;rng.shuffle(variants)
 rows=[];used_inputs=set();used_targets=set();used_scenarios=set();rejected=collections.Counter();maxscore=0.;literal_count=0
 literal_templates=[('İşin istinad nömrəsi KOR-2026-0412 kimi göstərilib.',['KOR-2026-0412']),('Yoxlama faylı `control_log_v3.xlsx` adı ilə saxlanılıb.',['`control_log_v3.xlsx`']),('Əlaqə üçün review.office@example.com ünvanı göstərilib.',['review.office@example.com']),('Daxili qeyd https://work.example.com/tasks/CTRL-082 ünvanında yerləşir.',['https://work.example.com/tasks/CTRL-082']),('Əlavə PDF formatında, hesablama isə XLSX formatında təqdim edilib.',['PDF','XLSX']),('Qəbul edilmiş sənədin DOCX variantı ayrıca saxlanılıb.',['DOCX'])]
 for i in range(1000):
  domain=domains[i%len(domains)];events=pool[domain+'.events'];actions=pool[domain+'.actions'];module='mail' if i%10 in (0,3,6) else 'text';structured=module=='text' and i%10==8
  for attempt in range(4000):
   ei=sorted(rng.sample(range(len(events)),2));ai=sorted(rng.sample(range(len(actions)),2));scenario=(domain,*ei,*ai)
   if scenario in used_scenarios:continue
   first,second=events[ei[0]],events[ei[1]];action=[actions[x] for x in ai]
   literal,literals=rng.choice(literal_templates) if i%4==0 else ('',[])
   header='## İcra qeydi\n\n' if structured else ''
   action_text='\n'.join('- '+s for s in action) if structured else ' '.join(action)
   core=header+first+'\n\n'+second+'\n\n'+action_text+('\n\n'+literal if literal else '')
   tail=completion(pool,budgets[i]-count(core),rng)
   if tail is None:continue
   body=core+('\n\n'+' '.join(tail) if tail else '')
   kind=variants[i];raw,mutations=corrupt(body,kind,literals,rng)
   if count(raw)!=budgets[i]:raise AssertionError('Word count changed under corruption')
   if kind!='identity' and raw==body:continue
   checks=[novelty(text,refs,tri,eight,index) for text in [body,raw]]
   if not all(c[0] for c in checks):
    rejected.update(c[2] for c in checks if not c[0]);continue
   key=normalized(body)
   if raw in used_inputs or key in used_targets:continue
   expected='Salam,\n\n'+body+'\n\nHörmətlə,' if module=='mail' else body
   rows.append({'id':f'corp100k-{i+1:04}','domain':domain,'module':module,'format':'email' if module=='mail' else 'structured-note' if structured else 'work-note','variant':kind,'input':raw,'expected':expected,'inputWords':count(raw),'expectedWords':count(expected),'options':{'emailGreeting':'Salam,','omitSubject':True} if module=='mail' else {'preserveFormatting':True},'protectedLiterals':literals,'authoredBody':body,'scenario':{'events':ei,'actions':ai},'injectedTypos':mutations,'noveltyMaxTrigramJaccard':max(c[1] for c in checks)})
   used_inputs.add(raw);used_targets.add(key);used_scenarios.add(scenario);maxscore=max(maxscore,*(c[1] for c in checks));literal_count+=bool(literals);break
  else:raise ValueError('Cannot construct fresh full-sentence document '+str(i))
  if (i+1)%100==0:print('Prepared',i+1,'input words',sum(r['inputWords'] for r in rows),flush=True)
 assert len(rows)==1000 and sum(r['inputWords'] for r in rows)==100000
 args.out.mkdir(parents=True);raw=('\n'.join(json.dumps(r,ensure_ascii=False) for r in rows)+'\n').encode();compressed=gzip.compress(raw,mtime=0);(args.out/'cases.jsonl.gz').write_bytes(compressed)
 manifest={'schemaVersion':1,'source':'Fresh assistant-authored corporate compositional work notes/email drafts; not real-user observations','purpose':'Frozen evaluation only; no model training or policy selection','requests':1000,'inputWords':100000,'expectedWords':sum(r['expectedWords'] for r in rows),'wordDefinition':'Whitespace-delimited unit containing at least one Unicode letter or number; markup-only tokens excluded; URLs/file names count as one unit','wordCountRange':[min(r['inputWords'] for r in rows),max(r['inputWords'] for r in rows)],'sourceCommit':commit,'seed':SEED,'domains':dict(collections.Counter(r['domain'] for r in rows)),'modules':dict(collections.Counter(r['module'] for r in rows)),'formats':dict(collections.Counter(r['format'] for r in rows)),'variants':dict(collections.Counter(r['variant'] for r in rows)),'literalCases':literal_count,'uniqueInputs':len(used_inputs),'uniqueNormalizedBodies':len(used_targets),'uniqueScenarioEventActionCombinations':len(used_scenarios),'composition':{'newDomainParagraphs':96,'newDomainActionSentences':96,'newSharedFollowupSentences':len(pool['followups']),'newShortClosings':len(pool['short']),'reusedSentencesWithinNewSet':True,'independentScenarioClaim':False},'corpusSHA256':sha(raw),'gzipSHA256':sha(compressed),'authoredPoolsSHA256':sha(POOL.read_bytes()),'generatorSHA256':sha(Path(__file__).read_bytes()),'referencesFrozenBeforeAppInference':True,'runtimeOutputsUsedToAuthorReferences':False,'usedForTraining':False,'previousQA':{'commit':commit,'normalizedReferences':len(old),'referenceSHA256':sha('\n'.join(old).encode()),'files':files},'novelty':{'normalizedExactPriorOverlap':0,'sharedPriorEightWordSequence':0,'maximumSeedTrigramJaccard':max(seed_scores),'maximumDocumentTrigramJaccard':maxscore,'rejectionThreshold':.35,'rejected':dict(rejected)},'judgmentPolicy':'Assistant reviews every nonmatching output difference against frozen meaning/spelling/grammar/literals. Accept only justified alternative typography or valid punctuation/layout; preserve original gold and record adjudication separately.'}
 (args.out/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in manifest.items() if k!='previousQA'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
