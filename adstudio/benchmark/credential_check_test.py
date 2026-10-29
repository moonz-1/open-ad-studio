import importlib.util, json, os, pathlib, tempfile, unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('credential_check',pathlib.Path(__file__).with_name('credential-check.py'))
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

class CredentialCheckTests(unittest.TestCase):
    def setUp(self):
        root=pathlib.Path('outputs/benchmark-readiness').resolve();root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.addCleanup(self.temp.cleanup)
        self.out=pathlib.Path(self.temp.name)/'check.json'
        self.key=pathlib.Path(self.temp.name)/'identity.pub'
        self.key.write_text('ssh-ed25519 cHVibGljLWZpeHR1cmU= private-comment-not-for-evidence')
        self.secret='test-only-secret-never-save'

    def run_check(self,extra,responses):
        with patch.dict(os.environ,{'RUNPOD_API_KEY':self.secret}),patch.object(check,'request',side_effect=responses) as request:
            result=check.main(['--check-read-only','--out',str(self.out),*extra])
            self.assertNotIn('RUNPOD_API_KEY',os.environ)
        saved=self.out.read_text();self.assertNotIn(self.secret,saved)
        self.assertNotIn('private-comment',saved)
        self.assertTrue(all(len(call.args)==1 for call in request.call_args_list)) # GET default only
        return result,json.loads(saved),request

    def test_matching_public_key_and_complete_empty_inventory(self):
        result,report,request=self.run_check(['--public-key',str(self.key)],[(200,{'keys':[self.key.read_text()]}),(200,{'pods':[],'pagination':{'hasNextPage':False}})])
        self.assertEqual(result,0);self.assertEqual(report['status'],'PASS');self.assertEqual(request.call_count,2)

    def test_wrong_key_and_nonempty_or_incomplete_inventory_fail(self):
        for replies in [[(200,{'keys':[]})],[(200,{'keys':[self.key.read_text()]}),(200,{'pods':[{'id':'foreign'}],'pagination':{'hasNextPage':False}})],[(200,{'keys':[self.key.read_text()]}),(200,{'pods':[],'pagination':{'hasNextPage':True}})]]:
            result,report,_=self.run_check(['--public-key',str(self.key)],replies)
            self.assertEqual(result,1);self.assertEqual(report['status'],'FAIL')

    def test_billing_uses_only_separate_billing_read(self):
        result,report,request=self.run_check(['--billing-only'],[(200,{'metadata':{'totals':{'totalAmount':0}}})])
        self.assertEqual(result,0);request.assert_called_once_with('/billing?lastN=1&bucketSize=month')
        self.assertEqual(report['checks']['currentMonthSpendUSD'],0)

    def test_nonzero_missing_and_invalid_billing_never_pass(self):
        for value in [1,None,True,float('nan')]:
            result,report,_=self.run_check(['--billing-only'],[(200,{'metadata':{'totals':{'totalAmount':value}}})])
            self.assertEqual(result,1);self.assertEqual(report['status'],'FAIL')

    def test_provider_error_is_redacted_and_stale_pass_invalidated(self):
        self.out.write_text('{"status":"PASS"}')
        result,report,_=self.run_check(['--billing-only'],[RuntimeError(self.secret)])
        self.assertEqual(result,1);self.assertEqual(report['status'],'FAIL');self.assertEqual(report['errorType'],'RuntimeError')

    def test_auth_status_is_safe_to_report_without_provider_body(self):
        result,report,_=self.run_check(['--billing-only'],[RuntimeError('Runpod GET: HTTP 403')])
        self.assertEqual(result,1);self.assertEqual(report['httpStatus'],403)

    def test_default_is_offline_and_never_prompts(self):
        with patch.object(check,'request') as request,patch.object(check.getpass,'getpass') as prompt:
            check.main([]);request.assert_not_called();prompt.assert_not_called()

    def test_echoing_prompt_fails_closed(self):
        with patch.dict(os.environ,{},clear=True),patch.object(check.getpass,'getpass',side_effect=check.getpass.GetPassWarning('no console')),patch.object(check,'request') as request:
            self.assertEqual(check.main(['--check-read-only','--billing-only','--out',str(self.out)]),1)
            request.assert_not_called();self.assertEqual(json.loads(self.out.read_text())['status'],'FAIL')

if __name__=='__main__':unittest.main()
