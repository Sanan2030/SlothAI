"""Supervisor-only fixtures: no corpus audit or optimizer is run by these tests."""
from datetime import datetime, timezone
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import Mock, patch

from training.common import ROOT, sha256, write_json
from training import full_job as job


class FullJobTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.output = self.root / 'artifacts/training'
        self.data = self.output / 'full-data'; self.data.mkdir(parents=True)
        self.config = json.loads((ROOT / 'training/configs/full.json').read_text())
        write_json(self.root / 'training/configs/full.json', self.config)
        for name in job.SEMANTIC_FILES:
            path = self.root / 'training' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('Supervisor unit fixture: ' + name)
        self.metadata = {'status': 'prepared', 'profile': 'full', 'manifestSHA256': 'fixture-only',
                         'seed': self.config['seed'], 'hyperparameters': self.config,
                         'splits': {split: {'sentences': count} for split, count in job.COUNTS.items()}}
        write_json(self.data / 'prepared.json', self.metadata)
        write_json(self.data / 'config.json', self.config)
        self.args = SimpleNamespace(data=self.data, job=self.output / 'full-job', prepare_pid=4321,
                                    prepare_start_ticks='1234', prepare_resource=self.output / 'runs/prepare-full-20261009.resource.json')
        self.command = [str(self.root / '.venv-training/bin/python'), '-m', 'training.cli', 'prepare',
                        '--profile=full', '--out=' + str(self.data)]
        write_json(self.args.prepare_resource, {'status': 'completed', 'exitCode': 0, 'command': self.command,
                                               'startedAtUTC': datetime.now(timezone.utc).isoformat(),
                                               'pid': 5678, 'log': str(self.output / 'runs/prepare-full-20261009.log')})
        for name, value in [('ROOT', self.root), ('OUTPUT', self.output),
                            ('PYTHON', self.root / '.venv-training/bin/python')]:
            self.addCleanup(patch.stopall)
            patch.object(job, name, value).start()
        self.receipt = patch.object(job, 'receipt', return_value=({'manifestSHA256': 'fixture-only'}, {})).start()
        self.smoke = patch.object(job, 'validate_full_smoke').start()

    def execute(self, **changes):
        resource = json.loads(self.args.prepare_resource.read_text()) if self.args.prepare_resource.exists() else {}
        binding = {key: resource.get(key) for key in ('pid', 'startedAtUTC', 'log')}
        binding['earliest'] = 0
        defaults = {'adopt_preparation': (self.command, binding), 'same_process': True,
                    'disk_guard': {'workspaceFreeGiB': 8, 'tmpFreeGiB': 8},
                    'process_identity': {'startTicks': '1234', 'groupPID': 4321}, 'shutdown': None}
        mocks = {}
        for name, value in {**defaults, **changes}.items():
            mock = Mock(side_effect=value) if isinstance(value, Exception) else Mock(return_value=value)
            mocks[name] = mock
        with patch.multiple(job, **mocks), patch.object(job.time, 'sleep'):
            code = job.run_job(self.args)
        return code, mocks

    def test_failed_preparation_never_launches_a_trainer(self):
        resource = json.loads(self.args.prepare_resource.read_text())
        resource.update(status='failed', exitCode=2)
        write_json(self.args.prepare_resource, resource)
        with patch.object(job.subprocess, 'Popen') as launch:
            code, _ = self.execute()
        self.assertEqual(code, 1)
        launch.assert_not_called()
        state = json.loads((self.args.job / 'job.json').read_text())
        self.assertEqual(state['status'], 'failed')
        self.assertFalse(state['trainingStarted'])

    def test_stale_or_different_preparation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'stale'):
            job.preparation_resource(self.args.prepare_resource, self.command, 9999999999)
        with self.assertRaisesRegex(ValueError, 'command'):
            job.preparation_resource(self.args.prepare_resource, ['wrong-command'], 0)
        resource = json.loads(self.args.prepare_resource.read_text())
        binding = {key: resource[key] for key in ('pid', 'startedAtUTC', 'log')}
        binding['pid'] += 1
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            job.preparation_resource(self.args.prepare_resource, self.command, 0, binding)

    def test_missing_preparation_process_does_not_start_training(self):
        self.args.prepare_resource.unlink()
        with patch.object(job.subprocess, 'Popen') as launch:
            code, _ = self.execute(same_process=False)
        self.assertEqual(code, 1)
        launch.assert_not_called()

    def test_full_split_configuration_and_manifest_must_match(self):
        self.assertEqual(job.validate_data(self.data, self.config), self.metadata)
        self.assertEqual([call.args[0] for call in self.smoke.call_args_list], list(job.STAGES))
        for field, value in [('profile', 'smoke'), ('manifestSHA256', 'wrong')]:
            bad = {**self.metadata, field: value}
            write_json(self.data / 'prepared.json', bad)
            with self.assertRaisesRegex(ValueError, 'exact accepted'):
                job.validate_data(self.data, self.config)
        bad = {**self.metadata, 'splits': {'train': {'sentences': 100000},
                                         'validation': {'sentences': 10000}}}
        write_json(self.data / 'prepared.json', bad)
        with self.assertRaisesRegex(ValueError, 'exact accepted'):
            job.validate_data(self.data, self.config)
        write_json(self.data / 'prepared.json', self.metadata)
        write_json(self.data / 'config.json', {**self.config, 'seed': 1})
        with self.assertRaisesRegex(ValueError, 'configuration'):
            job.validate_data(self.data, self.config)

    def test_disk_reserve_stops_adopted_group_before_any_learning(self):
        with patch.object(job.subprocess, 'Popen') as launch:
            code, mocks = self.execute(disk_guard=ValueError('Disk reserve exhausted'))
        self.assertEqual(code, 1)
        launch.assert_not_called()
        mocks['shutdown'].assert_called_once_with((4321, '1234'), None)
        self.assertFalse(json.loads((self.args.job / 'job.json').read_text())['trainingStarted'])
        with patch.object(job.shutil, 'disk_usage', return_value=SimpleNamespace(free=2**29)):
            with self.assertRaisesRegex(ValueError, 'Disk reserve'):
                job.disk_guard()

    def test_stage_order_matching_smoke_receipts_and_actual_completion(self):
        commands = []

        def launch(command, **kwargs):
            commands.append(command)
            stage = command[4]
            output = Path(next(value.split('=', 1)[1] for value in command if value.startswith('--out=')))
            output.mkdir()
            artifact = 'wordlm.sqlite' if stage == 'wordlm' else 'best.pt'
            (output / artifact).write_bytes(b'unit fixture only')
            write_json(output / 'report.json', {'status': 'completed', 'stage': stage, 'profile': 'full',
                'device': 'cpu', 'manifestSHA256': 'fixture-only', 'hyperparameters': self.config,
                'seed': self.config['seed'], 'testRead': False,
                'sentences': job.COUNTS, 'preparedSHA256': sha256(self.data / 'prepared.json'),
                'artifact': artifact, 'artifactSHA256': sha256(output / artifact)})
            if stage != 'wordlm':
                write_json(output / 'progress.json', {'optimizerStepsOverall': 1})
            process = Mock(pid=5678, returncode=0)
            process.poll.side_effect = [None, 0]
            process.wait.return_value = 0
            return process

        with patch.object(job.subprocess, 'Popen', side_effect=launch):
            code, _ = self.execute()
        self.assertEqual(code, 0)
        self.assertEqual([command[4] for command in commands], list(job.STAGES))
        for stage, command in zip(job.STAGES, commands):
            self.assertIn('--device=cpu', command)
            self.assertIn('--smoke-receipt=' + str(self.output / f'{stage}-smoke-20261009/report.json'), command)
        state = json.loads((self.args.job / 'job.json').read_text())
        self.assertEqual(state['status'], 'completed')
        self.assertTrue(state['trainingStarted'])
        self.assertTrue(all(entry['status'] == 'completed' for entry in state['stages']))
        self.assertEqual(list(self.args.job.glob('*.partial')), [])
        with self.assertRaises(FileExistsError):
            job.run_job(self.args)

    def test_existing_stage_output_is_preserved_and_status_is_read_only(self):
        (self.output / 'wordlm-full-20261009').mkdir()
        with patch.object(job.subprocess, 'Popen') as launch:
            code, _ = self.execute()
        self.assertEqual(code, 1)
        launch.assert_not_called()
        path = self.args.job / 'job.json'
        before = path.read_bytes()
        with patch.object(job, 'same_process', return_value=False):
            state = job.status(self.args.job)
        self.assertFalse(state['supervisorAlive'])
        self.assertEqual(before, path.read_bytes())

    def test_semantic_source_change_before_a_stage_stops_learning(self):
        def mutate_before_validation(data, config):
            (self.root / 'training/run.py').write_text('Changed fixture source')
            return self.metadata
        with patch.object(job, 'validate_data', side_effect=mutate_before_validation), \
                patch.object(job.subprocess, 'Popen') as launch:
            code, _ = self.execute()
        self.assertEqual(code, 1)
        launch.assert_not_called()
        state = json.loads((self.args.job / 'job.json').read_text())
        self.assertIn('semantic source changed', state['error'])
        self.assertFalse(state['trainingStarted'])

    def test_shutdown_is_bounded_and_rechecks_group_before_escalation(self):
        process = Mock()
        process.wait.side_effect = [job.subprocess.TimeoutExpired('fixture', 30),
                                   job.subprocess.TimeoutExpired('fixture', 30), 0]
        with patch.object(job, 'stop_group') as stop:
            job.shutdown((4321, '1234'), process)
        self.assertEqual([call.args[2] for call in stop.call_args_list],
                         [job.signal.SIGINT, job.signal.SIGTERM, job.signal.SIGKILL])
        self.assertEqual([call.kwargs['timeout'] for call in process.wait.call_args_list], [30, 30, 5])
        with patch.object(job, 'process_identity', return_value={'startTicks': 'different', 'groupPID': 4321}), \
                patch.object(job.os, 'killpg') as kill:
            job.stop_group(4321, '1234', job.signal.SIGKILL)
        kill.assert_not_called()


if __name__ == '__main__':
    unittest.main()
