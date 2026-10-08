"""Explicit commands: status/import/verify/prepare never start model training."""
import argparse
import json
from pathlib import Path
import sys

from training.common import CORPUS, OUTPUT, ROOT, import_parts, inspect_corpus, read_json, run_gate, safe_output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    status = commands.add_parser('status', help='Read-only readiness report (no full corpus audit)')
    status.add_argument('--corpus', type=Path, default=CORPUS)
    unpack = commands.add_parser('import', help='Verify and decompress the six original gzip parts')
    unpack.add_argument('--parts', type=Path, required=True)
    unpack.add_argument('--corpus', type=Path, default=CORPUS)
    verify = commands.add_parser('verify', help='Verify all hashes and rerun the original full data gate')
    verify.add_argument('--corpus', type=Path, default=CORPUS)
    verify.add_argument('--out', type=Path, default=OUTPUT / 'verification')
    prep = commands.add_parser('prepare', help='Prepare task datasets and index; no training')
    prep.add_argument('--corpus', type=Path, default=CORPUS)
    prep.add_argument('--profile', choices=['smoke', 'full'], default='smoke')
    prep.add_argument('--out', type=Path, required=True)
    train = commands.add_parser('train', help='Explicit experimental training; never publishes a model')
    train.add_argument('stage', choices=['charspell', 'wordlm', 'punctcase'])
    train.add_argument('--data', type=Path, required=True)
    train.add_argument('--out', type=Path, required=True)
    train.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    train.add_argument('--smoke-receipt', type=Path, help='Successful measured smoke report, required for full')
    train.add_argument('--resume', action='store_true', help='Resume a neural run from its last completed epoch')
    args = parser.parse_args()
    try:
        if args.command == 'status':
            result = inspect_corpus(args.corpus)
        elif args.command == 'import':
            result = import_parts(args.parts, args.corpus)
        elif args.command == 'verify':
            result = run_gate(args.corpus, safe_output(args.out, args.corpus))
        elif args.command == 'prepare':
            from training.prepare import prepare
            result = prepare(args.corpus, args.out, read_json(ROOT / f'training/configs/{args.profile}.json'))
        else:
            from training.run import train_model
            result = train_model(args.stage, args.data, args.out, args.device, args.smoke_receipt, args.resume)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if result.get('status') == 'blocked' else 0
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        # A train failure may occur after optimizer steps; report.json is authoritative.
        print(json.dumps({'status': 'blocked', 'error': str(error),
                          'trainingStarted': False if args.command != 'train' else 'see run report; may not have started'},
                         ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
