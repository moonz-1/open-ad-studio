# Standalone runtime and workflows

This directory belongs to Open Ad Studio in this repository. It has no dependency on the upstream app folders or their notes files.

- `lib/`: shared brand, creative, image, film, sound and provenance contracts.
- `runtime/`: Node/Vite API, Comfy SDK orchestration, local setup and media tools.
- `workflows/`: native Comfy API graphs and their contracts/pins.
- `comfy-nodes/`: optional original I/O helpers retained for inherited routes.

Three unreferenced mockup assets (`lib/kit.js`, `lib/kit.css`, `styleboard/looks.js`) were removed during release audit. Geometry/training, semantic search, captions and precision-edit modules are still imported by the unified API/client or setup paths. They are not exposed as Ad Studio features; deleting them without changing those consumers would break compilation or retained routes. Hunyuan is not part of the recommended submission configuration.

The general installer still offers inherited optional captions/search/training prompts. These extras are unnecessary for the advertising journey; skip them. Their complete cleanup is a separate runtime extraction, not a prerequisite to the app's CPU path. No installer/model job was run by the audit.

Current instructions: [README](../README.md). Release findings: [audit](../docs/RELEASE_AUDIT.md).
