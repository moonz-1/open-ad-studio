"""Offline measurements of real exports. Uses the existing Pillow test environment.
Does not edit source photographs, logos or exported PNGs. Not OCR/brand verification.
"""
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import json,math,hashlib
root=Path('outputs/static-ads-demo')
evidence=json.loads((root/'verification.json').read_text(encoding='utf-8'))
def comparison(output,source,box):
    x,y,w,h=box;scale=min(w/source.width,h/source.height)
    width,height=source.width*scale,source.height*scale
    left,top=x+(w-width)/2,y+(h-height)/2
    roi=(math.floor(left),math.floor(top),math.ceil(left+width),math.ceil(top+height))
    actual=output.crop(roi).convert('RGB');reference=source.convert('RGB').resize(actual.size,Image.Resampling.LANCZOS)
    if min(actual.size)>10:
        crop=(2,2,actual.width-2,actual.height-2);actual=actual.crop(crop);reference=reference.crop(crop)
    stats=ImageStat.Stat(ImageChops.difference(actual,reference))
    a=list(actual.convert('L').resize((96,128),Image.Resampling.LANCZOS).tobytes());b=list(reference.convert('L').resize((96,128),Image.Resampling.LANCZOS).tobytes())
    av,bv=sum(a)/len(a),sum(b)/len(b)
    den=math.sqrt(sum((v-av)**2 for v in a)*sum((v-bv)**2 for v in b))
    correlation=sum((x-av)*(y-bv) for x,y in zip(a,b))/den if den else None
    return {'roi':roi,'mean_absolute_rgb_0_255':sum(stats.mean)/3,'rms_rgb_0_255':math.sqrt(sum(x*x for x in stats.rms)/3),'normalized_gray_correlation':correlation}
photo=Image.open(root/'photo-normalized.png');logo=Image.open(root/'logo.png');results=[]
for item in evidence['results']:
    image=Image.open(root/item['filename']);b=item['photoBox'];inset={'spotlight':16,'editorial':12,'poster':0}[item['design']['concept']]
    photobox=(b['x']+inset,b['y']+inset,b['width']-2*inset,b['height']-2*inset)
    logobox={'spotlight':(860,36,156,148),'editorial':(64,48,184,176),'poster':(64,48,200,190)}[item['design']['concept']]
    results.append({'file':item['filename'],'size':image.size,'photo':comparison(image,photo,photobox),'logo':comparison(image,logo,logobox),'text_boxes_within_canvas':all(t['x']>=0 and t['y']>=0 and t['x']+t['width']<=image.width and t['y']+t['height']<=image.height for t in item['textBounds'])})
report={'measurements':results,'limitations':'Correlation/MAE compare expected contained resampling of supplied files. They do not prove independent business accuracy, OCR legibility, browser appearance or user approval. Text boxes are layout estimates; actual exports inspected separately. No strict pixel-perfect fidelity claim.','original_source_hashes':evidence['originalHashes']}
(root/'fidelity-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
