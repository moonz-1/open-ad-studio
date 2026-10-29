"""One approved A40 create; credentials stay inside this process/provider env."""
import argparse,base64,hashlib,json,pathlib,time,urllib.parse
import importlib.util
spec=importlib.util.spec_from_file_location('guard',pathlib.Path(__file__).with_name('qwen-guard.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--approved',action='store_true');parser.add_argument('--check',action='store_true');a=parser.parse_args()
 if not a.approved:print('DRY RUN: no API calls or deployment');return
 g.load_key();out=g.OUT;out.mkdir(parents=True,exist_ok=True)
 if (out/'intent.json').exists() or (out/'lease.json').exists():raise RuntimeError('An attempt already exists. No second Pod authorized.')
 status,b=g.request('graphql','POST',{'query':'query { myself { clientBalance currentSpendPerHr isAutoPayEnabled } }'});me=b['data']['myself']
 if me['clientBalance']<6 or me['isAutoPayEnabled'] is not False or me['currentSpendPerHr']!=0:raise RuntimeError('Balance/reserve/auto-pay/current-spend gate failed')
 status,offer=g.request('/catalog/gpus/'+urllib.parse.quote('NVIDIA A40',safe='')+'?include=AVAILABILITY&product=POD&cloud=SECURE&count=1&minCudaVersion=12.8')
 if offer['price']['secure']!=.59:raise RuntimeError('Live GPU quote changed')
 dc=next((x['id'] for x in offer.get('dataCenters',[]) if x['availability']!='NONE' and x['id'] in ['CA-MTL-1','EU-SE-1']),None)
 if not dc:raise RuntimeError('Approved GPU unavailable')
 status,listing=g.request('/pods')
 if listing.get('pods') or listing.get('pagination',{}).get('hasNextPage'):raise RuntimeError('Expected empty Pod inventory')
 public=(pathlib.Path.home()/'.ssh/runpod_ltx25.pub').read_text().strip();status,keys=g.request('/account/ssh-keys')
 if not any(k.split()[:2]==public.split()[:2] for k in keys['keys']):raise RuntimeError('SSH account mismatch')
 pins=json.loads((g.ROOT/'adstudio/benchmark/qwen-hero-pins.json').read_text());image=pins['runtime']['remoteImage']
 credit={'availableUSD':me['clientBalance'],'autoPay':me['isAutoPayEnabled'],'otherSpendPerHour':me['currentSpendPerHr'],'gpuHourly':.59,'storageHourlyBound':.02,'twoHourUpperEstimate':1.22,'cap':2,'reserveUSD':4,'dataCenter':dc,'checked':time.time()};g.save(out/'quote-and-credit.json',credit)
 print('LIVE CHECK PASS:',json.dumps(credit),flush=True)
 if a.check:return
 ready=json.loads((out/'precreate-ready.json').read_text())
 if not ready.get('ready') or time.time()-ready['checked']>15:raise RuntimeError('Retained host watchdog is not fresh')
 created=time.time();name='adstudio-qwen2511-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime(created));intent={'version':1,'name':name,'created':created,'deadline':created+7200,'gpuRate':.59,'storageHourly':.02,'cap':2,'image':image}
 code=(g.ROOT/'adstudio/benchmark/qwen-guard.py').read_bytes();boot="import base64;exec(compile(base64.b64decode('"+base64.b64encode(code).decode()+"'),'/workspace/qwen-guard-boot.py','exec'),{'__file__':'/workspace/qwen-guard-boot.py','__name__':'__main__'})"
 # The key is never printed or written to an evidence/request file. SSH children
 # do not inherit it. The private Pod guard needs it independently of this PC.
 body={'name':name,'cloud':'SECURE','dataCenterIds':[dc],'gpu':{'id':'NVIDIA A40','count':1,'minCudaVersion':'12.8','minRamPerGpu':48,'minVcpuCountPerGpu':8},'image':image,'disk':30,'mounts':{'persistent':{'size':80,'path':'/workspace'}},'ports':['22/tcp'],'startSsh':True,'startJupyter':False,'globalNetworking':False,'env':{'PUBLIC_KEY':public,'QWEN_TERMINATION_KEY':g.KEY,'QWEN_POD_NAME':name,'QWEN_CREATED':str(created),'QWEN_DEADLINE':str(created+7200),'QWEN_IMAGE':image},'entrypoint':['python3.12','-u','-c'],'cmd':[boot,'--approved','--boot']}
 g.save(out/'intent.json',intent);print('Creating ONE Secure A40; GPU$0.59/h + <=$0.02/h storage,2h/$2 ceiling',flush=True)
 pod=None
 try:
  status,pod=g.request('/pods','POST',body)
 except Exception:
  status,listing=g.request('/pods');matches=[p for p in listing.get('pods',[]) if p.get('name')==name]
  if len(matches)==1:pod=matches[0]
  else:raise RuntimeError('Create failed/uncertain. No automatic second attempt.') from None
 lease={**intent,'podId':pod['id']};g.save(out/'lease.json',lease)
 try:
  status,readback=g.request('/pods/'+pod['id']);g.check(lease,readback)
  readback.pop('env',None);readback.pop('args',None);g.save(out/'pod-readback.json',readback);print('CREATED AND VERIFIED:',pod['id'],flush=True)
 except BaseException:g.terminate(lease);raise
if __name__=='__main__':main()
