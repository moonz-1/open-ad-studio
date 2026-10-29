#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == '--run' ]] || { echo 'DRY RUN: CPU container import/schema/transport check. No models or cloud resources.'; exit 0; }
source /opt/benchmark-venv/bin/activate
: "${BENCHMARK_PROXY_TOKEN:?Ephemeral CPU proxy token required; never use an account credential}"
cd /opt/benchmark-ComfyUI
comfy_pid='';proxy_pid=''
finish(){ [[ -z "$proxy_pid" ]] || kill "$proxy_pid" 2>/dev/null || true; [[ -z "$comfy_pid" ]] || kill "$comfy_pid" 2>/dev/null || true; }
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Container port publishing MUST be bound to 127.0.0.1 on the free CPU host.
python main.py --cpu --listen 0.0.0.0 --port 28188 --offline --disable-partner-nodes --disable-auto-launch &
comfy_pid=$!
healthy=false
for i in $(seq 1 120); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:28188/system_stats >/dev/null; then healthy=true; break; fi
  kill -0 "$comfy_pid" || exit 1
  sleep 1
done
[[ "$healthy" == true ]] || exit 1
comfy-api-proxy run --comfyui http://127.0.0.1:28188 --host 0.0.0.0 --port 28189 --token "$BENCHMARK_PROXY_TOKEN" &
proxy_pid=$!
echo 'CPU services started. Validate graph schema excluding missing weights, then run synthetic SDK transport. This is not a GPU/model pass.'
wait -n "$comfy_pid" "$proxy_pid"
