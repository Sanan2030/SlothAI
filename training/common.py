"""Hash-bound corpus access; no alternate corpus, split or approval generation."""
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACCEPTED = ROOT / 'docs/stage1/collection'
CORPUS = ROOT / 'data/corpus/az-v1'
OUTPUT = ROOT / 'artifacts/training'
SPLITS = ('train', 'validation')  # Test is deliberately absent from preparation/training.
PREPARED_FILES = {'config.json', 'lexicon.sqlite', 'data-gate.json', 'data-gate-receipt.json',
                  *(f'{stage}-{split}.jsonl.gz' for stage in ('charspell', 'wordlm', 'punctcase') for split in SPLITS)}


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.partial')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def receipt():
    accepted = read_json(ACCEPTED / 'accepted-corpus.json')
    if accepted['status'] != 'passed' or sha256(ACCEPTED / 'MANIFEST.json') != accepted['manifestSHA256']:
        raise ValueError('Accepted manifest/receipt mismatch; do not substitute a new corpus')
    if sha256(ACCEPTED / accepted['report']) != accepted['reportSHA256']:
        raise ValueError('Accepted audit receipt hash mismatch')
    return accepted, read_json(ACCEPTED / 'MANIFEST.json')


def inspect_corpus(directory):
    accepted, manifest = receipt()
    directory = Path(directory).resolve()
    missing = [name for name in ['MANIFEST.json', *manifest['files']] if not (directory / name).is_file()]
    return {'status': 'blocked' if missing else 'present-not-verified', 'corpus': str(directory),
            'missingFiles': missing, 'manifestSHA256': accepted['manifestSHA256'],
            'splitCounts': manifest['splitCounts'], 'trainingStarted': False,
            'torchInstalledInCurrentPython': __import__('importlib.util', fromlist=['find_spec']).find_spec('torch') is not None,
            'trainingEnvironmentPresent': (ROOT / '.venv-training/bin/python').is_file(),
            'nvidiaSmiPresent': shutil.which('nvidia-smi') is not None,
            'cpuThreads': os.cpu_count(), 'freeDiskGiB': round(shutil.disk_usage(ROOT).free / 2**30, 2)}


def verify_files(directory):
    accepted, manifest = receipt()
    directory = Path(directory).resolve()
    missing = inspect_corpus(directory)['missingFiles']
    if missing:
        raise ValueError('Missing accepted corpus files: ' + ', '.join(missing))
    if sha256(directory / 'MANIFEST.json') != accepted['manifestSHA256']:
        raise ValueError('Corpus MANIFEST.json is not the accepted version')
    for name, expected in manifest['files'].items():
        path = directory / name
        if path.stat().st_size != expected['bytes'] or sha256(path) != expected['sha256']:
            raise ValueError('Corpus file integrity mismatch: ' + name)
    return accepted, manifest


def model_card(report):
    accepted, manifest = receipt()
    return {**report, 'sources': [{key: source[key] for key in ('id', 'name', 'url', 'license', 'licenseEvidence')}
                                  for source in manifest['sources']],
            'approvalScope': accepted['approvalScope'], 'linguisticReview': accepted['linguisticReview'],
            'candidateDictionary': read_json(ROOT / 'public/dictionaries/az/metadata.json'),
            'calibrationData': 'Separate owner-supplied real data/calibration/ required; not supplied.',
            'releaseStatus': 'Offline experiment only; no trained artifact was enabled in the editor.'}


def run_gate(directory, output):
    accepted, manifest = verify_files(directory)
    output = Path(output)
    # The original gate performs its leakage audit; no evaluation text reaches the trainer.
    report_path = output / 'data-gate.json'
    output.mkdir(parents=True, exist_ok=True)
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/data/gate.py'), str(Path(directory).resolve()),
                             '--out', str(report_path)], cwd=ROOT, check=False)
    report = read_json(report_path)
    if result.returncode or report['status'] != 'passed':
        raise ValueError('Full data gate failed; see ' + str(report_path))
    # Bind the new audit to the exact bytes it audited, not just status=passed.
    binding = {'manifestSHA256': accepted['manifestSHA256'], 'reportSHA256': sha256(report_path),
               'corpus': str(Path(directory).resolve()), 'files': manifest['files'], 'trainingStarted': False}
    write_json(output / 'data-gate-receipt.json', binding)
    return binding


def safe_output(path, corpus=CORPUS):
    path, corpus = Path(path).resolve(), Path(corpus).resolve()
    if path == corpus or path.is_relative_to(corpus) or corpus.is_relative_to(path):
        raise ValueError('Output must be separate from the corpus')
    if path.is_relative_to(ROOT) and not path.is_relative_to(OUTPUT):
        raise ValueError('Repository outputs belong under ignored artifacts/training/')
    if path == Path(path.anchor):
        raise ValueError('Invalid output root')
    return path


def indices(count, limit, seed):
    """Uniform sentence sampling within an existing source split; never re-split."""
    if limit is None or limit >= count:
        return None
    return set(random.Random(seed).sample(range(count), limit))


def jsonl(path):
    import gzip
    opener = gzip.open if str(path).endswith('.gz') else open
    with opener(path, 'rt', encoding='utf-8') as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                raise ValueError(f'{path}:{number}: blank row')
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f'{path}:{number}: object required')
            yield value


@contextmanager
def gzip_writer(path):
    import gzip
    import io
    # No timestamp or output path in the gzip header: same config gives same dataset bytes.
    with open(path, 'wb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding='utf-8', newline='\n') as stream:
                yield stream


def verify_prepared(directory):
    directory = Path(directory).resolve()
    metadata = read_json(directory / 'prepared.json')
    accepted, manifest = verify_files(metadata['corpus'])
    binding = read_json(directory / 'data-gate-receipt.json')
    gate = read_json(directory / 'data-gate.json')
    if (metadata['status'] != 'prepared' or metadata['manifestSHA256'] != accepted['manifestSHA256']
            or binding['manifestSHA256'] != accepted['manifestSHA256']
            or binding['files'] != manifest['files'] or binding['corpus'] != metadata['corpus']
            or binding['reportSHA256'] != sha256(directory / 'data-gate.json') or gate['status'] != 'passed'
            or gate['cleanSentences'] != accepted['cleanSentences'] or gate['crossSplitCollisions'] != 0):
        raise ValueError('Prepared data or fresh gate binding is invalid')
    if set(metadata['files']) != PREPARED_FILES:
        raise ValueError('Prepared manifest must bind every task file, index, configuration and gate receipt')
    for name, expected in metadata['files'].items():
        if Path(name).name != name:
            raise ValueError('Invalid prepared artifact name')
        path = directory / name
        if path.stat().st_size != expected['bytes'] or sha256(path) != expected['sha256']:
            raise ValueError('Prepared artifact integrity mismatch: ' + name)
    if read_json(directory / 'config.json') != metadata['hyperparameters'] or metadata['seed'] != metadata['hyperparameters']['seed']:
        raise ValueError('Prepared configuration mismatch')
    for split in SPLITS:
        if not 0 < metadata['splits'][split]['sentences'] <= manifest['splitCounts'][split]:
            raise ValueError('Invalid prepared split count: ' + split)
        for source in metadata['splits'][split].get('sources', {}):
            if manifest['assignments'].get(source) != split:
                raise ValueError('Prepared source crosses split boundary')
    return metadata


def import_parts(source, destination):
    """Verify original gzip and raw hashes, then atomically publish the whole directory."""
    import gzip
    accepted, manifest = receipt()
    parts = read_json(ACCEPTED / 'compressed-parts.json')['parts']
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.exists():
        raise ValueError('Destination already exists; preserve it and choose an empty path')
    missing = [p['file'] for p in parts if not (source / p['file']).is_file()]
    if missing:
        raise ValueError('Missing gzip parts: ' + ', '.join(missing))
    destination.parent.mkdir(parents=True, exist_ok=True)
    required = sum(p['bytes'] for p in manifest['files'].values())
    if shutil.disk_usage(destination.parent).free < required + 2**30:
        raise ValueError('Insufficient free disk for the uncompressed accepted corpus')
    for part in parts:
        path = source / part['file']
        if path.stat().st_size != part['bytes'] or sha256(path) != part['sha256']:
            raise ValueError('Gzip integrity mismatch: ' + part['file'])
    with tempfile.TemporaryDirectory(prefix='az-v1-import-', dir=destination.parent) as temp:
        staging = Path(temp) / 'corpus'
        staging.mkdir()
        for part in parts:
            name = part['uncompressedFile']
            expected, digest, size = manifest['files'][name], hashlib.sha256(), 0
            with gzip.open(source / part['file'], 'rb') as compressed, (staging / name).open('wb') as raw:
                for block in iter(lambda: compressed.read(1024 * 1024), b''):
                    size += len(block)
                    if size > expected['bytes']:
                        raise ValueError('Decompressed size exceeds accepted receipt: ' + name)
                    digest.update(block)
                    raw.write(block)
            if size != expected['bytes'] or digest.hexdigest() != expected['sha256']:
                raise ValueError('Decompressed integrity mismatch: ' + name)
        shutil.copyfile(ACCEPTED / 'MANIFEST.json', staging / 'MANIFEST.json')
        if sha256(staging / 'MANIFEST.json') != accepted['manifestSHA256']:
            raise ValueError('Manifest changed during import')
        staging.rename(destination)
    return inspect_corpus(destination)
