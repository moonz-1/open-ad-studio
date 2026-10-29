"""Local comparison artifacts only; never changes a raw model PNG."""
import argparse,hashlib,html,json,pathlib,os
from PIL import Image,ImageDraw,ImageFont,ImageOps
ROOT=pathlib.Path('outputs/qwen-hero-benchmark');SESSION=pathlib.Path(os.environ.get('QWEN_SESSION_DIR',ROOT/'session'))
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--plan');args=parser.parse_args()
 manifest=json.loads((ROOT/'input.json').read_text());items=[('Original photograph',ROOT/'original-reference.jpeg')];records=[]
 kinds=['authenticity','intimate','campaign'] if args.plan else ['lighting','cinematic']
 if args.plan:
  plan=json.loads(pathlib.Path(args.plan).read_text(encoding='utf8'))
  if [c['id'] for c in plan['cases']]!=kinds:raise ValueError('Unexpected campaign case list')
 for kind in kinds:
  p=SESSION/'candidates'/kind;r=json.loads((p/'render.json').read_text());raw=p/'raw.png'
  assert r['status']=='complete' and hashlib.sha256(raw.read_bytes()).hexdigest()==r['rawSha256'];items.append((kind.title()+' · requested concept',raw));records.append(r)
 assert hashlib.sha256(items[0][1].read_bytes()).hexdigest()==manifest['originalSha256']
 sheet=Image.new('RGB',(600*len(items),920),'#17130f');draw=ImageDraw.Draw(sheet)
 try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',23)
 except OSError:font=ImageFont.load_default()
 for i,(label,path) in enumerate(items):
  with Image.open(path) as source:im=ImageOps.exif_transpose(source).convert('RGB')
  im.thumbnail((560,800),Image.Resampling.LANCZOS);sheet.paste(im,(i*600+(600-im.width)//2,70));draw.text((i*600+20,20),label,font=font,fill='#fff5e4')
 draw.text((20,880),'RAW Qwen-Image-Edit-2511 FP8 outputs · seed42 · not owner-approved',font=font,fill='#fff5e4');sheet.save(SESSION/'comparison.jpg',quality=96)
 figures=[]
 for i,(label,path) in enumerate(items):
  src=pathlib.Path(os.path.relpath(path,SESSION)).as_posix();figures.append(f'<figure><a href="{src}"><img src="{src}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>')
 (SESSION/'gallery.html').write_text('<!doctype html><meta charset="utf-8"><title>Actual Qwen hero comparison · owner review</title><style>body{font:16px Arial;background:#17130f;color:#fff5e4;margin:28px}section{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;flex:1;min-width:260px;max-width:650px}img{width:100%;max-height:850px;object-fit:contain}figcaption{margin-top:12px}p{max-width:1000px;line-height:1.6}a{color:#edbb81}pre{white-space:pre-wrap}</style><h1>Qwen-Image-Edit-2511 · '+str(len(records))+' real candidates</h1><p>Original nine-roll photograph, not an AI-enhanced input. Raw model PNGs have no finishing, logo or typography. All candidates remain unapproved. Compare roll structure, frosting, spirals, dough, invented details and believable lighting; successful inference alone is not a quality pass.</p><section>'+''.join(figures)+'</section>'+''.join('<details><summary>'+html.escape(r['case'])+' · exact prompt and provenance</summary><pre>'+html.escape(r['prompt'])+'</pre><p>Seed42 ·40steps ·CFG4 ·euler/simple ·FP8mixed · '+str(round(r['seconds'],1))+'s elapsed</p><a href="candidates/'+r['case']+'/render.json">Full execution/hash record</a></details>' for r in records),encoding='utf8')
 print('Verified raw hashes and original; comparison.jpg/gallery.html saved. Owner approval PENDING.')
if __name__=='__main__':main()
