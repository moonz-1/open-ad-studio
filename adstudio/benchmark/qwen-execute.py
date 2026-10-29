"""Setup -> two SDK images -> collect -> verified termination, including errors."""
import argparse,hashlib,importlib.util,json,pathlib,subprocess,sys,time
spec=importlib.util.spec_from_file_location('guard',pathlib.Path(__file__).with_name('qwen-guard.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--approved',action='store_true');parser.add_argument('--plan');a=parser.parse_args()
 if not a.approved:print('DRY RUN: no SSH/model execution or lifecycle change');return
 expected=['lighting','cinematic']
 if a.plan and g.OUT==(g.ROOT/'outputs/qwen-hero-benchmark/session').resolve():raise ValueError('Three-concept plan requires a new separate session; preserve earlier results')
 g.load_key();lease=g.validate(json.loads((g.OUT/'lease.json').read_text()));start=time.time();tunnel=None;tunnel_log=None;record={'podId':lease['podId'],'started':start,'ownerApproved':False,'status':'setting-up','expectedCases':expected}
 node=g.ROOT/'outputs/runpod-integration/node-runtime/node-v22.20.0-win-x64/node.exe';helper=g.ROOT/'adstudio/benchmark/qwen-ssh.py';py=sys.executable
 try:
  if a.plan:
   plan=json.loads(pathlib.Path(a.plan).read_text(encoding='utf8'));expected=[c['id'] for c in plan['cases']]
   if expected!=['authenticity','intimate','campaign']:raise ValueError('Unexpected campaign cases')
   record['expectedCases']=expected
   subprocess.run([str(node),str(g.ROOT/'adstudio/benchmark/qwen-render-runpod.mjs'),'--check-plan',str(pathlib.Path(a.plan).resolve())],check=True,timeout=30)
  with (g.OUT/'setup.log').open('w') as log:subprocess.run([py,'-u',str(helper),'--approved'],stdout=log,stderr=subprocess.STDOUT,check=True,timeout=3000)
  record['setupSeconds']=time.time()-start;g.save(g.OUT/'execution.json',record);print('SETUP PASS; collecting health and starting private SDK tunnel',flush=True)
  subprocess.run([py,str(helper),'--approved','--collect'],check=True,timeout=180)
  tunnel_log=(g.OUT/'tunnel.log').open('w');tunnel=subprocess.Popen([py,'-u',str(helper),'--approved','--tunnel'],stdout=tunnel_log,stderr=subprocess.STDOUT)
  import urllib.request
  ready=False
  for _ in range(20):
   if tunnel.poll() is not None:raise RuntimeError('SSH tunnel exited')
   try:
    with urllib.request.urlopen('http://127.0.0.1:28189/api/v2/health',timeout=2) as r:ready=r.status==200
   except Exception:pass
   if ready:break
   time.sleep(1)
  if not ready:raise RuntimeError('Private proxy tunnel unavailable')
  print('GENERATING ONLY PREPARED CASES: '+','.join(expected),flush=True)
  command=[str(node),str(g.ROOT/'adstudio/benchmark/qwen-render-runpod.mjs'),'--approved']+(['--plan',str(pathlib.Path(a.plan).resolve())] if a.plan else [])
  with (g.OUT/'render.log').open('w') as log:subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=max(1,lease['deadline']-time.time()-360))
  for kind in expected:
   folder=g.OUT/'candidates'/kind;r=json.loads((folder/'render.json').read_text());b=(folder/'raw.png').read_bytes()
   if r['status']!='complete' or hashlib.sha256(b).hexdigest()!=r['rawSha256'] or r['podId']!=lease['podId']:raise RuntimeError('Downloaded output verification failed')
  record['status']='three-images-collected' if a.plan else 'two-images-collected';record['rawFilesVerified']=True;print('ALL PLANNED RAW MODEL OUTPUTS VERIFIED LOCALLY',flush=True)
 except BaseException as e:record['status']='failed';record['errorType']=type(e).__name__;raise
 finally:
  try:
   subprocess.run([py,str(helper),'--approved','--collect'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=120)
  except Exception:pass
  print('TERMINATING EXACT POD AND ITS LOCAL DISKS NOW',flush=True);g.terminate(lease);record['termination']='VERIFIED_404';record['finished']=time.time();record['elapsedHours']=(record['finished']-lease['created'])/3600;record['conservativeCostUpperEstimateUSD']=record['elapsedHours']*.61;g.save(g.OUT/'execution.json',record)
  if tunnel:
   tunnel.terminate()
   try:tunnel.wait(timeout=10)
   except subprocess.TimeoutExpired:tunnel.kill();tunnel.wait()
  if tunnel_log:tunnel_log.close()
if __name__=='__main__':main()
