import importlib.util, os, pathlib, unittest
from unittest.mock import Mock, patch

spec=importlib.util.spec_from_file_location('watch_awake',pathlib.Path(__file__).with_name('watch-awake.py'))
wrapper=importlib.util.module_from_spec(spec);spec.loader.exec_module(wrapper)

class AwakeTests(unittest.TestCase):
    def test_interrupted_watchdog_terminates_and_releases_awake_state(self):
        awake=Mock(return_value=1);dll=Mock(SetThreadExecutionState=awake)
        with patch.object(wrapper.os,'name','nt'),patch.dict(os.environ,{'RUNPOD_API_KEY':'test-only'}),patch.object(wrapper.pathlib.Path,'read_text',return_value='{}'),patch.object(wrapper,'validate_lease',return_value={'podId':'approved'}),patch.object(wrapper.ctypes,'WinDLL',return_value=dll),patch.object(wrapper,'watch',side_effect=KeyboardInterrupt()),patch.object(wrapper,'terminate_until_gone') as terminate,patch('sys.argv',['watch-awake.py','--approved','--lease','test','--ready-file','test']):
            wrapper.main();terminate.assert_called_once_with({'podId':'approved'})
            self.assertNotIn('RUNPOD_API_KEY',os.environ)
        self.assertEqual([c.args[0] for c in awake.call_args_list],[0x80000001,0x80000000])

    def test_awake_failure_never_starts_watch_or_leaves_secret(self):
        awake=Mock(return_value=0);dll=Mock(SetThreadExecutionState=awake)
        with patch.object(wrapper.os,'name','nt'),patch.dict(os.environ,{'RUNPOD_API_KEY':'test-only'}),patch.object(wrapper.pathlib.Path,'read_text',return_value='{}'),patch.object(wrapper,'validate_lease',return_value={}),patch.object(wrapper.ctypes,'WinDLL',return_value=dll),patch.object(wrapper,'watch') as watch,patch('sys.argv',['watch-awake.py','--approved','--lease','test','--ready-file','test']):
            with self.assertRaises(RuntimeError):wrapper.main()
            watch.assert_not_called();self.assertNotIn('RUNPOD_API_KEY',os.environ)
        self.assertEqual(awake.call_args.args,(0x80000000,))

if __name__=='__main__':unittest.main()
