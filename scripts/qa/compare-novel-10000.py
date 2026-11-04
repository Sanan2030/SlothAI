"""Rescore saved before/after outputs against ONE approved reference revision."""
import argparse
from collections import Counter, defaultdict
import difflib
import gzip
import hashlib
import json
from pathlib import Path
import re
import unicodedata


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def comparable(value):
    return ' '.join(unicodedata.normalize('NFC', value).split())


def load(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def differences(expected, actual):
    a, b = expected.split(), actual.split()
    return [{'expected': ' '.join(a[i:j]), 'actual': ' '.join(b[k:l])}
            for operation, i, j, k, l in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes()
            if operation != 'equal']


def diagnosis(row, actual):
    expected = row['expected']
    fold = lambda text: re.sub(r'[^\w]+', ' ', text.translate(str.maketrans('əçıöüşğƏÇIÖÜŞĞİ', 'eciousgECIOUSGI')).lower()).strip()
    words = lambda text: ' '.join(re.findall(r'\w+', text, re.UNICODE)).lower()
    if row['module'] == 'mail' and len(actual.split()) + 3 < len(expected.split()):
        return 'mail-body-boundary', 'Salamlaşmanın sonu səhv seçilərək əsas mətnin bir hissəsi alıcı kimi ayrılıb; hazır salam abzasının sərhədi qorunmalıdır.'
    if row['variant'] == 'spacing' and any('və' in part['actual'] and len(part['expected'].split()) > len(part['actual'].split()) for part in differences(expected, actual)):
        return 'glued-conjunction', 'Bitişik yazılmış bağlayıcının sərhədi tanınmayıb; əvvəlki hissənin təsdiqlənmiş feil olması ilə məhdud ayırma əlavə edilib.'
    if words(expected) == words(actual):
        return 'punctuation-boundary', 'Sözlər eynidir, cümlə sərhədi və ya durğu seçimi fərqlidir; sual/nisbi cümlə və feili sifət sərhədləri yoxlanıb. Üslub alternativləri ayrıca nəzərə alınmalıdır.'
    if row['variant'] == 'repeated-key':
        return 'repeated-key-or-candidate', 'Təkrar hərf silinməyib və ya yanlış namizəd seçilib. Bir hərfin silinməsi yalnız təsdiqlənmiş yeganə söz forması ilə qəbul edilir; həqiqi qoşa samitlər qorunur.'
    homographs = {'seher', 'suret', 'sert', 'acar', 'adi', 'el', 'serf', 'eser', 'aciq', 'kes', 'ucun'}
    if any(any(fold(token).startswith(key) for key in homographs) for part in differences(expected, actual) for token in part['expected'].split()):
        return 'lexical-sense-or-context', 'ASCII yazılışı bir neçə mənalı sözə uyğun gələ bilir və ya lokal model başqa məna seçir; təhlükəsiz düzəliş üçün yaxın sözlərdən qrammatik/terminoloji sübut tələb olunur.'
    if fold(expected) == fold(actual):
        return 'lexical-diacritic-coverage', 'Eyni hərf skeletində düzgün Azərbaycan hərfi və ya şəkilçi forması bərpa edilməyib. Sözlükdə təsdiqlənən tək forma və məhdud məhsuldar şəkilçilər üzrə əhatə artırılıb.'
    if comparable(row['input']) == comparable(expected):
        return 'changed-correct-input', 'Düzgün girişə artıq söz/model/yer adı düzəlişi tətbiq olunub; düzgün formanın qorunması və namizəddən imtina sərhədləri vacibdir.'
    return 'candidate-or-morphology', 'Ən az bir söz namizədi və ya şəkilçi düzgün seçilməyib. Söz fərqləri saxlanıb; bu avtomatik mexanizm təsnifatı hər sətir üçün ayrıca təsdiqlənmiş kök-səbəb iddiası deyil.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--final', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    corpus = Path('data/qa/novel-10000-2026-11-04')
    manifest = json.loads((corpus / 'MANIFEST.json').read_text())
    assert sha(corpus / 'cases.jsonl.gz') == manifest['gzipSHA256']
    rows = [json.loads(line) for line in gzip.decompress((corpus / 'cases.jsonl.gz').read_bytes()).splitlines()]
    review = json.loads((corpus / 'GOLD_REVIEW.json').read_text())
    assert review['baseCorpusSHA256'] == manifest['corpusSHA256']
    amendments = {item['id']: item for item in review['changes']}
    for row in rows:
        if row['id'] in amendments:
            item = amendments.pop(row['id']); assert row['expected'] == item['before']
            row['expected'] = item['after']
    assert not amendments
    before = {(row['id'], row['mode']): row for row in load(args.baseline / 'results.jsonl')}
    after = {(row['id'], row['mode']): row for row in load(args.final / 'results.jsonl')}
    assert len(before) == len(after) == 20000
    args.out.mkdir(parents=True, exist_ok=False)
    counters, domains = defaultdict(Counter), defaultdict(lambda: defaultdict(Counter))
    ledger, failures = [], []
    for row in rows:
        for mode in ('default', 'punctcase'):
            a, b = before[(row['id'], mode)], after[(row['id'], mode)]
            assert a['input'] == b['input'] == row['input']
            old_ok = not a.get('error') and comparable(a['actual']) == comparable(row['expected'])
            new_ok = not b.get('error') and comparable(b['actual']) == comparable(row['expected'])
            status = 'retained-correct' if old_ok and new_ok else 'fixed' if new_ok else 'regressed' if old_ok else 'open'
            count = counters[mode]; count[status] += 1; count['beforeExact'] += old_ok; count['afterExact'] += new_ok
            count['beforeUnstable'] += not a['stable']; count['afterUnstable'] += not b['stable']
            count['afterExceptions'] += bool(b.get('error'))
            identity = comparable(row['input']) == comparable(row['expected'])
            count['identityInputs'] += identity; count['beforeIdentityChanged'] += identity and not old_ok; count['afterIdentityChanged'] += identity and not new_ok
            d = domains[mode][row['domain']]; d['cases'] += 1; d['beforeExact'] += old_ok; d['afterExact'] += new_ok
            category, why = diagnosis(row, a['actual'] if not old_ok else b['actual']) if status != 'retained-correct' else ('none', '')
            record = {**row, 'mode': mode, 'before': a['actual'], 'after': b['actual'], 'beforeExact': old_ok,
                      'afterExact': new_ok, 'beforeStable': a['stable'], 'afterStable': b['stable'],
                      'status': status, 'mechanismCategory': category, 'why': why,
                      'diagnosisScope': 'Mechanism classification; confirmed code-level causes and limits are documented in the report.',
                      'beforeDifferences': differences(row['expected'], a['actual']),
                      'afterDifferences': differences(row['expected'], b['actual'])}
            ledger.append(record)
            if not new_ok or not b['stable']:
                record = {**record, 'remainingCategory': diagnosis(row, b['actual'])[0], 'remainingWhy': diagnosis(row, b['actual'])[1]}
                failures.append(record)
    for name, records in [('comparison-ledger', ledger), ('remaining-errors', failures)]:
        content = ''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in records).encode()
        (args.out / (name+'.jsonl.gz')).write_bytes(gzip.compress(content, mtime=0))
    summary = {'scope': 'Development comparison, both versions rescored against the same explicit gold revision; not general real-user quality.',
               'corpusSHA256': manifest['corpusSHA256'], 'goldReviewSHA256': sha(corpus / 'GOLD_REVIEW.json'),
               'baselineResultsSHA256': sha(args.baseline / 'results.jsonl'), 'finalResultsSHA256': sha(args.final / 'results.jsonl'),
               'comparison': 'NFC and whitespace only', 'modes': dict(counters), 'domains': {key: dict(value) for key, value in domains.items()},
               'errorFamilies': dict(Counter(row['remainingCategory'] for row in failures if row['mode'] == 'default')),
               'files': {name: sha(args.out / name) for name in ('comparison-ledger.jsonl.gz', 'remaining-errors.jsonl.gz')}}
    (args.out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
