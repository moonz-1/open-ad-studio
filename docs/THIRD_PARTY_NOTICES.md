# Third-party notices

Application code originated in the MIT-licensed Ad Studio/shared portions of `dvsll/open-higgsfield`, source revision `d041f02c7dcbbbc4362947b152a14efc0dd3069b`. Retain the exact `Copyright (c) 2026 open-higgsfield contributors` notice in LICENSE. Upstream shared-runtime contributions remain credited; this extraction does not claim sole authorship. The correction commit also credits Cursor as a co-author. See its [source record](https://github.com/dvsll/open-higgsfield/commit/d041f02c7dcbbbc4362947b152a14efc0dd3069b).

## Installed software

| Component | Version inspected | License / source |
|---|---|---|
| Comfy SDK (`@comfyorg/sdk`) | 0.5.0 | MIT; https://github.com/Comfy-Org/comfy-typescript-sdk |
| React / React DOM | 19.3.1 | MIT; https://github.com/facebook/react |
| parse5 | 8.0.0 | MIT; https://github.com/inikulin/parse5 |
| `@resvg/resvg-js` | 2.6.2 | **MPL-2.0**, not MIT; https://github.com/yisibl/resvg-js |
| Vite | 8.3.5 | MIT; https://github.com/vitejs/vite |
| TypeScript | 7.0.2 | Apache-2.0; https://github.com/microsoft/TypeScript |
| Comfy API proxy | pinned 0.1.6 | MIT per official PyPI metadata; https://github.com/Comfy-Org/comfy-api-proxy |
| ComfyUI | external; 0.42.4 inspected | GPL-3.0; https://github.com/Comfy-Org/ComfyUI |
| FFmpeg / FFprobe | external; 9.0.1 inspected | LGPL/GPL depending on build; inspected Gyan build enables GPL/version3. https://ffmpeg.org/legal.html |

These dependencies are acquired separately; no node_modules, FFmpeg executable, Python environment or ComfyUI code is committed. Keep their upstream licenses when distributing any compiled package or binary. MPL-covered package changes, if made, carry their own source obligations; this audit does not modify that dependency. This repository's MIT grant covers its app code, not external models/software.

Audit tooling only: Node.js 22.20.0 (MIT plus bundled notices) and Playwright 1.56.1 (Apache-2.0) were installed under ignored `outputs/release-audit/tooling`. They were not added to the app dependency manifest. The browser uses an existing Chrome installation. Pure CPU release fixtures are original synthetic drawings, not AI output or a campaign endorsement.

## Images, audio, trademarks and workflows

This repository does **not** redistribute product photography, customer images,
generated advertisements, or sample campaign PNGs. Users supply their own
authorized media at runtime. See `adstudio/assets/README.md`.

No private customer photos, MP4s, music or model weights are tracked. Company or
product names appearing in tests or historical notes are not endorsements or
blanket trademark permissions.

Native Comfy workflows are supplied with SDK input/output contracts. The historical Qwen benchmark includes the Comfy Org workflow MIT notice in `adstudio/benchmark/QWEN_WORKFLOW_LICENSE.txt`. The LTX benchmark license file applies to its upstream model/materials and does not relicense the whole application. No partner inference node was found in the shipped workflow graphs.

Optional Stable Audio notice (applies when enabled): Powered by Stability AI. This Stability AI Model is licensed under the Stability AI Community License, Copyright (c) Stability AI Ltd. All Rights Reserved. Consult the [complete license](https://huggingface.co/stabilityai/stable-audio-open-1.0/blob/main/LICENSE.md), including registration, revenue and attribution obligations. No Stable Audio output or weights are distributed here.

## Integrated workflow-template attribution

The tracked FLUX template and derived API graphs originate from [Comfy-Org/workflow_templates](https://github.com/Comfy-Org/workflow_templates), under its [MIT license](https://github.com/Comfy-Org/workflow_templates/blob/main/LICENSE). The copyright and permission text are retained in shared/workflows/LICENSE-Comfy-workflow-templates.txt. This code/template license does not change the FLUX model license. No template sample portrait is bundled as a customer reference.

## Graphic Art Director typography

The six already bundled font files (EB Garamond, Newsreader, Source Sans 3 regular/semibold, DM Sans and Outfit) retain the upstream copyright and SIL OFL 1.1 texts in `shared/fonts/licenses/`. The combined notices ship as `OFL-font-licenses.txt` in the production build. Exact sources and browser/export roles are listed in `shared/fonts/README.md`. No font or model was downloaded during this final integration; only the missing redistribution notice texts were retrieved.
