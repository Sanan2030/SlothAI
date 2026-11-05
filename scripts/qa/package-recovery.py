"""Package only QA results/source; original training corpus is never included."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit', type=Path, required=True)
    parser.add_argument('--final', type=Path, required=True)
    parser.add_argument('--browser', type=Path, required=True)
    parser.add_argument('--comparison', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--log', type=Path, action='append', default=[])
    parser.add_argument('--integration-report', default='docs/qa/novel-10000-2026-11-04.md')
    parser.add_argument('--automatic-models', action='store_true')
    args = parser.parse_args()
    if args.out.exists() or args.out.with_suffix('.tar.gz').exists():
        raise ValueError('Do not overwrite an existing recovery package')
    args.out.mkdir(parents=True)
    summary = json.loads((args.final / 'summary.json').read_text())
    browser = json.loads((args.browser / 'summary.json').read_text())
    comparison = json.loads((args.comparison / 'summary.json').read_text())
    assert summary['totalDistinctInputs'] == 10000
    assert all(item['cases'] == 10000 and item['nodeParityDifferences'] == item['exceptions'] == 0
               for item in browser['totals'].values())
    assert comparison['finalResultsSHA256'] == digest(args.final / 'results.jsonl')
    matched = {}
    for name, expected in summary['runtimeSHA256'].items():
        content = subprocess.check_output(['git', 'show', args.source+':'+name])
        actual = hashlib.sha256(content).hexdigest()
        if actual != expected or digest(Path(name)) != expected:
            raise ValueError('Source commit does not match evaluated runtime: '+name)
        matched[name] = actual
    artifact_paths = [name for name in subprocess.check_output(
        ['git', 'ls-tree', '-r', '--name-only', args.source, 'lib/editor', 'lib/strategies'], text=True).splitlines()
        if name.endswith('.json')]
    subprocess.run(['git', 'diff', '--quiet', summary['sourceCommit'], args.source, '--', *artifact_paths], check=True)
    artifacts = {}
    for name in artifact_paths:
        content = subprocess.check_output(['git', 'show', args.source+':'+name])
        expected = hashlib.sha256(content).hexdigest()
        if digest(Path(name)) != expected:
            raise ValueError('Runtime JSON artifact differs from source commit: '+name)
        artifacts[name] = expected
    with (args.out / 'application-source.tar.gz').open('wb') as output:
        subprocess.run(['git', 'archive', '--format=tar.gz', args.source], stdout=output, check=True)
    for name in ('data/qa/novel-10000-2026-11-04', 'scripts/qa', 'docs/qa'):
        shutil.copytree(name, args.out / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for source, name in [(args.audit / 'baseline', 'baseline'), (args.audit / 'baseline-browser-verified', 'baseline-browser-verified'),
                         (args.final, 'final'), (args.browser, 'final-browser'), (args.comparison, 'comparison')]:
        target = args.out / name; target.mkdir()
        for item in source.iterdir():
            if item.is_file() and item.suffix in ('.gz', '.json'):
                shutil.copyfile(item, target / item.name)
    history = args.out / 'development-history'; history.mkdir()
    for directory in args.audit.iterdir():
        if directory.is_dir() and (directory / 'summary.json').exists():
            shutil.copyfile(directory / 'summary.json', history / (directory.name+'-summary.json'))
    shutil.copyfile(args.audit / 'WORK_LOG.md', args.out / 'WORK_LOG.md')
    logs = args.out / 'checks'; logs.mkdir()
    for item in args.log:
        shutil.copyfile(item, logs / item.name)
    provenance = {'applicationSourceCommit': args.source, 'evaluatedBaseCommit': summary['sourceCommit'],
                  'runtimeSourceMatchesCommit': True, 'runtimeSHA256': matched,
                  'runtimeJSONUnchangedFromBase': True, 'runtimeJSONSHA256': artifacts,
                  'corpusSHA256': summary['corpusSHA256'], 'goldReviewSHA256': summary['goldReviewSHA256'],
                  'reviewedTargetsSHA256': summary['reviewedTargetsSHA256'],
                  'finalResultsSHA256': summary['resultsSHA256'], 'browserResultsSHA256': browser['resultsSHA256'],
                  'originalSixTrainingArchivesIncluded': False, 'bulkPreparedTrainingDataIncluded': False}
    (args.out / 'RUN_PROVENANCE.json').write_text(json.dumps(provenance, indent=2)+'\n')
    (args.out / 'RESTORE.md').write_text(f'''# Continue this QA work in a new chat

1. Verify the OUTER `SHA256SUMS`, extract the archive, enter this directory,
   then run `sha256sum -c SHA256SUMS` to verify every inner file.
2. Clone https://github.com/Sanan2030/SlothAI and check out `{args.source}`.
   `application-source.tar.gz` is a separate exact source fallback. It contains
   no Git history; novelty rechecking needs the pinned legacy commit in Git.
3. Read `{args.integration_report}`, the corpus README, MANIFEST,
   GOLD_REVIEW and `comparison/summary.json`. Inputs and original references
   are frozen. Apply only the explicit gold errata; never fit references to outputs.
4. All before/after outputs are in `baseline/results.jsonl.gz` and
   `final/results.jsonl.gz`. Decompress copies with `gzip -dk` before running
   compare/trace commands. `comparison/remaining-errors.jsonl.gz` is the next
   work queue. `final/error-traces.jsonl.gz` records observed stage decisions.
5. Run `npm ci`, then the commands in the corpus README. Use fresh output
   directories. Browser QA requires a running production build and Chromium;
   set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH only for an existing binary.
6. `RUN_PROVENANCE.json` proves all evaluated TypeScript runtime files match
   the source commit. The archived reports originally record the pre-commit
   base plus working-tree hashes, not a falsely claimed committed run.

The dataset is assistant-authored compositional development material, not a
blind or independently human-labelled benchmark. Open disagreements remain.
{'Both models ran automatically; the second browser pass explicitly sent the ignored legacy false flag.' if args.automatic_models else "PunctCase's opt-in path was tested."}
Zero accepted PunctCase edits in this corpus is not
evidence that its training adds this measured improvement. No model retraining
used these QA cases. Do not restart or overwrite unrelated training jobs.

Original six training gzip files and bulk prepared training data are excluded.
Separate training recovery Releases:
- https://github.com/Sanan2030/SlothAI/releases/tag/punctcase-backup-2026-11-04
- https://github.com/Sanan2030/SlothAI/releases/tag/charspell-backup-2026-11-04
''')
    files = sorted(item for item in args.out.rglob('*') if item.is_file())
    (args.out / 'SHA256SUMS').write_text(''.join(digest(item)+'  '+str(item.relative_to(args.out))+'\n' for item in files))
    archive = args.out.with_suffix('.tar.gz')
    with tarfile.open(archive, 'w:gz') as output:
        output.add(args.out, arcname='novel-10000-recovery')
    with tarfile.open(archive) as saved:
        sums = saved.extractfile('novel-10000-recovery/SHA256SUMS').read().decode()
        for line in sums.splitlines():
            expected, name = line.split('  ', 1)
            actual = hashlib.sha256(saved.extractfile('novel-10000-recovery/'+name).read()).hexdigest()
            assert expected == actual, name
    print(json.dumps({'archive': str(archive), 'sha256': digest(archive), 'innerFilesVerified': len(files),
                      'sourceCommit': args.source, 'runtimeSourceMatchesCommit': True}, indent=2))


if __name__ == '__main__':
    main()
