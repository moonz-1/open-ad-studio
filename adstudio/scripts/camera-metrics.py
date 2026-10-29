"""CPU-only adjacent-frame registration and private gallery; existing numpy/Pillow only.
Not a perceptual score or browser playback test. Run --self-test before measuring.
Usage: python camera-metrics.py outputs/camera-motion-20261022
"""
import hashlib, html, json, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def sample(im, x, y):
    x=np.clip(x,0,im.shape[1]-2);y=np.clip(y,0,im.shape[0]-2)
    ix=x.astype(int);iy=y.astype(int);fx=x-ix;fy=y-iy
    return im[iy,ix]*(1-fx)*(1-fy)+im[iy,ix+1]*fx*(1-fy)+im[iy+1,ix]*(1-fx)*fy+im[iy+1,ix+1]*fx*fy


def register(a,b,roi):
    # Dense least-squares similarity around ROI center; adjacent movement only.
    # Smooth 1px to reduce interpolation bias, exclude the matte/photo boundary.
    a=np.array(Image.fromarray(a).filter(ImageFilter.GaussianBlur(1)),dtype=float)
    b=np.array(Image.fromarray(b).filter(ImageFilter.GaussianBlur(1)),dtype=float)
    x,y,w,h=roi;yy,xx=np.mgrid[y:y+h:2,x:x+w:2];cx=x+w/2;cy=y+h/2
    xx=xx.ravel().astype(float);yy=yy.ravel().astype(float);rx=xx-cx;ry=yy-cy
    target=sample(a,xx,yy);gy,gx=np.gradient(b);p=np.zeros(4)
    for _ in range(12):
        scale,rotation,tx,ty=p
        u=xx+scale*rx-rotation*ry+tx;v=yy+rotation*rx+scale*ry+ty
        vx=sample(gx,u,v);vy=sample(gy,u,v);error=sample(b,u,v)-target
        jac=np.column_stack((vx*rx+vy*ry,-vx*ry+vy*rx,vx,vy))
        delta=np.linalg.lstsq(jac,error,rcond=None)[0];p-=delta
        if np.linalg.norm(delta)<1e-6:break
    return {'scale':float(1+p[0]),'rotationRadians':float(p[1]),'dx':float(p[2]),'dy':float(p[3]),'residualMAE':float(np.abs(error).mean())}


def self_test():
    rng=np.random.default_rng(42);a=np.array(Image.fromarray((rng.random((180,240))*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5)))
    yy,xx=np.mgrid[:180,:240]
    for dx,dy,z in [(0,0,1),(.125,-.3,1),(.47,.18,1),(0,0,1.001)]:
        b=np.clip(sample(a.astype(float),(xx-120-dx)/z+120,(yy-90-dy)/z+90),0,255).round().astype('uint8')
        r=register(a,b,[40,30,160,120]);assert abs(r['dx']-dx)<.025 and abs(r['dy']-dy)<.025 and abs(r['scale']-z)<.0002,(dx,dy,z,r)
    print('PASS stationary, fractional translations .125/-.3/.47/.18px, centered 1.001x scale (tolerance .025px / .0002x)')


def decode(ffmpeg,path,w,h):
    raw=subprocess.check_output([ffmpeg,'-v','error','-i',str(path),'-f','rawvideo','-pix_fmt','gray','-'])
    return np.frombuffer(raw,dtype=np.uint8).reshape(-1,h,w)


def analyze(case,frames):
    tracks=[register(a,b,case['roi']) for a,b in zip(frames[:-1],frames[1:])]
    dx=np.array([r['dx'] for r in tracks]);dy=np.array([r['dy'] for r in tracks]);z=np.array([r['scale'] for r in tracks])
    # Ideal UNQUANTIZED transform at ROI center; baseline linear, candidate smoothstep.
    p=np.arange(len(frames))/(len(frames)-1)
    if case['variant']=='candidate':p=p*p*(3-2*p)
    x,y,w,h=case['roi'];cx=x+w/2;cy=y+h/2;W,H=case['width'],case['height']
    zoom=1+(.04 if case['variant']=='candidate' else .08)*p if case['motion']=='push' else np.full(len(p),1.04 if case['variant']=='candidate' else 1.06)
    pan=0 if case['motion']=='push' else (1 if case['motion']=='pan-right' else -1)*(p-.5)*W*(.024 if case['variant']=='candidate' else .04)
    # Each affine maps original coordinates to that frame. Compare frame centers.
    tx=W/2*(1-zoom)-pan*zoom;ty=H/2*(1-zoom)
    dz=zoom[1:]/zoom[:-1];idealx=(dz-1)*cx+tx[1:]-dz*tx[:-1];idealy=(dz-1)*cy+ty[1:]-dz*ty[:-1]
    error=np.column_stack((dx-idealx,dy-idealy));acc=np.diff(error,axis=0)
    return {'name':case['name'],'adjacent':tracks,'netTranslationAtROICenterPx':[float(dx.sum()),float(dy.sum())],
      'netScale':float(z.prod()),'idealScale':float(zoom[-1]/zoom[0]),
      'motionErrorRmsPx':float(np.sqrt(np.mean(np.sum(error**2,axis=1)))),
      'unexpectedAccelerationRmsPx':float(np.sqrt(np.mean(np.sum(acc**2,axis=1)))),
      'maxAdjacentTranslationPx':float(np.max(np.hypot(dx,dy))),
      'rmsVerticalStepPx':float(np.sqrt(np.mean(dy**2))),
      'adjacentResidualMAE':float(np.mean([r['residualMAE'] for r in tracks])),
      'scaleStepStd':float(z.std()),'presentationIntervalRangeSeconds':[float(np.diff(case['pts']).min()),float(np.diff(case['pts']).max())]}


def main(folder):
    folder=pathlib.Path(folder);records=[];cases=[]
    for variant in ['baseline','candidate']:
        manifest=folder/(variant+'.json')
        if not manifest.exists():continue
        spec=json.loads(manifest.read_text());ffmpeg=spec['ffmpeg']
        for case in spec['videos']:
            frames=decode(ffmpeg,case['mp4'],case['width'],case['height']);r=analyze(case,frames)
            lossless=decode(ffmpeg,case['video'],case['width'],case['height']);r['lossless']=analyze(case,lossless)
            records.append(r);cases.append(case)
            w,h=case['width'],case['height'];sheet=Image.new('RGB',(w*3,h+24),'#171717');draw=ImageDraw.Draw(sheet)
            # Full RGB frames for actual texture/label/color inspection.
            raw=subprocess.check_output([ffmpeg,'-v','error','-i',case['mp4'],'-f','rawvideo','-pix_fmt','rgb24','-'])
            rgb=np.frombuffer(raw,dtype=np.uint8).reshape(-1,h,w,3)
            for k,i in enumerate([0,len(frames)//2,len(frames)-1]):
                sheet.paste(Image.fromarray(rgb[i]),(k*w,24));draw.text((k*w+4,4),f'frame {i}',fill='white')
            sheet.save(folder/(case['name']+'-frames.png'))
            print(json.dumps({k:v for k,v in r.items() if k not in ['adjacent','lossless']}),flush=True)
    if '--assert' in sys.argv:
        for r in records:
            if not r['name'].endswith('-candidate'):continue
            control=next(a for a in records if a['name']==r['name'].replace('-candidate','-baseline'))
            for domain in [None,'lossless']:
                a=r if domain is None else r[domain];b=control if domain is None else control[domain]
                assert a['motionErrorRmsPx']<.12 and a['motionErrorRmsPx']<b['motionErrorRmsPx']*.5,(r['name'],domain,a)
                assert a['unexpectedAccelerationRmsPx']<.2 and a['unexpectedAccelerationRmsPx']<b['unexpectedAccelerationRmsPx']*.5,(r['name'],domain,a)
            assert max(abs(v-1/24) for v in r['presentationIntervalRangeSeconds'])<.000002
            if 'landscape-pan' in r['name']:assert r['netTranslationAtROICenterPx'][0]<-10
            if 'square-pan' in r['name']:assert r['netTranslationAtROICenterPx'][0]>8
            if 'portrait-push' in r['name']:assert abs(r['netScale']-1.04)<.006
        print('PASS six matched photo comparisons: encoded motion bounds and >50% error/acceleration reduction, lossless and MP4; uniform PTS. Not perceptual acceptance.',flush=True)
    (folder/'metrics.json').write_text(json.dumps(records,indent=2))
    blocks=[]
    for id in ['cookies','printed-label']:
        for template in ['portrait-push','landscape-pan','square-pan']:
            row=[]
            for c in cases:
                if c['id']!=id or c['template']!=template:continue
                n=html.escape(c['name']);m=next(r for r in records if r['name']==c['name'])
                row.append(f'<article><h3>{n}</h3><video controls loop muted playsinline preload="metadata" src="{n}.mp4"></video><p>{c["renderSeconds"]:.2f}s CPU render; motion error RMS {m["motionErrorRmsPx"]:.3f}px; unexpected acceleration RMS {m["unexpectedAccelerationRmsPx"]:.3f}px/frame²</p><a href="{n}-frames.png"><img src="{n}-frames.png"></a></article>')
            blocks.append(f'<h2>{id} / {template}</h2><div class="pair">'+''.join(row)+'</div>')
    (folder/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Private Camera motion comparison</title><style>body{background:#141518;color:#eee;font:16px system-ui;margin:30px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{min-width:0}video{max-width:100%;height:400px;background:#16171b}img{width:100%}button{padding:12px}p{max-width:1000px}</style><h1>Camera: preserved baseline vs candidate</h1><p>Private originals; conventional 2D photo animation. All clips 73 frames / 24fps, 3.0417s, no prompt/seed/model. Baseline is exact productPlan from commit 2d38051. Candidate uses smoother sampling, 4% eased push / 2.4% eased pan. Measurements are estimates inside the photo, not quality scores. Full normal-speed playback and human acceptance remain required.</p><button onclick="document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play()})">Play all from start (best-effort sync)</button><button onclick="document.querySelectorAll('video').forEach(v=>v.pause())">Pause all</button><p><a href="cookies.png">Original cookie normalization</a> · <a href="printed-label.png">Original printed-label normalization</a> · <a href="metrics.json">Every-frame metrics</a> · <a href="baseline.json">Baseline provenance</a> · <a href="candidate.json">Candidate provenance</a></p>'''+''.join(blocks),encoding='utf-8')


if __name__=='__main__':
    if sys.argv[1]=='--self-test':self_test()
    else:main(sys.argv[1])
