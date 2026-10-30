# Connect AI

You can explore the app and make Product-safe PNGs before connecting any AI. No backend is purchased, started or downloaded by the launcher.

## No GPU or credentials

Upload a photograph you may use, select **Basic draft - no AI planning**, approve a direction and choose **Product-safe design**. The app composes your original pixels with digital typography. Authored and Basic plans are not described as AI successes.

## Local ComfyUI

1. Install/start your existing ComfyUI on this computer. The default endpoint is `http://127.0.0.1:8188`; keep it on loopback.
2. Install the SDK proxy in your chosen Python environment: `python -m pip install -r shared/runtime/requirements.txt`. This does not install ComfyUI or weights.
3. Install only the models you want, after reviewing their terms. Follow [Klein bootstrap](KLEIN_BOOTSTRAP.md) and [models and licenses](MODELS_AND_LICENSES.md). Local Qwen planning uses the configured text encoder and native text nodes; a text model does not prove it inspected image pixels.
4. For non-default locations, copy `.env.example` to `.env` in this application folder and set `COMFYUI_DIR` / `COMFYUI_MODELS_DIR`, or the documented backend URLs. Restart the app. Automatic inspection reports installed-model, node, queue and GPU-memory availability; it does not make missing models operational.
5. In Journey, select the desired engine under **Advanced · generation engine**. Unavailable engines explain their configuration error and do not become successful AI output.

Klein 4B FP8 and FLUX.3 BF16 have different requirements. The coded FLUX.3 admission floor is 18 GiB reclaimable VRAM plus 12 GiB free host RAM, not a fit guarantee; the tested 10 GB RTX 3080 fails that BF16 requirement. See [FLUX runtime details](FLUX3_RUNTIME.md). GPU drivers, compatible Comfy nodes and all model terms remain your prerequisites.

## Comfy Cloud

**Release status:** the committed native Cloud adapter is integrated as experimental, with fresh-install spending disabled. CPU contracts and unavailable-model recovery are tested. This release audit does not certify a new paid Journey Generate result. Earlier direct Cloud outputs do not establish full customer-click acceptance.

Comfy's [SDK quickstart](https://docs.comfy.org/development/deploy/cloud) requires a paid subscription and API key. [Standard supports one concurrent workflow](https://docs.comfy.org/development/deploy/cloud-usage); Creator supports more concurrency/custom model import. Start by checking managed FLUX.3 Distilled Edit model availability in your account. Do not upgrade or subscribe merely because a source file names a model. Consult [current pricing](https://comfy.org/pricing) yourself; this app does not purchase a plan.

Shortest safe setup:

1. Create an API key at https://platform.comfy.org/profile/api-keys.
2. Copy `.env.example` to `.env` **in this application's folder**. Add these server-only values in a local text editor:

```dotenv
COMFY_API_KEY=<your-key>
ADSTUDIO_COMFY_CLOUD_ENABLED=1
ADSTUDIO_COMFY_CLOUD_COMPAT_CONFIRMED=0
ADSTUDIO_COMFY_CLOUD_SPEND_APPROVED=0
ADSTUDIO_COMFY_CLOUD_SOURCE_POLICY=reviewed
```

3. Run `node scripts/verify-comfy-cloud-key.mjs`. This explicit GET-only authentication check reads this installation's environment; it never writes/copies `.env`, uploads photos or submits jobs. Authentication does not establish compatible models, credits or successful inference.
4. Confirm the required weights/nodes for the pinned native workflow in your Cloud account. The RC maps the BF16 transformer/encoder filenames to Cloud int8 counterparts; both reviewed reference slots use the selected customer's source, not a bundled brand photograph. Account compatibility remains an acceptance requirement. Leave compatibility off until verified.
5. Only when you authorize credit spending, set compatibility and spending approval to `1`, restart, choose **Comfy Cloud / FLUX** in Journey and explicitly click Generate. The reviewed-source policy permits transfer only after the app's source/brief checks; the default allowlist policy is stricter and can instead bind exact normalized source hashes.

Each explicit Generate can consume credits. Cloud API jobs share the account's Cloud credit pool. The adapter serializes jobs and does not automatically retry paid failures, but **does not enforce a hard per-ad credit ceiling**. Before retrying a timeout, inspect the existing Cloud job/receipt; a second submission can bill twice. Turn spending back off in `.env` when you no longer want paid generation enabled.

Never commit `.env`, paste a key into the Journey, prefix it with `VITE_`, or expose ComfyUI/proxy ports publicly. No UI credential vault is claimed. This release uses a short local configuration file rather than adding an unreviewed credential form.
