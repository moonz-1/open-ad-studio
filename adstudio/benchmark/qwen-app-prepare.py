"""Local-only public code package and unapproved one-job source binding. No network."""
import argparse,hashlib,io,json,os,pathlib,subprocess,tarfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
REQUIRED={'adstudio/benchmark/vite.app-api.config.ts','adstudio/benchmark/qwen-app-start.sh','package.json','package-lock.json'}
def sha(data):return hashlib.sha256(data).hexdigest()
def output(path):
 # Preserve the API worktree's lexical path. resolve()/Resolve-Path traverses
 # outputs junctions and can produce a path outside this API's repository.
 p=pathlib.Path(os.path.abspath(ROOT/pathlib.Path(path)))
 base=ROOT/'outputs'
 if not p.is_relative_to(base) or not p.resolve().is_relative_to(base.resolve()) or p.name!='session':raise ValueError('Use this worktree outputs/.../session path, not an outer repository alias')
 p.mkdir(parents=True,exist_ok=True)
 identity={'version':1,'repoRoot':str(ROOT),'sessionDir':str(p),'realSessionDir':str(p.resolve()),'relativeSession':p.relative_to(ROOT).as_posix()}
 file=p/'local-session.json'
 if file.exists() and json.loads(file.read_text())!=identity:raise ValueError('Existing session belongs to a different worktree; use a fresh session')
 if not file.exists():file.write_text(json.dumps(identity,indent=2))
 return p
def bundle(out):
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 archive=subprocess.check_output(['git','archive','HEAD'],cwd=ROOT)
 files={}
 with tarfile.open(fileobj=io.BytesIO(archive)) as src:
  for item in src:
   if item.isfile() and (item.name.startswith('shared/') or item.name in REQUIRED):files[item.name]=src.extractfile(item).read()
 if not REQUIRED.issubset(files):raise ValueError('Commit the tested API startup files before packaging HEAD')
 manifest={'version':1,'commit':commit,'files':{name:sha(data) for name,data in files.items()}}
 files['source-manifest.json']=json.dumps(manifest,indent=2).encode()
 path=out/'public-app.tar'
 with tarfile.open(path,'w') as tar:
  for name,data in sorted(files.items()):
   item=tarfile.TarInfo(name);item.size=len(data);item.mode=0o600;tar.addfile(item,io.BytesIO(data))
 (out/'public-package.json').write_text(json.dumps({'commit':commit,'sha256':sha(path.read_bytes()),'files':len(files)},indent=2))
 print('PASS committed public source package; no photos, outputs, credentials or uncommitted files')
def bind(draft,origin,out):
 import re
 from urllib.parse import urlsplit
 u=urlsplit(origin)
 if u.scheme!='http' or u.hostname not in ('127.0.0.1','localhost') or u.username or u.password or u.path not in ('','/') or u.query or u.fragment:raise ValueError('Use the exact existing browser loopback origin')
 record=json.loads(pathlib.Path(draft).read_text(encoding='utf-8-sig'));d=record['draft'];s=record['payload']['settings'];project=record.get('project',{})
 if any(not isinstance(v,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,160}',v) for v in [project.get('id'),s.get('brandId'),s.get('sourceId')]):raise ValueError('Re-export from the real saved project with selected brand/source identity')
 if s['imageModel']!='qwen-fp8' or s['seed']!=42 or s['sourceKind']!='original' or not d.get('reviewedSnapshot'):raise ValueError('Export the reviewed original Qwen direction with seed 42')
 if s['prompt']!=(d.get('modelPrompt') if d.get('promptFormat')=='concise-v2' else d['prompt']):raise ValueError('Exported reviewed prompt mismatch')
 plan={'version':1,'projectId':project['id'],'brandId':s['brandId'],'sourceId':s['sourceId'],'productId':s.get('productId',''),'purpose':'qwen-app-acceptance','paidApproved':False,'privateUploadApproved':False,'podId':'UNALLOCATED','maxJobs':1,'maxSpendUSD':2,'reserveUSD':4,'seed':42,'browserOrigin':origin.rstrip('/'),'remoteOrigin':'http://127.0.0.1:28301','codeCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'originalSha256':d['input']['source']['originalSha256'],'referenceSha256':d['input']['source']['sha256'],'promptSha256':sha(s['prompt'].encode())}
 for key in ('originalSha256','referenceSha256','promptSha256'):
  if len(plan[key])!=64 or any(c not in '0123456789abcdef' for c in plan[key]):raise ValueError('Invalid source/prompt digest')
 for name,data in [('acceptance.json',plan),('reviewed-request.json',record)]:
  with (out/name).open('x',encoding='utf8') as f:json.dump(data,f,indent=2)
 print('PASS private source/seed/prompt binding prepared; PAID AND UPLOAD APPROVAL REMAIN FALSE')
def main():
 p=argparse.ArgumentParser();p.add_argument('--bundle',action='store_true');p.add_argument('--draft');p.add_argument('--origin');p.add_argument('--out',default=ROOT/'outputs/qwen-app-acceptance/session');a=p.parse_args()
 if not a.bundle and not a.draft:print('DRY RUN: no package, upload, network or paid resource');return
 out=output(a.out)
 if a.bundle:bundle(out)
 if a.draft:
  if not a.origin:raise ValueError('--origin must match the saved browser project')
  bind(a.draft,a.origin,out)
if __name__=='__main__':main()
