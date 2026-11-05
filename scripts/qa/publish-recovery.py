"""Publish QA recovery without the original training corpus, using GitHub tags."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request

REPO = 'Sanan2030/SlothAI'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, stderr=subprocess.PIPE, timeout=180).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--release', required=True)
    parser.add_argument('--notes', type=Path, required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--title', default='New 10,000-case application QA and recovery — 4 November 2026')
    parser.add_argument('--integration-report', default='docs/qa/novel-10000-2026-11-04.md')
    args = parser.parse_args()
    if args.work.exists():
        raise ValueError('Use a NEW backup work directory; previous snapshots are immutable')
    args.work.mkdir(parents=True)
    run('git', 'init', '--quiet', cwd=args.work)
    for key in ('user.name', 'user.email'):
        run('git', 'config', key, run('git', 'config', '--get', key), cwd=args.work)
    run('git', 'remote', 'add', 'origin', f'https://github.com/{REPO}.git', cwd=args.work)
    archive = args.work / 'novel-10000-recovery.tar.gz'
    shutil.copyfile(args.archive, archive)
    recovery = {'savedAtUTC': datetime.now(timezone.utc).isoformat(), 'applicationSourceCommit': args.source,
                'archive': archive.name, 'archiveSHA256': digest(archive),
                'originalTrainingCorpusUploaded': False,
                'scope': '10,000 authored QA cases, before/after outputs, errors, browser receipts, source and restore guide; no model quality certification.'}
    (args.work / 'RECOVERY.json').write_text(json.dumps(recovery, ensure_ascii=False, indent=2)+'\n')
    (args.work / 'RESTORE.md').write_text(f'''# Recover the 10,000-case audit

Download the four pinned files linked in the GitHub Release. Run
`sha256sum -c SHA256SUMS`, extract `novel-10000-recovery.tar.gz`, then
`cd novel-10000-recovery && sha256sum -c SHA256SUMS`.

The application source commit is `{args.source}`. Source is included in
`application-source.tar.gz`; it contains no credentials or original corpus.
Read `{args.integration_report}` and `RESTORE.md` INSIDE the archive.
Both the original frozen targets and the explicit reference errata are saved.
Use the comparison ledger and remaining errors to continue; do not change
targets to match actual app outputs. No running training process is implied.

The original six uploaded training gzip files and prepared training data are
excluded. Separate model backup Releases remain authoritative for checkpoints.
''')
    names = (archive.name, 'RECOVERY.json', 'RESTORE.md')
    (args.work / 'SHA256SUMS').write_text(''.join(digest(args.work / name)+'  '+name+'\n' for name in names))
    run('git', 'add', '--all', cwd=args.work)
    run('git', 'commit', '--quiet', '-m', '[skip ci] Save novel 10,000-case QA recovery', cwd=args.work)
    commit = run('git', 'rev-parse', 'HEAD', cwd=args.work)
    exists = subprocess.run(['gh', 'release', 'view', args.release, '--repo', REPO], stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, timeout=60).returncode == 0
    tag = f'{args.release}-save-{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")}' if exists else args.release
    run('git', 'push', 'origin', f'HEAD:refs/tags/{tag}', cwd=args.work)
    base = f'https://raw.githubusercontent.com/{REPO}/{commit}'
    for name in (*names, 'SHA256SUMS'):
        with urllib.request.urlopen(base+'/'+name, timeout=90) as response:
            actual = hashlib.sha256(response.read()).hexdigest()
        if actual != digest(args.work / name):
            raise ValueError('Remote checksum mismatch: '+name)
    notes = args.notes.read_text()+f'''\n\nPinned recovery files (all four downloaded and checksum-verified):

- [novel-10000-recovery.tar.gz]({base}/{archive.name})
- [RECOVERY.json]({base}/RECOVERY.json)
- [RESTORE.md]({base}/RESTORE.md)
- [SHA256SUMS]({base}/SHA256SUMS)

Backup Git commit: `{commit}`. Archive SHA-256: `{digest(archive)}`.
The automatic Source code ZIP/TAR below contains the recovery wrapper files.
The complete audit and application source are inside the linked recovery archive.
Original six training gzip archives and bulk prepared task data are excluded.
'''
    note_path = args.work.parent / (args.work.name+'-release-notes.md')
    note_path.write_text(notes)
    if exists:
        run('gh', 'release', 'edit', args.release, '--repo', REPO, '--notes-file', str(note_path))
    else:
        run('gh', 'release', 'create', args.release, '--repo', REPO, '--verify-tag', '--prerelease',
            '--title', args.title, '--notes-file', str(note_path))
    receipt = {**recovery, 'backupCommit': commit, 'backupTag': tag, 'archiveURL': base+'/'+archive.name,
               'recoveryURL': base+'/RECOVERY.json', 'restoreURL': base+'/RESTORE.md',
               'releaseURL': f'https://github.com/{REPO}/releases/tag/{args.release}',
               'status': 'published-and-download-verified'}
    (args.work.parent / (args.work.name+'-receipt.json')).write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
