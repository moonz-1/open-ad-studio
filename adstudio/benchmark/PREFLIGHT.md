# Final no-spend preflight — 2026-10-22

**Deployment: NO-GO today. CPU preflight and authenticated model-file HEAD access: PASS.** A live quote and explicit deployment/private-transfer approval are still required. No Pod, billing, heavyweight model download or product-photo upload occurred. GitHub reports PR #2 was externally merged as `c7d02b7` at22:52UTC; this agent did not merge it. PR #3 is the draft follow-up. Browser acceptance remains NOT RUN.

## Findings and changes

| Check | Evidence / disposition |
|---|---|
| Exact image | **PASS actual pull/build/run:** Linux/amd64 pinned `7ed657…` base, Python3.12.3, torch2.10.0+cu128, fresh Comfy0.42.0 checkout. Built CPU overlay is19.2GB; no model weights. Docker29.9.2/Desktop4.96.3,20CPUs/15.5GiB VM; test limited to8CPUs/10GiB. About598GiB host disk was free before the pull. |
| Old prebuilt Comfy | Image build source bakes0.30.0; LTX node1.1.0 declares>=0.35.0. Keep the fresh pinned Comfy checkout and isolated28188/28189 endpoints. Do not use the old default8188 service or Manager auto-update. |
| Dependencies | **PASS actual hash-lock install, pip check and imports**, including ComfyUI-LTXVideo (0.7s startup import), torch/transformers/diffusers/OpenImageIO/colour. No pin changes needed. OpenImageIO/nanobind emits reference-leak warnings on interpreter shutdown with exit0; HDR/EXR behavior is not tested. |
| CUDA/RAM | Candidate remains Python3.12 / CUDA12.8 / torch2.10.0+cu128 / one A10080GB,>=110GB RAM (health>=100GiB). Pinned Comfy `comfy/quant_ops.py` disables the optimized comfy-kitchen CUDA backend below cu130; eager fallback remains. CPU PASS does **not** validate A100 kernels, memory fit or speed. After approval, run a brief software/GPU sanity check before weights; do not spend the lease upgrading CUDA/debugging a new environment. This RAM headroom is not a measured model requirement. |
| Model access | **PASS authenticated HEAD, HTTP200 and exact expected size for all five pinned files** at revision49b093a39c19169a8a81721dcc541e07e945232f: transformer, upscaler, projected Gemma encoder, audio VAE and video VAE. Token loaded privately; no credentials printed/committed. Log: `outputs/cpu-preflight-20261022/hf-head-configured.log`. HEAD preserved across redirects; no model body downloaded. This verifies access/size, not full-file hashes or runtime compatibility. Optional prompt enhancer/API encoding are absent. |
| Watchdog readiness | Previously a live process could be unauthenticated. Now startup/setup/download/render require matching authenticated heartbeat evidence; stale/mismatched proof blocks work. The watchdog rechecks identity/rate and refreshes proof only on success. Financial lease validation also remains active under Python optimization. |
| Failure cost | Source fetches and pip waits are bounded; setup/weight failure triggers verified termination. Download checks heartbeat/deadline per block and enforces45-minute bootstrap limit. Complete verified `.part` files are promoted without an invalid end-of-file Range request; mismatched ranges cannot append. Startup health failure terminates instead of proceeding. |
| Before upload | SDK runner requires the external heartbeat and remote health/weight-hash report tied to the same Pod/deadline/pins. It rechecks immediately before lazy upload; keeps four-attempt ledger and bounded render/download waits. Missing evidence stops before private transfer. |
| SDK MP4 transport | **PASS inside the pinned CPU environment**, SDK0.5.0 → authenticated proxy0.1.6 → RepeatImageBatch/CreateVideo/SaveVideo → downloaded96×128 H.264 MP4,73frames/24FPS. No model nodes. All34 benchmark node instances validate against the container schema with absent-weight choices excluded; the LTX graph was not queued. Evidence: private `outputs/cpu-preflight-20261022/run-*/` and `outputs/benchmark-preflight-20261022/transport-*/result.json`. |
| Reproduced compatibility failure | Initial Comfy/custom-node import succeeded, then proxy refused0.0.0.0 without `--token` (exit2). Fixed with cryptographically random, ephemeral **local test** token; SDK gets the same token without logging it. After logs/shutdown evidence, the container is removed to discard Docker's token metadata. Host publishing stays127.0.0.1. Current `--offline --disable-partner-nodes` replaces deprecated `--disable-api-nodes` in CPU startup. Production/remote loopback proxy behavior is unchanged. |
| Clock/config | Documented Runpod API1 does not promise `createdAt`; lease starts from a saved local timestamp immediately before the approved create request. No clock reset after restart. Shell credentials/lease variables must be exported in each SSH session. Public package transfer now uses tracked-only `git archive`, excluding ignored credentials/cache/private files. |

Public sources rechecked: [image build pins](https://github.com/runpod-workers/comfyui-base/blob/33dfcd67fd5dfa666bc339aae4b92cf25d292a8b/docker-bake.hcl), [LTX node requirement](https://github.com/Lightricks/ComfyUI-LTXVideo/blob/220e1d45aa0469f518e982102fca4dca92a61862/pyproject.toml), [model access/conditions](https://huggingface.co/Lightricks/LTX-2.5), [Pod API fields](https://docs.runpod.io/api-reference/pods/GET/pods/podId). Small public metadata/HEAD checks only; no Runpod account API was called.

## What is needed from you

| You control | Needed action / information | What can be automated afterward |
|---|---|---|
| Runpod account | Confirm available research credits and any funding/tax/fees. Obtain a current **unsubmitted** quote for one on-demand Secure A100 SXM80GB, >=110GB RAM/8vCPU,30GB container+200GB Pod volume, no network/global volume. Provide region, rate, storage charge and quote time/screenshot; do not click Deploy or top up on my behalf. | Validate request/quote arithmetic, save pre-request timestamp, prepare lease and exact commands. Actual create remains approval-gated. |
| Hugging Face account | **Complete:** terms accepted and privately configured token successfully passed all five pinned HEAD checks. Keep the token private; no additional account action is needed for this gate. [Token instructions](https://huggingface.co/docs/hub/en/security-tokens). | `access.py --check-head` can repeat access/size checks before an approved deployment without downloading weights. Weight download remains separately gated. |
| Runpod credentials | Privately configure an ephemeral key with Pod read/terminate permissions, plus billing/volume read access (separate read-only credential where supported). Confirm permission scopes; a successful GET alone does not prove DELETE permission. | Watchdogs, named-resource checks, deadline/rate enforcement, DELETE/404 verification and independent billing audit. Keys are never logged or baked into images; revoke after deletion. |
| SSH access | Select your existing SSH public key, retain its private key locally, and later verify the provider's host fingerprint/Connect details. Never send a private key in chat. | Tracked source archive transfer, SSH tunnels and log/report collection using the approved connection. No product photos are included in the archive. |
| Monitoring | Free CPU host/test is complete. Still confirm an always-awake external watchdog host and your2h45m manual console fallback during the later paid session. | Local/remote heartbeat checks and artifact collection. No new cloud/CI runner is provisioned. |
| Final approval | After the above evidence and quote: explicitly approve **one <=3h session, <=$6 initial total, $10 research total**, download of the pinned model bundle, and transfer of only the two selected prepared guides: original cookie and **printed-label surrogate**. Input selection was already approved; this still does not authorize transfer or deployment. | Execute the reviewed setup/health/SDK render/collection/termination sequence. No further model/prompt sweep, automatic second session, spending of the reserve, production promotion or merge. |

Do not paste any token, private key or full credential-bearing Pod response into chat. Public SSH key, redacted quote and the explicit scope decision suffice here; secrets belong in private environment/local storage. Verify both Runpod credentials belong to the same account/organization as the quote and record an initial positive Pod identity/owner check: a404 or empty billing list under a wrong account is not proof of deletion/zero spend. Synchronize host clocks before creating the lease. A genuine branded-product photograph is **not required for this initial surrogate experiment**; actual brand-logo fidelity will remain untested.

## Free CPU check before spending

`Dockerfile.preflight` uses the same pinned image, commits and hash lock. Its whitelisted context contains no photos, secrets or model files. Actual local CPU tests **PASS**. It installs only software dependencies and starts Comfy with `--cpu`; no GPU requests/model download. Repeat only on a free existing host. Existing host Node/npm installation and FFmpeg/ffprobe are needed for the SDK transport smoke.

```sh
docker build --platform linux/amd64 -f adstudio/benchmark/Dockerfile.preflight -t adstudio-ltx25-cpu-check adstudio/benchmark
node adstudio/benchmark/cpu-preflight.mjs --run-local
```

The harness generates a disposable local token, starts a bounded8CPU/10GiB container with HF offline mode and loopback-only publishing, validates CPU/schema/pip, tests actual SDK MP4 transport, captures logs and verifies container shutdown/removal. It refuses already occupied ports and uses `--pull never`; it cannot provision cloud resources. Images and diagnostic logs remain cached locally; only its own test container is removed. If Docker is absent from an older Windows process's PATH, set only its executable path:
```powershell
$env:DOCKER_BINARY="$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
node adstudio/benchmark/cpu-preflight.mjs --run-local
```

Node22.14 actually passed, though the repository declares>=22.18. Final successful logs: `outputs/cpu-preflight-20261022/build-{1,2}.log`, `run-1792711443013/{runtime.log,pip-check.txt,object-info.json,system-stats.json,container.json,stopped.json,result.json}`. Transport output: `outputs/benchmark-preflight-20261022/transport-1792711455660/`. Initial failure is retained in `runtime-2.log`; earlier successful runs remain alongside the final run. This is CPU software/schema/transport acceptance, not LTX video-quality or GPU acceptance. No product photos were provided to any container.

## Cost and remaining risks

Published reference:3h×$1.79=$5.37 compute;230GB running/container storage at$.10/GB/month adds about$.0945 using730h/month, **~$5.47 before tax**, not a live quote. Initial all-in ceiling$6; reserve at least$4 of the$10 total. Tax/top-up fees and exact provider month divisor must be verified from the account/quote; do not silently spend beyond either ceiling. [Pricing](https://www.runpod.io/pricing), [per-second billing](https://docs.runpod.io/pods/pricing), [storage lifecycle](https://docs.runpod.io/pods/storage/types).

Remaining risks: A100 stock/actual download throughput, cold image initialization, native-resolution model OOM/latency, software/GPU compatibility beyond CPU imports, and provider control-plane/billing delay. A1Gbps host filter is not a sustained HF download guarantee. If readiness is not achieved by45minutes, terminate and report; leave at least30minutes before starting a new render. Ten dollars does not guarantee a useful model result.

No provider-enforced TTL was verified. Independent watchdogs begin DELETE five minutes before the three-hour boundary and retry until404; provider/API failure can defeat any client-side monetary guarantee. An always-awake independent host, verified credentials and manual console fallback remain required. A stopped Pod still bills storage: terminate and independently reconcile the bill; no retained paid volume or automatic top-up.

## Tests performed in this task

PASS: authenticated HF HEAD/status/size for all five pins; actual pinned CPU image build/imports/pip-check,34-node schema, authenticated SDK/SaveVideo MP4 and verified local shutdown; default no-action paths; financial/lease/fresh-heartbeat guards; six lifecycle/four download tests; Node/Python/Git Bash syntax; both-app domain suites/typecheck/build and CPU silent/audio edit/export/product/source-preservation checks. Camera correction and its private evidence are in `../CAMERA_MOTION.md`; production generation workflows/models remain unchanged. A100 generation/quality, downloaded-file SHA verification, real Runpod deletion and settled billing remain NOT RUN.

Full paid-operation commands and exact model pins remain in [README.md](README.md). This report adds prerequisites; it grants no approval to execute them.

Latest read-only account/SXM quote and exact blockers: [DEPLOYMENT_GATE.md](DEPLOYMENT_GATE.md). Catalog price verified; full host/all-in offer and access/watchdog gates remain NO-GO.

Scope correction: browser/Camera/project acceptance gates production acceptance and PR3 merge only; no browser UI is a technical dependency of the isolated SDK feasibility run. Current practical procedures, v2 lifecycle reconciliation and zero-cost rehearsals: [ACCESS_RUNBOOK.md](ACCESS_RUNBOOK.md). Maximum2.5h/$6 all-in, not3h.
