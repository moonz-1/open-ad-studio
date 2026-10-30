# Workflow contract

## Catalog V2 / source-first interpretation (2026-10-26, additive)

`ProductDiscovery.method` additionally accepts `product-card`, `item-list`, and
`storefront-data`; optional `linked` distinguishes a declared product link from a
fallback evidence-page URL. Product-card proof binds a meaningful bounded container,
not arbitrary nearby page text. Public JSON is parsed, never executed. Variants
deduplicate by canonical own product URL. New methods use the same fresh source
revalidation, bounded raster transport, hashes and separate rights/accuracy gates.

BrandResearch v1 optionally adds `identity:{name,url}`, `catalogSources` (up to4
URL/title/hash-only records, text empty), `catalog` coverage/timing/partial reasons,
`analysisKey`, `analysisFingerprint` and `analysisMs`. Up to4 text sources plus4
compact catalog sources are validated together for product/image references.
Caps remain40 products/40 image refs;8 collected HTML pages,10 page attempts,
25s collection scheduling window,3MiB per HTML (raised from1.2MB),300KB CSS/5MiB
raster and existing redirect/timeout/DNS defenses. In-flight reads can add timeout
latency. Robots policy is read with the same protected reader and cached; specific
agent / longest path rules are respected. No authentication or anti-bot bypass.
Coverage is a public snapshot, never complete inventory/availability certification.

React POST `/api/brand/research` `{website,analyze:false,deferAnalysis:true}` returns
products first, with `analysisState:"pending"` and a server-issued receipt. Optional
POST `/api/brand/analyze` `{key}` uses only server-retained evidence and returns its
validated result. States are pending/completed/unavailable/failed. Concurrent/repeated
receipts and identical model input share one attempt via a16-entry process cache.
Receipts/successes last30min; failed results have a60-second cross-receipt cooldown,
while the original receipt never retries. A later explicit discovery can recover;
no background retry. Different evidence while analysis is busy returns unavailable
immediately rather than waiting behind a long text job. Unavailable status can be rechecked on
a new discovery. Expired/unknown receipt =>409; malformed key =>400. API restart
expires volatile receipts; existing project/catalog data is retained. Legacy callers
without `deferAnalysis` keep synchronous semantics; `analyze:false` stays source-only.

Source delivery is independent of text inference. Background results require matching
brand/receipt/fingerprint and preserve current customer edits/assets. Pending receipt
resume after refresh does not resubmit a model job. Same-business root/catalog matching
uses source-backed identity plus conservative tenant boundaries, with a constrained
legacy path for older profiles. Same-brand research retains active directions/history/
sources/permissions. Changed full snapshots make review stale; no automatic reapproval.
Selected image proofs are explicitly minimal (one source/product/image), omit analysis
and catalog payloads and retain the original64KiB API limit. IndexedDB v3 and Director,
generation, editing, model/setup, budget, one-job and export contracts remain unchanged.

## Editable brand intelligence (2026-10-26, additive)

React discovery now requests `analyze:true`. The default brand backend reuses the
installed Qwen3 4B FP8 native text workflow through the existing Comfy SDK/proxy;
`GET /api/brand/status` may return `provider:"comfy-qwen3"`. An explicitly selected
legacy `ADSTUDIO_BRAND_MODEL` retains the previous Ollama behavior. No automatic
downloads/fallback inference. At most one text call per successful discovery,
600 output tokens and a 150s execution deadline from job submission. No image/vision analysis.
`analyze:false` remains source-only. Research optionally adds `analysisState`
(`completed|unavailable|failed`), `analysisRaw`, observed/verified `aliases` and
`websiteColors:{hex,count,contexts,neutral}[]`. Suggestions are inferred with
validated source IDs, never website facts. Unsupported operating promises are
filtered; no semantic correctness guarantee. Existing public-fetch protections stay.

Brand v1 optionally adds `aliases`, per-field `approvedFields`, DNA `messaging` /
`creativePreferences`, product overrides including `sellingPoints`, and
`palette:{approved,preferred}` (preferred is a subset). Old profiles still validate.
Customer edits and empty removals survive rediscovery; original research remains
separate. Customer draft saves merge field changes into the newest profile so
concurrent imported assets/evidence are preserved. Brand revision changes invalidate
old creative review. `brandContext`/planning/layouts consume preferred then approved
colors, with legacy colors retained for unchanged older profiles. No product/logo
recoloring. Optional ProductAsset `palette` records `kind:"overall-image"`,
`method:"local-rgb-histogram-v1"`, `colors` and `sampledPixels`; this is local pixel
statistics with no object/background separation. Image bytes and source hashes,
IndexedDB v3, job/budget/approval guards and Director contracts are unchanged.

## Website product source contract (2026-10-26, additive)

Brand v1 research/products optionally retain `discovery:{key,sourceId,method,imageUrls}`.
Methods are explicit Product JSON-LD, Product microdata, product-permalink DOM
relationships or Product page OG metadata. Generic images/banners are not product
fallbacks; shared/ambiguous references cannot be auto-imported. Product records
retain stable IDs and customer corrections on repeat research of the same website.

Existing POST `/api/brand/research` accepts `analyze:false` for source-only discovery;
no model needed. Existing POST `/api/brand/image` still accepts `{url}` for legacy
manual collection. Website-first callers add `{productKey,research}` containing
only the selected relationship, under the unchanged64KiB body cap. Server re-reads
the public page, proves the current unique product/image relationship and validates
the bounded raster. It records both research and fresh page hashes (nonce-only
HTML changes are not automatically identity changes). SSRF/DNS pinning/redirects,
size limits, MIME/magic and no-cookie/no-script behavior are retained.

ProductAsset optionally stores external WebsiteSource provenance plus decoded
original dimensions. `BriefInput.source.provenance` carries the same public origin,
source/normalized hashes, brand/product/key/method and separate timestamped user
accuracy/use attestations. Original-input kind is not a claim of ownership or camera
authenticity. Website copy stays sourced product data, never verified image facts.
Photo observations still require the existing explicit direction/facts review.
Provenance/permission changes invalidate the reviewed input; no request/generation
or export through the primary app while required consent is absent. Unknown/stale
website product evidence is not upgraded into an owner assertion.

IndexedDB remainsv3; old assets, drafts, services and endpoints remain compatible.
No new inference defaults, models, dependency, Director contract, budget/one-job
receipt or long HTTP/lease guard changes. No automatic GPU rental/download/upload.

## Bounded visual proposals (2026-10-26, supersedes full-JSON planning)

Creative routes and image/Director contracts remain compatible. Qwen3 outputs
three compact tagged visual proposals,600tokens/150s/no retry; trusted app code
supplies final schema, identity/count/packaging/camera/composition, evidence, copy
and neutral scores. `provider.contribution` is optional metadata distinguishing
model idea/environment/light from app-authored fields. Invalid model decisions
are rejected whole, raw retained and a labeled deterministic campaign used.
A saved proposal with `rejected` audit marker cannot be retrieved/prepared.
`creative-json.ts` remains for historical strict replay, not a mandatory live format.
No image pins, long HTTP transport, approval/source/lease/budget guards changed.
GET plan lookup alone has a10s client timeout; inference deadlines unchanged.
Owner-opened local review links attach existing proposals only after exact saved
project/profile/original hash checks; no automatic review, inference or DB upgrade.

## Ad Studio creative planning (2026-10-25, additive)

Functional UX adds optional `facts:SourceFacts` to `creative/select`. Source/brand/
model identities remain immutable. Facts are validated and marked unconfirmed;
the existing three concepts are retained in a new plan with genuine `parentId`.
The prior record remains intact. No inference, human approval or paid permission
is implied; `creative/prepare` still requires explicit facts+direction confirmation
and current exact source hashes. Existing callers omit facts unchanged. Browser
one-action export reuses existing composition/provenance services; no Qwen/Director
transport or production workflow changes.

React integration adds POST `/api/creative/select` (`planId,projectId,conceptId`),
returning a new unreviewed plan without invoking a model. `creative/compose` may
receive optional `copy:{headline?,body?,cta?,size?}`; other override keys rejected,
existing static-design validation/raw-Qwen provenance/source/pin gates preserved.
No Director contract or production model/workflow changed.

`/api/creative/{status,plan,prepare,compose}` and typed `OSH.creative*` reuse the
existing native `prompt_polish.json` Qwen3 text graph, Qwen Hero validation/delivery,
and static PNG exporter. No production workflow default or Director route changed.
Planning is text-only and never authorizes/submits image inference. Campaign allows
contextual reframing; enhancement stays explicit. Missing weights/invalid text
output are labeled deterministic fallback. `CreativeStudioService` connects
project Blobs/history without a database upgrade. See `adstudio/CREATIVE_ENGINE.md`
for review freshness, source identity, copy, provenance and composition contracts.
Remote paid/private gates remain separate.

One section per workflow. The apps only talk to workflows through what is listed here.
Export workflows from ComfyUI with **Save (API format)** and commit the JSON next to this file.

## Template

### `<name>.json`
- **Used by:** studio / adstudio
- **Models:** e.g. LTX-2.5 + IC-LoRA ? (open weights? yes/no)
- **Inputs:** node `<id>` `<field>`: image (PNG) / text / number ?
- **Outputs:** node `<id>`: MP4 / PNG
- **Render time:** `<seconds>` on `<GPU>` at `<resolution, length>`
- **Notes:**

## Workflows

### Fidelity postprocessing API (2026-10-22, additive)
- `POST /api/product-video`: `{image: "/outputs/<hex>.png", mode: "locked"|"camera", ratio: "16:9"|"9:16"|"1:1", duration: 2..5, background?: "/outputs/<hex>.webm", motion?: "push"|"pan-left"|"pan-right"}`. Locked requires a background from the existing SDK shot path. Camera uses only the source photograph and FFmpeg.
- Returns API-owned lossless VP9/yuv420p WebM plus seconds, frames, width/height, mode/motion and protectedRect (locked only). Fixed development sizes: 512?288, 288?512, 384?384. Frame count follows 8n+1 at 24 fps. Existing `/api/export` can add a PNG tagline and encode MP4; MP4 is lossy.
- Locked overlays an ~82%-fit static original-photo rectangle over blurred/dimmed LTX footage. This is not product segmentation. Four-pixel-inset core measurements on the cookie test prove resized/color-converted WebM preservation only; no universal strict-fidelity claim.
- Camera push/pan recipes and protection bounds are fixed in `shared/runtime/product-video.ts`; no client filter expressions/paths are accepted. Existing access gate, opaque outputs and shared four-job queue apply. 90-second FFmpeg timeout, partial-output cleanup; no changes to existing generation/model/Director signatures.
- Camera sampling correction (2026-10-22): new takes use eased 1.00??1.04? push, or eased 2.4% crop-center pan travel at 1.04? zoom; RGB 8? input/4? output sampling followed by Lanczos downsample. Same dimensions, 24FPS and duration mapping; originals/old takes retained. This is conventional 2D animation. Creative/Locked/Director routes and audio behavior unchanged. Evidence and playback limits: `adstudio/CAMERA_MOTION.md`.

### Local model discovery and selection
- `GET /api/models`: returns `keyframe`/`video` arrays of `{id, label}` for installed workflow-compatible models, plus `inventory` groups `{category, files}` from the connected ComfyUI. Config/custom-node source files are excluded from model inventory. Supporting models and workflow node classes must exist before a choice is offered.
- 2026-10-22 additive metadata: choices also include `family`, `description`, `capabilities` (`name`, `status`, `detail`, optional UI `control`) and `timing` (baseline range/workload/provenance). Capability statuses describe the connected app workflow, not theoretical model support. `research` lists completed local LoRA-lab model bundles from their manifest; these are not runnable choices. Old ID/label consumers remain compatible.
- `POST /api/keyframe` and `POST /api/shot` accept optional `model` (the catalog ID). Missing IDs use the first compatible installed choice; unsupported/unavailable IDs return HTTP 400 before generation. The selected ID sets the workflow's UNET/checkpoint loader. Discovery downloads nothing and does not imply every listed model has an app workflow.
- Browser methods: `OSH.models()`, `OSH.keyframe(prompt, seed, size, model?)`, `OSH.shot(keys, prompt, duration, seed, model?)`.
- Merged client compatibility: the fifth `OSH.shot` argument accepts either a model ID string (Director) or `{width?, height?, model?}` (Ad Studio or combined use). Omitting it preserves default dimensions and the installed default video model.

### Local export API (postprocessing, not a generation workflow)
- `POST /api/export`: `{video: "/outputs/<hex>.webm", overlay?: "/outputs/<hex>.png"}` ? `{url: "/outputs/<hex>.mp4", seconds}`. Only existing API-owned files are accepted, under the same localhost/token gate. Source WebM is kept.
- Uses local FFmpeg (`FFMPEG_PATH` or PATH), H.264/libx264, yuv420p, no audio, faststart. Optional static PNG is composited at 0,0; Ad Studio creates a same-size transparent tagline PNG in the browser and uploads it. No client-provided filesystem paths, shell commands or filter expressions.
- Shared queue, 90-second export timeout; failure removes partial MP4. No generation models or workflow JSON change. FFmpeg must be installed separately.

### Video editing and exact sizes (2026-10-22)
- `POST /api/edit-video`: `{video, start?, end?, speed?, reverse?, width?, height?}` ? `{url, seconds, width, height}`. `OSH.editVideo` mirrors this. Only API-owned WebM/MP4 sources; original is kept. Trim bounds 0?60 seconds, end after start; speed 0.25?4; whole-pixel dimensions 16?4096, at most 4096?2160 total pixels. Local FFmpeg trims, optionally reverses, changes speed, resamples to 24 fps and scales with Lanczos to VP9 WebM without audio. Same gate/queue, 90-second timeout, no client filter/shell strings, partial output cleanup. This is conventional resizing, not learned super-resolution.
- Generation accepts exact whole-pixel dimensions. Image bounds 256?1536; video 256?1024 and at most 768?768 pixels after padding. Internal latents round up to 16 pixels (image) or 32 (video); a core `ImageCrop` after decoding returns the exact requested output size. Existing aligned defaults are unchanged.
- `GET /api/models` additionally returns top-level `timing`: actual ComfyUI GPU identity/VRAM, hardware-specific measured render samples, last observed model and queue depth. Successful uncached SDK executions are saved in gitignored `outputs/render-timings.json`; cached sampler executions are excluded. UI uses nearby measured workloads, actual padded dimensions/frame count, model-switch overhead and missing-keyframe work. Unknown hardware without samples needs a benchmark. Queue wait is separate; another Comfy client can change model residency.

Dev set: small + fast, for iterating locally on 12 GB cards (4070 Super; should fit a 3080 with ComfyUI offloading, untested).
Swap to LTX-2.5 + IC-LoRAs on a rented 32 GB+ GPU for final renders.

### `keyframe_zimage.json`
- **Used by:** studio (Generate keyframe, missing keyframes before a shot); available to adstudio
- **Models:** Z-Image Turbo bf16 + Qwen3-4B fp8 text encoder + ae VAE (Apache-2.0, open)
- **Inputs:** node `5` `text` (prompt) ? node `8` `seed` ? node `7` `width`/`height` (default 768?448)
- **Outputs:** node `10`: PNG
- **Render time:** ~7 s warm, ~18 s cold, 768?448, 8 steps, RTX 4070 Super (2026-10-21)

### `shot_ltxv.json`
- **Used by:** studio (Generate shot); the same pattern works for adstudio's product shots
- **Ad Studio integration (2026-10-21):** `/api/upload` accepts a PNG data URL (5 MB decoded, max 2048?2048) and returns an API-owned `/outputs/<hex>.png` for the existing keyframe input. `/api/shot` optionally accepts width/height (256?1024, snapped to 32, max 768?768 pixels); sets both latent and guide scale sizes. Omitted dimensions retain the Director's 768?448 default. Ad Studio uses 512?288, 288?512, 384?384 and generates each format separately through the SDK. No workflow JSON or model changes.
- **Models:** LTX-Video 2B 0.9.8 distilled + T5-XXL fp8 (open weights)
- **Inputs:** node `3` `text` (motion prompt) ? node `7` `length` (frames, 8n+1, 24 fps) ? node `14` `noise_seed` ? keyframe *i*: image node `5` / `5NN`, guide node `8` / `8NN` (`frame_idx`, `strength`)
  - The file has one keyframe guide. `shared/runtime/api.ts` clones nodes 5/6/8 per extra keyframe (`shotGraph()`) and snaps `frame_idx` to multiples of 8 (last key = `-1`).
- **Outputs:** node `17`: WEBM (VP9)
- **Render time:** ~20 s for 3 s (73 frames) from 2 keyframes; ~32 s for 4 s including generating 2 missing keyframes. 768?448, 8 steps, RTX 4070 Super (2026-10-21)

### Optional shot guides (2026-10-22)
`POST /api/shot` accepts `keys: []` or omitted keys for text-to-video; up to eight image guides remain optional. Zero-key graph removes LoadImage/ImageScale/LTXVAddGuide/LTXVCropGuides and connects text conditioning plus EmptyLTXVLatentVideo directly to the existing scheduler/sampler/decode. Same SDK/proxy path, model, dimensions, frame cap and output. Studio sends only keys with actual images and never silently generates missing images. Start/end UI anchors send t=0 / current shot duration; regular keys send their timed position. Guidance remains approximate, not an exact reproduction promise.

### Explicit frame timing (2026-10-22)
Optional shot fields `frames` (integer9?121, `(frames-1)%8=0`) and `fps` (1?120, float) set latent length, conditioning node11 frame_rate, output node17 fps and guide frame snapping. Explicit duration is frames/fps; response adds fps and duration. Omitted frames retains existing 1?8s duration mapping/cap and omitted FPS retains24. OSH.shot fifth options argument accepts both fields. 121 is the current app workload cap; installed ComfyUI node exposes a larger theoretical maximum. No workflow JSON/model changes.

### audio_stable.json / local soundtrack (2026-10-22)
- Stable Audio Open1.0 (Stability AI Community License, Powered by Stability AI), Google T5-base (Apache2); built-in nodes only. Source https://huggingface.co/Comfy-Org/stable-audio-open-1.0_repackaged ; encoder https://huggingface.co/google-t5/t5-base . Model entries in runtime/models.json.
- POST/api/audio `{prompt, duration?, seed?, video?}` ? `{audio, video?, duration, seconds}`; OSH.audio mirrors it. Prompt1?1500chars, duration0.1?47s (latent minimum1s), seed uint32. Optional input must be API-owned existing WebM/MP4. Graph1 checkpoint,2 text encoder,3/4 text,5 seconds conditioning,6 latent seconds,7 seeded30-step sampler,8 decode,9 SaveAudio FLAC. Generated text audio is separate from video, not synchronized foley/lip-sync.
- Shared SDK/proxy/queue and local/token gate; outputs accepts opaque FLAC with audio/flac. Optional FFmpeg mux maps only video0/audio1, copies WebM video (MP4 re-encodes VP9), encodes stereo Opus, pads/trims to requested duration; fixed filters, 90s timeout, partial mux cleanup and source preservation.
- GET/api/models adds audio.available/model. Audio model execution is recorded for hardware/model residency; UI video estimate explicitly excludes the additional audio job.
- Export now maps optional source audio to AAC. edit-video maps optional audio, applying areverse/atempo with video trim/speed; `keepAudio:false` performs video-only edits. Silent inputs remain supported. Director linked/unlinked state is browser project data; unlinked audio is not altered by video-only Edit.

## 2026-10-22: local service capabilities (Ad Studio workspace)
`GET /api/capabilities` uses the existing access gate and returns boolean API support (`upload`, `shot`, `keyframe`, `audio`, `productVideo`, `editVideo`, `exportVideo`) plus `ffmpeg.available`. FFmpeg is probed with `-version`, 3s timeout, 30s cache. It does not contact ComfyUI, start a proxy, queue jobs or download models. API support does not imply installed weights: `/api/models` remains authoritative for compatible model/node availability. Camera/Adjust/MP4 may be enabled while ComfyUI is offline. Existing routes/signatures unchanged; audio-aware edits/exports and product generation coexist.


## 2026-10-23: local Ad Composer (additive, no model workflow changes)
- POST `/api/media`: raw MP4/WebM or audio MIME (MP3/WAV/M4A/FLAC/Ogg), <=100MiB, <=600s. FFprobe validates content/dimensions. Returns `{url,kind,duration,width,height,audio,bytes}` with an opaque immutable output; corrupt new imports removed. Original Blobs live separately in Ad Studio IndexedDB.
- POST `/api/compose-ad`: `{shots:[{source,start,end}],width:720|1080,transition:"cut"|"dissolve",keepAudio:boolean,ctaSeconds:0..8,overlay?:PNG,closing?:PNG,music?:{source,volume:0..1}}`. 1..12 API-owned MP4/WebM shots with >=0.5s trims inside source duration. Positive ending >=0.5s requires closing PNG. Max90s. Contains/pads to9:16 without stretching;24fps,H.264/yuv420p MP4 and optional48kHz stereo AAC. Source audio normalized/crossfaded; music loops/fades. Dissolve overlaps adjacent clips/card by0.3s. Returns `{url,width,height,fps,duration,seconds,audio}`. One local composition (409),240s timeout, originals unchanged. 400 invalid,404 missing,422 decode/render,503 missing tools,504 timeout. No Comfy generation.
- Existing opaque output access gate retained; audio extensions added. GET/HEAD with MIME/Content-Length/Accept-Ranges. One byte range206, invalid416. Existing Director FLAC/MP4/WebM outputs preserved with seek support.
- GET `/api/ad-composer-demo` reads only fixed local `outputs/composer-demo/project.json` (404 absent). Private photos/videos/evidence stay gitignored.
- No existing SDK signature, frames/FPS, audio/edit/export or product-video route changed. Generation remains SDK -> proxy -> ComfyUI. Latest-main integration must retain newer Director services, never replace shared files wholesale.


## 2026-10-23: Ad Studio Brand Intelligence (additive local analysis)
- GET `/api/brand/status` returns `{provider:"none"|"ollama",available,model?,digest?,reason}`. Optional ADSTUDIO_BRAND_MODEL selects installed local qwen2.5:7b-instruct/7b via Ollama127.0.0.1:11434. No keys, cloud fallback, weight downloads or inference when unconfigured. Text-only research, not media generation; existing SDK/proxy workflows unchanged.
- POST `/api/brand/research` `{website}` returns version1 BrandResearch: website, sources with URLs/text/SHA256, source observations, images, palette candidates, structured products, provider/warnings, aiCompleted. Max4 pages/2 stylesheets; bounded bytes/time/redirects; DNS public-only and pinned; no credentials/custom ports/private IPs or script execution. Website content is untrusted model data, no tools; all model text is inference with validated source IDs. Failure is explicit and manual fallback keeps originals. Product prices/availability excluded from draft fields.
- POST `/api/brand/image` `{url}` downloads bounded public PNG/JPEG/WebP after the same URL/DNS controls, validates signature and returns data URL/source URL/SHA256. User chooses retention/association; originals stored locally as Blobs. GET `/api/brand/demo` reads only fixed private outputs/brand-demo/demo.json,404 absent,25MiB cap. Existing auth gate retained.
- Portable contract shared/lib/brand.ts: BrandProfile version1, evidence/corrections/assets/products/reviewed state, `brandContext(brand,productIds?)`. Ad Studio DB3 adds brands without changing old stores/project schemas. Optional project.brandId links profile. Composer uses explicit reviewed name handoff only. No Director source/SDK/shared editing/model capability changes.


## 2026-10-23: integrated runtime and deterministic static ads
- Feature merge3191482 integrates main ea2287b RuntimeSetup/model download/job activity and latest client with all Brand/Composer/product/media routes. Setup keeps its loopback/origin/queued-generation guards. Old model-string and options-object + frames/FPS SDK calls remain valid. No workflow graph/model pin changes.
- POST `/api/static-ad` `{design:StaticDesign,photo:opaquePNG,logo?:opaquePNG,support?:opaquePNG}` -> `{url,width,height,sha256,sources,recipeSha256,renderer,font,photoBox,textBounds,warnings}`. Fixed concept/format schema; source confirmation required; source PNG bounds/signature/native decode checked. Embedded raster images only, escaped text, contain/no stretch, local resvg2.6.2; no arbitrary SVG/network/file reads. Sizes1080x1350/1080x1920/1080x1080. New immutable opaque PNG; 400 invalid,404 missing,409 busy,422 invalid/empty raster. Text bounds are layout estimates; preview/font appearance still needs browser review.
- `OSH.staticAd` additive local wrapper (not a GPU job). Optional supporting imagery reuses OSH.keyframe/shared Z-Image SDK/proxy workflow and model discovery; no auto-download. Original product/logo are separate deterministic layers.
- GET `/api/static-ad-demo` reads only fixed local outputs/static-ads-demo/demo.json (32MiB cap/404 absent), same access gate. Private original photos/generated evidence remain gitignored.
- Existing project schema3 adds optional version1 staticAds workspace (designs/history/immutable PNG export snapshots with Blob asset IDs), defaults empty for legacy data. DB3/stores unchanged. BrandProfile v1 and brandContext reused, independent from Director registry. Source assets/history never overwritten by derived exports.


## 2026-10-23: isolated product hero benchmark (additive)
- GET /api/hero/capabilities: {finish:true,reimagine:boolean,experimental:true}; reference generation requires compatible installed image weights and all nodes. No downloads. Existing /api/models keyframe capability remains prompt-only; not relabeled as product editing.
- POST /api/hero/finish {image:opaquePNG,settings:HeroSettings}: fixed FFmpeg photographic grade + explicit uniform 4:5 crop,1080x1350PNG. Settings: direction natural/warm/clean,zoom1..1.5,x/y0..1,sourceKind original/supplied-ai. Returns url,width,height,sha256,sourceSha256,method,seconds,crop,filter,sourceKind. No AI or supplied filters/paths; source PNG decode/bounds checked,45s timeout,409 busy,partial output cleanup.
- POST /api/hero/reimagine {image,settings}: experimental hero_zimage_experimental.json only; source-conditioned VAEEncode,768x960 center crop,24steps,CFG1,res_multistep/simple,shift3,denoise0.2..0.55. SDK assets.fromFile -> proxy -> ComfyUI; existing GPU serialization/setup guards/activity. Returns source/output/workflow hashes,model,prompt,seed,strength,timing,warning. Missing models/nodes503, no fallback. Real inference NOT RUN; not a commercial fidelity claim. Original production graphs unchanged.
- POST /api/hero/export {hero:opaquePNG,logo?:opaquePNG,reviewed:true,copy:{headline,productName,website}}: real resvg1080x1350PNG, escaped bounded copy, no arbitrary SVG. Hero/logo uniform contain, no logo generation. Review is a customer assertion, not automated identity verification. Returns url,width,height,sha256,sources,seconds.
- GET /api/hero/demo: fixed private outputs/benchmark-ad-v1/demo.json,404 absent,45MiB cap, existing access gate. No user paths. Original/enhanced input provenance and evidence remain gitignored.
- Optional project.hero version1 within Ad Studio schema3/DB3: settings, immutable hero history/source lineage, explicit selected-hero review, immutable export snapshots, Blob asset IDs. Legacy1/2/3 migration additive. Director storage/source unchanged. Existing audio/FLAC/edit/export/product/brand/composition/setup/model-string/options+frames/FPS routes retained.
# Studio prompt preparation (2026-10-23)

Advanced review adds optional `details:{visual?,motion?,audio?}` to POST, with string fields limited to2000 characters each. Provided boxes override the original idea during explicit polish; an explicitly empty audio field remains silent. Existing prompt-only calls are unchanged. Studio Advanced Generate bypasses text rewriting and uses the reviewed visual/motion/audio values; Polish returns suggestions only. No automatic rewrite runs while Advanced is open; edits made during a pending polish cause its result to be discarded.

`GET /api/prompt-rewriter` returns `{available,busy,id,model,reason}` based on the connected ComfyUI node inventory and Qwen3 encoder. `POST /api/prompt-rewriter` accepts `{prompt:string,details?:{visual?,motion?,audio?},device?:"default"|"cpu"}`. Prompt is nonempty/max4000 chars, each reviewed field max2000. It returns validated `{visual,motion,audio,model}`. Core CLIPLoader?TextGenerate?SaveText (`prompt_polish.json`) runs through Comfy SDK/proxy and the shared serialized queue, using installed Apache-2.0 Qwen3 4B FP8. No llama.cpp child process/cloud/download/custom node. `/no_think` suppresses Qwen reasoning; native output is JSON-validated before use. Explicit silence survives rewriting. Missing support503, active rewrite/app generation409, invalid input/device400, malformed output502; authored UI fields are retained. Changing prompt/boxes in flight still discards stale results. Prompt generation currently accepts only default placement; explicit cpu returns400 before submission because native TextGenerate CPU-only placement fails in the installed ComfyUI build. GET reports cpuSupported:false. GPU/offload uses CLIPLoader default. Keyframe/shot requests additionally accept optional `textDevice` with the same values, forwarded to their CLIPLoader, with no change to the diffusion model's server-managed placement. Existing callers omitting placement keep default behavior.

## Studio precision image edit (2026-10-24)
`GET /api/precision-image` reports availability (installed Z-Image pack + graph nodes), model label and `automaticSubjectSelection:false`. `POST /api/precision-image` accepts `{image,mask,prompt,seed?}`: both images must be API-owned `/outputs/<16hex>.png`; prompt1?2000 characters; matching dimensions <=768?768 total pixels; mask green channel must contain a nonzero selection. Returns `{url,width,height,seconds}`. Authentication/origin guard, SDK?proxy, serialized GPU queue and output ownership follow existing endpoints. `precision_zimage.json` uses existing Z-Image weights, VAEEncodeForInpaint + noise mask, then ImageCompositeMasked against the source so unselected working-image pixels are preserved. This is experimental masked resynthesis, NOT a dedicated instruction-edit model or tracked video editor. No dependency/model downloads. Existing keyframe/LTX/audio graphs and Ad Studio routes unchanged.

## Studio local captions (2026-10-24)
`GET /api/captions` returns `{available,model,setup}` by checking `LoadAudio` and repo-owned `OSHWhisperCaptions` node/model readiness. `POST /api/captions` accepts `{audio:'/outputs/<16hex>.<audio-or-video>'}` with API-owned WAV/FLAC/MP3/M4A/Ogg/WebM/MP4, <=32MB and <=600s. Uses existing auth/SDK/proxy queue and `captions_whisper.json`: LoadAudio -> OSHWhisperCaptions. Returns `{model,language,duration,seconds,segments:[{start,end,text}]}` with times relative to the source. Node writes a JSON text-file asset consumed via SDK Output.toBytes, rather than reading a bypass generation endpoint. Whisper Tiny multilingual / faster-whisper CPU int8 uses local files only; word timestamps are grouped into <=42-character/~4-second phrases. Quiet audio returns empty segments. Review speech recognition before applying. Studio offsets captions by the selected source's sequence start, validates source identity/URL on apply, and replaces only that source's caption group. Existing generation graphs/routes unchanged.
Explicit installation: run `shared/runtime/setup-captions.py --comfy-root <ComfyUI folder>` using that instance's Python; it installs requirements-captions.txt, downloads pinned MIT Whisper Tiny weights and copies the repo-owned node. Restart idle ComfyUI. Inference never auto-downloads. Setup/model/licenses recorded in notes/studio.md; existing models and packages remain in place.



## 2026-10-23: isolated Qwen2511 benchmark, not production
hero_qwen2511_benchmark.json is an API-format flattening of the official Comfy template pinned in adstudio/benchmark/qwen-hero-pins.json (MIT original notice retained). TextEncodeQwenImageEditPlus CLIP/VAE/image1 conditioning on positive and negative, source VAE latent, index_timestep_zero,40steps/CFG4/euler/simple/denoise1/shift3.1, no Lightning. FP8 editor default, optional BF16 explicitly chosen by standalone benchmark script. All nodes/schema match local0.42.4; actual inference NOT RUN because editor/encoder/VAE weights absent. No new route, SDK signature/default or production model-catalog change. Existing Z-Image /api/keyframe and /api/hero/reimagine are not Qwen-edit endpoints. Standalone check/prepare never submits; opt-in Windows-local render uses SDK -> proxy, requires explicit approval and verifies publisher weight hashes; remote rendering blocked pending a separately approved Qwen lease/health/termination adaptation. All private refs/raw evidence stay outputs/ gitignored.


## Ad Studio Qwen Hero adapter (2026-10-24, additive)

`POST /api/hero/qwen` / `OSH.qwenHero(image, settings, originalDataURL)` uses the unchanged `hero_qwen2511_benchmark.json` official FP8 reference-edit graph, pinned by `hero_qwen2511_contract.json`. Request: API-owned PNG, original image bytes, `imageModel: qwen-fp8`, reviewed source/hash/seed-bound brief and exact prompt.20MB JSON cap;10MB original limit. Optional concise-v2 draft fields preserve legacy v1 draft/full-prompt compatibility. Sampler40steps/CFG4/euler/simple/denoise1 remains pinned. No frame/FPS/audio/video or Director API changes.

`GET /api/hero/capabilities` retains finish/reimagine fields and adds qwen readiness, missing model/node/file details and required pins. It never downloads files. Names/local sizes are checked for availability; actual SHA256 verification runs before submitting against a readable folder for the same ComfyUI (`COMFYUI_MODELS_DIR` or existing setup config). SDK -> current proxy -> ComfyUI, same serialized GPU queue/activity IDs; no HTTP-selected mock mode, automatic retry or fallback. Z-Image rejects explicit Qwen requests.

Success returns the untouched SaveImage PNG URL/hash/dimensions, source/original hashes, Comfy job ID, workflow hash and provenanceId. Private `outputs/hero-qwen/<id>/provenance.json` records both prompt forms, reviewed draft, graph/model hashes and timing. PNG checksum/pixel/executed-workflow mismatches fail without publishing a replacement. Product preservation controls are requested intent, not enforced geometry or quality certification. See adstudio/QWEN_HERO_INTEGRATION.md.

## Optional same-origin Qwen app acceptance relay (2026-10-24)

`GET /api/hero/qwen/provenance/<16hex>` exposes only the saved bounded job manifest through the existing API access gate (404 if absent). No arbitrary paths. Existing SDK signatures, graphs and production generation defaults remain unchanged.

Opt-in `QWEN_APP_RELAY_URL=http://127.0.0.1:28301` plus `QWEN_APP_SESSION_DIR=<repo>/outputs/.../session` routes only Qwen capability/submission/activity through an authenticated SSH loopback tunnel to this same API beside readable GPU weights. Other APIs and every local output remain local. Explicit one-job approval binds browser origin/source/prompt/seed/commit/exact lease and fresh independent Pod heartbeat. No implicit remote/private upload. `QWEN_APP_REMOTE_SESSION` enables the additional durable one-job gate on the remote API before SDK submit. This is acceptance infrastructure, not automatic provisioning or a model default.

The local relay validates raw output/provenance and durably collects original/reference/raw/manifest/opaque PNG before returning success with a local URL; only then may the collection monitor terminate the exact Pod. An interrupted request is never automatically resubmitted. Unset env preserves the existing local Qwen path and Director behavior. Browser/real app GPU acceptance remains unverified. See adstudio/QWEN_APP_ACCEPTANCE.md.

2026-10-25 transport correction: only the approved loopback inference POST uses
Node's built-in HTTP client to avoid fetch/Undici's independent300s header timeout.
The request still has a firm connect/upload/header/body deadline: min(30min,
Pod-deadline minus10min). Response metadata is streamed with a512KiB cap; redirects
and retries are forbidden. All source, provenance, one-job, approval, collection
and termination contracts above remain unchanged. No shared API signature change.


## Integrated main acceptance metadata (2026-10-24)
Captions/Qwen both retain X-OSH-Request activity tracking. OSH.qwenHero adds optional fourth projectId; POST accepts optional projectId and provenance records it. Existing three-argument calls remain valid; only opt-in one-job acceptance requires exact project/brand/source/product binding from a genuine browser export. Project schemas and Director APIs remain unchanged. The Qwen graph byte pin now matches canonical tracked LF bytes (8dc8cd...), fixing fresh checkout/archive readiness without changing graph content or weakening validation. Both current native Comfy prompt-polishing/textDevice and Qwen services coexist. See notes/cross-project-handoff.md.

## ComfyUI loading diagnostics (2026-10-24)
Tracked /api/activity/<request> responses may add diagnostics: [{at,source,message}], capped at8 loading-related lines. Sources distinguish SDK job logs from comfy-server / managed-server output. Existing fields and generation contracts are unchanged. Current node metadata names the loader/model; real SDK progress continues to own phase/percent. Server-wide console output never changes a job percentage or claims attribution to that job.

During tracked SDK runs only, the local runtime optionally probes the fixed loopback ComfyUI /internal/logs/raw endpoint. This is an upstream frontend-internal, version-dependent endpoint, not a required public API:404/malformed/oversize/timeout responses fall back without failing/substituting generation. Baseline messages are skipped, polling is bounded and stops even if submit fails. Studio-managed ComfyUI also drains stdout/stderr with unbuffered Python as a console fallback. No node installation, restart, model run or generation bypass is required. Only selected loading lines pass through; credentials/URLs/local directories are filtered. Console diagnostics are best-effort observations, not evidence of job success.

Local setup compatibility (2026-10-26): GET /api/setup may include optional canStart and launchDirectory. POST /api/setup/start supports detected existing local installs in addition to managed ones; saved launchDirectory is optional. Generation graph/API schemas unchanged. These lifecycle endpoints retain same-origin loopback and generation locks.

## Studio semantic search and caption model selection (2026-10-26)
`semantic_minilm.json` runs repo-owned `OSHSemanticSearch` through the existing Comfy SDK/proxy route. `GET /api/search` reports local availability; `POST /api/search` accepts a query (1..256 chars) and1..128 unique `{id,text}` descriptions (text<=1200 chars). Returns normalized cosine-ranked IDs/scores. Existing API authorization/origin guards retained. CPU only, local-files-only MiniLM L6 safetensors; no external inference, image analysis, or auto downloads. Busy generation/setup returns409; browser keeps literal matches, debounces/aborts stale searches and briefly retries contention. Bounded query and embedding caches; literal hits remain visible. Currently Elements is Studio's only explicit search bar. Setup: run `shared/runtime/setup-search.py --comfy-root <folder>` using ComfyUI Python and restart idle ComfyUI. Requires existing torch/transformers; no new package dependency.

Caption `GET /api/captions` adds `models:string[]` of installed node-advertised Whisper choices. `POST /api/captions` adds optional `model` (must exactly match an advertised option); omitted defaults to first installed. Selected model is passed to node2, and returned transcript provenance reports that model. Repo node discovers installed Tiny/Base/Small/Medium/Large-v3 CTranslate2 directories under models/whisper, always CPU/int8 and local-only. Setup accepts `--model tiny|base|small|medium|large-v3` and `--skip-deps`; default Tiny behavior remains. No inference/download on model selection. Existing output/size/timing gates retained.


### Studio image LoRA training (2026-10-26)

`GET /api/training?projectId=...` returns native/custom-node readiness, compatible Z-Image Turbo base and project-filtered run records. `POST /api/training` accepts a named project dataset of 1?24 API-owned PNGs with individual captions, bounded steps/rank/size/learning-rate/seed. It requires idle ComfyUI and runs the dynamic graph from `shared/lib/training.ts` through the SDK/proxy; training is not silently retried after uncertain job failures. FP8 frozen base, BF16 bypass adapters, block checkpointing, AdamW/batch1 are the tested12GB path. Repo-owned `osh_training` nodes split image/caption batches and save safetensors plus exact base/run/step metadata. Results copy to API-owned downloads and ComfyUI `loras/studio`; only completed records with an advertised matching file become child model choices (`studio-tune:<runid>`). Image inference inserts `LoraLoaderModelOnly` before model sampling; parent model settings remain in effect. Existing catalog consumers may ignore optional `parentId`/`loraFile`. API-owned safetensors are served as octet-stream. Initial image-only contract is extended by the video/geometry section below. No audio or full-model training support.


### Video and3D training extension (2026-10-26)

TrainingInput remains backward compatible: `images` is the dataset-entry array; entries are PNGs for image/geometry, MP4/WebM for LTX video. Video additionally validates `frames` (9?49,8n+1) and `fps` (1?60); OSHVideoTrainingDataset decodes only selected temporal indices, resizes and VAE-encodes a whole clip, preserves caption/FPS, then OSHTrainingConcat retains per-example pairing. Geometry entries add an API-owned `.obj` `mesh` alongside reference PNG; caption may be empty because conditioning is visual. `/api/training-mesh` accepts bounded OBJ text, strips resource paths and returns opaque OBJ URL. Mesh tensors are made by the frozen official encoder, never by replacing a mesh with a rendered still.

`GET /api/models` gains additive `geometry` choices; optional parentId/loraFile continue to identify exact base-specific adapter children in each media group. `/api/shot` patches the LTX sampler model when a video adapter is selected. `POST /api/geometry` validates owned reference, model/adapter and bounded seed/steps/voxel resolution, executes `shared/lib/geometry.ts` through SDK/proxy and copies a validated GLB to API outputs. OSHSaveGeometry bridges native GLB bytes into SDK-supported output descriptors. API-owned `.glb` serves `model/gltf-binary`; `.obj` serves plain text. No other arbitrary files are exposed. Material training is explicitly unavailable, not silently mapped to geometry or image training.

The optional Hunyuan mini model pack is hash-pinned. `ModelFile.sha256` permits integrity validation of its official encoder `.ckpt`; Comfy loads that encoder with PyTorch `weights_only=True`. Existing safetensors structural checks remain for models without manifest hashes; existing Ad Studio routes and shapes remain compatible.


## Ad Studio creative intelligence gates (2026-10-26)

No route removals, storage migrations, UI changes or production image/video model
pin changes. CreativeContext optionally adds `grounding`: business identity,
appearance, positioning, declared preferences, hypotheses and customer objective.
Old saved plans remain readable. New plans use distinct composition/environment/
lighting proposals and deterministic recommendation; model self-scores are archived,
not used as measured quality. Owner locks resolve before Qwen prompt compilation.

GET `/api/creative/status` may add `checks:{weights,loader,text,output}`. It now
checks the actual CLIPLoader type/device, TextGenerate controls/token limit and
SaveText format, not just node names. Text planning requires loopback HTTP ComfyUI
and proxy configuration, never a silently selected remote provider. Native workflow
still uses existing Qwen3 4B FP8: greedy/no thinking/template+system,600tokens,
150s scoped SDK wait including in-flight polling/result abort,15s output fetch,
32KB text limit; failed text job cancellation
targets only that job. No expired-job retry for creative text; Director's default
30min workflow timeout/retry behavior is retained. Saved planning.json records
actual context/settings/provider/timing; no duplicate image data.

Ad Studio text status/submission additionally checks the native queue and
conservative free/reclaimable VRAM (6GiB) / free RAM (2GiB) headroom, before and
inside serialization. Busy/unverifiable/low-headroom states do not submit text;
source products and explicitly non-AI planning remain available. This admission
policy is not a model-fit/speed guarantee. Failed text reports job/native state
and cancellation-request status; cancellation is never claimed as termination.
Invalid returned text is retained as raw evidence without successful observations.
Explicitly accepted inferred style preferences may guide planning but remain
inferred evidence, not verified business claims.

Qwen image hashes, source binding, review freshness, paid/private gates, one-job
receipts, long HTTP transport, exact-Pod watchdogs and provenance remain unchanged.
Model absence still yields explicit deterministic suggestions, never fake AI.

## Qwen3 planning contract repair (2026-10-26)

Routes/Director defaults/image pins are unchanged. Planning now sends exact
context-derived permittedEvidenceIds/permittedCopyIds, a complete compact JSON
shape and physical framing/camera instructions. Appearance with confirmed:false
may inform proposals but is absent from the evidence allowlist. CreativeContext
optionally adds observedCount derived from existing owner input (no vision/schema
migration); old plans stay readable and are never rewritten.

`creative-json.ts` is a bounded strict parser, not general JSON repair: only known
schema-key whitespace is normalized, with audited paths. Duplicate decoded keys,
normalized collisions, unknown fields, malformed JSON and coerced/missing values
fail closed. All original values/evidence IDs are retained. `planning.json` adds
normalizations/validationIssues/rawTextReturned and exact model request. Invalid
responses remain raw evidence and yield labeled deterministic fallback, not AI
success. Local check reports actual returned text separately from validated AI.
No automatic retry. Existing review/hash/one-job/lease/transport/budget checks remain.


Caption device selection (2026-10-26): GET /api/captions includes devices (cpu, optional cuda). POST accepts optional device, default cpu; validates against the installed node schema. Legacy CPU-only nodes remain supported. CUDA is advertised only when CTranslate2 detects a device, float16 support, CUDA12 cuBLAS and cuDNN9 libraries. CPU uses int8, explicit CUDA uses float16. No inference-time downloads.

Caption language and capability update (2026-10-26): GET /api/captions adds languageSelection and modelDevices; model support is distinct from devices available in the current runtime. POST optional language defaults to auto; explicit selection requires updated native caption node, never silently ignored. Native Whisper validates language codes and rejects highly repetitive output. No inference-time downloads.

Admin diagnostics (2026-10-27): local-computer/origin-protected GET /api/errors returns newest-first bounded entries {id,at,source,message,details,status?,requestId?}. Per-port server history retains100 errors across restarts; no body/header capture, secret/media/query redaction. Existing generation responses unchanged.


Caption SRT library (2026-10-27): Successful POST /api/captions adds srt (API-owned /outputs/<16hex>.srt, null for empty transcript). POST /api/captions/srt accepts {segments:[{start,end,text}]} with at most500 validated cues and24h end limit, returning {url}. Existing local auth/origin gates apply. SRT outputs use application/x-subrip; charset=utf-8. Omitted caption device selects first available compatible node device; explicit validation remains supported. Source associations live in project metadata.


## Ad Studio local Klein background (2026-10-27)

Additive GET /api/hero/capabilities.klein describes actual pinned-file hashes,
native graph/schema, completed-runtime proof and current queue/memory readiness.
It includes installed/tested/available/status/reason, precision/license/disk size.
Graph: klein4b_background.json; pins: klein4b_fp8_contract.json. Model Apache-2.0,
512x640/four-step distilled FP8, existing Qwen3-4B FP8 via native flux2 loader,
Klein-pack VAE. No file-name-only readiness and no automatic downloads.
Private ADSTUDIO_KLEIN_MODELS_DIR optionally selects Ad Studio's readable files
without altering Director setup. SDK -> existing proxy -> local ComfyUI only.

POST /api/hero/background accepts requestId/projectId/planId/preparedId/image/current.
Server validates immutable reviewed plan/current snapshot/owned normalized source
hash and retained original hash/permissions, compiles background-only instructions,
then creates an exclusive prepared receipt. Exactly one submission per reviewed
receipt; reuse409, no retry. A fresh explicit review is required for a new attempt.
Queue/headroom rechecked inside existing serialization; unknown/busy/low headroom
rejects before submit. Native resources use3.5GiB reclaimable VRAM/4GiB free RAM
policy, not a model-fit guarantee. Overall execution600s, output retrieval15s.
POST /api/hero/background/cancel requires matching requestId/projectId; aborts only
that job and requests exact SDK cancellation, never global interruption. Progress
uses existing X-OSH-Request/activity events. Cancellation requested != termination.

Returns raw generated background URL/hash/dimensions/seconds/model/job/provenance/
prompt/seed/workflow hash. Raw PNG CRC/inflate/dimensions/executed graph are checked;
512x640 only. No product photo or typography is generated. Project/source binding,
model pins and unmodified output remain in outputs/hero-klein/<id>/. Normal native
cache release is requested only if our own completed job is last and queue empty;
no unrelated applications or system GPU settings change.

HeroTake optionally adds background (including raw assetId/hash/prompt/job/seed)
and adDesign snapshot; CreativeWorkspace optionally saves generationEngine. DBv3
and earlier data remain compatible. Existing static compositor receives original
photo +generated support; deterministic text and original logo stay separate.
Existing takes/exports remain; re-edit/export never resubmits diffusion and never
uses a completed ad as the foreground image. Automatic prefers verified local
Klein, otherwise product-safe; explicit AI errors are never relabeled as success.

Qwen remains optional: CRLF-only workflow normalization is checked against the
existing LF content pin; any other change fails. Model weight hashes unchanged.
A remote Qwen relay's capability/admission is remote, not the client's local VRAM.
All paid/private, source/review, one-job, long HTTP and watchdog guards remain.

## Ad Studio source-integrated campaigns (2026-10-27)

POST /api/hero/campaign is additive and remains local SDK -> proxy -> ComfyUI.
Accepts requestId, projectId, planId, preparedId, image, current and promptSha256.
Header/body request IDs must match; reviewed source/original/brand/seed snapshot
and compiled environment-prompt SHA256 must match. Same exclusive prepared receipt
as background/scene: one pipeline, no retry. Pipeline = one native BiRefNet mask
(product_cutout.json/contract, MIT pinned444473596-byte weight) plus one existing
Klein background graph; no generated product geometry. Empty/ambiguous mask fails
closed, explicit AI never falls back to a framed photo. Existing background and
experimental reference-scene routes remain distinct. Production defaults use the
source-preserving campaign. Queue/admission/deadline/owned cancellation unchanged.

Capability klein.mode=source-integrated requires BOTH verified runtime proofs,
all four model pins, native nodes, headroom and idle queue; includes extraction
license/checks and complete disk bytes. No model/dependency download at startup.
Normal cache release after our completed text/mask/image job is guarded by exact
last-job identity and idle native queue, never a global job interrupt.

Response model=klein-integrated is a deterministic composite, NOT a raw diffusion
photograph. Includes separate unchanged raw background URL/hash/prompt/seed/job,
cutout URL/hash/mask job/method/source box and uniform placement, source hash,
integrated scene URL/hash768x960 and provenance. Raw mask/source checks and exact
executed graph remain strict, including hash verification of native SDK input.
Native duplicate input names with literal spaces/parentheses are URL-encoded;
absolute/traversal paths and non-loopback reads remain rejected.

HeroTake optionally stores scene (raw background +cutout assetIds/provenance) and
campaign design snapshot; HeroSettings additionally accepts klein-scene and
klein-integrated IDs. No DB/schema/origin version change. Old takes/recipes remain
valid. Campaign renderer is selected only by the optional version1 campaign field;
product-safe layouts are unchanged. Source-isolated scene is saved before export;
export/history recovery reuses its raw assets without inference or stale saves.
