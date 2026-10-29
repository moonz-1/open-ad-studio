"""Exact-Pod Qwen watchdog, shared by Windows and the Pod. Default is dry run.
Remote boot starts the independent timer before SSH or any inference setup.
"""
import argparse,base64,ctypes,json,math,os,pathlib,re,subprocess,sys,threading,time,urllib.error,urllib.request
_parents=pathlib.Path(__file__).resolve().parents
ROOT=_parents[2] if len(_parents)>2 else pathlib.Path('/workspace')
def session_dir(value=None):
 # Keep the worktree spelling shared with the API; check physical containment
 # separately so an escaping junction still fails closed.
 path=pathlib.Path(os.path.abspath(value or ROOT/'outputs/qwen-hero-benchmark/session'))
 if not path.resolve().is_relative_to((ROOT/'outputs').resolve()) or path.name!='session':raise ValueError('Qwen session must be a separate outputs/.../session folder')
 app=os.environ.get('QWEN_APP_SESSION_DIR')
 if app and pathlib.Path(os.path.abspath(app))!=path:raise ValueError('Watchdog and local API must use the same session path')
 identity=path/'local-session.json'
 if identity.exists():
  binding=json.loads(identity.read_text())
  if binding!={'version':1,'repoRoot':str(ROOT),'sessionDir':str(path),'realSessionDir':str(path.resolve()),'relativeSession':path.relative_to(ROOT).as_posix()}:raise ValueError('Session worktree identity mismatch')
 return path
OUT=session_dir(os.environ.get('QWEN_SESSION_DIR'))
KEY=''
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise RuntimeError('Control-plane redirect refused')
def load_key():
 global KEY
 KEY=os.environ.get('QWEN_TERMINATION_KEY','') or os.environ.get('RUNPOD_API_KEY','')
 if not KEY:
  match=re.search(r'^\s*RUNPOD_API_KEY\s*=\s*(.*?)\s*$',(ROOT/'.env').read_text(),re.M)
  if match:KEY=match[1].strip().strip('"\'')
 if not KEY:raise RuntimeError('Temporary key unavailable; no deployment')
def request(path,method='GET',body=None):
 if path=='graphql':url='https://api.runpod.io/graphql'
 else:
  if not path.startswith('/') or path.startswith('//'):raise ValueError('Invalid control path')
  url='https://api.runpod.io/v2'+path
 req=urllib.request.Request(url,method=method,headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},data=json.dumps(body).encode() if body is not None else None)
 try:
  with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as r:
   raw=r.read();return r.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:
  code=e.code;e.close()
  if code==404:return 404,None
  raise RuntimeError(f'Runpod {method} HTTP{code}') from None
def save(path,data):
 path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix(path.suffix+f'.{os.getpid()}.tmp');temp.write_text(json.dumps(data,indent=2));temp.replace(path)
def validate(p):
 if p.get('version')!=1 or not re.fullmatch(r'[A-Za-z0-9_-]+',p.get('podId','')) or not p.get('name','').startswith('adstudio-qwen2511-'):raise ValueError('Invalid Qwen lease identity')
 for k in ['created','deadline','gpuRate','storageHourly','cap']:
  if isinstance(p.get(k),bool) or not isinstance(p.get(k),(int,float)) or not math.isfinite(p[k]):raise ValueError('Invalid lease number')
 if not 0<p['deadline']-p['created']<=7200 or p['gpuRate']!=.59 or p['storageHourly']!=.02 or p['cap']!=2 or (p['deadline']-p['created'])/3600*(p['gpuRate']+p['storageHourly'])>1.8:raise ValueError('Qwen approval bounds exceeded')
 return p
def identity(p,pod):
 if pod.get('id')!=p['podId'] or pod.get('name')!=p['name']:raise ValueError('Pod identity mismatch')
def check(p,pod):
 validate(p);identity(p,pod)
 rate=pod.get('cost')
 if isinstance(rate,bool) or not isinstance(rate,(int,float)) or not math.isfinite(rate) or not 0<rate<=.61:raise ValueError('Unexpected actual price')
 if pod.get('cloud')!='SECURE' or pod.get('gpu',{}).get('id')!='NVIDIA A40' or pod['gpu'].get('count')!=1 or pod['gpu'].get('memory',0)<48 or pod['gpu'].get('vcpuCount',0)<8:raise ValueError('Wrong GPU/host allocation')
 if pod.get('image')!=p['image'] or pod.get('disk')!=30 or pod.get('mounts',{}).get('persistent')!={'size':80,'path':'/workspace'} or pod['mounts'].get('network') or pod['mounts'].get('global') or pod.get('ports')!=['22/tcp']:raise ValueError('Wrong image/security/storage')
 return True
def terminate(p):
 validate(p)
 while True:
  try:
   status,pod=request('/pods/'+p['podId'])
   if status==404:print('TERMINATION VERIFIED: exact Pod absent',flush=True);return
   identity(p,pod);request('/pods/'+p['podId'],'DELETE');status,_=request('/pods/'+p['podId'])
   if status==404:print('TERMINATION VERIFIED: exact Pod absent',flush=True);return
  except Exception as e:print('Termination retry:',type(e).__name__,flush=True)
  time.sleep(5)
def watch(p,ready,remote=False):
 validate(p);failures=0
 while True:
  try:
   status,pod=request('/pods/'+p['podId'])
   if status==404:return
   check(p,pod);failures=0
   now=time.time();estimated=max(0,now-p['created'])/3600*.61
   if now>=p['deadline']-300 or estimated>=1.8 or (remote and pathlib.Path('/workspace/qwen-abort').exists()):break
   save(ready,{'podId':p['podId'],'checked':now,'deadline':p['deadline'],'state':'armed','estimatedUSD':estimated})
  except Exception as e:
   failures+=1;print('Watchdog check failed:',type(e).__name__,flush=True)
   if failures>=3 or time.time()>=p['deadline']-300:break
  time.sleep(10)
 terminate(p)
def boot():
 load_key();p={'version':1,'podId':os.environ['RUNPOD_POD_ID'],'name':os.environ['QWEN_POD_NAME'],'created':float(os.environ['QWEN_CREATED']),'deadline':float(os.environ['QWEN_DEADLINE']),'gpuRate':.59,'storageHourly':.02,'cap':2,'image':os.environ['QWEN_IMAGE']};validate(p)
 save('/workspace/qwen-lease.json',p)
 # Authenticate before admitting SSH; publish only public readiness/host-key data.
 status,pod=request('/pods/'+p['podId']);check(p,pod)
 threading.Thread(target=watch,args=(p,'/workspace/qwen-watchdog.json',True),daemon=True).start()
 try:
  subprocess.run(['ssh-keygen','-A'],check=True,stdout=subprocess.DEVNULL)
  pathlib.Path('/run/sshd').mkdir(parents=True,exist_ok=True);d=pathlib.Path('/root/.ssh');d.mkdir(exist_ok=True);d.chmod(0o700);a=d/'authorized_keys';a.write_text(os.environ['PUBLIC_KEY'].strip()+'\n');a.chmod(0o600)
  print('QWEN_HOST_ED25519 '+pathlib.Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().strip(),flush=True)
  env={k:v for k,v in os.environ.items() if k not in ['QWEN_TERMINATION_KEY','RUNPOD_API_KEY','HF_TOKEN']}
  subprocess.run(['/usr/sbin/sshd','-D','-e','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','AuthenticationMethods=publickey','-o','PermitRootLogin=prohibit-password','-o','GatewayPorts=no'],env=env,check=True)
 finally:terminate(p)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--approved',action='store_true');parser.add_argument('--wait',action='store_true');parser.add_argument('--boot',action='store_true');parser.add_argument('--terminate',action='store_true');args=parser.parse_args()
 if not args.approved:print('DRY RUN: no control-plane requests');return
 if args.boot:boot();return
 load_key();awake=None
 if os.name=='nt':
  awake=ctypes.WinDLL('kernel32',use_last_error=True).SetThreadExecutionState
  awake.argtypes=[ctypes.c_uint];awake.restype=ctypes.c_uint
  if not awake(0x80000001):raise RuntimeError('Cannot keep local watchdog awake')
 p=None
 try:
  if args.wait:
   status,pods=request('/pods');
   if status!=200 or pods.get('pods') or pods.get('pagination',{}).get('hasNextPage'):raise RuntimeError('Expected empty Pod inventory')
   save(OUT/'precreate-ready.json',{'checked':time.time(),'ready':True})
   print('HOST WATCHDOG READY; waiting for the one approved lease',flush=True)
   while not (OUT/'lease.json').exists():
    save(OUT/'precreate-ready.json',{'checked':time.time(),'ready':True})
    if (OUT/'intent.json').exists():
     intent=json.loads((OUT/'intent.json').read_text());status,listing=request('/pods');matches=[x for x in listing.get('pods',[]) if x.get('name')==intent['name']]
     if len(matches)==1:
      p={**intent,'podId':matches[0]['id']};validate(p);save(OUT/'lease.json',p);break
     if len(matches)>1:raise RuntimeError('Uncertain creation identity')
    time.sleep(2)
  p=validate(json.loads((OUT/'lease.json').read_text()))
  if args.terminate:terminate(p)
  else:watch(p,OUT/'watchdog-ready.json')
 finally:
  if p:terminate(p)
  if awake:awake(0x80000000)
if __name__=='__main__':main()
