"""Synthetic CPU fixtures only. Never reuses product photos as generated outputs."""
import hashlib,importlib.util,json,pathlib,sys,tempfile,unittest
from unittest.mock import patch
from PIL import Image
s=importlib.util.spec_from_file_location('gallery',pathlib.Path(__file__).with_name('qwen-compare.py'));g=importlib.util.module_from_spec(s);s.loader.exec_module(g)

class GalleryTests(unittest.TestCase):
 def exercise(self,campaign):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);session=root/'session';session.mkdir()
   original=root/'original-reference.jpeg';Image.new('RGB',(24,32),'white').save(original)
   (root/'input.json').write_text(json.dumps({'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest()}))
   kinds=['authenticity','intimate','campaign'] if campaign else ['lighting','cinematic']
   plan=root/'campaign.json';plan.write_text(json.dumps({'cases':[{'id':k} for k in kinds]}))
   for i,kind in enumerate(kinds):
    folder=session/'candidates'/kind;folder.mkdir(parents=True);raw=folder/'raw.png';Image.new('RGB',(24,32),['red','green','blue'][i]).save(raw)
    (folder/'render.json').write_text(json.dumps({'status':'complete','rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'case':kind,'prompt':'SYNTHETIC CPU TEST ONLY <escaped>','seconds':1}))
   args=['qwen-compare.py']+(['--plan',str(plan)] if campaign else [])
   with patch.object(g,'ROOT',root),patch.object(g,'SESSION',session),patch.object(sys,'argv',args):
    g.main();page=(session/'gallery.html').read_text(encoding='utf8');self.assertEqual(page.count('<figure>'),len(kinds)+1);self.assertIn('&lt;escaped&gt;',page)
    with Image.open(session/'comparison.jpg') as image:self.assertEqual(image.size,(600*(len(kinds)+1),920))
    (session/'candidates'/kinds[-1]/'raw.png').write_bytes(b'corrupt fixture')
    with self.assertRaises(AssertionError):g.main()
 def test_legacy_gallery_still_works(self):self.exercise(False)
 def test_three_concept_gallery_and_corrupt_output_rejection(self):self.exercise(True)

if __name__=='__main__':unittest.main()
