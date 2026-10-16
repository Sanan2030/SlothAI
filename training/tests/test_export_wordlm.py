import json
from pathlib import Path
import tempfile
import unittest

from training.common import sha256
from training.export_wordlm import export
from training.wordlm import build


class BrowserExportTests(unittest.TestCase):
    def test_pruning_keeps_normalized_backoff_and_is_deterministic(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); model=root/'model.sqlite'
            build(model,[['mən','gəldim'],['sən','getdin'],['mən','getdin']],
                  {'mən','sən','gəldim','getdin'})
            state={'status':'completed','zeroProbabilityTokens':0,'validationPerplexity':3.,
                   'validationRowsComplete':3,'validationRowsTotal':3,'trainingRowsComplete':3,
                   'runId':'fixture','modelSHA256':sha256(model),'manifestSHA256':'fixture'}
            first=export(model,state,root/'one.json',bigrams=2,trigrams=2)
            second=export(model,state,root/'two.json',bigrams=2,trigrams=2)
            self.assertEqual(first,second)
            a=json.loads((root/'one.json').read_text())
            self.assertAlmostEqual(sum(a['unigrams']),1.)
            for order in (2,3):
                entries=a['bigrams' if order==2 else 'trigrams']
                for *key,backoff in a['contexts'+str(order)]:
                    direct=sum(row[-1] for row in entries if row[:-2]==key)
                    self.assertAlmostEqual(direct+backoff,1.)
            for changes in [{'status':'running'},{'zeroProbabilityTokens':1},
                            {'validationPerplexity':float('inf')},{'modelSHA256':'wrong'},
                            {'validationRowsComplete':2}]:
                with self.assertRaises(ValueError): export(model,{**state,**changes},root/'bad.json')


if __name__=='__main__': unittest.main()
