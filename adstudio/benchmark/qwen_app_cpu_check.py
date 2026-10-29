# LOCAL CPU SOFTWARE CHECK ONLY. No lease, approval, model weights or inference.
import os,pathlib,subprocess,tempfile,shutil,hashlib,json,time,urllib.request,traceback,shlex,sys
if "--run-local" not in sys.argv:
 print("DRY RUN: explicit --run-local in a model-free CPU container required; no cloud/model/asset actions.");raise SystemExit(0)
if sys.platform!='linux' or os.geteuid()!=10001:
 raise SystemExit('Use the documented non-root Linux CPU container (UID10001).')
E=pathlib.Path('/evidence');E.mkdir(exist_ok=True)
result={'cpuOnly':True,'privateAssetsMounted':False,'generationSubmitted':False,'fullRemoteAcceptance':False,'guardedStartupExecuted':False,'uid':os.geteuid()};children=[];handles=[]
def logprocess(name,args,**kw):
 h=(E/(name+'.log')).open('w');handles.append(h);p=subprocess.Popen(args,stdout=h,stderr=subprocess.STDOUT,**kw);children.append(p);return p

def get(url):
 with urllib.request.urlopen(url,timeout=4) as r:return json.load(r)
def wait(url,p):
 for _ in range(120):
  if p.poll() is not None:raise RuntimeError('Service exited: '+str(p.args))
  try:return get(url)
  except Exception:time.sleep(.5)
 raise RuntimeError('CPU service startup timed out: '+url)
try:
 assert os.geteuid()==10001
 assert not any(os.environ.get(k) for k in ['RUNPOD_API_KEY','QWEN_TERMINATION_KEY','HF_TOKEN'])
 assert os.environ.get('CUDA_VISIBLE_DEVICES')==''
 root=pathlib.Path(tempfile.mkdtemp(prefix='qwen-api-cpu-'));app=root/'app';shutil.copytree('/fixtures/app',app);os.chdir(app)
 source=(app/'adstudio/benchmark/qwen-app-start.sh').read_text();archive=pathlib.Path('/fixtures/node-v22.20.0-linux-x64.tar.xz');digest=hashlib.sha256(archive.read_bytes()).hexdigest()
 assert digest=='00bbd05e306ea68b6e13e17360d0e2f680b493ef95f2fea1c4296ff7437530bc'
 subprocess.run(['bash','-n',str(app/'adstudio/benchmark/qwen-app-start.sh')],check=True)
 verify=next(l.strip() for l in source.splitlines() if '| sha256sum -c -' in l);extract=next(l.strip() for l in source.splitlines() if l.strip().startswith('tar '))
 subprocess.run(['bash','-e','-c','node_archive='+shlex.quote(str(archive))+'\n'+verify+'\numask 027\nmkdir node\n'+extract],check=True)
 env={**os.environ,'PATH':str(app/'node/bin')+':'+os.environ['PATH'],'HOME':str(root/'home'),'NPM_CONFIG_CACHE':str(root/'npm-cache'),'USER':'qwen-cpu-test','LOGNAME':'qwen-cpu-test'};pathlib.Path(env['HOME']).mkdir()
 version=subprocess.check_output([str(app/'node/bin/node'),'--version'],text=True).strip();assert version=='v22.20.0';result['nodeVersion']=version;result['nodeSha256']=digest
 lock=hashlib.sha256((app/'package-lock.json').read_bytes()).hexdigest();npmline=next(l.strip() for l in source.splitlines() if l.startswith('timeout 600 npm ci '))
 with (E/'npm-ci.log').open('w') as h:subprocess.run(['bash','-e','-c',npmline],env=env,stdout=h,stderr=subprocess.STDOUT,check=True,timeout=630)
 assert hashlib.sha256((app/'package-lock.json').read_bytes()).hexdigest()==lock;result['npmCi']='PASS exact production --ignore-scripts command';result['lockfileUnchanged']=True
 print('PASS Node extraction/version and exact production npm ci; starting CPU services',flush=True)
 cpu_python='/opt/benchmark-venv/bin/python';proxy='/opt/benchmark-venv/bin/comfy-api-proxy';comfyroot=pathlib.Path('/opt/benchmark-ComfyUI')
 assert not list((comfyroot/'models').rglob('*.safetensors'))
 probe=subprocess.check_output([cpu_python,'-c','import torch; assert not torch.cuda.is_available(); print(torch.__version__)'],env=env,text=True).strip();result['torchCPUProbe']=probe
 paths=[]
 for name in ['user','input','output','temp']:
  p=root/name;p.mkdir();paths.extend(['--'+('user-directory' if name=='user' else name+'-directory'),str(p)])
 comfy=logprocess('comfy',[cpu_python,str(comfyroot/'main.py'),'--cpu','--listen','127.0.0.1','--port','28188','--offline','--disable-all-custom-nodes','--disable-partner-nodes','--disable-auto-launch',*paths],env=env,cwd=comfyroot)
 stats=wait('http://127.0.0.1:28188/system_stats',comfy);assert all(d['type']=='cpu' for d in stats['devices']);result['comfyDevices']=stats['devices']
 prox=logprocess('proxy',[proxy,'run','--comfyui','http://127.0.0.1:28188','--host','127.0.0.1','--port','28189'],env=env,cwd=app);wait('http://127.0.0.1:28189/api/v2/health',prox)
 env.update(COMFYUI_URL='http://127.0.0.1:28188',COMFY_BASE_URL='http://127.0.0.1:28189',COMFYUI_MODELS_DIR=str(comfyroot/'models'),COMFY_API_PROXY=proxy)
 # Execute the actual existing API boot command; no mocked HTTP/provider result.
 apiLine=next(l.strip().rstrip('\\').strip() for l in source.splitlines() if l.strip().startswith('node node_modules/vite/bin/vite.js --config'))
 api=logprocess('api',shlex.split(apiLine),env=env,cwd=app)
 health=wait('http://127.0.0.1:28301/api/health',api);assert health['comfyui'] and health['proxy'] and health['queued']==0
 caps=get('http://127.0.0.1:28301/api/hero/capabilities');assert caps['qwen']['available'] is False and len(caps['qwen']['missingFiles'])==3
 queue=get('http://127.0.0.1:28188/queue');assert not queue['queue_running'] and not queue['queue_pending']
 (E/'capabilities.json').write_text(json.dumps(caps,indent=2));(E/'health.json').write_text(json.dumps(health,indent=2));(E/'queue.json').write_text(json.dumps(queue,indent=2))
 result.update(passed=True,apiStartup='PASS actual Vite app API over real CPU ComfyUI/proxy',qwenAvailable=False,modelWeights='NOT INSTALLED',queuedJobs=0,remoteGuardAndGPUReadiness='NOT RUN - requires separately approved remote environment')
 print('PASS real CPU API startup; honest missing Qwen weights; queue empty. NOT GPU/remote acceptance.',flush=True)
except BaseException as e:
 result.update(passed=False,errorType=type(e).__name__,error=str(e));traceback.print_exc();raise
finally:
 for child in reversed(children):
  if child.poll() is None:
   child.terminate()
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:child.kill();child.wait()
 for h in handles:h.close()
 result['childProcessesStopped']=all(p.poll() is not None for p in children)
 (E/'result.json').write_text(json.dumps(result,indent=2))
