> Current consolidated RC: [verified application, port 8341, evidence and remaining live blockers](CONSOLIDATED_RC.md). This record supersedes older branch/URL/pending-integration statements below.

> Integrated RC update (2026-10-29): [current acceptance](RC_ACCEPTANCE.md) supersedes the historical pending-integration/frozen-code statements below. All three committed sources are merged; live FLUX/LTX acceptance and owner publication remain separate.

> Incoming-model review: [FLUX 3 / SAM / LTX license delta](MODEL_LICENSE_REVIEW.md). This inventory describes the earlier baseline; final incoming model setup is not yet integrated.

> Current release scope: image-focused; final image branch acceptance is pending. Video is frozen at `fb27680` after an interrupted LTX decode with no footage. Models listed below are dependencies/code paths, not claims of successful generation. See [current readiness](RELEASE_READINESS.md).

# Models, workflows and submission configuration

No weights are distributed. An open-weight license is not automatically an OSI open-source license or unrestricted commercial permission. The user is responsible for accepting the applicable model terms before download/use. Do not describe a missing model as operational.

## Image submission configuration and retained optional paths

| Path | Model / license | Code and source |
|---|---|---|
| Creative Restage | FLUX.2 Klein **4B FP8**, Apache-2.0; not the restricted 9B variant | `klein4b_scene.json`, `klein4b_fp8_contract.json`, `runtime/klein-scene.ts`; [BFL card](https://huggingface.co/black-forest-labs/FLUX.2-klein-4b-fp8) |
| Klein encoder / VAE | Qwen3 4B FP8 mixed + Flux2 VAE; Apache-2.0 in pinned distributions | [Comfy Qwen encoder packaging](https://huggingface.co/Comfy-Org/Z-Image-Turbo), [Flux2 VAE packaging](https://huggingface.co/Comfy-Org/Flux-2-Klein-4B); three exact SHA-256 values in the Klein contract |
| Creative/brand text | Same local Qwen3 encoder, Apache-2.0; deterministic fallback | `prompt_polish.json`, `creative-engine.ts`, `brand-analysis.ts`. Optional local Ollama Qwen2.5 is separately configured/installed; no cloud fallback. |
| Experimental video (frozen) | LTX-Video **2B 0.9.8 distilled**, LTXV Open Weights License 0.X; T5 encoder packaging Apache-2.0 | `lib/campaign-motion.ts` explicitly selects the model; `shot_ltxv.json` loads it and native LTX guide/scheduler/sample/decode/save nodes. [Official model card](https://huggingface.co/Lightricks/LTX-Video), [license](https://huggingface.co/Lightricks/LTX-Video/blob/main/LTX-Video-Open-Weights-License-0.X.txt). |
| Brand text/end card/export | Deterministic browser canvas, Resvg and local FFmpeg | These are not generative models. End-card text is composed after LTX; sound status stays outside rendered pixels. |
| Sound | Silent master by default | No music or Stable Audio model is needed for the recommended silent entry. Use separate rights-cleared audio only after approval. |

`npm run models -- --only klein4b --models-dir <directory>` now exposes all three existing pinned files (10,038,829,863 bytes). The Qwen encoder revision was resolved through official Hugging Face metadata as `6fc90a3b1b653e935a0d175e260736de25b84df5`; its remote LFS digest/size match the existing contract. The two BFL/Comfy VAE revision URLs already came from that contract. This adds a reproducible download selection, not a new inference method. No model download was performed during audit.

The general video manifest still uses upstream `main` URLs for older LTX/T5 files; those are not immutable revision pins. Their graph/filenames are included, but a completely pinned clean GPU installation and end-to-end run were not repeated. The first-run proof cycle is corrected: an explicit Klein selection can establish its initial render record after all admission/integrity checks. A clean first-run image verification on the final approved release remains unverified; see [bootstrap notes](KLEIN_BOOTSTRAP.md).

## Other retained paths

| Optional path | License distinction / scope |
|---|---|
| Klein background + original compositing / BiRefNet | Klein Apache-2.0; BiRefNet MIT. `klein4b_background.json`, `product_cutout.json` and their contracts. Main Creative Restage instead redraws product pixels. Background readiness has a similar prior-runtime-proof gate. |
| Qwen-Image / Qwen-Image Edit 2511 | Apache-2.0 in retained Comfy distributions; `keyframe_qwen.json`, `hero_qwen2511_benchmark.json`, pinned Qwen contract. Requires additional large weights. Not exercised in this audit. |
| Z-Image / Turbo / precision editing | Apache-2.0 in retained Comfy distributions; `keyframe_zimage.json`, `hero_zimage_experimental.json`, `precision_zimage.json`. |
| LTX-Video 13B | Same model-specific LTXV license; separate larger pack. Campaign Animate explicitly uses 2B. |
| LTX-2.5 / associated encoder, upscaler and VAEs | Custom LTX-2 Community License and upstream component terms, not MIT/Apache blanket permission. `shot_ltx25.json` and manifest are retained; clean-install GPU compatibility and exact encoder licensing were not revalidated. Do not claim this as the demonstrated default model. |
| Stable Audio Open 1.0 | Custom Stability AI Community License; **not** an unrestricted permissive license. [Official text](https://huggingface.co/stabilityai/stable-audio-open-1.0/blob/main/LICENSE.md) requires registration for commercial use and applies a USD 1 million aggregate annual-revenue condition; attribution/notice obligations also apply. Confirm terms before enabling. |
| Hunyuan3D mini | Tencent Hunyuan Community License with territorial/use restrictions. Director-oriented optional geometry route; not used in the entry configuration. |
| Whisper / MiniLM / training helpers | Optional inherited captions/search/training routes. Whisper/MiniLM have separate MIT/Apache model terms. These are not advertised Ad Studio features or required to install. |
| Qwen SSH relay | Opt-in, single-job approval/lease-bound development route to open weights through SDK/proxy; not a closed-model API, not configured in the recommended local entry. Never infer remote/private-upload authorization from its presence. |

The LTXV license permits use subject to its terms, includes a separate commercial-license requirement at USD 10 million annual revenue, requires downstream use-restriction compliance where applicable, and calls for disclosure of machine-generated content. Clearly label generated video in the demo/social description. Owner revenue/use eligibility and any external soundtrack rights are not inferable from source code.

## Open Weights Only scope

All shipped graph node types were inventoried: native Comfy loaders/conditioning/samplers/I/O plus repo-owned optional captions/search nodes. No BFL/Comfy partner API, OpenAI, Anthropic, Fal, Replicate or other closed model provider occurs in these workflows. Web research is a bounded public-page reader, not inference. Network model downloads and optional SSH transport are not themselves closed inference services.

This supports the recommended local configuration's open-weight claim, subject to model terms, actual installed configuration and owner attestation. It does not certify every user-installed custom Comfy node, remotely replaced model or arbitrary future plugin.
