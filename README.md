# Open Ad Studio

**An open-source AI creative agency that turns brand and product evidence into advertising campaigns — built on ComfyUI.**

Open Ad Studio is a local web application for the [Comfy Org Open Source Higgsfield](https://comfy.org/open-source-higgsfield/) competition. Bring a business website and authorized product photographs; review AI creative directions grounded in what you can actually see; generate or compose campaign stills through the **Comfy SDK**; verify product identity and framing; finish typography with the Graphic Art Director; export a PNG. Optional photograph-motion video extends the same campaign plan.

> **Honest scope.** Product-safe composition (original photo + design) works offline without GPU weights. Local Qwen creative planning and Klein / FLUX.3 scene generation need ComfyUI and open-weight models you install yourself. One-click RunPod FLUX orchestration is implemented and **dry-run verified**; live cloud spend is opt-in and off by default. Genuine LTX generative video is experimental and not claimed as commercially ready.

---

## Features

| Area | What you get |
|------|----------------|
| **Creative Journey** | Guided flow: brand → products → AI concepts → editions → reveal |
| **Creative Intelligence** | Source-bound briefs and visual directions (local Qwen when configured) |
| **Composition & Dynamics** | Image-aware layout, copy boxes, photographic captions for restage engines |
| **Product identity & framing** | Gates that refuse silent “product-safe” swaps when generative checks fail |
| **Graphic Art Director** | Typography and campaign finish on the approved photograph |
| **Static export** | PNG advertisement cards with editable copy |
| **Static → video** | Same creative plan; photograph-motion MP4 (CPU) and optional LTX path |
| **Comfy Developer Platform** | `@comfyorg/sdk` → `comfy-api-proxy` → ComfyUI (loopback) |
| **FLUX.3 mi2i** | Pinned open-weight Klein BF16 multi-reference workflow (explicit engine) |
| **RunPod controller** | Server-side detect / budget gate / SSH tunnel / release (never public Comfy) |

---

## Autonomous workflow (supported)

```
Website + product photo (permission + visible facts)
  → Creative Intelligence / Creative Director concepts
  → You approve a direction
  → Generate Advertisement
       ├─ Product-safe: compose original pixels + GAD typography → PNG
       ├─ Klein / FLUX.3: Comfy SDK inference → identity/framing review → GAD → PNG
       └─ Optional film: photograph-motion (or experimental LTX) from the same plan
```

No partner/API image nodes are required for the open-weights path. FLUX.3 and Klein use local or privately tunneled ComfyUI only.

---

## Quick start

**Requirements:** Node.js **22.18+**, Git. Optional: ComfyUI on `127.0.0.1:8188`, FFmpeg on `PATH`.

```bash
git clone https://github.com/moonz-1/open-ad-studio.git
cd open-ad-studio
npm ci
npm start
```

Open **http://127.0.0.1:8341/adstudio/journey.html**

```bash
npm run typecheck
npm run build
npm run test:release
```

Copy [`.env.example`](.env.example) to `.env` only when you need overrides. **Never commit `.env`.**

Windows: if PowerShell blocks `npm.ps1`, use `npm.cmd`. Double-click `start.cmd` also launches the release server after `npm ci` when needed.

---

## Create an advertisement (Journey)

1. Start the app and open the Journey URL above.
2. Enter a website and/or upload an **authorized** product photograph.
3. Confirm what you can see and that you have permission to use the image.
4. Develop creative directions (AI planning when Qwen is available, or Basic draft).
5. Approve a direction and choose edition count.
6. Select an engine (**Product-safe** always works offline; Klein/FLUX.3 need weights).
7. Generate → review identity/framing → export PNG.
8. Optional: photograph-motion film from the same campaign card.

---

## Inference backends

| Backend | Role | Notes |
|---------|------|--------|
| **Product-safe** | Supported | No AI pixels; original photo + layout |
| **Qwen (planning)** | Supported when installed | Local text planning via Comfy / configured encoder |
| **FLUX.2 Klein 4B** | Supported when installed | Product-locked / scene paths; ~6+ GiB free VRAM admission |
| **FLUX.3 Image Klein BF16 mi2i** | Supported when configured | Explicit engine; ≥18 GiB reclaimable VRAM typical; see [FLUX3_RUNTIME](docs/FLUX3_RUNTIME.md) |
| **RunPod one-click FLUX** | Experimental / opt-in | [RUNPOD_ONE_CLICK_FLUX](docs/RUNPOD_ONE_CLICK_FLUX.md); dry-run default; live flags required to spend |
| **LTX video** | Experimental | Not claimed as commercial-quality; photograph-motion is the reliable film path |

Consumer GPUs under ~12 GB generally **cannot** run FLUX.3 BF16 locally. Use Product-safe, Klein (if it fits), or an authorized remote worker.

### Local Qwen / Klein models

See [MODELS_AND_LICENSES](docs/MODELS_AND_LICENSES.md) and [KLEIN_BOOTSTRAP](docs/KLEIN_BOOTSTRAP.md). Example:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r shared/runtime/requirements.txt   # Windows
npm run models -- --models-dir "<your-ComfyUI/models>" --only klein4b --dry-run
```

Accept upstream licenses before downloading. Weights are **not** shipped in this repository.

### FLUX.3 / RunPod

1. Install ComfyUI ≥0.41 with the nodes listed in `shared/workflows/flux3_klein_bf16_mi2i_contract.json`.
2. Place the four contract weight files (or use a prepared volume on a private Pod).
3. Set `ADSTUDIO_FLUX3_INFERENCE=1` only after license acceptance.
4. For one-click cloud: read [RUNPOD_ONE_CLICK_FLUX](docs/RUNPOD_ONE_CLICK_FLUX.md). Keep `ADSTUDIO_RUNPOD_LIVE=0` until you intentionally authorize spend.

---

## Architecture

```
Browser (React Journey + Classic workspace)
  → Vite / Node API (shared/runtime/api.ts)
  → @comfyorg/sdk
  → comfy-api-proxy (loopback)
  → ComfyUI (loopback or SSH-forwarded private worker)
```

Workflow JSON (API format) lives under [`shared/workflows/`](shared/workflows/) with [`CONTRACT.md`](shared/workflows/CONTRACT.md). Key graphs include Klein scene/campaign, FLUX.3 mi2i, Qwen hero, and film/LTX variants.

---

## Competition packaging

- **License:** MIT ([LICENSE](LICENSE)) — OSI-compatible. See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES](docs/THIRD_PARTY_NOTICES.md) for attributions (including MPL-2.0 `@resvg/resvg-js`).
- **Platform:** Built on the Comfy Developer Platform (SDK + proxy + workflow files).
- **Open Weights Only:** Product-safe, Klein, Qwen, and FLUX.3 open-weight graphs avoid partner API nodes. Optional RunPod is rented GPU compute with **your** open weights — not a closed generation API. Disclose any uncertainty in [docs/COMPETITION.md](docs/COMPETITION.md).
- **FLUX bonus:** FLUX.3 is integrated as an explicit core still-image engine when enabled; live quality depends on your backend.
- **LTX bonus:** LTX workflows are included; generative film is experimental. Photograph-motion does **not** qualify as LTX-core VFX by itself.

---

## Contributing

Issues and PRs that improve reliability, docs, and open-weight paths are welcome. Keep secrets out of commits. Prefer Conventional Commits (`feat:`, `fix:`, `docs:`).

## Known limitations

- Live FLUX.3 / RunPod success depends on your GPU, licenses, and spend authorization — not claimed for every machine from this README alone.
- Generative video identity can drift; framing gates may block close-up food heroes under `full-product` mode.
- Website discovery cannot bypass logins, private networks, or script-only sites.
- This repo does not redistribute model checkpoints or private customer photographs.

## Source lineage

Standalone application extracted from Ad Studio work that began in the open-higgsfield collaboration. RC source commit: **`78b42e3`**. Public release commit: **`755bab8`**. See [NOTICE](NOTICE).

---

## License

[MIT](LICENSE) © 2026 Open Ad Studio contributors and open-higgsfield contributors.
