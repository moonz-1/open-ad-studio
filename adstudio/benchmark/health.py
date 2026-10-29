"""Remote readiness check only; never queues a workflow or downloads weights."""
import hashlib, json, os, pathlib, subprocess, sys, time, urllib.request
from lifecycle import require_armed
if sys.flags.optimize:raise RuntimeError('Validation requires Python without -O/PYTHONOPTIMIZE')
root = pathlib.Path(__file__).resolve().parent
pins = json.loads((root / 'pins.json').read_text())
lease=json.loads(pathlib.Path(os.environ['BENCHMARK_LEASE']).read_text())
require_armed(lease,os.environ['BENCHMARK_WATCHDOG_READY'])
import torch
assert sys.version_info[:2] == (3, 12), sys.version
assert torch.__version__ == pins['torch'], torch.__version__
assert torch.version.cuda == pins['cuda'] and torch.cuda.is_available()
assert torch.cuda.device_count() == 1
gpu = torch.cuda.get_device_properties(0)
assert 'A100' in gpu.name and gpu.total_memory >= 79 * 1024**3, str(gpu)
ram = int(next(l for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemTotal:')).split()[1]) * 1024
assert ram >= 100 * 1024**3  # Conservative offload/load headroom for the 71GB BF16 stack.
comfy = pathlib.Path('/workspace/adstudio-benchmark/ComfyUI')
for repo, expected in [(comfy, pins['comfy']), (comfy / 'custom_nodes/ComfyUI-LTXVideo', pins['ltxNodes'])]:
    assert subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip() == expected
for weight in pins['weights']:
    path = comfy / 'models' / weight['path']
    assert path.stat().st_size == weight['bytes'], str(path)
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(16 * 1024 * 1024), b''): h.update(block)
    assert h.hexdigest() == weight['sha256'], str(path)
for route in ['http://127.0.0.1:28188/system_stats', 'http://127.0.0.1:28189/api/v2/health']:
    with urllib.request.urlopen(route, timeout=10) as response: assert response.status == 200
subprocess.run(['python', '-m', 'pip', 'check'], check=True)
subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.DEVNULL)
report={'ready':True,'podId':lease['podId'],'created':lease['created'],'deadline':lease['deadline'],'checked':time.time(),'pinsSha256':hashlib.sha256((root/'pins.json').read_bytes()).hexdigest(),'gpu':gpu.name,'vram':gpu.total_memory,'ram':ram,'torch':torch.__version__,'cuda':torch.version.cuda}
pathlib.Path(os.environ.get('BENCHMARK_HEALTH_REPORT','/workspace/benchmark-health.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
