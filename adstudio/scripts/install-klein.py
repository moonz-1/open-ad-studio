"""Bounded public Klein FP8 setup. Standard library only; never starts inference.
Defaults to checking. --install downloads only the two pinned Apache-2.0 files;
the verified, already installed Qwen3 encoder must be present separately.
--with-cutout additionally selects the single pinned MIT BiRefNet extraction file.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", required=True)
    parser.add_argument("--install", action="store_true")
    parser.add_argument("--with-cutout", action="store_true", help="Also check/install the single pinned MIT BiRefNet extraction file")
    args = parser.parse_args()
    root = pathlib.Path(args.models_dir).resolve(strict=True)
    pins = json.loads((ROOT / "shared/workflows/klein4b_fp8_contract.json").read_text(encoding="utf8"))
    if args.with_cutout:
        pins["files"].extend(json.loads((ROOT / "shared/workflows/product_cutout_contract.json").read_text(encoding="utf8"))["files"])
    missing, verified = [], []
    for entry in pins["files"]:
        target = (root / entry["file"]).resolve()
        if not target.is_relative_to(root):
            raise RuntimeError("Model path escapes the selected directory")
        if target.exists():
            with target.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            if target.stat().st_size != entry["bytes"] or digest != entry["sha256"]:
                raise RuntimeError("Existing file differs from pin; kept unchanged: " + entry["file"])
            verified.append(entry["file"])
        elif entry.get("reused"):
            raise RuntimeError("Required existing Qwen3 encoder is missing. No additional model pack downloaded.")
        else:
            missing.append((entry, target))
    total = sum(entry["bytes"] for entry, _ in missing)
    if total and shutil.disk_usage(root).free < total + 5 * 1024**3:
        raise RuntimeError("Insufficient disk headroom")
    if args.install:
        for entry, target in missing:
            target.parent.mkdir(parents=True, exist_ok=True)
            part = target.with_name(target.name + ".openadstudio-download")
            if part.exists():
                raise RuntimeError("A prior partial file is retained; inspect it before continuing: " + str(part))
            url = "https://huggingface.co/" + entry["repo"] + "/resolve/" + entry["revision"] + "/" + entry.get("path", entry["file"])
            digest, count = hashlib.sha256(), 0
            with urllib.request.urlopen(url, timeout=60) as response, part.open("xb") as stream:
                while chunk := response.read(4 * 1024 * 1024):
                    count += len(chunk)
                    if count > entry["bytes"]:
                        raise RuntimeError("Download exceeded pin; partial retained")
                    digest.update(chunk)
                    stream.write(chunk)
            if count != entry["bytes"] or digest.hexdigest() != entry["sha256"]:
                raise RuntimeError("Download integrity failure; partial retained")
            if target.exists():
                raise RuntimeError("Destination appeared; verified partial retained")
            part.rename(target)
            verified.append(entry["file"])
    print(json.dumps({"verified": verified, "downloadBytes": total if args.install else 0,
                      "missing": [] if args.install else [entry["file"] for entry, _ in missing],
                      "inferenceStarted": False}, indent=2))


if __name__ == "__main__":
    main()
