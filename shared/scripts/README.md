# scripts/

Planned: `run.py`, a comfy-sdk runner shared by both apps.

```python
from comfy_sdk import Comfy
client = Comfy(api_key="comfyui-...")            # or COMFY_BASE_URL for self-hosted
wf = client.workflows.from_file("../workflows/<name>.json")
wf.set_input("<node>", "image", client.assets.from_file("in.png"))
job = client.run(wf)
for out in job.get_outputs("<node>"): out.to_file(out.name)
```

Source: https://docs.comfy.org/development/api-development/sdks (comfy-sdk v0.5.0, Python 3.10+). Keep API keys in `.env` (gitignored).
