# Comfy Cloud / FLUX setup and verification limits

This release includes the native Comfy Cloud adapter as **experimental**. It submits an API-format FLUX.3 Klein multi-reference graph through `@comfyorg/sdk` to Comfy Cloud API v2. It is distinct from Comfy Router/Partner Nodes and from the separate RunPod controller.

**Fresh installations do not spend credits.** API credentials stay on the server. An unavailable explicit engine never silently becomes a successful AI image. Use Product-safe to create a PNG with no model or subscription.

## Configure safely

Follow [Connect AI](CONNECT_AI.md#comfy-cloud). In this application's root `.env`, set your own server-only API key, enable the Cloud engine, and leave both compatibility and spending approval off initially. Never copy configuration from another worktree or prefix credentials with `VITE_`.

Run `node scripts/verify-comfy-cloud-key.mjs` for an explicit read-only authentication check. This utility reads this installation's environment, makes only GET requests and never copies/writes `.env`, uploads media or submits inference. Authentication does not verify models, credits or complete workflow execution.

Comfy's [Cloud SDK quickstart](https://docs.comfy.org/development/deploy/cloud) requires eligible paid API access. [Standard supports one concurrent workflow](https://docs.comfy.org/development/deploy/cloud-usage); Creator adds concurrency/custom-model import. Check [current pricing](https://comfy.org/pricing) and your account; do not purchase or upgrade solely because this app names a model.

Confirm the managed Distilled Image Edit weights/nodes for the pinned graph in your account before enabling compatibility. The default profile maps the BF16 transformer and encoder filenames to the official Cloud int8 counterparts. A documented model family and a compatibility flag are not proof the account can execute the exact graph.

When you deliberately authorize paid generation, set compatibility and spending approval to `1`, restart, choose **Comfy Cloud / FLUX** under Journey's Advanced engine controls and click Generate. The default source policy is a strict hash allowlist. Optional `ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY=reviewed` permits the actual reviewed source bound to the approved brief; it is not permission to upload unrelated images. See `.env.example` and the connection guide for the short configuration block.

## Execution and review

The selected customer's reference is bound to both current reference slots, rather than a bundled brand/sample image. FLUX performs Creative Restage; geometry/identity constraints remain in the request, and identity/framing/lettering checks run on returned pixels. These checks are heuristics and do not establish factual fidelity by themselves. Review the original and output before publishing.

The adapter uses one job at a time, unique submission receipts and no automatic paid retry. Cloud API runs share the account's Cloud credit pool. **There is no hard per-ad credit ceiling.** Check the account's usage after a run. A timeout does not prove the job stopped; inspect its receipt/history before submitting again.

The intended FLUX graph includes prompt upsampling. `ADSTUDIO_FLUX3_SKIP_PUP=1` is an explicit compatibility bypass on affected stacks, not the full intended workflow. Saved provenance must continue to disclose it. Do not describe a bypassed run as validation of the full upsampler path.

## Evidence boundary

CPU graph/reference/default-off tests and Product-safe browser/export/persistence acceptance pass. Cursor reported earlier genuine direct Cloud outputs; their existence does not establish a fresh integrated Journey click or current account compatibility. This audit performed **no paid Cloud or RunPod inference**. Do not label CPU fixtures, saved images or authored/Basic planning as new AI generation.

The owner records the final genuine demonstration only after successful accepted execution and product review. Experimental Cloud/LTX status must remain visible until that evidence exists. [Current source and release assessment](release/STATUS.md).
