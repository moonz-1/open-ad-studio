/** Product-identity reference prep notes for generative restage.
 * Scripts still run Pillow for raster work; this module encodes the policy the prep must follow.
 * Goal: avoid elongated SAM3 crops and cocoa mattes that merge with chocolate becoming identity “facts”. */

export type IdentityPrepPolicy={
 /** Max width/height (or height/width) before the crop is square-centred on alpha mass. */
 maxAspect:number;
 /** RGB matte — neutral charcoal, not cocoa brown that blends with chocolate chips. */
 matteRgb:[number,number,number];
 /** Padding around the (possibly square-cropped) subject, in pixels. */
 pad:number;
 note:string;
};

export const DEFAULT_IDENTITY_PREP:IdentityPrepPolicy={
 maxAspect:1.28,
 matteRgb:[32,30,28],
 pad:28,
 note:'Tight alpha crop; if elongated, square-centre on alpha mass; neutral charcoal matte; RGB only. Identity guide — not a paste plate.',
};

/** Python snippet used by live scripts — keeps prep identical across oneshot / Journey proofs. */
export function identityPrepPython(rgbaPath:string,outPath:string,policy:IdentityPrepPolicy=DEFAULT_IDENTITY_PREP){
 const [r,g,b]=policy.matteRgb;
 return `
from PIL import Image
import hashlib
rgba=Image.open(r'''${rgbaPath.replace(/\\/g,'/')}''').convert('RGBA')
a=rgba.split()[-1];bbox=a.getbbox();assert bbox
crop=rgba.crop(bbox);w,h=crop.size
max_aspect=${policy.maxAspect}
# Square-centre elongated cutouts so planform is not baked into a bread-roll silhouette.
if max(w,h)/max(1,min(w,h))>max_aspect:
 side=min(w,h)
 # Alpha centre-of-mass for a stable crop.
 hist=crop.split()[-1]
 px=list(hist.getdata());W,H=hist.size
 mass=sum(px) or 1;cx=cy=0
 for y in range(H):
  row=px[y*W:(y+1)*W];s=sum(row)
  if s:
   cx+=sum(i*v for i,v in enumerate(row))/mass
   cy+=y*(s/mass)
 cx=int(cx);cy=int(cy)
 left=max(0,min(w-side,cx-side//2));top=max(0,min(h-side,cy-side//2))
 crop=crop.crop((left,top,left+side,top+side));w,h=crop.size
pad=${policy.pad};side=max(w,h)+pad*2
canvas=Image.new('RGBA',(side,side),(${r},${g},${b},255))
canvas.paste(crop,((side-w)//2,(side-h)//2),crop)
rgb=canvas.convert('RGB');rgb.save(r'''${outPath.replace(/\\/g,'/')}''')
print(rgb.size[0],rgb.size[1],hashlib.sha256(open(r'''${outPath.replace(/\\/g,'/')}''','rb').read()).hexdigest())
`.trim();
}
