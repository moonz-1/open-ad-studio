"""Strict SSH bootstrap/collection for the exact approved Qwen lease."""
import argparse,io,importlib.util,json,pathlib,subprocess,tarfile,hashlib
spec=importlib.util.spec_from_file_location('guard',pathlib.Path(__file__).with_name('qwen-guard.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def connection():
 p=g.validate(json.loads((g.OUT/'lease.json').read_text()));pod=json.loads((g.OUT/'pod-readback.json').read_text());g.check(p,pod);ep=pod['ssh']['direct']
 if not ep or ep['username']!='root' or not 1<=ep['port']<=65535:raise ValueError('SSH endpoint unavailable')
 opts=['-i',str(pathlib.Path.home()/'.ssh/runpod_ltx25'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','KexAlgorithms=curve25519-sha256','-o','HostKeyAlgorithms=ssh-ed25519','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(g.OUT/'known_hosts'),'-o','ForwardAgent=no','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3']
 return ep,opts
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--approved',action='store_true');parser.add_argument('--collect',action='store_true');parser.add_argument('--tunnel',action='store_true');a=parser.parse_args()
 if not a.approved:print('DRY RUN: no SSH/upload');return
 ep,opts=connection();target='root@'+ep['host'];ssh=['ssh',*opts,'-p',str(ep['port']),target]
 if a.tunnel:subprocess.run(['ssh',*opts,'-p',str(ep['port']),'-N','-o','ExitOnForwardFailure=yes','-L','127.0.0.1:28188:127.0.0.1:28188','-L','127.0.0.1:28189:127.0.0.1:28189',target],check=True);return
 if a.collect:
  for name in ['hardware.json','health.json','model-hashes.json','comfy.log','proxy.log','system-stats.json']:
   # Partial setup may have only hardware diagnostics. Don't lose all evidence
   # because the first later-stage artifact is absent.
   try:subprocess.run(['scp',*opts,'-P',str(ep['port']),target+':/workspace/qwen/'+name,str(g.OUT/name)],check=False,timeout=15)
   except subprocess.TimeoutExpired:pass
  return
 pins=json.loads((g.ROOT/'adstudio/benchmark/qwen-hero-pins.json').read_text());lock=(g.ROOT/'adstudio/benchmark/requirements.lock').read_bytes();assert hashlib.sha256(lock).hexdigest()==pins['runtime']['existingRequirementsSha256']
 archive=g.OUT/'public-package.tar'
 with tarfile.open(archive,'w') as tar:
  for name in ['qwen-remote.sh','qwen-preflight.py','qwen-download.py','qwen-hero-pins.json','requirements.lock']:
   data=(g.ROOT/'adstudio/benchmark'/name).read_bytes().replace(b'\r\n',b'\n');item=tarfile.TarInfo(name);item.size=len(data);item.mode=0o600;tar.addfile(item,io.BytesIO(data))
 subprocess.run([*ssh,'mkdir -p /workspace/qwen/package'],check=True,timeout=20)
 subprocess.run(['scp',*opts,'-P',str(ep['port']),str(archive),target+':/workspace/qwen/public-package.tar'],check=True,timeout=60)
 subprocess.run([*ssh,'tar -xf /workspace/qwen/public-package.tar -C /workspace/qwen/package && bash /workspace/qwen/package/qwen-remote.sh'],check=True)
if __name__=='__main__':main()
