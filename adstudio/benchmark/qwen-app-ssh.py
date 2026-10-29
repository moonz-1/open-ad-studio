"""Future approved API-only SSH setup/tunnel. Never called during free preflight."""
import argparse,hashlib,importlib.util,json,pathlib,subprocess,time
spec=importlib.util.spec_from_file_location('qssh',pathlib.Path(__file__).with_name('qwen-ssh.py'))
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
def main():
 p=argparse.ArgumentParser();p.add_argument('--approved',action='store_true');p.add_argument('--tunnel',action='store_true');p.add_argument('--heartbeat',action='store_true');a=p.parse_args()
 if not a.approved:print('DRY RUN: no SSH, private upload, model download or provider mutation');return
 ep,opts=q.connection();target='root@'+ep['host'];ssh=['ssh',*opts,'-p',str(ep['port']),target]
 if a.tunnel:
  subprocess.run(['ssh',*opts,'-p',str(ep['port']),'-N','-o','ExitOnForwardFailure=yes','-L','127.0.0.1:28301:127.0.0.1:28301',target],check=True);return
 if a.heartbeat:
  while True:
   raw=subprocess.check_output([*ssh,'cat /workspace/qwen-watchdog.json'],timeout=15)
   watch=json.loads(raw);lease=json.loads((q.g.OUT/'lease.json').read_text())
   if watch['podId']!=lease['podId'] or watch['deadline']!=lease['deadline'] or watch['state']!='armed' or not 0<=time.time()-watch['checked']<40:raise ValueError('Independent remote watchdog not fresh')
   q.g.save(q.g.OUT/'pod-watchdog-ready.json',watch);time.sleep(10)
 lease=json.loads((q.g.OUT/'lease.json').read_text())
 try:
  plan=json.loads((q.g.OUT/'acceptance.json').read_text())
  if plan.get('paidApproved') is not True or plan.get('privateUploadApproved') is not True or plan['podId']!=lease['podId']:raise ValueError('Separate approval/exact Pod missing')
  package=json.loads((q.g.OUT/'public-package.json').read_text())
  if plan['codeCommit']!=package['commit']:raise ValueError('Reviewed code differs from source package')
  if hashlib.sha256((q.g.OUT/'public-app.tar').read_bytes()).hexdigest()!=package['sha256']:raise ValueError('Public package hash mismatch')
  subprocess.run([*ssh,'test ! -e /workspace/qwen-app && mkdir /workspace/qwen-app'],check=True,timeout=20)
  for name in ['public-app.tar','acceptance.json']:
   subprocess.run(['scp',*opts,'-P',str(ep['port']),str(q.g.OUT/name),target+':/workspace/qwen-app/'+name],check=True,timeout=90)
  subprocess.run([*ssh,'cd /workspace/qwen-app && tar -xf public-app.tar && bash adstudio/benchmark/qwen-app-start.sh --approved'],check=True)
 except BaseException as e:
  q.g.save(q.g.OUT/'one-job.json.status.json',{'state':'failed','podId':lease['podId'],'errorType':type(e).__name__,'checked':time.time()})
  raise
if __name__=='__main__':main()
