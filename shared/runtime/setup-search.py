"""Install Apache-2.0 MiniLM weights and the Studio CPU search node into an existing ComfyUI."""
import argparse
from pathlib import Path
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--comfy-root', required=True)
args = parser.parse_args()
root = Path(args.comfy_root).resolve()
if not (root / 'main.py').is_file():
    raise SystemExit('Choose the ComfyUI folder containing main.py.')
from huggingface_hub import snapshot_download
snapshot_download('sentence-transformers/all-MiniLM-L6-v2', revision='c9745ed1d9f207416be6d2e6f8de32d1f16199bf',
                  allow_patterns=['config.json', 'model.safetensors', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'vocab.txt'],
                  local_dir=str(root / 'models' / 'sentence_transformers' / 'all-MiniLM-L6-v2'))
target = root / 'custom_nodes' / 'osh_semantic'
target.mkdir(parents=True, exist_ok=True)
shutil.copy2(Path(__file__).resolve().parents[1] / 'comfy-nodes' / 'osh_semantic' / '__init__.py', target / '__init__.py')
print('Local search installed. Restart ComfyUI when idle; no inference was run.')
