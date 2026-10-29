import importlib.util,json,pathlib,time,unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('qguard',pathlib.Path(__file__).with_name('qwen-guard.py'));g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class GuardTests(unittest.TestCase):
 def test_session_isolation(self):
  self.assertEqual(g.session_dir(g.ROOT/'outputs/creative-quality-sprint/session'),g.ROOT/'outputs/creative-quality-sprint/session')
  # A worktree may itself live inside the shared ignored outputs directory.
  # Derive the negative fixture from the canonical output root, not ROOT.parent.
  for path in [g.ROOT/'.env',(g.ROOT/'outputs').resolve().parent/'outside-output-fixture/session',g.ROOT/'outputs/not-a-session']:
   with self.assertRaises(ValueError):g.session_dir(path)
 def test_watchdog_api_path_mismatch_is_rejected_before_key_access(self):
  with patch.dict(g.os.environ,{'QWEN_APP_SESSION_DIR':str(g.ROOT/'outputs/other/session')}):
   with self.assertRaisesRegex(ValueError,'same session path'):g.session_dir(g.ROOT/'outputs/creative-quality-sprint/session')
 def setUp(self):
  self.lease={'version':1,'podId':'owned','name':'adstudio-qwen2511-fixture','created':time.time()-100,'deadline':time.time()+7000,'gpuRate':.59,'storageHourly':.02,'cap':2,'image':'pinned'}
  self.pod={'id':'owned','name':self.lease['name'],'cost':.59,'cloud':'SECURE','gpu':{'id':'NVIDIA A40','count':1,'memory':50,'vcpuCount':8},'image':'pinned','disk':30,'mounts':{'persistent':{'size':80,'path':'/workspace'}},'ports':['22/tcp']}
 def test_exact_bounds(self):
  self.assertTrue(g.check(self.lease,self.pod))
  for change in [{'cap':3},{'deadline':self.lease['created']+7201},{'gpuRate':1.79},{'storageHourly':.04},{'name':'adstudio-ltx25-old'}]:
   with self.assertRaises(ValueError):g.validate(self.lease|change)
  for change in [{'id':'foreign'},{'cost':None},{'cost':.62},{'cloud':'COMMUNITY'},{'image':'other'},{'disk':50},{'ports':['22/tcp','8188/http']},{'gpu':{'id':'NVIDIA A100','count':1,'memory':117,'vcpuCount':16}},{'mounts':{'persistent':{'size':200,'path':'/workspace'}}}]:
   with self.assertRaises(ValueError):g.check(self.lease,self.pod|change)
 def test_early_cutoff_and_verified_delete(self):
  calls=[];gone=False
  def api(path,method='GET',body=None):
   nonlocal gone
   calls.append((path,method))
   if method=='DELETE':gone=True;return 204,None
   return (404,None) if gone else (200,self.pod)
  p=self.lease|{'created':time.time()-7000,'deadline':time.time()+100}
  with patch.object(g,'request',side_effect=api),patch.object(g.time,'sleep') as sleep:g.watch(p,'unused');sleep.assert_not_called()
  self.assertEqual([m for _,m in calls],['GET','GET','DELETE','GET']);self.assertTrue(all(p=='/pods/owned' for p,_ in calls))
 def test_unexpected_rate_fails_closed(self):
  with patch.object(g,'request',return_value=(200,self.pod|{'cost':99})),patch.object(g.time,'sleep'),patch.object(g,'terminate') as kill:g.watch(self.lease,'unused');kill.assert_called_once_with(self.lease)
 def test_no_secret_in_public_ready(self):
  with patch.object(g,'request',side_effect=[(200,self.pod),(404,None)]),patch.object(g,'save') as save,patch.object(g.time,'sleep'):g.watch(self.lease,'unused');self.assertNotIn('KEY',str(save.call_args));self.assertEqual(save.call_args.args[1]['state'],'armed')
if __name__=='__main__':unittest.main()
