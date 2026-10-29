#!/usr/bin/env bash
# No account credentials or product photos in this setup package.
set -euo pipefail
trap 'touch /workspace/qwen-abort' ERR
root=/workspace/qwen
package=$root/package
python3.12 "$package/qwen-preflight.py"
[[ ! -e "$root/ComfyUI" ]] || { echo 'Existing setup; refuse overwrite'; exit 1; }
git init "$root/ComfyUI"
git -C "$root/ComfyUI" remote add origin https://github.com/Comfy-Org/ComfyUI.git
timeout 120 git -C "$root/ComfyUI" fetch --depth 1 origin a40c6ce87ba6358080d85fe4ab339bcb0b2fd020
git -C "$root/ComfyUI" checkout --detach FETCH_HEAD
python3.12 -m venv --system-site-packages "$root/venv"
source "$root/venv/bin/activate"
PIP_CONSTRAINT= timeout 900 python -m pip install --require-hashes --only-binary=:all: --timeout 30 --retries 1 -r "$package/requirements.lock"
python -m pip check
python "$package/qwen-download.py"
cd "$root/ComfyUI"
nohup env -u RUNPOD_API_KEY -u QWEN_TERMINATION_KEY -u HF_TOKEN python main.py --listen 127.0.0.1 --port 28188 --offline --disable-all-custom-nodes --disable-partner-nodes --disable-auto-launch > "$root/comfy.log" 2>&1 < /dev/null &
for i in $(seq 1 120); do
 if curl --silent --fail --max-time 2 http://127.0.0.1:28188/system_stats >/dev/null; then break; fi
 sleep 1
done
curl --silent --fail http://127.0.0.1:28188/system_stats > "$root/system-stats.json"
nohup env -u RUNPOD_API_KEY -u QWEN_TERMINATION_KEY -u HF_TOKEN comfy-api-proxy run --comfyui http://127.0.0.1:28188 --host 127.0.0.1 --port 28189 > "$root/proxy.log" 2>&1 < /dev/null &
for i in $(seq 1 30); do
 if curl --silent --fail --max-time 2 http://127.0.0.1:28189/api/v2/health >/dev/null; then break; fi
 sleep 1
done
curl --silent --fail http://127.0.0.1:28189/api/v2/health > "$root/proxy-health.json"
python - <<'PY'
import json,time,pathlib,subprocess
r=pathlib.Path('/workspace/qwen');p=json.load(open('/workspace/qwen-lease.json'));w=json.load(open('/workspace/qwen-watchdog.json'))
assert w['podId']==p['podId'] and time.time()-w['checked']<40
json.dump({'ready':True,'podId':p['podId'],'checked':time.time(),'models':json.load(open(r/'model-hashes.json')),'stats':json.load(open(r/'system-stats.json')),'comfyCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()},open(r/'health.json','w'),indent=2)
print('QWEN REMOTE READY; no inference submitted',flush=True)
PY
