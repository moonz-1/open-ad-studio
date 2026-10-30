# Evaluate Open Ad Studio

Open Ad Studio helps a small business turn its own product evidence into an advertisement. The user reviews discovered products, approves a creative direction, chooses how much the photograph may change, and exports a designed PNG.

The connected workflow is the contribution: product evidence, planning provenance, physical constraints, composition, reference-conditioned photography, product review and editable typography share one saved project. A text model is not treated as a visual inspector. Generated product pixels require comparison with the original.

## Run the public application

Install Node.js **22.18 or newer** with npm once; Node 22.20 is used for this audit. Download/extract the ZIP and double-click `start.cmd` on Windows, or use `sh start.command` on macOS/Linux. The launcher installs application packages, builds and opens Journey. Git is optional for the ZIP path. See [installation](INSTALL.md) and [AI connection](CONNECT_AI.md).

The launcher prints the actual loopback address, normally `http://127.0.0.1:8341/adstudio/journey.html`, and selects a free port safely when necessary. Keep that address/browser profile for saved work. Production builds are bound to source and asset hashes; Git checkouts additionally retain the clean-revision requirement.

The normal customer page is Journey. Classic workspace is available at `/adstudio/workspace.html`. Keep the same origin for browser-saved projects; changing ports creates separate browser storage. `GET /api/release` identifies the running compiled build.

## What needs a model

| Operation | Requirement and honest status |
| --- | --- |
| Website discovery | Public, accessible pages and an internet connection; some protected or script-rendered sites need manual product upload. |
| Product-safe PNG | Authorized input photograph, Node and the app. Original photo pixels plus digital layout; no AI image inference. |
| Qwen creative planning | Separately installed local ComfyUI, Qwen encoder and native text nodes. Successful AI execution has a job identity; authored and Basic planning keep different provenance. |
| Klein scene generation | Separately installed ComfyUI, the pinned three-file Klein pack, suitable GPU memory and matching SDK proxy. |
| FLUX.3 generation | Explicit engine, accepted model terms, compatible backend and the four contract components. CPU tests do not establish live model quality. |
| Photograph-motion MP4 | FFmpeg/FFprobe installed separately. This moves existing photographs; it is not generative LTX video. |
| LTX video | Experimental optional path. A successful commercial-quality LTX acceptance is not claimed. |

Models and ComfyUI are not bundled. Follow [model setup and terms](MODELS_AND_LICENSES.md), [Klein bootstrap](KLEIN_BOOTSTRAP.md), and the [FLUX runtime contract](FLUX3_RUNTIME.md). Install the local SDK proxy with `python -m pip install -r shared/runtime/requirements.txt` in your chosen Python environment; this command does not install ComfyUI or model weights. Configure existing backend paths in a gitignored `.env` as described in `.env.example`. No API key is needed for Product-safe composition.

Local inference runs through `@comfyorg/sdk`, the loopback `comfy-api-proxy`, and native ComfyUI graphs in [`shared/workflows`](../shared/workflows/). Creative Intelligence compiles the selected `creative-brief-v2` into the photographic scene; approved headline/body/CTA are typeset separately by Graphic Art Director. Product geometry also guides copy placement. Identity/framing failures must remain visible and can block export; typography does not repair incorrect products.

The published snapshot audited here is `3c922518`. The incoming Comfy Cloud branch is **not integrated or accepted in this staging release**. Its native graph, exact weights, Journey generation, credits and saved output must be verified before its behavior is advertised. RunPod is a separate opt-in controller; dry-run proof does not mean a worker is prepared. All spending remains disabled in this audit.

Keep ComfyUI and the app on loopback. Never publish `.env`, keys or customer images. App code is MIT; external software, fonts and model weights retain their own terms. See [third-party notices](THIRD_PARTY_NOTICES.md).

[Measured release findings and integration procedure](release/STAGING.md) | [110-second demo and submission checklist](SUBMISSION.md)
