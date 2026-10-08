#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-cpu}" in
  cpu) training_wheel_index=https://download.pytorch.org/whl/cpu; training_torch_requirement='torch==2.8.0+cpu' ;;
  cuda) training_wheel_index=https://download.pytorch.org/whl/cu128; training_torch_requirement='torch==2.8.0+cu128' ;;
  *) echo 'Usage: bash training/setup.sh cpu|cuda' >&2; exit 2 ;;
esac
python3 -m venv .venv-training
.venv-training/bin/python -m pip install --cache-dir artifacts/training/.pip-cache \
  --index-url https://pypi.org/simple -r training/requirements-common.txt
.venv-training/bin/python -m pip install --cache-dir artifacts/training/.pip-cache \
  --index-url "$training_wheel_index" -c training/requirements-common.txt "$training_torch_requirement"
.venv-training/bin/python -c 'import torch; print("PyTorch:", torch.__version__, "CUDA available:", torch.cuda.is_available())'
