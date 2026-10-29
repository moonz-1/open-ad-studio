"""Collect-before-delete companion to the independent exact-Pod watchdog.
Default: dry run. Requires separate paid approval, existing lease and local key.
"""
import argparse,hashlib,importlib.util,json,pathlib,time
spec=importlib.util.spec_from_file_location('guard',pathlib.Path(__file__).with_name('qwen-guard.py'))
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
def verify_collection(record,lease,root):
 if record.get('state')!='collected' or record.get('podId')!=lease['podId'] or not record.get('jobId'):raise ValueError('No complete exact-Pod collection')
 files=record.get('files',[])
 if len(files)!=5:raise ValueError('Incomplete artifact collection')
 names=set();paths=set()
 for item in files:
  path=pathlib.Path(item['path']).resolve()
  if not path.is_relative_to((root/'outputs').resolve()) or path in paths:raise ValueError('Unsafe or duplicate artifact path')
  paths.add(path);names.add(path.name)
  if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Artifact readback hash mismatch')
 if not {'comfy-output.png','reference.png','provenance.json'}.issubset(names) or not any(n in names for n in ('original.jpg','original.png','original.webp')):raise ValueError('Missing raw/provenance/reference/original')
 return True
def monitor(p,interval=5):
 try:
  while True:
   status,pod=g.request('/pods/'+p['podId'])
   if status==404:return
   g.check(p,pod)
   path=g.OUT/'one-job.json.status.json'
   if path.exists():
    record=json.loads(path.read_text())
    if record.get('state')=='failed':raise RuntimeError('App generation/collection failed; no retry')
    if record.get('state')=='collected':
     verify_collection(record,p,g.ROOT);print('PASS five local artifact hashes; terminating exact Pod now',flush=True);return
   now=time.time()
   if now>=p['deadline']-300 or max(0,now-p['created'])/3600*.61>=1.8:raise RuntimeError('Acceptance time/budget stop')
   time.sleep(interval)
 finally:g.terminate(p)
def main():
 p=argparse.ArgumentParser();p.add_argument('--approved',action='store_true');a=p.parse_args()
 if not a.approved:print('DRY RUN: no key read, API request, upload or provider mutation');return
 g.load_key();lease=g.validate(json.loads((g.OUT/'lease.json').read_text()));monitor(lease)
if __name__=='__main__':main()
