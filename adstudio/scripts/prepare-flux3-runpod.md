# FLUX 3 remote inference (optional backend)

Verified 2026-10-29 on Secure RunPod **L40S 48GB** (SSH tunnel only). The app stays usable without this path.

## Target
- **GPU:** RunPod L40S 48GB Secure Cloud (~$1.09/hr)
- **Disk:** ≥40 GB for BF16 DiT + Qwen3-VL BF16 + w4a8 pup + VAE (~27 GB) + Comfy + refs
- **ComfyUI:** ≥0.41.0 (`ReferenceMultiLatent`, CLIP type `flux3`, `TextGenerate` pup)
- **Transport:** SSH local-forward only — **never** public unauthenticated Comfy

## Connect
```powershell
ssh -i $env:USERPROFILE\.ssh\runpod_ltx25 -L 18188:127.0.0.1:3001 -N root@HOST -p PORT
$env:COMFYUI_URL='http://127.0.0.1:18188'
$env:ADSTUDIO_FLUX3_INFERENCE='1'
$env:ADSTUDIO_FLUX3_REMOTE_WEIGHTS='1'   # weights already on the pod
```

Journey Creative Restage (`POST /api/hero/scene`) uses FLUX 3 when the flag + availability pass; otherwise Klein / Product-safe.

## One-shot live script
```powershell
node --experimental-transform-types adstudio/scripts/live-flux3-generate-once.mjs
```

## Hard rules
- Track spend (GPU + storage). Stop and remove the pod when finished.
- Do not expose Comfy without auth.
- Partner `Flux3ImageNode` is forbidden (closed API).
