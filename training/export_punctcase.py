"""Export verified PunctCase weights without quantization or further fitting."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

from training.common import ROOT, read_json, receipt, sha256, write_json


def export(run, output, golden):
    import torch
    from training.charspell.model import CHARACTERS
    from training.punctcase.model import PunctCase, collate
    from training.text import PUNCTUATION, CASES, lower
    run, output = Path(run), Path(output)
    report = read_json(run / 'report.json')
    accepted, manifest = receipt()
    if (report.get('status') != 'completed' or report.get('stage') != 'punctcase'
            or report.get('profile') != 'full' or report.get('testRead') is not False
            or report.get('manifestSHA256') != accepted['manifestSHA256']
            or report.get('sentences') != {split: manifest['splitCounts'][split] for split in ('train', 'validation')}
            or sha256(run / 'best.pt') != report.get('artifactSHA256')):
        raise ValueError('Export requires a completed, hash-matching full PunctCase run')
    checkpoint = torch.load(run / 'best.pt', map_location='cpu', weights_only=True)
    if (checkpoint['epoch'] != report['selectedEpoch'] or checkpoint['config'] != report['hyperparameters']
            or checkpoint['manifestSHA256'] != report['manifestSHA256']):
        raise ValueError('Checkpoint/report configuration mismatch')
    torch.set_num_threads(1)
    model = PunctCase(checkpoint['config']).eval()
    model.load_state_dict(checkpoint['state_dict'], strict=True)
    records, payload = {}, bytearray()
    for name, tensor in model.state_dict().items():
        if not torch.isfinite(tensor).all():
            raise ValueError('Nonfinite checkpoint tensor: ' + name)
        records[name] = {'offset': len(payload) // 4, 'shape': list(tensor.shape)}
        payload.extend(tensor.detach().contiguous().numpy().astype('<f4').tobytes())
    config = {key: checkpoint['config'][key] for key in ('charEmbedding', 'charChannels', 'wordEmbedding',
              'taggerHidden', 'maxWordChars', 'maxSentenceTokens')}
    info = {'format': 'punctcase-f32le-v1', 'parameters': len(payload) // 4, 'bytes': len(payload),
            'sha256': hashlib.sha256(payload).hexdigest(), 'sourceCheckpointSHA256': report['artifactSHA256'],
            'sourceReportSHA256': sha256(run / 'report.json'), 'manifestSHA256': report['manifestSHA256'],
            'selectedEpoch': checkpoint['epoch'], 'config': config, 'characters': CHARACTERS,
            'punctuation': PUNCTUATION, 'cases': CASES, 'tensors': records}
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / 'model-info.json', info)
    write_json(output / 'weights.json', {'data': base64.b64encode(payload).decode('ascii')})
    # Variable-length batched reference catches packed bidirectional GRU and mask mistakes.
    fixtures = [
        ['salam'], ['mən', 'bu', 'gün', 'məktəbə', 'getdim'],
        ['İŞIQ', 'IŞIQ', 'İstanbul', 'şəhər', 'səhər'],
        ['kitab', '', 'Ω', '🙂', '𐐀', 'x' * 45, "foo-bar", "o'neil"],
        ['mən', 'bilirəm', 'ki', 'sən', 'sabah', 'gələcəksən'],
        ['bu', 'məsələni', 'araşdırdıq', 'amma', 'hələ', 'cavab', 'almamışıq'],
        (['salam', 'dünya', 'məktəb', 'İşıq', 'gələcəksən'] * 20)[:96],
    ]
    normalized = [[lower(word) for word in words] for words in fixtures]
    rows = [{'words': words, 'punctuation': [0] * len(words), 'case': [0] * len(words)} for words in normalized]
    with torch.no_grad():
        logits = model(collate(rows, checkpoint['config'], 'cpu'))
    examples = [{'words': source, 'punctuation': logits[0][at, :len(words)].tolist(),
                 'case': logits[1][at, :len(words)].tolist()}
                for at, (source, words) in enumerate(zip(fixtures, normalized))]
    write_json(golden, {'purpose': 'Numerical engineering fixtures, not language-quality evaluation',
                       'sourceCheckpointSHA256': report['artifactSHA256'], 'examples': examples})
    return {**info, 'weightsJSONBytes': (output / 'weights.json').stat().st_size,
            'weightsGzipBytes': len(gzip.compress((output / 'weights.json').read_bytes(), mtime=0)),
            'goldenSHA256': sha256(golden), 'quantization': 'none; exact original float32 weights',
            'trainingStarted': False, 'testRead': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--out', type=Path, default=ROOT / 'lib/editor/punctcase')
    parser.add_argument('--golden-out', type=Path, default=ROOT / 'tests/fixtures/punctcase-golden.json')
    parser.add_argument('--receipt', type=Path, default=ROOT / 'docs/training/punctcase-export-2026-11-04.json')
    args = parser.parse_args()
    result = export(args.run, args.out, args.golden_out)
    write_json(args.receipt, result)
    print(json.dumps({key: result[key] for key in ('parameters', 'bytes', 'sha256', 'weightsGzipBytes', 'quantization')}, indent=2))


if __name__ == '__main__':
    main()
