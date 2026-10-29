import importlib.util, json, pathlib, tempfile, unittest, threading, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('lifecycle',pathlib.Path(__file__).with_name('lifecycle.py'))
life=importlib.util.module_from_spec(spec);spec.loader.exec_module(life)
class LifecycleTests(unittest.TestCase):
    def setUp(self): self.lease={'version':1,'podId':'test-pod','name':'adstudio-ltx25-test','created':1000,'deadline':10000,'gpuRate':1.79,'storageHourly':.032,'sessionCap':6,'feesUSD':0,'networkVolumeId':None}
    def test_bounds(self):
        self.assertEqual(life.validate_lease(self.lease,1100),self.lease)
        for field,value in [('deadline',11800),('gpuRate',2),('sessionCap',10),('feesUSD',2),('feesUSD',float('nan')),('networkVolumeId','volume'),('podId','../other')]:
            with self.subTest(field=field), self.assertRaises((ValueError,KeyError)): life.validate_lease({**self.lease,field:value},1100)
    def test_watchdog_heartbeat_required(self):
        base=pathlib.Path('outputs/benchmark-preflight-20261022').resolve();base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as folder:
            file=pathlib.Path(folder)/'ready.json'
            with self.assertRaises(FileNotFoundError):life.require_armed(self.lease,file,1100)
            proof={k:self.lease[k] for k in ['podId','created','deadline']}|{'state':'armed','checked':1090}
            file.write_text(json.dumps(proof));self.assertTrue(life.require_armed(self.lease,file,1100))
            for bad in [{**proof,'checked':1000},{**proof,'podId':'other'},{**proof,'state':'starting'}]:
                file.write_text(json.dumps(bad))
                with self.assertRaises(RuntimeError):life.require_armed(self.lease,file,1100)
    def test_early_termination(self):
        self.assertFalse(life.expired(self.lease,1100))
        self.assertTrue(life.expired(self.lease,9700))
    def test_termination_verified(self):
        with patch.object(life,'request',side_effect=[(200,{'id':self.lease['podId'],'name':self.lease['name']}),(204,None),(404,None)]) as req:
            self.assertTrue(life.terminate(self.lease));self.assertEqual(req.call_args_list[1].args,('/pods/test-pod','DELETE'))
    def test_wrong_resource_never_deleted(self):
        with patch.object(life,'request',return_value=(200,{'name':'other-project'})) as req:
            with self.assertRaises(RuntimeError):life.terminate(self.lease)
            self.assertEqual(req.call_count,1)
    def test_absent_idempotent(self):
        with patch.object(life,'request',return_value=(404,None)) as req:
            self.assertTrue(life.terminate(self.lease));self.assertEqual(req.call_count,1)

    def test_v2_rate_rejects_missing_legacy_conflict_and_nan(self):
        pod={'id':self.lease['podId'],'name':self.lease['name'],'cost':1.79}
        self.assertEqual(life.live_rate(self.lease,pod),1.79)
        for update in [{'cost':None},{'cost':float('nan')},{'cost':float('inf')},{'cost':True},{'cost':'1.79'},{'cost':2},{'cost':0},{'costPerHr':1.79},{'id':'other'},{'name':'other'}]:
            with self.subTest(update=update),self.assertRaises((ValueError,RuntimeError)):
                life.live_rate(self.lease,pod|update)

    def test_transport_cannot_provision_or_delete_other_resource_types(self):
        for path,method in [('/pods','POST'),('/network-volumes/other','DELETE'),('//other-origin','GET'),('/pods/../other','DELETE')]:
            with self.subTest(path=path,method=method),self.assertRaises(ValueError):life.request(path,method)

    def test_redirect_is_refused(self):
        with self.assertRaises(RuntimeError):life.NoRedirect().redirect_request(None,None,302,'Found',{},'https://another-origin.example')

    def test_id_must_match_even_when_name_matches(self):
        with patch.object(life,'request',return_value=(200,{'id':'other','name':self.lease['name']})) as req:
            with self.assertRaises(RuntimeError):life.terminate(self.lease)
            self.assertEqual(req.call_count,1)

    def test_billing_v2_is_not_silently_zero(self):
        row={'podId':self.lease['podId'],'totalAmount':1.82,'gpuAmount':1.79,'diskAmount':.03,'cpuAmount':0}
        billing={'records':[row],'metadata':{'query':{'podId':self.lease['podId']},'recordCount':1,'totals':{'totalAmount':1.82}}}
        self.assertEqual(life.billing_total(self.lease,billing)[1],1.82)
        for bad in [[row],{**billing,'records':[row|{'podId':'other'}]},{**billing,'records':[row|{'totalAmount':float('nan')}]},{**billing,'records':[row|{'diskAmount':0}]}]:
            with self.assertRaises((ValueError,KeyError)):life.billing_total(self.lease,bad)

    def test_delete_retries_until_get_absence(self):
        with patch.object(life,'terminate',side_effect=[RuntimeError('403'),False,True]) as terminate,patch.object(life.time,'sleep'):
            life.terminate_until_gone(self.lease)
            self.assertEqual(terminate.call_count,3)

    def test_auth_failure_does_not_refresh_heartbeat_or_extend_deadline(self):
        pod={'id':self.lease['podId'],'name':self.lease['name'],'cost':1.79}
        with patch.object(life.time,'time',side_effect=[1100,9700]),patch.object(life.time,'sleep'),patch.object(life,'request',side_effect=RuntimeError('401')),patch.object(life,'write_ready') as ready,patch.object(life,'terminate_until_gone') as terminate:
            life.watch(self.lease,'unused');ready.assert_not_called();terminate.assert_called_once_with(self.lease)

    def test_rate_increase_terminates_without_arming(self):
        pod={'id':self.lease['podId'],'name':self.lease['name'],'cost':2}
        with patch.object(life.time,'time',return_value=1100),patch.object(life,'request',return_value=(200,pod)),patch.object(life,'write_ready') as ready,patch.object(life,'terminate_until_gone') as terminate:
            life.watch(self.lease,'unused');ready.assert_not_called();terminate.assert_called_once_with(self.lease)

    def test_loopback_http_termination_rehearsal(self):
        # Real HTTP transport against a local fake provider, never a Runpod call.
        calls=[];state={'deleted':False,'deletes':0}
        pod={'id':self.lease['podId'],'name':self.lease['name'],'cost':1.79}
        class Provider(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                calls.append(('GET',self.path))
                self.send_response(404 if state['deleted'] else 200);self.end_headers()
                if not state['deleted']:self.wfile.write(json.dumps(pod).encode())
            def do_DELETE(self):
                calls.append(('DELETE',self.path));state['deletes']+=1
                # First acknowledgement is asynchronous: GET still finds it.
                state['deleted']=state['deletes']>=2
                self.send_response(202);self.end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',0),Provider)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with patch.object(life,'BASE',f'http://127.0.0.1:{server.server_port}'),patch.dict(os.environ,{'RUNPOD_API_KEY':'local-fixture-not-a-credential'}),patch.object(life.time,'sleep'):
                life.terminate_until_gone(self.lease)
            self.assertEqual(state['deletes'],2)
            self.assertEqual(calls[-1],('GET','/pods/test-pod'))
            self.assertTrue(all(path=='/pods/test-pod' for _,path in calls))
        finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
