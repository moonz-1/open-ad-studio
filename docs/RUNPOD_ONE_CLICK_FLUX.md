# One-click FLUX.3 orchestration — final RC

**Integrated from Cursor `b173969`; hardened in the RC. No billable infrastructure changes or new live FLUX inference were performed.** Local rollback: `rollback/pre-one-click-flux-20261029` (`9228d2b`). Genuine accepted local Qwen planning is preserved. Current application: http://127.0.0.1:8341/adstudio/journey.html; exact compiled revision is `/api/release`.

## Actual status

The real Journey action calls `/api/hero/scene` with `engine:flux3`, after fresh source-bound review. That route validates `creative-brief-v2`, actual source bytes, measured identity, spatial caption, prompt hash and Creative Restage eligibility **before** provisioning. Product-locked/high-fidelity plans remain blocked. The controller then probes FLUX-specific readiness, plans a private GPU lease, and either stops honestly in dry-run or provisions only with server authorization. Generation remains Comfy SDK → matching local proxy → SSH-forwarded ComfyUI. Both input references are the current reviewed source, checked against native execution. Inspection and Graphic Art Director run after the returned photograph; failing identity/framing cannot be cleared by typography.

Read-only RunPod inventory on October 29: **zero Pods and zero network volumes** in the connected account. Existing cloud weights are therefore **not confirmed persistent**. The tracked generic Comfy image digest is a base-image reference, not proof it contains FLUX weights. Three FLUX-specific files are missing locally; the 10 GB GPU is below the 18 GiB BF16 admission floor. The app must not pick this Qwen-capable server as a FLUX backend merely because HTTP is healthy.

## Prepared worker prerequisites (one-time operator setup)

Provide a private, digest-pinned image that already contains the accepted licensed weights, or a separately authorized existing volume in a compatible data center. This sprint creates neither and downloads no weights. No automatic downloader is hidden in Generate. Preparing a large image/volume is still an owner/deployment prerequisite; it cannot honestly be called completed here.

Required configuration on the server only:

| Variable | Required value / purpose |
|---|---|
| `RUNPOD_API_KEY` | Valid account key, never browser code or committed files |
| `ADSTUDIO_FLUX3_WORKER_IMAGE` | Approved `registry/name@sha256:<digest>` containing compatible runtime and model files |
| `ADSTUDIO_FLUX3_WORKER_MODELS_DIR` | Absolute worker models path, e.g. `/opt/ComfyUI/models`; no `..` |
| `ADSTUDIO_FLUX3_WORKER_ARGS_JSON` | JSON exec-form CMD for that image's startup, e.g. `["/start-private-flux"]`; not a universal executable supplied by this repo |
| `ADSTUDIO_RUNPOD_SSH_KEY` | Existing private key with adjacent `.pub`; worker/account must accept it |
| `ADSTUDIO_FLUX3_NETWORK_VOLUME_ID` | Optional existing model volume; placement is checked, never created |
| `ADSTUDIO_FLUX3_CLOUD_SOURCE_SHA256` | Exact approved normalized source hash, or comma-separated approved hashes; required before cloud provisioning/upload |

The prepared entrypoint must start SSH and ComfyUI **on loopback port 3001**, with a compatible CUDA/PyTorch stack and ComfyUI >=0.41.0. Only `22/tcp` is exposed. Native model paths, exact byte sizes and available digest pins are checked over SSH; the private listener, native node choices, idle queue, >=18 GiB reclaimable VRAM and >=12 GiB free RAM must all pass. Null model digests remain an explicit cryptographic limitation. Actual model loading is unverified until native inference executes.

Required files (see [workflow contract](../shared/workflows/flux3_klein_bf16_mi2i_contract.json)): BF16 Klein DiT, Qwen3-VL encoder, prompt upsampler and FLUX VAE, about 27 GB. Licenses remain component-specific; configure only after accepting applicable terms. `ADSTUDIO_FLUX3_REMOTE_WEIGHTS=1` skips local filesystem checks; it does not prove remote files exist. SSH uses a session-specific known-hosts file and accept-new trust on first use; subsequent changed host keys are rejected.

`ADSTUDIO_FLUX3_SKIP_PUP=1` is an explicit compatibility bypass for affected TextGenerate/Flash Attention stacks. It encodes the reviewed caption directly, **not the full intended upsampler workflow**. Neither mode has fresh live RC visual acceptance.

## Nonbillable acceptance

```powershell
npm run test:runpod
node --experimental-transform-types adstudio/scripts/runpod-flux-lifecycle.mjs
```

The CLI and `POST /api/hero/flux3/runpod/dry-run` force live flags off even when the server is live-armed. `GET /api/hero/flux3/runpod` only plans/reads. To exercise the actual Generate action nonbillably, configure server flags `ADSTUDIO_FLUX3_INFERENCE=1`, `ADSTUDIO_FLUX3_AUTOPROVISION=1`, `ADSTUDIO_FLUX3_DRY_RUN=1`, while keeping both live/spend flags **0**. The selector says dry-run, never model-ready. An eligible reviewed Creative Restage request reaches the controller, saves its plan and returns 503 explicitly stating that no GPU/image was created. Source/hash/geometry rejection remains earlier than orchestration. Original-photo design is still available by explicit selection; no silent substitution occurs.

## Cost and lifecycle controls

- Both `ADSTUDIO_RUNPOD_LIVE=1` **and** `ADSTUDIO_FLUX3_SPEND_APPROVED=1`, plus auto-provision and inference flags, are required for a new lease. `ADSTUDIO_FLUX3_DRY_RUN=1` overrides them. HTTP bodies cannot arm flags.
- Protected reserve **at least $2.96**; maximum individual/job and cumulative session reservation **$0.50 each**. The default A40 quote is pinned at $0.59/hour plus $0.02/hour storage bound. A 2,400-second maximum lease estimates **$0.4067**; no higher quote is silently accepted. These are admission/lease bounds, not a provider-enforced dollar guarantee; teardown/network delays can still cause billing overrun.
- A verified finite account balance/current spend, enough balance above the reserve for the full $0.50 ceiling, and disabled auto-pay are required. Balance hints are **dry-run estimates only**. Other ongoing account spend blocks admission. The conservative `spend-ledger.json` reserves the full authorized ceiling and is not automatically refunded, preventing repeated requests against delayed billing. Owner must review actual billing before archiving it for a newly authorized session.
- Atomic exclusive intent blocks concurrent creates. Exact name, random ownership token and returned Pod ID are persisted before use; no arbitrary prefix-matched Pod is adopted or deleted. Ambiguous create responses retain the intent and deadline guard; never delete that guard to retry.
- Provisioning, readiness, cancellation, inference and early admission errors are inside cleanup scope. A detached lease watchdog survives the application process and is resumed from intent on app startup. Cleanup permission is tied to the owned creation record, so clearing live flags does not abandon an already created Pod. Full machine/network outage can still delay cleanup; retained intents must be checked against provider state.
- Failure to verify deletion is surfaced; teardown errors are not silently called success. Runtime logs, session/intent/ledger and native receipts are private under ignored `outputs/`. Keys are not written there or sent to the worker/browser.

## ONE future owner-authorized live test (not executed)

1. Review worker image/runtime/model licenses and prepare the configuration above. Confirm no unaccounted billable resources, current balance, auto-pay disabled and remaining session budget. Do not create a new persistent volume as an implicit part of this test.
2. Use an owner-authorized **No Crumbs** photograph. Record its normalized SHA-256 from the saved source/plan and put only that hash into `ADSTUDIO_FLUX3_CLOUD_SOURCE_SHA256`. Private Abel test material must not be used. Choose one source, one concept and quantity **1**.
3. For this newly authorized test only, set `ADSTUDIO_FLUX3_INFERENCE=1`, `ADSTUDIO_FLUX3_AUTOPROVISION=1`, `ADSTUDIO_FLUX3_REMOTE_WEIGHTS=1`, `ADSTUDIO_FLUX3_DRY_RUN=0`, `ADSTUDIO_RUNPOD_LIVE=1`, `ADSTUDIO_FLUX3_SPEND_APPROVED=1`. Preserve reserve 2.96, job/session ceilings 0.50 and lease <=2400 seconds. Restart using `npm start` from the clean RC; verify `/api/release`.
4. Website → correct product/source → visible facts/permissions → choose Creative Restage before planning → genuine Qwen concept → approve. High geometry locks deliberately prevent FLUX; do not bypass them. Existing accepted Qwen model evidence is a regression record, not proof of a newly revised live plan.
5. Select **FLUX 3 Image Klein**, inspect its explanation and click Generate once. Expected real stages: Preparing GPU → Loading model → Generating photograph → Checking product → Designing advertisement; cleanup reports Releasing GPU. A model/quality failure stays a failure and does not fall back.
6. On success, compare the raw photograph with the source and inspect identity/framing. Export only if gates permit. Edit approved copy and download PNG; reload to confirm raw photo, source hashes, provider and exports remain in the project. A failed quality gate may preserve a raw result while blocking the ad.
7. Verify fresh SDK native execution/job ID, actual input-reference hashes and `executionKind:model-output` in saved evidence, with `outputs/hero-flux3/<provenanceId>/provenance.json` and `binding.json`. Inspect `promptUpsamplerBypassed` honestly. Original-photo composition or replay is not live proof.
8. Confirm `outputs/runpod-flux-session/session.json` says released with deletion confirmed, no `intent.json` remains, and a read-only RunPod inventory no longer contains the exact created Pod. Check Pods, volumes and billing in the console or `runpodctl pod list` / `runpodctl volume list`. This controller never deletes pre-existing volumes; they can continue billing.
9. Clear live/spend flags immediately and restore dry-run mode. If generation or cleanup fails, retain the intent, ledger, request and native IDs. The watchdog retries exact owned cleanup; verify resource state yourself if the host/network failed. Do not click Generate again or delete intent/ledger to bypass the block.

**GO: integrated nonbillable request/lifecycle path and original-photo exports. NO-GO: claiming a genuine website-to-live-FLUX finished-ad success before this bounded owner test passes.** Missing prepared model deployment/key configuration and paid acceptance are real blockers.

## Recorded acceptance

- `npm run test:runpod`: **16 passing nonbillable lifecycle tests**, including failed balance reads, lowered ceilings/rates, forced dry-run with live flags, Qwen-only/missing-filename/low-RAM/public-URL rejection, prepared-worker admission, success/SSH/model-error/cancellation cleanup, changed ownership, ambiguous create, cumulative budget and stale-watchdog tokens. Cloud APIs/SSH are mocked; this is not real provision/teardown proof.
- Typecheck/build and full CPU application, consolidated, FLUX, film and release suites pass. Existing source/identity/framing gates, copy isolation, approved fields, graphics and media persistence remain exercised.
- Actual production desktop Journey: authorized original → explicit Basic Creative Restage direction → FLUX selection → Generate → controller plan → honest 503/no image → reload PASS. Mobile stop/reload layout also inspected. Evidence: ignored `outputs/final-sprint/runpod-browser/report.json` and screenshots. It explicitly distinguishes this CPU routing test from the saved genuine Qwen planning acceptance; no additional Qwen call was made.
- The customer dry-run contains no ready advertisement/take, no automatic fallback and no new native job. An HTTP request body attempting to set live flags still receives a forced dry-run. No `intent.json` is created.
- Desktop/mobile PNG/MP4/edit/reload and existing real-photo replay regressions are recorded separately. Replay keeps its `artifact-replay` provenance and failed-quality export blocks.

The final server is deliberately in **nonbillable dry-run mode** (`INFERENCE=1`, `AUTOPROVISION=1`, `DRY_RUN=1`, `LIVE=0`, `SPEND_APPROVED=0`). FLUX selection exercises orchestration but cannot produce a paid photograph. Explicit Product-safe remains the working original-photo export path. `/api/release` and `outputs/final-sprint/release.json` pin the final compiled checkout. No success of live FLUX or automatic real-world GPU cleanup is claimed.
