# FLUX 3 Image Klein workflows (Open Ad Studio)

## Status
- **Operational multi-ref (mi2i):** `flux3_klein_bf16_mi2i.json` — API graph derived from Comfy-Org `image_flux3_klein_distilled_image_edit` (supports `ReferenceMultiLatent` + dual `LoadImage`).
- **Single-ref (i2i):** `flux3_klein_bf16_i2i.json` — same schedule, one reference.
- **Official BFL HF file** `workflows/flux3_klein_bf16_mi2i.json` (oid `05730a9c…`) is **gated** until the FLUX Kommunity License is accepted. Token can list the repo but cannot download content (403).

## Pins
See `flux3_klein_bf16_mi2i_contract.json` (`graphSha256`, 16 steps, cfg 1, pup on, BF16 DiT + Qwen3-VL BF16 + w4a8 pup + flux2-vae).

## Rebuild
```text
python adstudio/scripts/build-flux3-mi2i-workflow.py
```

## Do not
- Download gated weights without owner authorization
- Use Partner / API nodes
- Expose ComfyUI publicly

## Integrated RC boundary (2026-10-29)
Journey uses the pinned multi-reference API graph. Both reference slots receive the current reviewed customer source; no sample cookie/SAM file is used. A separate identity picker is not connected. SKIP_PUP=1 feeds the current constraints plus Dynamics caption/boxes directly to CLIP; it is a compatibility limitation, not the full intended upsampler workflow. The committed Comfy template and derived graphs retain LICENSE-Comfy-workflow-templates.txt (MIT); model weights retain their separate FLUX Kommunity/component licenses. Do not run the historical developer converter merely to start the app; the operational graph pin is checked at runtime.
