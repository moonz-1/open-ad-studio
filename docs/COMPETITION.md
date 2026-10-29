# Open Source Higgsfield — compliance notes

Rules: https://comfy.org/open-source-higgsfield/  
Deadline: **30 October 2026, 9:00am PT**.

## Entry requirements (checklist)

| Requirement | Status in this repo |
|-------------|---------------------|
| Public GitHub repository | Target: `https://github.com/moonz-1/open-ad-studio` |
| OSI-compatible license | MIT (`LICENSE`) |
| Setup / launch instructions | `README.md` |
| Working creative app + UI | Journey + Classic workspace |
| Comfy Developer Platform | `@comfyorg/sdk` + `comfy-api-proxy` + workflow JSON |
| Workflow files included | `shared/workflows/` |
| Demo video ≤ 2 min | **Owner records** (outline in `docs/SUBMISSION.md`) |
| Social post `#OpenSourceHiggsfield` | **Owner posts** |
| Lawful / SFW / no unlicensed likenesses | App gates + docs; use only authorized photos |
| Submission form | https://form.typeform.com/to/V1dSQrkS |

## Category findings (do not overclaim)

### Open Weights Only (RTX 5090)

**Intended posture:** open-weight models only; no partner image API nodes on the critical path.

- Product-safe, Klein, Qwen planning, FLUX.3 mi2i graphs are open-weight oriented.
- RunPod (when enabled) is **rented GPU** hosting ComfyUI + your weights, not a closed generative API. Competition Q&A: rented GPUs still count for “fully open” if models/nodes/deps are open.
- **Disclose:** FLUX Kommunity / gated HF downloads require the user’s own license acceptance. `@resvg/resvg-js` is MPL-2.0 (layout), not an inference partner node.
- Uncertain items should be reviewed against the live form’s “fully open” wording before checking that box.

### Built with FLUX (bonus)

FLUX.3 Klein BF16 mi2i is the explicit Creative Restage still engine when authorized. Eligibility requires FLUX 3 as a **core** model in the demonstrated workflow — show Journey Generate with FLUX.3 in the owner demo if claiming this bonus. Do not claim from the filename alone without a working run.

### LTX VFX bonus

LTX workflow definitions are present. **Generative LTX film is experimental** and not asserted as demo-quality commercial VFX in this release. Photograph-motion MP4 is **not** an LTX-core claim. Only claim the LTX bonus if the owner demo actually uses LTX as the core video model.

### Most Innovative / Most Viral / Best Overall

Judging is subjective. Innovation to highlight: evidence-bound Creative Intelligence + Composition & Dynamics + identity/framing gates + GAD finish, with optional one-click private RunPod FLUX — an agency workflow on Comfy, not a raw graph dump.

## What this package deliberately excludes

API keys, `.env`, SSH keys, model weights, private customer media, Abel private benchmark packs, internal agent notes, and development outputs.
