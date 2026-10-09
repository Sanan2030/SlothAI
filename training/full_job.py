"""Explicit CPU full-job supervision; status never starts or resumes a model."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import resource
import shutil
import signal
import subprocess
import time

from training.common import OUTPUT, ROOT, read_json, receipt, safe_output, sha256, write_json
from training.run import validate_full_smoke

STAGES = ('wordlm', 'punctcase', 'charspell')
COUNTS = {'train': 3287357, 'validation': 1082532}
PYTHON = ROOT / '.venv-training/bin/python'
POLL_SECONDS = 10
SEMANTIC_FILES = ('cli.py', 'common.py', 'run.py', 'text.py', 'candidates.py', 'prepare.py',
                  'wordlm.py', 'charspell/model.py', 'punctcase/model.py', 'requirements-common.txt')


def now():
    return datetime.now(timezone.utc).isoformat()


def process_identity(pid):
    """Linux start ticks disambiguate recycled PIDs; zombies are not live."""
    try:
        fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
        if fields[0] == 'Z':
            return None
        return {'startTicks': fields[19], 'parentPID': int(fields[1]), 'groupPID': int(fields[2])}
    except (OSError, IndexError, ValueError):
        return None


def same_process(pid, ticks):
    identity = process_identity(pid)
    return identity is not None and identity['startTicks'] == str(ticks)


def disk_guard():
    free = {'workspaceFreeGiB': shutil.disk_usage(ROOT).free / 2**30,
            'tmpFreeGiB': shutil.disk_usage('/tmp').free / 2**30}
    if free['workspaceFreeGiB'] < 2 or free['tmpFreeGiB'] < 1:
        raise ValueError('Disk reserve exhausted: ' + json.dumps(free))
    return free


def stop_group(pid, ticks, sig=signal.SIGINT):
    identity = process_identity(pid)
    if identity and identity['startTicks'] == str(ticks) and identity['groupPID'] == pid:
        try:
            os.killpg(pid, sig)
        except ProcessLookupError:
            pass  # The verified process can finish between the check and signal.


def shutdown(active, child):
    """Bounded shutdown; every escalation rechecks the same isolated group."""
    for sig, seconds in ((signal.SIGINT, 30), (signal.SIGTERM, 30), (signal.SIGKILL, 5)):
        stop_group(*active, sig)
        if child is not None:
            try:
                child.wait(timeout=seconds)
                return
            except subprocess.TimeoutExpired:
                continue
        deadline = time.monotonic() + seconds
        while same_process(*active) and time.monotonic() < deadline:
            time.sleep(1)
        if not same_process(*active):
            return
    raise TimeoutError('Verified process group did not exit after bounded shutdown')


def adopt_preparation(pid, ticks, data, resource_path):
    if resource_path.resolve() != OUTPUT / 'runs/prepare-full-20261009.resource.json':
        raise ValueError('Preparation resource must be the expected full-run receipt')
    identity = process_identity(pid)
    if not identity or identity['startTicks'] != str(ticks) or identity['groupPID'] != pid:
        raise ValueError('Preparation wrapper is missing, recycled or not an isolated process group')
    command = [str(PYTHON), '-m', 'training.cli', 'prepare', '--profile=full', '--out=' + str(data)]
    wrapper = [str(PYTHON), str(OUTPUT / 'measure-run.py'), resource_path.name.removesuffix('.resource.json'),
               '--', *command]
    actual = Path(f'/proc/{pid}/cmdline').read_bytes().rstrip(b'\0').decode().split('\0')
    if actual != wrapper:
        raise ValueError('Preparation wrapper command does not match the requested full dataset')
    boot = next(int(line.split()[1]) for line in Path('/proc/stat').read_text().splitlines() if line.startswith('btime '))
    earliest = boot + int(ticks) / os.sysconf('SC_CLK_TCK')
    value = preparation_resource(resource_path, command, earliest)
    child = process_identity(value.get('pid', -1))
    expected_log = str(OUTPUT / 'runs/prepare-full-20261009.log')
    if (value['status'] != 'running' or value.get('log') != expected_log or not child
            or child['parentPID'] != pid or child['groupPID'] != pid
            or Path(f'/proc/{value["pid"]}/cmdline').read_bytes().rstrip(b'\0').decode().split('\0') != command):
        raise ValueError('Preparation receipt is not bound to the live adopted child process')
    return command, {'earliest': earliest, 'pid': value['pid'], 'childStartTicks': child['startTicks'],
                     'startedAtUTC': value['startedAtUTC'], 'log': expected_log}


def preparation_resource(path, command, earliest, binding=None):
    value = read_json(path)
    if (value.get('command') != command
            or datetime.fromisoformat(value['startedAtUTC']).timestamp() < earliest - 2
            or path.stat().st_mtime < earliest - 2):
        raise ValueError('Preparation resource is stale or its command does not match this job')
    if value.get('status') not in ('running', 'completed') or (value['status'] == 'completed' and value.get('exitCode') != 0):
        raise ValueError('Preparation did not complete successfully: ' + str(value.get('status')))
    if binding and any(value.get(key) != binding[key] for key in ('pid', 'startedAtUTC', 'log')):
        raise ValueError('Preparation receipt identity changed after adoption')
    return value


def validate_data(data, config):
    metadata = read_json(data / 'prepared.json')
    accepted, _ = receipt()
    if (metadata.get('status') != 'prepared' or metadata.get('profile') != 'full'
            or metadata.get('manifestSHA256') != accepted['manifestSHA256']
            or metadata.get('hyperparameters') != config or read_json(data / 'config.json') != config
            or metadata.get('seed') != config['seed'] or config['profile'] != 'full'
            or config['trainSentences'] is not None or config['validationSentences'] is not None
            or config['threads'] != 4 or set(metadata.get('splits', {})) != set(COUNTS)
            or any(metadata['splits'][split].get('sentences') != count for split, count in COUNTS.items())):
        raise ValueError('Prepared data must match the unchanged full configuration and exact accepted train/validation splits')
    # The trainer performs the complete corpus/prepared hashes and gate binding before learning.
    for stage in STAGES:
        validate_full_smoke(stage, metadata, OUTPUT / f'{stage}-smoke-20261009/report.json')
    return metadata


def stage_command(stage, data, output):
    return [str(PYTHON), '-m', 'training.cli', 'train', stage, '--data=' + str(data),
            '--out=' + str(output), '--device=cpu',
            '--smoke-receipt=' + str(OUTPUT / f'{stage}-smoke-20261009/report.json')]


def completed_report(stage, output, metadata, prepared_hash):
    report = read_json(output / 'report.json')
    if (report.get('status') != 'completed' or report.get('stage') != stage or report.get('profile') != 'full'
            or report.get('device') != 'cpu' or report.get('manifestSHA256') != metadata['manifestSHA256']
            or report.get('hyperparameters') != metadata['hyperparameters'] or report.get('sentences') != COUNTS
            or report.get('preparedSHA256') != prepared_hash
            or report.get('seed') != metadata['seed'] or report.get('testRead') is not False
            or report.get('artifact') != ('wordlm.sqlite' if stage == 'wordlm' else 'best.pt')
            or report.get('artifactSHA256') != sha256(output / report['artifact'])):
        raise ValueError('Successful process exit lacks a matching completed model/artifact report')
    return report


def run_job(args):
    data, job = safe_output(args.data), safe_output(args.job)
    if job == data or data.is_relative_to(job) or job.is_relative_to(data):
        raise ValueError('Job state must be separate from prepared data')
    job.mkdir(parents=True, exist_ok=False)  # Never overwrite or implicitly resume a prior job.
    state = {'status': 'running', 'phase': 'preparing', 'startedAtUTC': now(), 'data': str(data),
             'supervisorPID': os.getpid(), 'supervisorStartTicks': process_identity(os.getpid())['startTicks'],
             'preparePID': args.prepare_pid, 'prepareStartTicks': str(args.prepare_start_ticks),
             'prepareResource': str(args.prepare_resource), 'trainingStarted': False, 'stages': [],
             'requestedDevice': 'cpu', 'cpuThreads': 4}
    active, child = None, None

    def save():
        write_json(job / 'job.json', state)

    try:
        save()
        config_path = ROOT / 'training/configs/full.json'
        config, config_hash = read_json(config_path), sha256(config_path)
        state['configuration'] = config
        state['configurationSHA256'] = config_hash
        state['semanticSourceSHA256'] = {name: sha256(ROOT / 'training' / name) for name in SEMANTIC_FILES}
        command, binding = adopt_preparation(args.prepare_pid, args.prepare_start_ticks, data, args.prepare_resource)
        active = (args.prepare_pid, args.prepare_start_ticks)
        state['preparationCommand'] = command
        state['preparationIdentity'] = binding
        outputs = {stage: OUTPUT / f'{stage}-full-20261009' for stage in STAGES}
        if any(path.exists() for path in outputs.values()):
            raise ValueError('Full stage output exists; preserve it rather than overwrite or auto-resume')
        while True:
            state.update(disk_guard())
            if args.prepare_resource.exists():
                preparation = preparation_resource(args.prepare_resource, command, binding['earliest'], binding)
                if preparation['status'] == 'completed':
                    state['preparation'] = preparation
                    break
            if not same_process(*active):
                raise ValueError('Preparation process disappeared without a completed success receipt')
            save()
            time.sleep(POLL_SECONDS)
        active = None
        if sha256(config_path) != config_hash:
            raise ValueError('Full configuration changed while preparation was running')
        metadata = validate_data(data, config)
        state['manifestSHA256'] = metadata['manifestSHA256']
        state['preparedSHA256'] = sha256(data / 'prepared.json')
        environment = {**os.environ, 'OMP_NUM_THREADS': '4', 'MKL_NUM_THREADS': '4',
                       'OPENBLAS_NUM_THREADS': '1', 'TMPDIR': '/tmp', 'SQLITE_TMPDIR': '/tmp'}
        for stage in STAGES:
            state.update(disk_guard())
            if sha256(config_path) != config_hash or sha256(data / 'prepared.json') != state['preparedSHA256']:
                raise ValueError('Configuration or prepared manifest changed before a stage could start')
            if any(sha256(ROOT / 'training' / name) != digest for name, digest in state['semanticSourceSHA256'].items()):
                raise ValueError('Training semantic source changed before a stage could start')
            output, command = outputs[stage], stage_command(stage, data, outputs[stage])
            if output.exists():
                raise ValueError('Stage output appeared while waiting; refusing overwrite: ' + str(output))
            state['phase'] = stage
            entry = {'stage': stage, 'status': 'model-running', 'command': command, 'output': str(output),
                     'log': str(job / f'{stage}.log'), 'startedAtUTC': now()}
            state['stages'].append(entry)
            usage_before, started = resource.getrusage(resource.RUSAGE_CHILDREN), time.perf_counter()
            with Path(entry['log']).open('xb') as log:
                child = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                         stdin=subprocess.DEVNULL, env=environment, start_new_session=True)
                identity = process_identity(child.pid)
                if identity is None:
                    raise ValueError('Training process exited before its identity was recorded')
                active = (child.pid, identity['startTicks'])
                entry.update(pid=child.pid, startTicks=identity['startTicks'])
                save()
                while child.poll() is None:
                    state.update(disk_guard())
                    progress = output / 'progress.json'
                    if progress.exists():
                        entry['progress'] = read_json(progress)
                        if entry['progress'].get('optimizerStepsOverall', 0) > 0:
                            entry['status'] = 'learning'
                            state['trainingStarted'] = True
                    save()
                    time.sleep(POLL_SECONDS)
                code = child.wait()
            active, child = None, None
            usage = resource.getrusage(resource.RUSAGE_CHILDREN)
            entry.update(exitCode=code, elapsedSeconds=time.perf_counter() - started, finishedAtUTC=now(),
                         peakRSSKiBCumulativeChildren=usage.ru_maxrss,
                         rssScope='Maximum waited child RSS so far in this supervisor; not per-stage or summed host RAM.',
                         userCPUSeconds=usage.ru_utime - usage_before.ru_utime,
                         systemCPUSeconds=usage.ru_stime - usage_before.ru_stime)
            if code != 0:
                entry['status'] = 'failed'
                raise ValueError(f'{stage} exited {code}; inspect its log/report')
            entry['report'] = completed_report(stage, output, metadata, state['preparedSHA256'])
            entry['status'] = 'completed'
            state['trainingStarted'] = True
            save()
        state.update(status='completed', phase='completed', finishedAtUTC=now())
        save()
        return 0
    except (Exception, KeyboardInterrupt) as error:
        interrupted = isinstance(error, KeyboardInterrupt)
        state.update(status='interrupted' if interrupted else 'failed', error=str(error) or 'Signal interrupted job', finishedAtUTC=now())
        if active:
            try:
                shutdown(active, child)
            except Exception as cleanup_error:
                state['shutdownError'] = str(cleanup_error)
        if state['stages'] and state['stages'][-1]['status'] != 'completed':
            state['stages'][-1]['status'] = state['status']
            state['stages'][-1]['exitCode'] = child.returncode if child is not None else None
        save()
        return 130 if interrupted else 1


def status(job):
    value = read_json(job / 'job.json')
    value['supervisorAlive'] = same_process(value['supervisorPID'], value['supervisorStartTicks'])
    if value['status'] == 'running' and not value['supervisorAlive']:
        value['observedStatus'] = 'supervisor-missing; completion has not been recorded'
    if value['phase'] == 'preparing':
        value['preparationAlive'] = same_process(value['preparePID'], value['prepareStartTicks'])
    for entry in value['stages']:
        progress = Path(entry['output']) / 'progress.json'
        if progress.exists():
            entry['progress'] = read_json(progress)
        entry['processAlive'] = same_process(entry.get('pid', -1), entry.get('startTicks', ''))
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    run = commands.add_parser('run', help='Explicitly adopt preparation and start sequential CPU full training')
    run.add_argument('--data', type=Path, required=True)
    run.add_argument('--prepare-resource', type=Path, required=True)
    run.add_argument('--prepare-pid', type=int, required=True)
    run.add_argument('--prepare-start-ticks', required=True)
    run.add_argument('--job', type=Path, default=OUTPUT / 'full-job-20261009')
    show = commands.add_parser('status', help='Read-only actual job/process/progress snapshot')
    show.add_argument('--job', type=Path, default=OUTPUT / 'full-job-20261009')
    args = parser.parse_args()
    if args.command == 'status':
        print(json.dumps(status(args.job), ensure_ascii=False, indent=2))
        return 0
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    return run_job(args)


if __name__ == '__main__':
    raise SystemExit(main())
