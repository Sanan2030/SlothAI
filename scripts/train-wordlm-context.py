"""Train-only bounded spelling context profiles, independent of QA examples."""
import argparse,collections,gzip,hashlib,json,math,re,sys,time
from pathlib import Path
sys.path.insert(0,str(Path.cwd()))
from training.prepare import eligible_words
from training.common import receipt
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
args.out.mkdir(exist_ok=False,parents=True);started=time.monotonic();repo=Path.cwd().resolve()
accepted,manifest=receipt();baseBytes=(repo/'lib/editor/wordlm/model.json').read_bytes();dictionaryBytes=(repo/'lib/editor/generated/az-words.json').read_bytes();base=json.loads(baseBytes);dictionary=json.loads(dictionaryBytes)
settings={'minimumContextCount':3,'contextsPerDirectionPerForm':8,'maximumProfiles':8000,'maximumForms':8,'contextWords':2,'maximumAmbiguousPrefix':8,'prioritizeFullAmbiguities':True}
fold=lambda s:s.translate(str.maketrans('əçıöüşğ','eciousg'))
shape=re.compile('[a-zəçğıöşü]{2,32}').fullmatch;groups=collections.defaultdict(set)
for word in set(base['words'])|set(dictionary):
 if shape(word):groups[fold(word)].add(word)
ambiguous={key for key,words in groups.items() if len(words)>1};prefixes={key for key in ambiguous if 3<=len(key)<=settings['maximumAmbiguousPrefix']}
keys={key for key in groups if key in ambiguous or any(key[:at] in prefixes for at in range(3,min(len(key),settings['maximumAmbiguousPrefix'])+1))}
ids={word:i for i,word in enumerate(base['words']) if not word.startswith('<')};frequencies=collections.Counter();contexts=collections.defaultdict(collections.Counter);tokens=0;rows=0;decodedReplacementRows=0;digest=hashlib.sha256()
print(json.dumps({'eligibleFoldKeys':len(keys),'ambiguousFoldKeys':len(ambiguous),'settings':settings}),flush=True)
with args.input.open('rb') as check:
 assert hashlib.file_digest(check,'sha256').hexdigest()==manifest['files']['train.jsonl']['sha256']
with args.input.open('rb') as source:
 for line in source:
  digest.update(line)
  decoded=line.decode('utf-8')
  row=json.loads(decoded);words=eligible_words(row);rows+=1;tokens+=len(words)
  for at,word in enumerate(words):
   key=fold(word)
   if key not in keys:continue
   frequencies[(key,word)]+=1
   local=contexts[(key,word)]
   for side,neighbours in [(0,words[max(0,at-2):at]),(1,words[at+1:at+3])]:
    for neighbour in set(neighbours):
     if neighbour in ids:local[(side,ids[neighbour],-1)]+=1
   if at and at+1<len(words) and words[at-1] in ids and words[at+1] in ids:local[(2,ids[words[at-1]],ids[words[at+1]])]+=1
  if rows%250000==0:print(json.dumps({'sentences':rows,'tokens':tokens,'elapsedSeconds':round(time.monotonic()-started,1)}),flush=True)
assert rows==manifest['splitCounts']['train']
assert digest.hexdigest()==manifest['files']['train.jsonl']['sha256']
byKey=collections.defaultdict(list)
for (key,word),n in frequencies.items():byKey[key].append((word,n))
selected=sorted(byKey,key=lambda k:(k not in ambiguous,-sum(n for w,n in byKey[k]),k))[:settings['maximumProfiles']];profiles=[]
for key in selected:
 forms=sorted(byKey[key],key=lambda x:(-x[1],x[0]))[:settings['maximumForms']];total=sum(n for w,n in forms);allFeatures=collections.Counter()
 for word,n in forms:allFeatures.update(contexts[(key,word)])
 keep=set()
 for word,n in forms:
  prior=(n+1)/(total+len(forms));bySide=collections.defaultdict(list)
  for feature,count in contexts[(key,word)].items():
   if count<settings['minimumContextCount']:continue
   contrast=math.log((count+1)/(allFeatures[feature]+len(forms)))-math.log(prior)
   # A sole observed form still needs genuine lexical neighbours as evidence.
   merit=(max(contrast,0)+0.01)*math.sqrt(count)
   bySide[feature[0]].append((merit,count,feature))
  for side,values in bySide.items():keep.update(x[2] for x in sorted(values,key=lambda x:(-x[0],-x[1],x[2]))[:settings['contextsPerDirectionPerForm']])
 if keep:
  profiles.append([key,[w for w,n in forms],[n for w,n in forms],[[*f,[contexts[(key,w)].get(f,0) for w,n in forms]] for f in sorted(keep)]])
model={'schemaVersion':1,'sourceManifestSHA256':accepted['manifestSHA256'],'sourceTrainSHA256':digest.hexdigest(),'baseWordLMArtifactSHA256':hashlib.sha256(baseBytes).hexdigest(),'dictionarySHA256':hashlib.sha256(dictionaryBytes).hexdigest(),'settings':settings,'profiles':profiles}
modelPath=args.out/'model.json';modelPath.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':'))+'\n')
report={'scope':'Derived full-train-only lexical context counts. No QA/validation/test data read; engineering settings fixed before evaluation. Not calibrated correctness probabilities.','trainSentences':rows,'trainTokens':tokens,'utf8ReplacementRows':decodedReplacementRows,'eligibleFoldKeys':len(keys),'profiles':len(profiles),'features':sum(len(p[3]) for p in profiles),'artifactSHA256':hashlib.sha256(modelPath.read_bytes()).hexdigest(),'artifactBytes':modelPath.stat().st_size,'gzipBytes':len(gzip.compress(modelPath.read_bytes())),'sourceTrainSHA256':digest.hexdigest(),'manifestSHA256':accepted['manifestSHA256'],'scriptSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'settings':settings,'elapsedSeconds':time.monotonic()-started,'trainingSourceFilesModified':False}
(args.out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
