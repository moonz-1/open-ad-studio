"""Capture actual allocation before validating it; no weights or inference.

Runpod's GPU memory field is host RAM, not CUDA-visible VRAM. A nominal
48GB A40 can expose less memory with ECC/driver reservations. The 44GiB
usable-memory floor is a setup gate, not proof that inference will fit.
"""
import json
import pathlib
import shutil
import os
import time

GIB = 1024 ** 3


def validate_hardware(stats):
    checks = {
        'pinned Torch': stats['torch'] == '2.10.0+cu128',
        'CUDA and single device': stats['cuda'] and stats['deviceCount'] == 1,
        'A40 identity': 'A40' in stats['gpuName'],
        'usable VRAM >=44GiB': stats['vramBytes'] >= 44 * GIB,
        'CPU >=8': stats['cpuCount'] >= 8,
        'available workspace >60GB': stats['diskFreeBytes'] > 60 * 1000 ** 3,
        'host RAM >=44GB': stats['ramBytes'] >= 44 * 1000 ** 3,
    }
    failures = [name for name, ok in checks.items() if not ok]
    if failures:
        raise RuntimeError('Hardware preflight failed: ' + ', '.join(failures))


def main():
    import torch
    lease = json.loads(pathlib.Path('/workspace/qwen-lease.json').read_text())
    guard = json.loads(pathlib.Path('/workspace/qwen-watchdog.json').read_text())
    now = time.time()
    if (guard.get('state') != 'armed' or guard['podId'] != lease['podId']
            or not 0 <= now - guard['checked'] < 40 or now >= lease['created'] + 3000):
        raise RuntimeError('Independent watchdog/bootstrap deadline gate failed')
    available = torch.cuda.is_available()
    count = torch.cuda.device_count() if available else 0
    device = torch.cuda.get_device_properties(0) if count else None
    ram = int(next(line for line in pathlib.Path('/proc/meminfo').read_text().splitlines()
                   if line.startswith('MemTotal:')).split()[1]) * 1024
    limit = pathlib.Path('/sys/fs/cgroup/memory.max')
    if limit.exists() and limit.read_text().strip() != 'max':
        ram = min(ram, int(limit.read_text()))
    stats = {
        'podId': lease['podId'], 'checked': now, 'torch': torch.__version__,
        'cuda': available, 'deviceCount': count,
        'gpuName': device.name if device else '',
        'vramBytes': device.total_memory if device else 0,
        'cpuCount': len(os.sched_getaffinity(0)), 'ramBytes': ram,
        'diskFreeBytes': shutil.disk_usage('/workspace').free,
    }
    path = pathlib.Path('/workspace/qwen/hardware.json')
    # Emit and save measurements BEFORE any assertion, including failure cases.
    path.write_text(json.dumps(stats, indent=2))
    print('ACTUAL HARDWARE: ' + json.dumps(stats), flush=True)
    validate_hardware(stats)
    print('ACTUAL GPU/CPU/RAM/DISK PASS', flush=True)


if __name__ == '__main__':
    main()
