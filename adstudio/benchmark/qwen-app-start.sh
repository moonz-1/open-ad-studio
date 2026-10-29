#!/usr/bin/env bash
# No inference or model downloads. Run only after a separately approved lease.
set -Eeuo pipefail
if [[ "${1:-}" != --approved ]]; then
  echo 'DRY RUN: no install, SSH, inference or upload. Requires separate paid approval.'
  exit 0
fi
trap 'touch /workspace/qwen-abort' ERR
cd /workspace/qwen-app
python3 - <<'PY'
import hashlib,json,pathlib,time
root=pathlib.Path.cwd();plan=json.loads((root/'acceptance.json').read_text())
manifest=json.loads((root/'source-manifest.json').read_text())
assert plan['purpose']=='qwen-app-acceptance' and plan['paidApproved'] is True and plan['privateUploadApproved'] is True
assert plan['maxJobs']==1 and plan['maxSpendUSD']==2 and plan['codeCommit']==manifest['commit']
for name,digest in manifest['files'].items():
 p=(root/name).resolve();assert p.is_relative_to(root) and p.is_file()
 assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,name
lease=json.loads(pathlib.Path('/workspace/qwen-lease.json').read_text())
watch=json.loads(pathlib.Path('/workspace/qwen-watchdog.json').read_text())
assert lease['podId']==plan['podId']==watch['podId'] and watch['state']=='armed'
assert 0<=time.time()-watch['checked']<40 and lease['deadline']-time.time()>900
health=json.loads(pathlib.Path('/workspace/qwen/health.json').read_text())
assert health['ready'] is True and health['podId']==lease['podId']
assert health['comfyCommit']=='a40c6ce87ba6358080d85fe4ab339bcb0b2fd020'
pins=json.loads((root/'shared/workflows/hero_qwen2511_contract.json').read_text())
assert len(health['models'])==len(pins['files'])==3
for pin in pins['files']:
 assert any(all(m.get(k)==pin[k] for k in ('file','bytes','sha256')) for m in health['models'])
assert not (root/'outputs/runtime-config.json').exists(),'Refuse stale local runtime configuration'
print('PASS public source hashes, approved exact Pod and fresh independent watchdog')
PY
node_archive=node-v22.20.0-linux-x64.tar.xz
if [[ ! -x node/bin/node ]]; then
  curl --fail --location --proto '=https' --max-time 120 \
    "https://nodejs.org/dist/v22.20.0/$node_archive" -o "$node_archive"
  echo "00bbd05e306ea68b6e13e17360d0e2f680b493ef95f2fea1c4296ff7437530bc  $node_archive" | sha256sum -c -
  mkdir node
  # Retain extractor ownership and honor umask on restricted Pod-local volumes.
  tar --no-same-owner --no-same-permissions -xJf "$node_archive" --strip-components=1 -C node
fi
export PATH="$PWD/node/bin:$PATH"
[[ "$(node --version)" == v22.20.0 ]]
timeout 600 npm ci --ignore-scripts --no-audit --no-fund
export COMFYUI_URL=http://127.0.0.1:28188
export COMFY_BASE_URL=http://127.0.0.1:28189
export COMFYUI_MODELS_DIR=/workspace/qwen/ComfyUI/models
export COMFY_API_PROXY=/workspace/qwen/venv/bin/comfy-api-proxy
export QWEN_APP_REMOTE_SESSION=/workspace/qwen-app/acceptance.json
[[ -x "$COMFY_API_PROXY" ]]
nohup env -u RUNPOD_API_KEY -u QWEN_TERMINATION_KEY -u HF_TOKEN \
  node node_modules/vite/bin/vite.js --config adstudio/benchmark/vite.app-api.config.ts \
  >app-api.log 2>&1 </dev/null &
echo "$!" >app-api.pid
python3 - <<'PY'
import json,pathlib,time,urllib.request
for i in range(60):
 try:
  with urllib.request.urlopen('http://127.0.0.1:28301/api/hero/capabilities',timeout=5) as r: caps=json.load(r)
  assert caps['qwen']['available'],caps['qwen'].get('reason')
  watch=json.loads(pathlib.Path('/workspace/qwen-watchdog.json').read_text())
  assert watch['state']=='armed' and time.time()-watch['checked']<40
  print('PASS existing API ready, Qwen nodes/files present; hashes verified before inference');break
 except Exception:
  if i==59: raise
  time.sleep(2)
PY
