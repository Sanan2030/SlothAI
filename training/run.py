"""Explicit offline runs; all checkpoints stay outside the application model paths."""
from collections import Counter
import importlib
import json
from pathlib import Path
import platform
import random
import time

from training.common import jsonl, model_card, read_json, safe_output, sha256, verify_prepared, write_json

ARCHITECTURE_KEYS = ['charEmbedding', 'charChannels', 'wordEmbedding', 'taggerHidden', 'maxWordChars',
                     'contextWords', 'maxCandidates', 'prefixLength', 'maxSentenceTokens', 'discount', 'minLMFrequency']


def validate_full_smoke(stage, metadata, path):
    if metadata['profile'] != 'full':
        return
    if path is None:
        raise ValueError('Full training requires --smoke-receipt from a successful 100k–500k run')
    smoke = read_json(path)
    if (smoke.get('status') != 'completed' or smoke.get('profile') != 'smoke' or smoke.get('stage') != stage
            or smoke.get('manifestSHA256') != metadata['manifestSHA256']
            or not 100000 <= smoke.get('sentences', {}).get('train', 0) <= 500000
            or smoke.get('elapsedSeconds', 0) <= 0 or not smoke.get('validation', {}).get('examples', 0)):
        raise ValueError('Smoke receipt is not a successful run of this stage/corpus')
    if any(smoke['hyperparameters'].get(k) != metadata['hyperparameters'][k] for k in ARCHITECTURE_KEYS):
        raise ValueError('Smoke architecture differs from the requested full run')
    if smoke['artifact'] != ('wordlm.sqlite' if stage == 'wordlm' else 'best.pt'):
        raise ValueError('Unexpected smoke artifact name')
    artifact = Path(path).resolve().parent / smoke['artifact']
    if sha256(artifact) != smoke['artifactSHA256']:
        raise ValueError('Smoke model artifact hash mismatch')


def batches(path, batch_size, buffer_size, seed, shuffle, allowed_sources=None):
    rng, buffer, batch = random.Random(seed), [], []
    for row in jsonl(path):
        if allowed_sources is not None and row.get('sourceId') not in allowed_sources:
            raise ValueError('Task row source crosses the selected split: ' + str(path))
        if shuffle:
            buffer.append(row)
            if len(buffer) < buffer_size:
                continue
            at = rng.randrange(len(buffer))
            row = buffer.pop(at)
        batch.append(row)
        if len(batch) == batch_size:
            yield batch
            batch = []
    if shuffle:
        rng.shuffle(buffer)
        for row in buffer:
            batch.append(row)
            if len(batch) == batch_size:
                yield batch
                batch = []
    if batch:
        yield batch


def resume_report(stage, data, output, metadata):
    previous = read_json(output / 'report.json')
    if (previous.get('status') not in ('running', 'interrupted', 'failed') or previous.get('stage') != stage
            or previous.get('hyperparameters') != metadata['hyperparameters']
            or previous.get('preparedSHA256') != sha256(data / 'prepared.json')
            or previous.get('manifestSHA256') != metadata['manifestSHA256']
            or previous.get('lastCheckpointSHA256') != sha256(output / 'last.pt')
            or not previous.get('epochs') or previous.get('selectedEpoch', 0) <= 0
            or previous.get('bestCheckpointSHA256') != sha256(output / 'best.pt')):
        raise ValueError('Resume requires consistent checkpoints/report from this exact dataset/configuration')
    return previous


def validation(model, module, path, config, device, allowed_sources, expected_count):
    import torch
    counters, total = Counter(), 0.0
    model.eval()
    with torch.no_grad():
        for rows in batches(path, config['batchSize'], 0, config['seed'], False, allowed_sources):
            batch = module.collate(rows, config, device)
            logits = model(batch)
            value = module.loss(logits, batch)
            if not torch.isfinite(value):
                raise ValueError('Nonfinite validation loss')
            total += float(value) * len(rows)
            module.measure(logits, batch, counters)
    if not counters['examples']:
        raise ValueError('No usable validation examples')
    if counters['examples'] != expected_count:
        raise ValueError('Validation example count differs from prepared manifest')
    return {**counters, 'meanLoss': total / counters['examples'], **module.summarize(counters)}


def train_model(stage, data, output, requested_device, smoke_path=None, resume=False):
    # All guards execute before importing torch, creating a run or constructing an optimizer.
    data = Path(data).resolve()
    metadata = verify_prepared(data)
    config = metadata['hyperparameters']
    validate_full_smoke(stage, metadata, smoke_path)
    for split in ('train', 'validation'):
        if not metadata['splits'][split].get(stage + 'Rows', 0):
            raise ValueError('No usable prepared rows: ' + stage + '/' + split)
    output = safe_output(output, metadata['corpus'])
    if output.exists() and not resume:
        raise ValueError('Training output exists; preserve it and choose a new run directory')
    if output == data or data.is_relative_to(output):
        raise ValueError('Run output cannot replace its prepared dataset')
    if stage == 'wordlm':
        if resume:
            raise ValueError('WordLM resume is not supported; use a new run directory')
        from training.wordlm import fit
        return fit(data, output, metadata)
    previous = resume_report(stage, data, output, metadata) if resume else None
    try:
        import torch
    except ImportError as error:
        raise ValueError('Install training dependencies with bash training/setup.sh cpu|cuda') from error
    available = torch.cuda.is_available()
    if requested_device == 'cuda' and not available:
        raise ValueError('CUDA requested but no usable GPU is attached; choose cpu or auto')
    device = 'cuda' if available and requested_device != 'cpu' else 'cpu'
    if previous is not None and (previous['device'] != device or previous['torch'] != torch.__version__):
        raise ValueError('Resume requires the same CPU/CUDA runtime and PyTorch version')
    torch.set_num_threads(config['threads'])
    random.seed(config['seed'])
    torch.manual_seed(config['seed'])
    torch.use_deterministic_algorithms(True)
    if device == 'cuda':
        # Official deterministic CUDA GEMM workspace requirement, set before model allocation.
        import os
        os.environ['CUBLAS_WORKSPACE_CONFIG'] = ':4096:8'
        torch.cuda.manual_seed_all(config['seed'])
    module = importlib.import_module('training.' + stage + '.model')
    constructor = module.CharSpell if stage == 'charspell' else module.PunctCase
    model = constructor(config).to(device)
    parameters = sum(p.numel() for p in model.parameters())
    if parameters > 5000000:
        raise ValueError('Model exceeds the 5M parameter budget')
    if not resume:
        output.mkdir(parents=True)
    started = time.perf_counter()
    report = {'schemaVersion': 1, 'status': 'running', 'stage': stage, 'profile': metadata['profile'],
              'split': 'train', 'sentences': {s: metadata['splits'][s]['sentences'] for s in ('train', 'validation')},
              'seed': config['seed'], 'hyperparameters': config, 'manifestSHA256': metadata['manifestSHA256'],
              'preparedSHA256': sha256(data / 'prepared.json'), 'device': device, 'parameters': parameters,
              'dictionarySHA256': metadata['dictionarySHA256'],
              'python': platform.python_version(), 'torch': torch.__version__,
              'validationPurpose': 'Early stopping and model selection only; no threshold calibration.',
              'testRead': False, 'calibrationPerformed': False, 'trainingStarted': True,
              'browserPromotion': 'none', 'epochs': [], 'limitations': metadata['limitations'],
              'realUserQuality': 'not measured', 'browserInt8Parity': 'not measured; required before shadow integration'}
    optimizer = torch.optim.AdamW(model.parameters(), lr=config['learningRate'], weight_decay=config['weightDecay'])
    best, stale, first_epoch, previous_seconds = float('inf'), 0, 0, 0.0
    if previous is not None:
        checkpoint = torch.load(output / 'last.pt', map_location='cpu', weights_only=True)
        if (checkpoint['epoch'] != len(previous['epochs']) or checkpoint['stage'] != stage
                or checkpoint['config'] != config or checkpoint['manifestSHA256'] != metadata['manifestSHA256']):
            raise ValueError('Checkpoint epoch/provenance mismatch')
        model.load_state_dict(checkpoint['state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer'])
        torch.set_rng_state(checkpoint['randomState'])
        if device == 'cuda' and checkpoint.get('cudaRandomStates') is not None:
            torch.cuda.set_rng_state_all(checkpoint['cudaRandomStates'])
        report = previous
        report['status'] = 'running'
        report.setdefault('resumes', []).append({'afterEpoch': checkpoint['epoch'], 'device': device})
        best = report['validation']['meanLoss']
        first_epoch = checkpoint['epoch']
        stale = first_epoch - report['selectedEpoch']
        previous_seconds = report.get('elapsedSeconds', report['epochs'][-1]['elapsedSeconds'])
    write_json(output / 'report.json', report)
    try:
        for epoch in range(first_epoch, config['epochs']):
            epoch_started = time.perf_counter()
            model.train()
            examples, running_loss = 0, 0.0
            for rows in batches(data / f'{stage}-train.jsonl.gz', config['batchSize'], config['shuffleBuffer'],
                                config['seed'] + epoch, True, set(metadata['splits']['train']['sources'])):
                batch = module.collate(rows, config, device)
                optimizer.zero_grad(set_to_none=True)
                logits = model(batch)
                value = module.loss(logits, batch)
                if not torch.isfinite(value):
                    raise ValueError('Nonfinite training loss')
                value.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), config['gradientClip'], error_if_nonfinite=True)
                optimizer.step()
                examples += len(rows)
                running_loss += float(value.detach()) * len(rows)
            if examples != metadata['splits']['train'][stage + 'Rows']:
                raise ValueError('Training example count differs from prepared manifest')
            train_seconds = time.perf_counter() - epoch_started
            validation_started = time.perf_counter()
            measured = validation(model, module, data / f'{stage}-validation.jsonl.gz', config, device,
                                  set(metadata['splits']['validation']['sources']),
                                  metadata['splits']['validation'][stage + 'Rows'])
            entry = {'epoch': epoch + 1, 'trainExamples': examples, 'trainLoss': running_loss / examples,
                     'trainSeconds': train_seconds, 'validationSeconds': time.perf_counter() - validation_started,
                     'validation': measured, 'elapsedSeconds': previous_seconds + time.perf_counter() - started}
            report['epochs'].append(entry)
            checkpoint = {'state_dict': model.state_dict(), 'config': config, 'stage': stage,
                          'manifestSHA256': metadata['manifestSHA256'], 'epoch': epoch + 1}
            temporary = output / 'last.pt.partial'
            torch.save({**checkpoint, 'optimizer': optimizer.state_dict(), 'randomState': torch.get_rng_state(),
                        'cudaRandomStates': torch.cuda.get_rng_state_all() if device == 'cuda' else None}, temporary)
            temporary.replace(output / 'last.pt')
            report['lastCheckpointSHA256'] = sha256(output / 'last.pt')
            if measured['meanLoss'] < best - 1e-6:
                best, stale = measured['meanLoss'], 0
                torch.save(checkpoint, output / 'best.pt.partial')
                (output / 'best.pt.partial').replace(output / 'best.pt')
                report['bestCheckpointSHA256'] = sha256(output / 'best.pt')
                report['validation'] = measured
                report['selectedEpoch'] = epoch + 1
            else:
                stale += 1
            write_json(output / 'report.json', report)
            print(json.dumps(entry), flush=True)
            if stale >= config['patience']:
                break
        elapsed = previous_seconds + time.perf_counter() - started
        report.update(status='completed', elapsedSeconds=elapsed, artifact='best.pt', artifactSHA256=sha256(output / 'best.pt'))
        report['estimatedFullEpochSeconds'] = sum(e['trainSeconds'] * (3287357 / report['sentences']['train'])
                                                  + e['validationSeconds'] * (1082532 / report['sentences']['validation'])
                                                  for e in report['epochs']) / len(report['epochs'])
        report['estimateNote'] = 'Linear extrapolation from this run on this machine, not measured full training time.'
        write_json(output / 'report.json', report)
        write_json(output / 'model-card.json', model_card(report))
        return report
    except BaseException as error:
        report.update(status='interrupted' if isinstance(error, KeyboardInterrupt) else 'failed',
                      error=str(error), elapsedSeconds=previous_seconds + time.perf_counter() - started)
        write_json(output / 'report.json', report)
        raise
