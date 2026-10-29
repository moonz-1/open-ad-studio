"""No network, token, model weights or GPU required."""
import hashlib, io, pathlib, tempfile, unittest, urllib.request
from unittest.mock import Mock
from weights import download_weight, SafeRedirect
class Response(io.BytesIO):
    status=206
    headers={'Content-Range':'bytes 2-3/4'}
class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.base=pathlib.Path('outputs/benchmark-preflight-20261022').resolve();self.base.mkdir(parents=True,exist_ok=True)
        self.weight={'path':'model.fake','bytes':4,'sha256':hashlib.sha256(b'abcd').hexdigest()}
        self.pins={'modelRepo':'test','modelRevision':'pin'}
    def test_complete_part_never_redownloaded(self):
        with tempfile.TemporaryDirectory(dir=self.base) as folder:
            base=pathlib.Path(folder);(base/'model.fake.part').write_bytes(b'abcd');opener=Mock()
            download_weight(self.pins,self.weight,base,'test',lambda:None,opener)
            self.assertEqual((base/'model.fake').read_bytes(),b'abcd');opener.open.assert_not_called()
    def test_range_mismatch_does_not_append(self):
        with tempfile.TemporaryDirectory(dir=self.base) as folder:
            base=pathlib.Path(folder);part=base/'model.fake.part';part.write_bytes(b'ab')
            response=Response(b'cd');response.headers={'Content-Range':'bytes 0-3/4'}
            with self.assertRaises(RuntimeError):download_weight(self.pins,self.weight,base,'test',lambda:None,Mock(open=Mock(return_value=response)))
            self.assertEqual(part.read_bytes(),b'ab')
    def test_valid_resume_and_guard(self):
        with tempfile.TemporaryDirectory(dir=self.base) as folder:
            base=pathlib.Path(folder);(base/'model.fake.part').write_bytes(b'ab');guard=Mock()
            download_weight(self.pins,self.weight,base,'test',guard,Mock(open=Mock(return_value=Response(b'cd'))))
            self.assertEqual((base/'model.fake').read_bytes(),b'abcd');self.assertGreaterEqual(guard.call_count,2)
    def test_head_remains_head_and_token_is_not_forwarded(self):
        req=urllib.request.Request('https://huggingface.co/model',method='HEAD',headers={'Authorization':'Bearer fake-test'})
        redirected=SafeRedirect().redirect_request(req,None,302,'Found',{},'https://cdn.example/model')
        self.assertEqual(redirected.get_method(),'HEAD');self.assertIsNone(redirected.get_header('Authorization'))
        with self.assertRaises(RuntimeError):SafeRedirect().redirect_request(req,None,302,'Found',{},'http://cdn.example/model')
if __name__=='__main__':unittest.main()
