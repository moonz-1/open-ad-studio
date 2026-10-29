import importlib.util, os, pathlib, subprocess, unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('cookie_session',pathlib.Path(__file__).with_name('cookie-session.py'))
session=importlib.util.module_from_spec(spec);spec.loader.exec_module(session)

class CookieSessionTests(unittest.TestCase):
    def setUp(self):
        self.lease={'podId':'approved','deadline':10000}
        self.pod={'id':'approved'}

    def exercise(self,render_error=None,record=None,heartbeat_error=None):
        events=[]
        def child(args,**kwargs):
            self.assertNotIn('RUNPOD_API_KEY',kwargs['env']);self.assertNotIn('HF_TOKEN',kwargs['env'])
            self.assertLessEqual(kwargs['timeout'],1800)
            events.append('render' if 'render.mjs' in args[1] else 'collect')
            if render_error:raise render_error
        with patch.dict(os.environ,{'RUNPOD_API_KEY':'test-only','HF_TOKEN':'test-only'}),patch.object(session,'require_armed',side_effect=heartbeat_error),patch.object(session,'request',return_value=(200,self.pod)),patch.object(session,'live_rate'),patch.object(session.time,'time',return_value=1000),patch.object(session.subprocess,'run',side_effect=child),patch.object(session.pathlib.Path,'read_text',return_value=record or '{"status":"complete","videoSha256":"'+session.hashlib.sha256(b'fixture').hexdigest()+'"}'),patch.object(session.pathlib.Path,'read_bytes',return_value=b'fixture'),patch.object(session,'terminate_until_gone',side_effect=lambda p:events.append('terminate')):
            try:session.run_cookie(self.lease,'ready','node')
            except (RuntimeError,subprocess.TimeoutExpired,KeyboardInterrupt):pass
        return events

    def test_first_success_terminates_before_contact_sheets(self):
        self.assertEqual(self.exercise(),['render','terminate','collect'])

    def test_render_failure_or_interrupt_terminates_without_retry(self):
        for error in [RuntimeError('render'),subprocess.TimeoutExpired('node',1800),KeyboardInterrupt()]:
            self.assertEqual(self.exercise(render_error=error),['render','terminate'])

    def test_hash_mismatch_terminates_without_claiming_collection(self):
        self.assertEqual(self.exercise(record='{"status":"complete","videoSha256":"wrong"}'),['render','terminate'])

    def test_stale_watchdog_terminates_without_submission(self):
        self.assertEqual(self.exercise(heartbeat_error=RuntimeError('stale')),['terminate'])

    def test_default_does_nothing(self):
        with patch.object(session,'run_cookie') as run,patch.object(session.getpass,'getpass') as prompt,patch.object(session.subprocess,'check_output') as node:
            session.main([]);run.assert_not_called();prompt.assert_not_called();node.assert_not_called()

if __name__=='__main__':unittest.main()
