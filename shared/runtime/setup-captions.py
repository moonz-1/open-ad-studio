"""Run with ComfyUI's Python: setup-captions.py --comfy-root /path/to/ComfyUI.
Explicit setup only; inference never downloads packages or models.
"""
import argparse
import pathlib
import shutil
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--comfy-root', required=True)
parser.add_argument('--model', choices=['tiny', 'base', 'small', 'medium', 'large-v3'], default='tiny')
parser.add_argument('--skip-deps', action='store_true')
args = parser.parse_args()
root = pathlib.Path(args.comfy_root).resolve()
if not (root / 'main.py').is_file():
    raise SystemExit('Choose the ComfyUI folder containing main.py.')
if not args.skip_deps:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(pathlib.Path(__file__).with_name('requirements-captions.txt'))], check=True)
from huggingface_hub import snapshot_download
model = root / 'models' / 'whisper' / ('faster-whisper-' + args.model)
print(f'Downloading Whisper {args.model}. This is model setup, not transcription.', flush=True)
snapshot_download('Systran/faster-whisper-' + args.model, revision='d90ca5fe260221311c53c58e660288d3deb8d356' if args.model == 'tiny' else 'main',
                  allow_patterns=['config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt'], local_dir=str(model))
source = pathlib.Path(__file__).resolve().parents[1] / 'comfy-nodes' / 'osh_captions'
target = root / 'custom_nodes' / 'osh_captions'
target.mkdir(parents=True, exist_ok=True)
shutil.copy2(source / '__init__.py', target / '__init__.py')
print('Captions installed. Restart ComfyUI when idle, then refresh the Captions window.', flush=True)
