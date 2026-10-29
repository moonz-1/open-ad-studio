// Real processing/media evidence. Requires a prior acceptance.mjs Creative report.
// node --experimental-strip-types adstudio/scripts/fidelity-compare.mjs <report.json>
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadEnv } from 'vite';
const exec = promisify(execFile);
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
const env = {...loadEnv('development',process.cwd(),''),...process.env};
const ffmpeg = env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = env.FFPROBE_PATH || (env.FFMPEG_PATH ? join(dirname(ffmpeg),'ffprobe'+(process.platform==='win32'?'.exe':'')) : 'ffprobe');
const original = JSON.parse(await readFile(process.argv[2],'utf8'));
const folder = resolve(dirname(process.argv[2]),'fidelity-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(folder,{recursive:true});
const sha = b => createHash('sha256').update(b).digest('hex');
const input = await readFile(original.manifest.image);
const sw=input.readUInt32BE(16),sh=input.readUInt32BE(20);
const report={startedAt:new Date().toISOString(),base,sourceSha256:sha(input),sourceWidth:sw,sourceHeight:sh,creativeReport:resolve(process.argv[2]),recipeSha256:sha(await readFile('shared/runtime/product-video.ts')),runs:[],browser:'NOT TESTED by this script'};
const save=()=>writeFile(join(folder,'report.json'),JSON.stringify(report,null,2));
const post=async(name,body)=>{const r=await fetch(base+'/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.ok(r.ok,`${name} ${r.status}: ${JSON.stringify(j)}`);return j;};
const upload=await post('upload',{image:'data:image/png;base64,'+input.toString('base64')});
const raw=async(file,filter,frames=1)=> (await exec(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-i',file,'-vf',filter+',format=rgb24','-frames:v',String(frames),'-f','rawvideo','pipe:1'],{encoding:'buffer',maxBuffer:128*1024*1024,timeout:90000,windowsHide:true})).stdout;
const compare=(a,b)=>{assert.equal(a.length,b.length);let abs=0,sq=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];abs+=Math.abs(d);sq+=d*d;}return {mae:abs/a.length,psnr:sq===0?'infinite':10*Math.log10(255**2/(sq/a.length))};};
const patch=(data,width,rect)=>{const result=Buffer.alloc(rect.width*rect.height*3);for(let y=0;y<rect.height;y++)data.copy(result,y*rect.width*3,((y+rect.y)*width+rect.x)*3,((y+rect.y)*width+rect.x+rect.width)*3);return result;};
const photoBounds=(pixels,width,height)=>{
 const bg=pixels.subarray(0,3);let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3;if(Math.max(...[0,1,2].map(c=>Math.abs(pixels[i+c]-bg[c])))>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 return {left,top,right,bottom,width:right-left+1,height:bottom-top+1,centerX:(left+right)/2};
};
const download=async(url,path,type)=>{const r=await fetch(base+url);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),type);await writeFile(path,Buffer.from(await r.arrayBuffer()));};
for(const creative of original.runs) {
 assert.equal(creative.technical,'PASS');
 for(const [mode,motion] of [['locked','push'],['camera','push'],['camera','pan-left'],['camera','pan-right']]) {
  const name=creative.ratio.replace(':','x')+'-'+mode+(mode==='camera'?'-'+motion:'');
  const run={name,ratio:creative.ratio,mode,motion,technical:'RUNNING',quality:'PENDING visual review'};report.runs.push(run);await save();
  try {
   run.request={image:upload.url,mode,ratio:creative.ratio,duration:original.manifest.duration,motion,...(mode==='locked'?{background:creative.result.url}:{})};
   run.result=await post('product-video',run.request);
   const video=join(folder,name+'.webm');await download(run.result.url,video,'video/webm');
   run.probe=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames','-of','json',video],{windowsHide:true})).stdout);
   const stream=run.probe.streams[0];assert.equal(stream.width,run.result.width);assert.equal(stream.height,run.result.height);assert.equal(Number(stream.nb_read_frames),run.result.frames);assert.equal(stream.r_frame_rate,'24/1');
   const frames=[0,Math.floor((run.result.frames-1)/2),run.result.frames-1];
   const filter='select='+frames.map(n=>`eq(n\\,${n})`).join('+')+',tile=3x1';
   await exec(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-i',video,'-vf',filter,'-frames:v','1',join(folder,name+'-contact.png')],{timeout:90000,windowsHide:true});
   run.export=await post('export',{video:run.result.url});
   const mp4=join(folder,name+'.mp4');await download(run.export.url,mp4,'video/mp4');
   run.exportProbe=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames','-of','json',mp4],{windowsHide:true})).stdout);
   assert.equal(Number(run.exportProbe.streams[0].nb_read_frames),run.result.frames);assert.equal(run.exportProbe.streams[0].codec_name,'h264');
   if(mode==='locked') {
    const r=run.result.protectedRect;
    // Insets avoid color conversion/chroma mixing at the composite boundary.
    const core={x:r.x+4,y:r.y+4,width:r.width-8,height:r.height-8};
    const crop=`crop=${core.width}:${core.height}:${core.x}:${core.y}`;
    const data=await raw(video,crop,run.result.frames),frameBytes=core.width*core.height*3;
    const hashes=[];for(let i=0;i<run.result.frames;i++)hashes.push(sha(data.subarray(i*frameBytes,(i+1)*frameBytes)));
    run.protectedCore=core;run.uniqueDecodedCoreFrames=new Set(hashes).size;
    assert.equal(run.uniqueDecodedCoreFrames,1,'protected region must be identical in every lossless WebM frame');
    const reference=await raw(original.manifest.image,`scale=${r.width}:${r.height}:flags=lanczos,format=rgb24,format=yuv420p,crop=${core.width}:${core.height}:4:4`);
    run.resizedSourceError=compare(data.subarray(0,frameBytes),reference);
    const compressed=await raw(mp4,crop,run.result.frames);const samples=[];
    for(const f of frames)samples.push({frame:f,...compare(compressed.subarray(f*frameBytes,(f+1)*frameBytes),reference)});
    run.mp4ResizedSourceError=samples;
    run.featureRois=[];
    for(const [feature,box] of Object.entries(original.manifest.rois || {})) {
     const roi={x:Math.floor(box.x/sw*r.width)-4,y:Math.floor(box.y/sh*r.height)-4,width:Math.floor(box.width/sw*r.width),height:Math.floor(box.height/sh*r.height)};
     assert.ok(roi.x>=0&&roi.y>=0&&roi.width>0&&roi.height>0&&roi.x+roi.width<=core.width&&roi.y+roi.height<=core.height);
     const expected=patch(reference,core.width,roi),hashes=[];
     for(let f=0;f<run.result.frames;f++)hashes.push(sha(patch(data.subarray(f*frameBytes,(f+1)*frameBytes),core.width,roi)));
     run.featureRois.push({feature,sourceRect:box,coreRect:roi,uniqueDecodedFrames:new Set(hashes).size,sourceError:compare(patch(data.subarray(0,frameBytes),core.width,roi),expected),mp4SourceError:frames.map(f=>({frame:f,...compare(patch(compressed.subarray(f*frameBytes,(f+1)*frameBytes),core.width,roi),expected)}))});
    }
   } else {
    const data=await raw(video,'select='+frames.map(n=>`eq(n\\,${n})`).join('+')+',setpts=N/(24*TB)',3);
    const bytes=run.result.width*run.result.height*3;
    run.samplePhotoBounds=frames.map((f,i)=>({frame:f,...photoBounds(data.subarray(i*bytes,(i+1)*bytes),run.result.width,run.result.height)}));
    const first=run.samplePhotoBounds[0],last=run.samplePhotoBounds.at(-1);
    for(const bounds of run.samplePhotoBounds)assert.ok(bounds.left>0&&bounds.top>0&&bounds.right<run.result.width-1&&bounds.bottom<run.result.height-1,'photo bounds must stay inside output');
    if(motion==='push')assert.ok(last.width>first.width&&last.height>first.height);
    if(motion==='pan-left')assert.ok(last.centerX>first.centerX);
    if(motion==='pan-right')assert.ok(last.centerX<first.centerX);
    // Compare decoded frames, not WebM container bytes (which can include random IDs).
    const repeat=await post('product-video',run.request),path=join(folder,name+'-repeat.webm');await download(repeat.url,path,'video/webm');
    const args=['-v','error','-i',video,'-f','framemd5','pipe:1'];
    const a=(await exec(ffmpeg,args,{windowsHide:true})).stdout;
    args[3]=path;const b=(await exec(ffmpeg,args,{windowsHide:true})).stdout;
    assert.equal(a,b);run.repeatDecodedFramesIdentical=true;run.repeatSeconds=repeat.seconds;
   }
   run.technical='PASS';console.log(name,'PASS',run.result.seconds,'s',run.uniqueDecodedCoreFrames ?? 'repeat deterministic');
  } catch(error){run.technical='FAIL';run.error=String(error);console.error(name,run.error);}
  await save();
 }
}
console.log('Evidence:',folder);if(report.runs.some(r=>r.technical==='FAIL'))process.exitCode=1;
