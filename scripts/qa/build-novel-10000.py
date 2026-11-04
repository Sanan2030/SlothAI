"""Freeze new assistant-authored development cases BEFORE running the application.

The semantic event/continuation combinations are new; this is compositional
authorship, not 10,000 independent human observations or blind quality evidence.
Legacy text is used exclusively to reject duplicate/near-duplicate candidates.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import io
import itertools
import json
from pathlib import Path
import random
import re
import subprocess
import tarfile
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
POOL = Path(__file__).with_name('novel-10000-pools.txt')
DEFAULT_OUT = ROOT / 'data/qa/novel-10000-2026-11-04'
BASE = 'ec966e2f42799d1ea9c4de10d92227bd1b6d62f8'
SEED = 20261104
FOLD = str.maketrans('əçıöüşğƏÇIÖÜŞĞİ', 'eciousgECIOUSGI')
FIELDS = {'input', 'expected', 'target', 'text', 'noisy', 'clean', 'sourceText', 'inputText', 'output', 'corrected'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def normalized(text):
    text = unicodedata.normalize('NFC', text).translate(FOLD).lower()
    return ' '.join(re.findall(r'[a-z]+|<n>', re.sub(r'\d+', '<n>', text)))


def grams(words, n):
    return frozenset(' '.join(words[i:i+n]) for i in range(len(words)-n+1))


def strings(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FIELDS and isinstance(child, str):
                yield child
            elif isinstance(child, (dict, list)) and key not in {'weights', 'tensors', 'parameters', 'counts', 'vectors'}:
                yield from strings(child)
    elif isinstance(value, list) and (not value or not isinstance(value[0], (float, int))):
        for child in value:
            if isinstance(child, (dict, list)):
                yield from strings(child)


def legacy():
    references, files = set(), []
    process = subprocess.Popen(['git', 'archive', BASE, 'tests', 'data/evaluation', 'data/nlp', 'data/local-ai', 'data/neural'],
                               cwd=ROOT, stdout=subprocess.PIPE)
    with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
        for item in archive:
            if not item.isfile() or not item.name.endswith(('.json', '.jsonl', '.ts')):
                continue
            content = archive.extractfile(item).read()
            files.append({'path': item.name, 'sha256': digest(content)})
            text = content.decode('utf-8')
            values = []
            if item.name.endswith('.json'):
                values = strings(json.loads(text))
            elif item.name.endswith('.jsonl'):
                values = itertools.chain.from_iterable(strings(json.loads(line)) for line in text.splitlines() if line.strip())
            else:
                values = (m[1].replace('\\n', '\n') for m in re.findall(r"(['\"`])((?:\\.|(?!\1).)*?)\1", text, re.S))
            for value in values:
                norm = normalized(value)
                if len(norm.split()) >= 5:
                    references.add(norm)
    if process.wait():
        raise RuntimeError('Cannot read the pinned legacy reference commit')
    # Explicit examples from this chat; not sources for new cases.
    references.update(normalized(s) for s in ('qeyd edək ki bu məsələ hələ araşdırılır', 'Mən bilirəm ki sən sabah gələcəksən'))
    ordered = sorted(references)
    tri = [grams(row.split(), 3) for row in ordered]
    eight = set().union(*(grams(row.split(), 8) for row in ordered))
    index = defaultdict(set)
    for at, row in enumerate(tri):
        for gram in row:
            index[gram].add(at)
    # Common grams are ignored only for candidate retrieval, never scoring.
    index = {g: ids for g, ids in index.items() if len(ids) <= 512}
    return ordered, references, tri, eight, index, files


def novelty(text, references, tri, eight, index):
    norm = normalized(text)
    if norm in references:
        return False, 1.0, 'exact'
    words = norm.split()
    if grams(words, 8) & eight:
        return False, 1.0, 'shared-eight-words'
    own = grams(words, 3)
    candidates = set().union(*(index.get(g, ()) for g in own))
    maximum = max((len(own & tri[i]) / len(own | tri[i]) for i in candidates), default=0.0)
    return maximum < 0.35, maximum, 'near' if maximum >= 0.35 else 'novel'


def capital(text):
    return text[0].replace('i', 'İ').upper()+text[1:]


def corrupt(body, variant, rng):
    if variant == 'identity':
        return body
    if variant == 'ascii':
        return body.translate(FOLD)
    if variant == 'partial-diacritics':
        return ''.join(c.translate(FOLD) if rng.random() < 0.55 else c for c in body)
    if variant == 'spacing':
        # A missing boundary before the conjunction, not superficial number changes.
        return body.replace(' və ', 'və ', 1)
    if variant == 'initial-case':
        return body[0].replace('İ', 'i').lower()+body[1:]
    if variant == 'missing-punctuation':
        return body.rstrip('.?!')
    words = list(re.finditer(r'[a-zəçğıöşü]{7,}', body))
    if not words:
        raise ValueError('No word eligible for a deterministic repeated-key typo')
    match = rng.choice(words)
    at = match.start()+rng.randrange(1, len(match[0])-1)
    return body[:at]+body[at]+body[at:]


def write_gzip(path, content):
    with path.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as stream:
            stream.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError('Frozen corpus already exists; preserve it')
    pools, section = {}, None
    for line in POOL.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            section = line[1:-1]
            pools[section] = []
        else:
            pools[section].append(line)
    domains = [key.split('.')[0] for key in pools if key.endswith('.events')]
    assert len(domains) == 10 and all(len(pools[d+'.events']) == 40 and len(pools[d+'.contexts']) == 30 for d in domains)
    print('Building rejection-only reference index from pinned legacy source...', flush=True)
    old, refs, tri, eight, index, files = legacy()
    print('Legacy reference count:', len(old), flush=True)
    rows, rejected, similarities = [], Counter(), []
    used_input, used_target = set(), set()
    variants = ['identity']*3+['ascii']*2+['partial-diacritics']*2+['spacing', 'initial-case', 'missing-punctuation', 'repeated-key']
    for domain in domains:
        rng = random.Random(f'{SEED}:{domain}')
        pairs = list(itertools.product(enumerate(pools[domain+'.events']), enumerate(pools[domain+'.contexts'])))
        rng.shuffle(pairs)
        count = 0
        for (event_at, event), (context_at, context) in pairs:
            style = rng.randrange(10)
            if style == 0:
                body = f'Doğrudanmı {event} və {context}?'
            elif style == 1:
                body = f'Bildiririk ki, {event} və {context}.'
            elif style == 2:
                body = f'{capital(event)}. {capital(context)}.'
            else:
                body = f'{capital(event)} və {context}.'
            kind = variants[rng.randrange(len(variants))]
            raw = corrupt(body, kind, rng)
            if kind != 'identity' and raw == body:
                kind, raw = 'initial-case', corrupt(body, 'initial-case', rng)
            target_key = normalized(body)
            raw_key = unicodedata.normalize('NFC', raw).casefold()
            if target_key in used_target or raw_key in used_input:
                rejected['internal-duplicate'] += 1
                continue
            checks = [novelty(value, refs, tri, eight, index) for value in (body, raw)]
            if not all(result[0] for result in checks):
                for result in checks:
                    if not result[0]:
                        rejected[result[2]] += 1
                continue
            module = 'mail' if domain == 'mail' or domain in ('it', 'rsd') and count % 2 == 0 else 'text'
            signature = 'Səbinə Rüstəmli' if count % 2 else 'Orxan Vəlizadə'
            envelope = lambda text: f'Salam,\n\n{text}\n\nHörmətlə,\n{signature}'
            rows.append({'id': f'novel10k-{domain}-{count+1:04}', 'domain': domain, 'module': module,
                         'scenario': {'event': event_at, 'continuation': context_at}, 'variant': kind,
                         'input': envelope(raw) if module == 'mail' else raw,
                         'expected': envelope(body) if module == 'mail' else body,
                         'options': {'emailGreeting': 'Salam,', 'omitSubject': True} if module == 'mail' else {},
                         'noveltyMaxLegacyTrigramJaccard': max(x[1] for x in checks)})
            similarities.extend(x[1] for x in checks)
            used_input.add(raw_key); used_target.add(target_key)
            count += 1
            if count == 1000:
                break
        if count != 1000:
            raise ValueError(f'{domain}: only {count} novel scenarios; add new author material, do not relax novelty')
        print(domain, count, flush=True)
    assert len(rows) == 10000 and len(used_target) == len(used_input) == 10000
    args.out.mkdir(parents=True)
    content = ''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in rows).encode()
    destination = args.out/'cases.jsonl.gz'
    write_gzip(destination, content)
    metadata = {'schemaVersion': 1, 'total': len(rows), 'seed': SEED, 'source': 'new assistant-authored compositional scenarios',
                'judgment': 'Assistant-authored expected outputs, frozen before first app run; not independent human certification.',
                'scope': 'Development/error-discovery set; any fixes informed by it make it a development regression set, not a blind benchmark.',
                'composition': 'Each event/continuation pair is used once; no name/number-only multiplication. 400 new events and 300 new continuations.',
                'domains': dict(Counter(row['domain'] for row in rows)), 'modules': dict(Counter(row['module'] for row in rows)),
                'variants': dict(Counter(row['variant'] for row in rows)), 'uniqueInputs': len(used_input), 'uniqueNormalizedBodies': len(used_target),
                'corpusSHA256': digest(content), 'gzipSHA256': digest(destination.read_bytes()),
                'authoredPoolsSHA256': digest(POOL.read_bytes()), 'generatorSHA256': digest(Path(__file__).read_bytes()),
                'legacyReferenceCommit': BASE, 'legacyReferences': len(old), 'legacyReferenceFiles': files,
                'legacyNormalizedReferenceSHA256': digest('\n'.join(old).encode()),
                'novelty': {'normalizedExactOverlap': 0, 'sharedEightWordSequence': 0, 'trigramJaccardLimit': 0.35,
                            'maximumAcceptedTrigramJaccard': max(similarities), 'rejectedCandidates': dict(rejected)},
                'runtimeOutputsUsedToAuthorTargets': False, 'usedForModelTraining': False}
    (args.out/'MANIFEST.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in metadata.items() if k != 'legacyReferenceFiles'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
