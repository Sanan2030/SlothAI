"""Deterministic, normalized browser projection of a completed WordLM checkpoint.

Keep all vocabulary/continuation unigrams and the most frequent higher orders.
Removed discounted mass is transferred to backoff, never silently lost.
No training, validation selection or calibration is performed by this export.
"""
import argparse
from collections import defaultdict
import gzip
import json
import math
from pathlib import Path
import sqlite3

from training.common import sha256


def export(model, state, output, bigrams=20000, trigrams=40000):
    if (state['status'] != 'completed' or state['zeroProbabilityTokens'] != 0
            or not isinstance(state.get('validationPerplexity'), (int, float))
            or not math.isfinite(state['validationPerplexity'])
            or state['validationRowsComplete'] != state['validationRowsTotal']):
        raise ValueError('A completed, finite, zero-error validation receipt is required')
    if bigrams < 1 or trigrams < 1:
        raise ValueError('Positive export limits required')
    if sha256(model) != state['modelSHA256']:
        raise ValueError('Model checksum differs from completed receipt')
    with sqlite3.connect(Path(model).resolve().as_uri()+'?mode=ro', uri=True) as db:
        db.execute('PRAGMA temp_store=FILE')
        vocabulary = {w for w, in db.execute('SELECT word FROM vocabulary')}
        unigram = dict(db.execute('SELECT word,n FROM continuation1'))
        words = sorted(vocabulary | unigram.keys() | {'<s>', '</s>', '<unk>'})
        ids = {w: i for i, w in enumerate(words)}
        discount = db.execute('SELECT discount FROM settings').fetchone()[0]
        total = sum(unigram.values())
        def project(table, width, limit, context_table):
            columns = ['a','b','c'][:width]
            rows = db.execute(f'SELECT {",".join(columns)},n FROM {table} '
                              f'ORDER BY n DESC,{",".join(columns)} LIMIT ?', (limit,)).fetchall()
            groups = defaultdict(list)
            for *key, n in rows:
                groups[tuple(key[:-1])].append((key[-1], n))
            contexts, entries = [], []
            for history, followers in sorted(groups.items()):
                clause = ' AND '.join(c+'=?' for c in columns[:-1])
                denom = db.execute(f'SELECT total FROM {context_table} WHERE {clause}', history).fetchone()[0]
                direct = [(ids[w], (n-discount)/denom) for w,n in followers]
                backoff = 1-math.fsum(p for _,p in direct)
                if not 0 <= backoff <= 1:
                    raise ValueError('Invalid retained probability mass')
                key = [ids[w] for w in history]
                contexts.append([*key, backoff])
                entries.extend([*key, w, p] for w,p in direct)
            return contexts, entries
        c2, p2 = project('continuation2', 2, bigrams, 'contexts2')
        c3, p3 = project('trigrams', 3, trigrams, 'contexts3')
    artifact = {'schemaVersion': 1, 'runId': state['runId'],
                'sourceModelSHA256': state['modelSHA256'],
                'manifestSHA256': state['manifestSHA256'],
                'projection': 'top-count discounted mass; removed mass goes to backoff',
                'words': words, 'unigrams': [unigram.get(w,0)/total for w in words],
                'contexts2': c2, 'bigrams': p2, 'contexts3': c3, 'trigrams': p3}
    output = Path(output); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact,ensure_ascii=False,separators=(',',':'))+'\n')
    raw = output.read_bytes()
    return {'sourceModelSHA256': state['modelSHA256'], 'artifactSHA256': sha256(output),
            'artifactBytes': len(raw), 'gzipBytes': len(gzip.compress(raw,mtime=0)),
            'vocabularySymbols': len(words), 'bigrams': len(p2), 'trigrams': len(p3),
            'trainRows': state['trainingRowsComplete'], 'validationRows': state['validationRowsComplete'],
            'fullModelValidationPerplexity': state['validationPerplexity'],
            'fullModelZeroProbabilityTokens': state['zeroProbabilityTokens'],
            'projectionValidationPerplexity': None, 'realErrorCalibration': False,
            'testRead': False, 'exporterSHA256': sha256(Path(__file__))}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['model','state','out','report']: p.add_argument('--'+name,type=Path,required=True)
    args=p.parse_args()
    report=export(args.model,json.loads(args.state.read_text()),args.out)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)
