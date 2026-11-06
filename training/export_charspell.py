"""Export a completed, hash-verified CharSpell checkpoint as original float32."""
import argparse, base64, gzip, hashlib, json
from pathlib import Path
from training.common import ROOT, receipt, sha256, read_json, write_json

def export(run, output, golden):
    import torch
    from training.charspell.model import CharSpell, collate, CHARACTERS
    run, output, golden = Path(run), Path(output), Path(golden)
    report = read_json(run / 'report.json')
    accepted, manifest = receipt()
    if (report.get('status') != 'completed' or report.get('stage') != 'charspell'
        or report.get('profile') != 'full' or report.get('testRead') is not False
        or report.get('manifestSHA256') != accepted['manifestSHA256']
        or report.get('sentences') != {s:manifest['splitCounts'][s] for s in ('train','validation')}
        or sha256(run/'best.pt') != report.get('artifactSHA256')):
        raise ValueError('A completed hash-matching full CharSpell run is required')
    checkpoint = torch.load(run/'best.pt',map_location='cpu',weights_only=True)
    if (checkpoint['stage']!='charspell' or checkpoint['epoch']!=report['selectedEpoch']
        or checkpoint['config']!=report['hyperparameters']
        or checkpoint['manifestSHA256']!=report['manifestSHA256']):
        raise ValueError('Checkpoint/report mismatch')
    torch.set_num_threads(1)
    model=CharSpell(checkpoint['config']).eval();model.load_state_dict(checkpoint['state_dict'],strict=True)
    records={};payload=bytearray()
    for name,tensor in model.state_dict().items():
        if not torch.isfinite(tensor).all():raise ValueError('Non-finite tensor: '+name)
        records[name]={'offset':len(payload)//4,'shape':list(tensor.shape)}
        payload.extend(tensor.detach().contiguous().numpy().astype('<f4').tobytes())
    keys=['charEmbedding','charChannels','wordEmbedding','maxWordChars','contextWords','maxCandidates','prefixLength']
    info={'format':'charspell-f32le-v1','parameters':len(payload)//4,'bytes':len(payload),
          'sha256':hashlib.sha256(payload).hexdigest(),'sourceCheckpointSHA256':report['artifactSHA256'],
          'sourceReportSHA256':sha256(run/'report.json'),'manifestSHA256':report['manifestSHA256'],
          'selectedEpoch':checkpoint['epoch'],'characters':CHARACTERS,
          'config':{k:checkpoint['config'][k] for k in keys},'tensors':records}
    output.mkdir(parents=True,exist_ok=True);write_json(output/'model-info.json',info)
    write_json(output/'weights.json',{'data':base64.b64encode(payload).decode('ascii')})
    # Numerical parity fixtures only. No reference/QA targets or language tuning.
    fixtures=[('', '', '', ['', 'a']),('salam','','',['salam','saləm','salon']),
      ('sureti','sənədin ilkin','mətni göndər',['sureti','surəti','sürəti']),
      ('İŞ','IŞIQ İşıqlı','ĞÖÜÇŞƏı',['iş','ış','İŞ']),
      ('x'*40,'uzun kontekst '*8,'sağ kontekst '*8,['x'*32,'x'*33,'x'*40]),
      ('a-b','sol','sağ',["a-b","a'b","a b",'🙂']),
      ('a','ə', 'i',['a','ə','ı','i']),('abc','','',['abc'])]
    generator=torch.Generator().manual_seed(71409)
    alphabet=CHARACTERS+'🙂9'
    for _ in range(48):
        def word():
            size=int(torch.randint(0,41,(1,),generator=generator));return ''.join(alphabet[int(i)] for i in torch.randint(len(alphabet),(size,),generator=generator))
        fixtures.append((word(),word(),word(),[word() for _ in range(int(torch.randint(1,9,(1,),generator=generator)))]))
    rows=[{'input':w,'left':l,'right':r,'candidates':c,'label':0} for w,l,r,c in fixtures]
    with torch.inference_mode():
        logits=model(collate(rows,checkpoint['config'],'cpu')).tolist()
    examples=[{**row,'logits':values[:len(row['candidates'])]} for row,values in zip(rows,logits)]
    write_json(golden,{'scope':'Deterministic numerical parity only; not model quality or threshold fitting',
                       'sourceCheckpointSHA256':report['artifactSHA256'],'examples':examples,'absoluteTolerance':0.001})
    return {'sourceCheckpointSHA256':report['artifactSHA256'],'sourceReportSHA256':sha256(run/'report.json'),
            'parameters':info['parameters'],'payloadSHA256':info['sha256'],'goldenSHA256':sha256(golden),
            'quantization':'none; original float32','weightsGzipBytes':len(gzip.compress((output/'weights.json').read_bytes())),
            'testRead':False,'trainingStarted':False,'selectedEpoch':report['selectedEpoch']}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run',type=Path,required=True)
    p.add_argument('--out',type=Path,default=ROOT/'lib/editor/charspell')
    p.add_argument('--golden-out',type=Path,default=ROOT/'tests/fixtures/charspell-golden.json')
    p.add_argument('--receipt',type=Path,default=ROOT/'docs/training/charspell-export-2026-11-06.json')
    args=p.parse_args();result=export(args.run,args.out,args.golden_out);write_json(args.receipt,result);print(json.dumps(result,indent=2))
if __name__=='__main__':main()
