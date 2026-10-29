"""Copy Studio's training I/O nodes; uses installed native ComfyUI training, no dependencies/models downloaded."""
import argparse
from pathlib import Path
import shutil
parser = argparse.ArgumentParser()
parser.add_argument('--comfy-root', required=True)
args = parser.parse_args()
root = Path(args.comfy_root).resolve()
if not (root / 'main.py').is_file():
    raise SystemExit('Choose an existing ComfyUI folder.')
target = root / 'custom_nodes' / 'osh_training'
target.mkdir(parents=True, exist_ok=True)
shutil.copy2(Path(__file__).resolve().parents[1] / 'comfy-nodes' / 'osh_training' / '__init__.py', target / '__init__.py')
print('Training I/O installed. Restart idle ComfyUI. No training has run.')
