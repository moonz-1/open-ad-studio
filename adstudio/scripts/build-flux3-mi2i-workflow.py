"""Vendor Comfy distilled multi-ref edit as operational BF16 mi2i API graph.
Official HF workflows/flux3_klein_bf16_mi2i.json remains gated until license accept.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parents[2]
WF = ROOT / "shared" / "workflows"
UPSTREAM_PKG = Path(
    r"C:\Users\osiam\AppData\Local\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI"
    r"\.venv\Lib\site-packages\comfyui_workflow_templates_json\templates"
    r"\image_flux3_klein_distilled_image_edit.json"
)
SRC = WF / "_upstream_comfy_image_flux3_klein_distilled_image_edit.json"


def widgets(n: dict) -> dict:
    named = n.get("widgets_values_named")
    if isinstance(named, dict) and named:
        return dict(named)
    vals = n.get("widgets_values") or []
    t = n["type"]
    if t == "UNETLoader":
        return {"unet_name": vals[0], "weight_dtype": vals[1] if len(vals) > 1 else "default"}
    if t == "CLIPLoader":
        return {
            "clip_name": vals[0],
            "type": vals[1] if len(vals) > 1 else "flux3",
            "device": vals[2] if len(vals) > 2 else "default",
        }
    if t == "VAELoader":
        return {"vae_name": vals[0]}
    if t == "KSampler":
        return {
            "seed": vals[0],
            "steps": vals[2],
            "cfg": vals[3],
            "sampler_name": vals[4],
            "scheduler": vals[5],
            "denoise": vals[6],
        }
    if t == "CLIPTextEncode":
        return {"text": vals[0] if vals else ""}
    if t == "LoadImage":
        return {"image": vals[0]}
    if t == "SaveImage":
        return {"filename_prefix": vals[0] if vals else "flux3"}
    if t == "EmptyFlux2LatentImage":
        out = {}
        for i, k in enumerate(["width", "height", "batch_size"]):
            if i < len(vals):
                out[k] = vals[i]
        return out
    if t == "PrimitiveStringMultiline":
        return {"value": vals[0] if vals else ""}
    return {f"w{i}": v for i, v in enumerate(vals)}


def recursive_entries(v):
    """Match shared/runtime/flux3-klein-scene.ts flux3CanonSha (array entries; avoids JS key reorder)."""
    if isinstance(v, list):
        return [recursive_entries(x) for x in v]
    if isinstance(v, dict):
        return [[k, recursive_entries(v[k])] for k in sorted(v)]
    return v


def canon(obj) -> str:
    return json.dumps(recursive_entries(obj), separators=(",", ":"))


def main() -> None:
    WF.mkdir(parents=True, exist_ok=True)
    if not SRC.exists():
        copyfile(UPSTREAM_PKG, SRC)

    ui = json.loads(SRC.read_text(encoding="utf-8"))
    link_by_id = {L[0]: (L[1], L[2]) for L in ui.get("links", [])}
    nodes = {n["id"]: n for n in ui["nodes"]}
    skip = {"MarkdownNote", "PreviewAny", "ImageCompare", "CreateBoundingBoxes"}
    api: dict[str, dict] = {}
    for n in ui["nodes"]:
        if n["type"] in skip:
            continue
        inputs: dict = {}
        for inp in n.get("inputs") or []:
            name, link = inp.get("name"), inp.get("link")
            if name is None or link is None:
                continue
            frm, fslot = link_by_id[link]
            inputs[name] = [str(frm), fslot]
        inputs.update(widgets(n))
        api[str(n["id"])] = {"class_type": n["type"], "inputs": inputs}

    for n in api.values():
        if n["class_type"] == "UNETLoader":
            n["inputs"]["unet_name"] = "flux3-image-klein-bf16.safetensors"
        if n["class_type"] == "CLIPLoader" and "qwen3vl" in str(n["inputs"].get("clip_name", "")):
            n["inputs"]["clip_name"] = "qwen3vl_4b_bf16.safetensors"
            n["inputs"]["type"] = "flux3"

    api["11"]["inputs"]["image"] = "no-crumbs-source.png"
    api["111"] = {"class_type": "LoadImage", "inputs": {"image": "sam3-identity-reference.png"}}

    batch_id = next((i for i, n in api.items() if n["class_type"] == "BatchImagesNode"), None)
    ref_id = next((i for i, n in api.items() if n["class_type"] == "ReferenceMultiLatent"), None)
    print("batch", batch_id, "ref", ref_id)
    if batch_id:
        bn = nodes[int(batch_id)]
        names = [inp.get("name") for inp in (bn.get("inputs") or [])]
        print("BATCH_INPUT_NAMES", names)
        # Official Comfy BatchImagesNode uses images.image0 / images.image1
        inputs = api[batch_id]["inputs"]
        # Keep existing image0 link from conversion; force image1 to SAM3 identity.
        if "images.image0" not in inputs:
            loads = [i for i, n in api.items() if n["class_type"] == "LoadImage" and i != "111"]
            if loads:
                inputs["images.image0"] = [loads[0], 0]
        inputs["images.image1"] = ["111", 0]
        inputs.pop("image_1", None)

    ks = next(n for n in api.values() if n["class_type"] == "KSampler")
    assert ks["inputs"]["steps"] == 16, ks["inputs"]
    assert ks["inputs"]["cfg"] == 1, ks["inputs"]

    api_sorted = {k: api[k] for k in sorted(api, key=lambda x: int(x))}
    (WF / "flux3_klein_bf16_mi2i.api.json").write_text(json.dumps(api_sorted, indent=2), encoding="utf-8")
    # Owner-requested filename: keep API graph as primary operational file until HF unlocks official UI JSON.
    (WF / "flux3_klein_bf16_mi2i.json").write_text(json.dumps(api_sorted, indent=2), encoding="utf-8")
    sha = hashlib.sha256(canon(api_sorted).encode()).hexdigest()
    print("API_SHA256", sha)
    print("API_NODE_COUNT", len(api_sorted))
    print("CLASSES", sorted({n["class_type"] for n in api_sorted.values()}))

    # Also pin single-ref i2i API (same graph, only LoadImage 11)
    i2i = json.loads(json.dumps(api_sorted))
    i2i.pop("111", None)
    if batch_id and "image_1" in i2i.get(batch_id, {}).get("inputs", {}):
        i2i[batch_id]["inputs"].pop("image_1", None)
    i2i_sha = hashlib.sha256(canon(i2i).encode()).hexdigest()
    (WF / "flux3_klein_bf16_i2i.json").write_text(json.dumps(i2i, indent=2), encoding="utf-8")

    contract = {
        "id": "flux3-klein-bf16-mi2i",
        "status": "comfy-template-vendored-pending-hf-mi2i",
        "license": "FLUX Kommunity License",
        "textEncoderLicense": "Apache-2.0",
        "promptUpsamplerLicense": "Apache-2.0",
        "repo": "black-forest-labs/flux-3-image-klein-comfy",
        "officialWorkflowFile": "workflows/flux3_klein_bf16_mi2i.json",
        "officialWorkflowOid": "05730a9c0dd373925823e06f38ce82ce7ebea4e5",
        "officialRevisionNote": "HF tree oid for workflows/flux3_klein_bf16_mi2i.json on main (listable; download gated until Kommunity License acceptance).",
        "operationalSource": "Comfy-Org workflow_templates image_flux3_klein_distilled_image_edit.json (ReferenceMultiLatent). Converted to API; UNET/CLIP set to BF16 distilled for L40S.",
        "workflowFile": "flux3_klein_bf16_mi2i.json",
        "apiWorkflowFile": "flux3_klein_bf16_mi2i.api.json",
        "i2iWorkflowFile": "flux3_klein_bf16_i2i.json",
        "uiUpstreamFile": "_upstream_comfy_image_flux3_klein_distilled_image_edit.json",
        "singleReferenceFallback": "flux3_klein_bf16_i2i.json (same schedule; one LoadImage).",
        "graphSha256": sha,
        "i2iGraphSha256": i2i_sha,
        "comfyUiMinVersion": "0.41.0",
        "defaults": {
            "steps": 16,
            "guidance": 1,
            "sampler": "euler",
            "scheduler": "simple",
            "promptUpsampler": True,
            "checkpoint": "diffusion_models/flux3-image-klein-bf16.safetensors",
            "textEncoder": "text_encoders/qwen3vl_4b_bf16.safetensors",
            "promptUpsamplerFile": "text_encoders/qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors",
            "vae": "vae/flux2-vae.safetensors",
            "references": ["no-crumbs-source.png", "sam3-identity-reference.png"],
            "bboxFormat": "comfy-caption-json-0-1000",
        },
        "requiredNodes": sorted({n["class_type"] for n in api_sorted.values()}),
        "files": [
            {
                "file": "diffusion_models/flux3-image-klein-bf16.safetensors",
                "bytes": None,
                "sha256": None,
                "license": "FLUX Kommunity License",
                "gated": True,
            },
            {
                "file": "text_encoders/qwen3vl_4b_bf16.safetensors",
                "bytes": None,
                "sha256": None,
                "license": "Apache-2.0",
                "gated": True,
            },
            {
                "file": "text_encoders/qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors",
                "bytes": None,
                "sha256": None,
                "license": "Apache-2.0",
                "gated": True,
            },
            {
                "file": "vae/flux2-vae.safetensors",
                "bytes": None,
                "sha256": None,
                "license": "FLUX Kommunity License",
                "gated": True,
            },
        ],
        "note": "Do not download gated weights until owner accepts HF Kommunity License and authorizes inference. Replace operational graph with official BFL mi2i JSON when downloadable; re-pin graphSha256.",
    }
    (WF / "flux3_klein_bf16_mi2i_contract.json").write_text(json.dumps(contract, indent=2), encoding="utf-8")
    # Update legacy i2i contract pointer
    (WF / "flux3_klein_bf16_i2i_contract.json").write_text(
        json.dumps(
            {
                **contract,
                "id": "flux3-klein-bf16-i2i",
                "workflowFile": "flux3_klein_bf16_i2i.json",
                "graphSha256": i2i_sha,
                "note": "Single-reference fallback derived from multi-ref operational graph.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("CONTRACT_OK", sha)


if __name__ == "__main__":
    main()
