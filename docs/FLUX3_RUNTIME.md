# FLUX 3 runtime contract — integrated RC

The optional Journey engine is **FLUX 3 Image Klein BF16 mi2i**. It is explicit; Automatic does not choose it, and an unavailable or incompatible explicit request never silently becomes Klein/Product-safe or a saved example.

## Current status

The RC is tested with inference disabled and the GPU backend offline. The pinned graph, current-customer inputs, SDK transport, native-history/reference checks and compatibility mode have CPU contract coverage. That is not live model acceptance. Cursor's prior native outputs and API proof are recorded in IMAGE_HANDOFF.md; its live path preceded the RC's SDK transport/reference-verification corrections. The later Cursor recovery commit 4c498d5 marks the previous kitchen-window/bread-morphology candidate as owner-rejected; its recovery changes are integrated, but no replacement output is claimed. A fresh live RC run remains required before claiming end-to-end generative UI acceptance.

The Journey uploads the reviewed source and binds it to nodes 11 and 111 through SDK assets. Both slots currently use that same customer source. No sample No Crumbs/SAM asset is selected. A different identity PNG is rejected by the Journey API until a separately reviewed identity picker is connected. The standalone historical image experiment used a separate SAM cutout; that stronger result does not establish equivalent UI conditioning.

## Required existing runtime

- A compatible ComfyUI serving the nodes listed in shared/workflows/flux3_klein_bf16_mi2i_contract.json, including ReferenceMultiLatent, ComfySwitchNode, BatchImagesNode and TextGenerate, plus the native loaders/sampler/I/O. A version label alone does not prove those nodes are present.
- The four exact component filenames and byte sizes in that contract, from [BFL's distribution](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy), with its terms accepted. Workflow canonical SHA-256 is pinned; weight SHA-256 entries are incomplete. Presence/size checks must not be advertised as cryptographic weight validation.
- At least the coded 18 GiB reclaimable CUDA VRAM and 12 GiB free host RAM, plus an idle known queue. These are admission floors, not a fit/performance guarantee. The local 10 GB RTX 3080 cannot meet this BF16 admission requirement.
- Installed comfy-api-proxy 0.1.6 and the existing Comfy SDK 0.5.0. Generation is SDK → proxy → ComfyUI. The native API is read only for completion/reference verification. Proxy health must identify the same upstream ComfyUI URL as the app.

## Configuration

Use the ignored .env or equivalent shell environment. Never put tokens in tracked files. The current RC example leaves inference off:

```dotenv
ADSTUDIO_FLUX3_INFERENCE=0
ADSTUDIO_FLUX3_REMOTE_WEIGHTS=0
ADSTUDIO_FLUX3_SKIP_PUP=0
```

For a separately authorized, already running worker, the operator connects an SSH local-forward and configures both the ComfyUI loopback URL and a proxy targeting that URL. An example port pair is COMFYUI_URL=http://127.0.0.1:18188 and COMFY_BASE_URL=http://127.0.0.1:18189; these are backend ports, not alternate app URLs. REMOTE_WEIGHTS=1 skips local filesystem checks because the weights live on that connected worker; node inventory, idle queue, memory checks and matching proxy still apply. INFERENCE=1 opts in only after those prerequisites and model terms are satisfied. This RC neither creates nor pays for that worker. Do not use demo-reserve credits without separate authorization.

A local worker instead uses its actual models directory. The general Klein 4B pack is not a FLUX 3 pack. Restart the application after changing configuration; an existing outputs/runtime-config.json overrides backend URLs and must also point to the intended worker. GET /api/hero/capabilities reports actual availability and reasons.

## Prompt-upsampler compatibility limitation

The intended graph routes the reviewed director prompt through TextGenerate, then CLIPTextEncode. Cursor reported a Flash-Attention stride crash on the overnight A40/torch 2.6 stack. ADSTUDIO_FLUX3_SKIP_PUP=1 selects ComfySwitch's direct path. The current constraints **and Dynamics caption/bounding boxes** reach CLIP directly, but there is no prompt expansion. This is a compatibility workaround, not completion of the full intended workflow. Capabilities, the engine panel and saved provenance disclose the bypass. Even bypass mode currently requires the graph's loaders/nodes and component inventory; it is not a smaller-model installation promise.

The full upsampler path, generated visual quality and the changed SDK path require live validation on the accepted backend. Do not infer them from a CPU fixture or from an earlier direct-native API run.

## Success and failure contract

One reviewed receipt per request, no automatic retry or model substitution. Native completion must be successful; cached sampler completion is rejected as fresh-inference evidence. Both executed reference bytes must match this request's source hashes. PNG signature/dimensions are checked. Raw image, native history, actual executed-graph hash, source/identity hashes and upsampler choice stay in private provenance; binding.json links project/plan/prepared IDs. Output geometry/labels can drift and still require visual comparison. A timeout or connection loss does not justify claiming success or automatically retrying a possibly running worker.

The previous post-success binding-directory bug is fixed. Its old HTTP 500 is historical evidence, not a current acceptance response. No fresh successful FLUX output was fabricated in this RC session.
