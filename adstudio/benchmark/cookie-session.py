"""One explicitly approved cookie attempt; terminate before local CPU review.

No provisioning, downloads of weights or automatic retry. External and in-Pod
watchdogs remain required: this foreground cleanup is an additional safeguard.
"""
import argparse, getpass, hashlib, json, os, pathlib, subprocess, time, warnings
from lifecycle import validate_lease, require_armed, request, live_rate, terminate_until_gone

ROOT=pathlib.Path(__file__).resolve().parents[2]

def run_cookie(lease, ready, node):
    # Secrets belong to the cleanup process, never the SDK/FFmpeg child.
    child_env={k:v for k,v in os.environ.items() if k not in ('RUNPOD_API_KEY','RUNPOD_BILLING_API_KEY','HF_TOKEN','COMFY_API_KEY')}
    complete=False
    try:
        require_armed(lease,ready)
        status,pod=request('/pods/'+lease['podId'])
        if status!=200:raise RuntimeError('Approved Pod unavailable')
        live_rate(lease,pod)
        remaining=lease['deadline']-300-time.time()
        if remaining<1800:raise RuntimeError('Insufficient time; terminate rather than start')
        subprocess.run([node,'adstudio/benchmark/render.mjs','--approved','--case','cookie','--seed','1'],
                       cwd=ROOT,env=child_env,check=True,timeout=min(1800,remaining))
        directory=ROOT/'outputs/ltx25-benchmark/cookie-seed1'
        record=json.loads((directory/'render.json').read_text())
        digest=hashlib.sha256((directory/'video.mp4').read_bytes()).hexdigest()
        if record['status']!='complete' or record['videoSha256']!=digest:
            raise RuntimeError('Local cookie artifact incomplete or hash mismatch')
        complete=True
    finally:
        # Do not keep paying for CPU contact sheets, visual review or more cases.
        # Also terminates on failed render, stale heartbeat or Ctrl+C.
        print('Cookie attempt ended: terminating exact approved Pod before local review.',flush=True)
        terminate_until_gone(lease)
    if complete:
        subprocess.run([node,'adstudio/benchmark/collect.mjs'],cwd=ROOT,env=child_env,check=True,timeout=180)

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument('--approved',action='store_true')
    parser.add_argument('--node',default='node',help='Existing Node >=22.18 executable; no installation')
    args=parser.parse_args(argv)
    if not args.approved:
        print('DRY RUN: no credentials, API, upload or render. Requires separate explicit deployment/transfer approval.');return
    lease=validate_lease(json.loads(pathlib.Path(os.environ['BENCHMARK_LEASE']).read_text()))
    ready=os.environ['BENCHMARK_WATCHDOG_READY']
    # Validate prerequisites before any paid session runner is started.
    if not os.environ.get('BENCHMARK_HEALTH_REPORT'):raise ValueError('Missing remote health report')
    version=subprocess.check_output([args.node,'--version'],text=True,timeout=10).strip().lstrip('v')
    if tuple(map(int,version.split('.'))) < (22,18,0):raise ValueError('Use existing Node >=22.18')
    try:
        if not os.environ.get('RUNPOD_API_KEY'):
            with warnings.catch_warnings():
                warnings.simplefilter('error',getpass.GetPassWarning)
                os.environ['RUNPOD_API_KEY']=getpass.getpass('Temporary termination key (hidden): ')
        if not os.environ['RUNPOD_API_KEY']:raise ValueError('Missing credential')
        run_cookie(lease,ready,args.node)
    finally:os.environ.pop('RUNPOD_API_KEY',None)

if __name__=='__main__':main()
