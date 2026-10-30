# Competition findings

Checked against the [official competition page](https://comfy.org/open-source-higgsfield/) and the [live submission form](https://form.typeform.com/to/V1dSQrkS). Deadline: **October 30, 2026, 9 AM Pacific / noon Eastern**.

The form requires a public licensed repository with setup instructions, a video showing the build and its construction in under two minutes, and a social-post URL with `#OpenSourceHiggsfield`. A live application link is optional. The owner must attest to lawful/SFW media and permissions, accept featuring terms and confirm this is their only submission. [Recording and form handoff](SUBMISSION.md).

## Categories

| Category | Recommendation |
| --- | --- |
| Best Overall | Every entry is considered automatically. |
| Most Innovative | Recommended. Explain the connected evidence-to-brief-to-photography-to-design workflow and review gates in the demo. |
| Most Viral | Optional; show the actual experience and outputs. |
| Open Weights Only | Conditional. The rule excludes partner nodes and closed-source APIs; the form asks whether every model/node/dependency is open, with no closed API model in the critical path, and allows rented GPUs. Local native open-weight graphs support the intended claim. Managed Comfy Cloud transport alone does not prove eligibility or ineligibility. Inspect the final graph, weights and actual run; disclose uncertainty rather than treating SDK transport as certification. |
| Built with FLUX 3 | Claim only after a genuine demonstrated FLUX.3 run establishes it as the core still-image model. Filenames, tests and an unexecuted Cloud adapter are insufficient. |
| VFX Built with LTX | Do not claim on the present acceptance record. Included LTX graphs and photograph-motion MP4 do not establish LTX as the core demonstrated video model. |

## Measured package status

The independent public clone at `3c922518` is public and MIT-licensed, with third-party notices and Comfy workflows. Node 22.20 installation/build/start and desktop/mobile launch were tested. A fresh-clone consolidated-test directory defect is fixed on the separate submission-staging branch. See [exact audit and integration procedure](release/STAGING.md).

No model checkpoints or product photographs are tracked at current HEAD. However, **`adstudio/assets/field-study.png` remains retrievable from the initial public Git history**. The owner must establish redistribution permission or authorize history/hosting remediation before making the unrestricted rights attestation. This engineering task does not rewrite public history.

Incoming Comfy Cloud support is pending Cursor's verified handoff. No new Cloud image, paid inference, final visual quality or Cloud credit ceiling is certified by this audit. Keep local Qwen/Klein, Product-safe and separate RunPod routes intact during final integration.

## Licensing distinctions

Application code: MIT with original contributor attribution retained. Bundled fonts: SIL OFL with notices. Workflow templates: Comfy Org MIT notice retained. Resvg: MPL-2.0; other installed npm packages inspected use MIT/Apache/BSD/ISC terms. These licenses do not relicense model weights.

FLUX.3's distribution states FLUX Kommunity terms, including qualifying-user conditions for commercial output; FLUX.2 Klein 4B FP8 states Apache-2.0. LTX and optional audio have separate custom terms. Use the [model inventory](MODELS_AND_LICENSES.md) and upstream terms for the actual configuration. Do not describe all open weights as unrestricted commercial software.

**Recommendation:** proceed toward Best Overall / Most Innovative. Final submission is conditional on a truthful working demo, rights resolution and owner completion of publication/social/form steps. FLUX and Open Weights claims require the final execution evidence; omit LTX bonus unless separately proven.
