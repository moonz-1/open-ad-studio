"""CPU-only mocked lifecycle tests. Never contacts Runpod or uploads assets."""
import hashlib,importlib.util,json,pathlib,tempfile,time,unittest
import os,shlex,stat,subprocess,sys
from unittest.mock import patch
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,pathlib.Path(__file__).with_name(file));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
m=module('monitor','qwen-app-monitor.py');prep=module('prepare','qwen-app-prepare.py');ssh=module('sshhelper','qwen-app-ssh.py')
class AppTests(unittest.TestCase):
 def test_preparation_keeps_api_worktree_spelling_and_identity(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);(root/'outputs').mkdir()
   with patch.object(prep,'ROOT',root):
    out=prep.output('outputs/isolated/session')
    self.assertEqual(out,root/'outputs/isolated/session')
    identity=json.loads((out/'local-session.json').read_text())
    self.assertEqual(identity['sessionDir'],str(out));self.assertEqual(identity['relativeSession'],'outputs/isolated/session')
    self.assertEqual(prep.output(out),out)
    identity['repoRoot']='other';(out/'local-session.json').write_text(json.dumps(identity))
    with self.assertRaisesRegex(ValueError,'different worktree'):prep.output(out)
    for invalid in [root/'outside/session',root/'outputs/not-session',root/'outputs/../outside/session']:
     with self.assertRaises(ValueError):prep.output(invalid)
 def test_startup_failure_signals_cleanup_without_upload(self):
  import sys
  with tempfile.TemporaryDirectory() as tmp:
   out=pathlib.Path(tmp);(out/'lease.json').write_text(json.dumps({'podId':'MOCK'}));(out/'acceptance.json').write_text(json.dumps({'paidApproved':False}))
   with patch.object(ssh.q,'connection',return_value=({'host':'MOCK','port':22},[])),patch.object(ssh.q.g,'OUT',out),patch.object(sys,'argv',['qwen-app-ssh.py','--approved']),patch.object(ssh.subprocess,'run') as run:
    with self.assertRaises(ValueError):ssh.main()
    run.assert_not_called();self.assertEqual(json.loads((out/'one-job.json.status.json').read_text())['state'],'failed')
 def test_verified_collection_and_original_preservation(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);out=root/'outputs';out.mkdir();files=[]
   for name in ['comfy-output.png','reference.png','original.jpg','provenance.json','aaaaaaaaaaaaaaaa.png']:
    path=out/name;path.write_bytes(name.encode());files.append({'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
   lease={'podId':'MOCK'};record={'state':'collected','podId':'MOCK','jobId':'MOCK-JOB','files':files}
   self.assertTrue(m.verify_collection(record,lease,root))
   (out/'original.jpg').write_bytes(b'changed')
   with self.assertRaises(ValueError):m.verify_collection(record,lease,root)
 def test_finally_exact_termination_on_success_failure_and_budget(self):
  for state in ['collected','failed','budget']:
   with self.subTest(state=state),tempfile.TemporaryDirectory() as tmp:
    out=pathlib.Path(tmp);p={'podId':'MOCK','created':time.time()-100,'deadline':time.time()+7000}
    if state!='budget':(out/'one-job.json.status.json').write_text(json.dumps({'state':state}))
    else:p['deadline']=time.time()+10
    with patch.object(m.g,'OUT',out),patch.object(m.g,'request',return_value=(200,{})),patch.object(m.g,'check'),patch.object(m.g,'terminate') as kill,patch.object(m,'verify_collection',return_value=True):
     if state=='collected':m.monitor(p)
     else:
      with self.assertRaises(RuntimeError):m.monitor(p)
     kill.assert_called_once_with(p)
 def test_prepare_remains_unapproved_and_origin_bound(self):
  with tempfile.TemporaryDirectory() as tmp:
   out=pathlib.Path(tmp);d={'reviewedSnapshot':'MOCK only','promptFormat':'concise-v2','modelPrompt':'Reviewed','input':{'source':{'sha256':'a'*64,'originalSha256':'b'*64}}}
   settings={'imageModel':'qwen-fp8','seed':42,'sourceKind':'original','brandId':'brand','sourceId':'ref','prompt':'Reviewed'}
   path=out/'brief.json';path.write_text(json.dumps({'project':{'id':'MOCK-project'},'draft':d,'payload':{'settings':settings}}))
   with patch.object(prep.subprocess,'check_output',return_value='c'*40):prep.bind(path,'http://127.0.0.1:8301',out)
   plan=json.loads((out/'acceptance.json').read_text());self.assertFalse(plan['paidApproved']);self.assertFalse(plan['privateUploadApproved']);self.assertEqual(plan['maxJobs'],1);self.assertEqual(plan['browserOrigin'],'http://127.0.0.1:8301')
   with self.assertRaises(ValueError):prep.bind(path,'https://public.example',out)
 def test_public_bundle_excludes_private_and_uncommitted_files(self):
  import io,tarfile
  with tempfile.TemporaryDirectory() as tmp:
   raw=io.BytesIO()
   with tarfile.open(fileobj=raw,mode='w') as t:
    for name in [*prep.REQUIRED,'shared/runtime/api.ts','.env','outputs/private.jpg','adstudio/src/private.ts']:
     item=tarfile.TarInfo(name);item.size=4;t.addfile(item,io.BytesIO(b'TEST'))
   with patch.object(prep.subprocess,'check_output',side_effect=['a'*40,raw.getvalue()]):prep.bundle(pathlib.Path(tmp))
   with tarfile.open(pathlib.Path(tmp)/'public-app.tar') as t:
    self.assertNotIn('.env',t.getnames());self.assertNotIn('outputs/private.jpg',t.getnames());self.assertNotIn('adstudio/src/private.ts',t.getnames())
# Optional REAL Linux regression. Set QWEN_NODE_ARCHIVE to the genuine pinned
# archive in a local container with --cap-drop=ALL; never provisions a GPU.
NODE_VERSION='v22.20.0'
NODE_SHA256='00bbd05e306ea68b6e13e17360d0e2f680b493ef95f2fea1c4296ff7437530bc'
START=pathlib.Path(__file__).with_name('qwen-app-start.sh')
def node_commands(archive):
 lines=START.read_text().splitlines()
 verify=next(line.strip() for line in lines if '| sha256sum -c -' in line)
 extract=next(line.strip() for line in lines if line.strip().startswith('tar '))
 return 'node_archive='+shlex.quote(str(archive))+'\n'+verify,extract
LINUX_ARCHIVE=sys.platform.startswith('linux') and bool(os.environ.get('QWEN_NODE_ARCHIVE'))
class NodeStartupTests(unittest.TestCase):
 def test_cpu_harness_defaults_to_no_actions(self):
  result=subprocess.run([sys.executable,str(START.with_name('qwen_app_cpu_check.py'))],capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stderr)
  self.assertIn('DRY RUN',result.stdout)

 def test_pin_verification_and_safe_extraction_contract(self):
  source=START.read_text();verify,extract=node_commands('/fixture/archive.tar.xz')
  self.assertIn('node_archive=node-'+NODE_VERSION+'-linux-x64.tar.xz',source)
  self.assertIn('https://nodejs.org/dist/'+NODE_VERSION+'/$node_archive',source)
  self.assertIn(NODE_SHA256,verify)
  self.assertIn('--no-same-owner',shlex.split(extract))
  self.assertIn('--no-same-permissions',shlex.split(extract))
  self.assertIn('--strip-components=1',extract)
  self.assertIn('[[ "$(node --version)" == '+NODE_VERSION+' ]]',source)
  self.assertLess(source.index('| sha256sum -c -'),source.index(extract))
  self.assertLess(source.index(extract),source.index('timeout 600 npm ci'))

 @unittest.skipUnless(LINUX_ARCHIVE,'real archive regression requires explicit local Linux fixture')
 def test_real_node_archive_when_chown_is_forbidden(self):
  archive=pathlib.Path(os.environ['QWEN_NODE_ARCHIVE'])
  self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),NODE_SHA256)
  caps=next(line.split(':',1)[1].strip() for line in pathlib.Path('/proc/self/status').read_text().splitlines() if line.startswith('CapEff:'))
  self.assertEqual(int(caps,16),0,'run this regression without Linux capabilities')
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);probe=root/'ownership-probe';probe.touch()
   with self.assertRaises(PermissionError):os.chown(probe,1000,1000)
   verify,extract=node_commands(archive)
   old=extract.replace(' --no-same-owner','').replace(' --no-same-permissions','')
   # GNU tar defaults to restoring ownership as root. For the separate non-root
   # run explicitly request the same behavior to prove the restriction still holds.
   if os.geteuid()!=0:old=old.replace('tar ','tar --same-owner ',1)
   env={**os.environ,'TAR_OPTIONS':''}
   negative=root/'old';negative.mkdir()
   result=subprocess.run(['bash','-e','-c',verify+'\nmkdir node\n'+old],cwd=negative,env=env,capture_output=True,text=True)
   self.assertNotEqual(result.returncode,0)
   self.assertIn('Cannot change ownership',result.stderr)
   fixed=root/'fixed';fixed.mkdir()
   command=verify+'\numask 027\nmkdir node\n'+extract+'\n./node/bin/node --version'
   corrected=subprocess.run(['bash','-e','-c',command],cwd=fixed,env=env,capture_output=True,text=True)
   self.assertEqual(corrected.returncode,0,corrected.stderr)
   self.assertEqual(corrected.stdout.splitlines()[-1],NODE_VERSION)
   binary=(fixed/'node/bin/node').stat()
   self.assertEqual(binary.st_uid,os.geteuid())
   self.assertEqual(stat.S_IMODE(binary.st_mode),0o750,'honor umask rather than archive permission bits')
   print('REAL LINUX PASS '+json.dumps({'uid':os.geteuid(),'effectiveCapabilities':caps,'oldExit':result.returncode,'fixedExit':corrected.returncode,'node':NODE_VERSION,'sha256':NODE_SHA256,'binaryOwner':binary.st_uid,'binaryMode':oct(stat.S_IMODE(binary.st_mode))}),flush=True)

 @unittest.skipUnless(LINUX_ARCHIVE,'real archive regression requires explicit local Linux fixture')
 def test_bad_checksum_stops_before_extracting(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);bad=root/'bad.tar.xz';bad.write_bytes(b'CORRUPT SOFTWARE ARCHIVE TEST FIXTURE')
   verify,extract=node_commands(bad)
   result=subprocess.run(['bash','-e','-c',verify+'\nmkdir node\n'+extract],cwd=root,capture_output=True,text=True)
   self.assertNotEqual(result.returncode,0)
   self.assertFalse((root/'node').exists(),'checksum gate must fail before extraction')
if __name__=='__main__':unittest.main()
