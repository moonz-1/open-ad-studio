"""Local diagnostic, using existing Pillow/numpy; no training or media uploads.
Usage: python motion-metrics.py private-spec.json | python motion-metrics.py --self-test
Measures NCC patch tracks inside an explicit product ROI, not padded backgrounds.
Not optical-flow ground truth, OCR, a perceptual quality score, or proof of camera motion.
"""
import json, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw


def points(im, roi):
    x, y, w, h = roi
    # Spread textured patches across the product; avoid repeated neighboring features.
    result = []
    for yy in range(y + 9, y + h - 9, 18):
        for xx in range(x + 9, x + w - 9, 18):
            patch = im[yy-5:yy+6, xx-5:xx+6]
            if patch.std() > 9:
                result.append((xx, yy))
    return np.array(result, dtype=float)


def track(a, b, coords, radius=22):
    good, dest, scores = [], [], []
    h, w = a.shape
    for x, y in coords.astype(int):
        if min(x,y) < 6 or x >= w-6 or y >= h-6:
            continue
        template = a[y-5:y+6,x-5:x+6].astype(float)
        template -= template.mean()
        norm = np.linalg.norm(template)
        if norm < 25: continue
        x0,x1=max(5,x-radius),min(w-6,x+radius)
        y0,y1=max(5,y-radius),min(h-6,y+radius)
        windows=np.lib.stride_tricks.sliding_window_view(b[y0-5:y1+6,x0-5:x1+6],(11,11)).astype(float)
        windows-=windows.mean(axis=(-1,-2),keepdims=True)
        corr=(windows*template).sum(axis=(-1,-2))/(np.linalg.norm(windows,axis=(-1,-2))*norm+1e-9)
        iy,ix=np.unravel_index(np.argmax(corr),corr.shape)
        score=float(corr[iy,ix])
        if score < .8 or ix in (0,corr.shape[1]-1) or iy in (0,corr.shape[0]-1):continue
        def sub(l,c,r):
            denom=l-2*c+r
            return float(np.clip(.5*(l-r)/denom,-.5,.5)) if abs(denom)>1e-9 else 0.
        dx=sub(corr[iy,ix-1],score,corr[iy,ix+1]);dy=sub(corr[iy-1,ix],score,corr[iy+1,ix])
        good.append((x,y));dest.append((x0+ix+dx,y0+iy+dy));scores.append(score)
    return np.array(good), np.array(dest), scores


def similarity(p, q):
    if len(p)<6:return {'acceptedTracks':len(p),'status':'insufficient tracks'}
    # qx=a*x-b*y+tx, qy=b*x+a*y+ty. Trim inconsistent tracks iteratively.
    keep=np.ones(len(p),dtype=bool)
    for _ in range(4):
        x,y=p[keep].T;u,v=q[keep].T
        mat=np.empty((len(x)*2,4));mat[0::2]=np.array([x,-y,np.ones(len(x)),np.zeros(len(x))]).T
        mat[1::2]=np.array([y,x,np.zeros(len(x)),np.ones(len(x))]).T
        fit=np.linalg.lstsq(mat,np.column_stack((u,v)).ravel(),rcond=None)[0]
        a,b,tx,ty=fit;pred=p@np.array([[a,b],[-b,a]])+[tx,ty]
        err=np.linalg.norm(pred-q,axis=1)
        next_keep=err<max(.6,float(np.median(err))*2.5)
        if next_keep.sum()<6:break
        keep=next_keep
    return {'acceptedTracks':len(p),'inliers':int(keep.sum()),'medianDisplacementPx':float(np.median(np.linalg.norm(q[keep]-p[keep],axis=1))),
            'scale':float(np.hypot(a,b)),'rotationDegrees':float(np.degrees(np.arctan2(b,a))),
            'translationPx':[float(tx),float(ty)],'medianResidualPx':float(np.median(err[keep])),
            'fitWarning':'non-rigid change / mismatches; not a reliable camera estimate' if np.median(err[keep])>1.5 else None}


def compare(a,b,roi):
    p,q,scores=track(a,b,points(a,roi));result=similarity(p,q)
    result['medianNCC']=float(np.median(scores)) if scores else None
    return result


def self_test():
    rng=np.random.default_rng(42);a=(rng.random((180,240))*255).astype(np.uint8)
    b=np.roll(a,(3,5),(0,1));r=compare(a,b,[30,30,160,110])
    assert abs(r['scale']-1)<.002 and abs(r['translationPx'][0]-5)<.1 and abs(r['translationPx'][1]-3)<.1,r
    r=compare(a,a,[30,30,160,110]);assert r['medianDisplacementPx']<.05,r
    # Known centered zoom, with interpolation and a broad enough crop to retain patches.
    im=Image.fromarray(a).resize((252,189),Image.Resampling.BICUBIC);b=np.array(im)[4:184,6:246]
    r=compare(a,b,[40,40,140,90]);assert abs(r['scale']-1.05)<.01,r
    print('PASS: stationary, (5,3) translation, 1.05x zoom calibration')


if __name__=='__main__':
    if sys.argv[1]=='--self-test':self_test();sys.exit()
    spec=json.loads(pathlib.Path(sys.argv[1]).read_text());report=[]
    for case in spec['videos']:
        path=pathlib.Path(case['path']);w,h=case['width'],case['height'];roi=case['roi']
        raw=subprocess.check_output([spec['ffmpeg'],'-v','error','-i',str(path),'-f','rawvideo','-pix_fmt','gray','-'])
        frames=np.frombuffer(raw,dtype=np.uint8).reshape(-1,h,w)
        x,y,rw,rh=roi;core=frames[:,y:y+rh,x:x+rw].astype(float)
        r={'name':case['name'],'roi':roi,'frames':len(frames),'firstLast':compare(frames[0],frames[-1],roi),
           'firstToSample':{str(i):compare(frames[0],frames[i],roi) for i in [12,24,36,48,60,72]},
           'adjacentCoreMAE':float(np.abs(np.diff(core,axis=0)).mean()),'firstLastCoreMAE':float(np.abs(core[0]-core[-1]).mean())}
        # Include all 73 frames, not only the three-frame delivery contact.
        sheet=Image.new('RGB',(w*9,(h+22)*9),'#171717');draw=ImageDraw.Draw(sheet)
        for i,frame in enumerate(frames):
            xx,yy=i%9*w,i//9*(h+22);sheet.paste(Image.fromarray(frame).convert('RGB'),(xx,yy));draw.text((xx+4,yy+h+2),str(i),fill='white')
        sheet.save(pathlib.Path(spec['output']).parent/(case['name']+'-all-frames.jpg'))
        report.append(r);print(json.dumps(r))
    pathlib.Path(spec['output']).write_text(json.dumps(report,indent=2))
