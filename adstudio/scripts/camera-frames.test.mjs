// Actual FFmpeg frame regression: generated local fiducial, no private assets/models.
// NODE_OPTIONS=--experimental-strip-types node adstudio/scripts/camera-frames.test.mjs
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadEnv} from 'vite';
import {productPlan} from '../../shared/runtime/product-video.ts';
const exec=promisify(execFile),env={...loadEnv('development',process.cwd(),''),...process.env};
const ffmpeg=env.FFMPEG_PATH||'ffmpeg',folder=await mkdtemp(join(tmpdir(),'adstudio-camera-'));
try {
  const w=160,h=200,pixels=Buffer.alloc(w*h*3);
  for(let y=70;y<130;y++)for(let x=50;x<110;x++)pixels.fill(255,(y*w+x)*3,(y*w+x+1)*3);
  const input=join(folder,'fiducial.ppm');await writeFile(input,Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`),pixels]));
  for(const [ratio,motion]of [['9:16','push'],['16:9','pan-right'],['1:1','pan-left']]) {
    const plan=productPlan('camera',ratio,3,motion,w,h),area=plan.width*plan.height;
    const args=['-v','error','-i',input,'-filter_complex',plan.filter,'-map','[out]','-frames:v',String(plan.frames),'-pix_fmt','gray','-f','rawvideo','-'];
    const render=async()=> (await exec(ffmpeg,args,{encoding:'buffer',maxBuffer:area*plan.frames+65536,windowsHide:true,timeout:90000})).stdout;
    const raw=await render();assert.equal(raw.length,area*plan.frames);assert.deepEqual(await render(),raw,'decoded motion must be deterministic');
    const centers=[];
    for(let f=0;f<plan.frames;f++) {
      let sum=0,sx=0,sy=0;
      for(let i=0;i<area;i++){const v=Math.max(0,raw[f*area+i]-50);sum+=v;sx+=(i%plan.width)*v;sy+=Math.floor(i/plan.width)*v;}
      assert.ok(sum>10000,'fiducial must remain visible');centers.push([sx/sum,sy/sum]);
    }
    let maxAcceleration=0,maxStep=0;
    const steps=centers.slice(1).map((p,i)=>p.map((v,j)=>v-centers[i][j]));
    for(let i=0;i<steps.length;i++){
      maxStep=Math.max(maxStep,Math.hypot(...steps[i]));
      if(i)maxAcceleration=Math.max(maxAcceleration,Math.hypot(...steps[i].map((v,j)=>v-steps[i-1][j])));
    }
    assert.ok(maxAcceleration<.25,`encoded frame jitter: ${ratio} ${maxAcceleration}`);
    assert.ok(maxStep<.5,`excessive frame step: ${ratio} ${maxStep}`);
    if(motion!=='push'){
      const net=centers.at(-1)[0]-centers[0][0];assert.ok(motion==='pan-right'?net<-10:net>8,'camera direction');
      assert.ok(Math.hypot(...steps[0])<.15&&Math.hypot(...steps.at(-1))<.15,'gentle endpoints');
      assert.ok(centers.every(p=>Math.abs(p[1]-centers[0][1])<.1),'no vertical pan shake');
    }
    console.log(JSON.stringify({ratio,motion,frames:plan.frames,maxStep,maxAcceleration}));
  }
  console.log('PASS actual-frame determinism, jitter bounds, pacing, pan direction and vertical stability for all three templates.');
} finally {await rm(folder,{recursive:true,force:true});}
