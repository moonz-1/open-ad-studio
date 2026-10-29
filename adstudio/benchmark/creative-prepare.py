"""Deterministic original crop and authentic circular logo treatment, no inference."""
import hashlib,json,pathlib
from PIL import Image,ImageDraw,ImageOps

ROOT=pathlib.Path('outputs/creative-quality-sprint')
sha=lambda b:hashlib.sha256(b).hexdigest()

def prepare():
    ROOT.mkdir(parents=True,exist_ok=True)
    sources=json.loads(pathlib.Path('outputs/benchmark-ad-v1/sources.json').read_text(encoding='utf8'))
    original=pathlib.Path(sources['original']['path']);logo=pathlib.Path(sources['logo']['path'])
    assert sha(original.read_bytes())==sources['original']['sha256']
    assert sha(logo.read_bytes())==sources['logo']['sha256']
    im=ImageOps.exif_transpose(Image.open(original)).convert('RGB')
    # ROI chosen by visually inspecting the actual middle-right irregular roll.
    roi=(round(im.width*.64),round(im.height*.33),round(im.width*.995),round(im.height*.645))
    crop=im.crop(roi);crop.thumbnail((1536,1536),Image.Resampling.LANCZOS)
    crop.save(ROOT/'intimate-original-crop.png')
    full=im.copy();full.thumbnail((1536,1536),Image.Resampling.LANCZOS);full.save(ROOT/'full-original-guide.png')
    brand=Image.open(logo).convert('RGBA')
    # Keep the genuine letterforms/texture. Only corners OUTSIDE the original
    # circular artwork are masked. No recoloring, tracing or AI reconstruction.
    if brand.size!=(461,437):raise ValueError('Logo dimensions changed; visually review the seal bounds again')
    bounds=(42,5,452,415);scale=4
    mask=Image.new('L',(brand.width*scale,brand.height*scale),0)
    ImageDraw.Draw(mask).ellipse(tuple(x*scale for x in bounds),fill=255)
    mask=mask.resize(brand.size,Image.Resampling.LANCZOS)
    brand.putalpha(mask);brand.crop(bounds).save(ROOT/'brand-seal.png')
    background=Image.new('RGBA',(900,470),'#f1e8db');background.alpha_composite(brand.crop(bounds),(30,30))
    dark=Image.new('RGBA',(450,470),'#1c1511');dark.alpha_composite(brand.crop(bounds),(20,30));background.alpha_composite(dark,(450,0));background.convert('RGB').save(ROOT/'logo-treatment-review.jpg',quality=95)
    report={'version':1,'generationRun':False,'source':sources['original'],
        'references':{'full':{'path':str(ROOT/'full-original-guide.png'),'kind':'original'},'intimate':{'path':str(ROOT/'intimate-original-crop.png'),'kind':'original-crop','originalPixelCrop':roi,'hiddenGeometry':'unverified; any new camera angle is inferred'}},
        'logo':{'source':str(logo),'sourceSha256':sources['logo']['sha256'],'output':str(ROOT/'brand-seal.png'),'bounds':bounds,'method':'Alpha outside genuine circular logo only. Original inner RGB artwork and lettering retained; no AI/redrawing/recoloring.'}}
    for ref in report['references'].values():ref['sha256']=sha(pathlib.Path(ref['path']).read_bytes());ref['originalPath']=str(original);ref['originalSha256']=sources['original']['sha256']
    report['logo']['sha256']=sha((ROOT/'brand-seal.png').read_bytes())
    assert sha(original.read_bytes())==sources['original']['sha256'] and sha(logo.read_bytes())==sources['logo']['sha256']
    (ROOT/'sources.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print('Prepared real original/crop, circular genuine logo and provenance. NO GENERATED CANDIDATE or ad export.')

if __name__=='__main__':prepare()
