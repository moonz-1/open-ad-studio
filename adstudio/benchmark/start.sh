#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "--approved" ]] || { echo 'DRY RUN: start isolated Comfy/proxy with watchdog after approval only.'; exit 0; }
package="$(cd "$(dirname "$0")" && pwd)"
: "${BENCHMARK_LEASE:?Private lease JSON required}"
: "${RUNPOD_API_KEY:?Ephemeral termination credential required}"
: "${BENCHMARK_WATCHDOG_READY:?Heartbeat path required}"
finish(){ python3.12 "$package/lifecycle.py" terminate --lease "$BENCHMARK_LEASE" --approved; }
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3.12 "$package/lifecycle.py" watch --lease "$BENCHMARK_LEASE" --ready-file "$BENCHMARK_WATCHDOG_READY" --approved > /workspace/watchdog.log 2>&1 &
watchdog=$!
armed=false
for i in $(seq 1 15); do
  if python3.12 "$package/lifecycle.py" verify-ready --lease "$BENCHMARK_LEASE" --ready-file "$BENCHMARK_WATCHDOG_READY" --approved >/dev/null 2>&1; then armed=true; break; fi
  kill -0 "$watchdog" || exit 1
  sleep 2
done
[[ "$armed" == true ]] || { echo 'Watchdog authentication/readiness unverified; refusing startup.'; exit 1; }
source /workspace/adstudio-benchmark/venv/bin/activate
cd /workspace/adstudio-benchmark/ComfyUI
# No public HTTP ports; SSH tunnel only. Do not start Manager/updaters/API nodes.
env -u RUNPOD_API_KEY -u HF_TOKEN python main.py --listen 127.0.0.1 --port 28188 --disable-api-nodes --disable-auto-launch > /workspace/comfy-benchmark.log 2>&1 &
comfy_pid=$!
healthy=false
for i in $(seq 1 120); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:28188/system_stats > /dev/null; then healthy=true; break; fi
  kill -0 "$comfy_pid" || exit 1
  sleep 1
done
[[ "$healthy" == true ]] || { echo 'Comfy health deadline exceeded'; exit 1; }
env -u RUNPOD_API_KEY -u HF_TOKEN comfy-api-proxy run --comfyui http://127.0.0.1:28188 --host 127.0.0.1 --port 28189 > /workspace/proxy-benchmark.log 2>&1 &
proxy_pid=$!
wait -n "$comfy_pid" "$proxy_pid" "$watchdog"
