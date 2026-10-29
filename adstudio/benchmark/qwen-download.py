"""Only the three approved public FP8 files. No credentials required."""
import concurrent.futures,hashlib,json,pathlib,time,urllib.request
ROOT=pathlib.Path('/workspace/qwen')
def guard():
 p=json.loads(pathlib.Path('/workspace/qwen-lease.json').read_text());r=json.loads(pathlib.Path('/workspace/qwen-watchdog.json').read_text())
 if r.get('podId')!=p['podId'] or r.get('state')!='armed' or time.time()-r['checked']>40 or time.time()>p['created']+3000:raise RuntimeError('Independent watchdog/bootstrap deadline gate failed')
def one(f):
 guard();path=ROOT/'ComfyUI/models'/f['file'];path.parent.mkdir(parents=True,exist_ok=True);part=path.with_suffix('.part');url='https://huggingface.co/'+f['repo']+'/resolve/'+f['revision']+'/'+f['path'];started=time.time();h=hashlib.sha256();count=0
 with urllib.request.urlopen(url,timeout=60) as r,part.open('wb') as out:
  if r.status!=200 or int(r.headers.get('Content-Length','0'))!=f['bytes']:raise RuntimeError('Model response size mismatch')
  while b:=r.read(8*1024*1024):
   guard();out.write(b);h.update(b);count+=len(b)
 if count!=f['bytes'] or h.hexdigest()!=f['sha256']:raise RuntimeError('Model SHA256 mismatch: '+f['file'])
 part.rename(path);print('VERIFIED MODEL:',f['file'],count,'bytes',round(time.time()-started,1),'seconds',flush=True)
 return {'file':f['file'],'bytes':count,'sha256':h.hexdigest(),'seconds':time.time()-started}
if __name__=='__main__':
 p=json.loads((ROOT/'package/qwen-hero-pins.json').read_text());files=[f for f in p['files'] if '_bf16' not in f['file']]
 if len(files)!=3 or sum(f['bytes'] for f in files)!=30172239743:raise RuntimeError('Unapproved model pack')
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:r=list(pool.map(one,files))
 (ROOT/'model-hashes.json').write_text(json.dumps(r,indent=2))
