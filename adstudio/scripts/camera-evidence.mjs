// Local CPU evidence only. Never uploads photos, installs packages or calls a model.
// node --experimental-strip-types adstudio/scripts/camera-evidence.mjs --run-local <original-folder> [baseline|candidate]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadEnv} from 'vite';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]!=='--run-local'){console.log('DRY RUN: explicitly supply --run-local and a private original-photo folder. CPU only.');process.exit();}
const folder=resolve(process.argv[3]),variant=process.argv[4]||'baseline';
if(!['baseline','candidate'].includes(variant))throw Error('Choose baseline or candidate');
const out=resolve('outputs/camera-motion-20261022');await mkdir(out,{recursive:true});
const env={...loadEnv('development',process.cwd(),''),...process.env},ffmpeg=env.FFMPEG_PATH||'ffmpeg',ffprobe=join(dirname(ffmpeg),'ffprobe.exe');
const baseline=(await exec('git',['show','2d38051:shared/runtime/product-video.ts'])).stdout;
const baselineFile=join(out,'baseline-product-video.ts');await writeFile(baselineFile,baseline);
const implementation=variant==='baseline'?baseline:await readFile('shared/runtime/product-video.ts','utf8');
const {productPlan}=await import(variant==='baseline'?pathToFileURL(baselineFile).href:'../../shared/runtime/product-video.ts');
const recipes=[['portrait-push','9:16','push'],['landscape-pan','16:9','pan-right'],['square-pan','1:1','pan-left']];
const inputs=[['cookies','Cookie4_og.jpeg'],['printed-label','cookie_og.jpeg']];
const records=[];
for(const [id,name]of inputs){
 const source=join(folder,name),sourceHash=sha(await readFile(source)),input=join(out,id+'.png');
 // Explicit local surrogate for browser Canvas normalization, NOT browser acceptance.
 // FFmpeg auto-orients JPEG; fit the original within 1536px, no aspect-ratio padding/cropping.
 if(variant==='baseline')await exec(ffmpeg,['-v','error','-n','-i',source,'-vf',"scale=w='min(1536,iw)':h='min(1536,ih)':force_original_aspect_ratio=decrease,setsar=1",'-frames:v','1',input],{windowsHide:true});
 const bytes=await readFile(input),sw=bytes.readUInt32BE(16),sh=bytes.readUInt32BE(20);
 for(const [template,ratio,motion]of recipes){
  const plan=productPlan('camera',ratio,3,motion,sw,sh),name=`${id}-${template}-${variant}`;
  const video=join(out,name+'.webm'),mp4=join(out,name+'.mp4');
  const args=['-nostdin','-hide_banner','-loglevel','error','-n','-i',input,'-filter_complex',plan.filter,'-map','[out]','-frames:v',String(plan.frames),'-an','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv420p','-deadline','realtime','-cpu-used','6',video];
  const start=performance.now();await exec(ffmpeg,args,{windowsHide:true,timeout:90000,maxBuffer:1000000});const renderSeconds=(performance.now()-start)/1000;
  const exportArgs=['-v','error','-n','-i',video,'-map','0:a?','-c:a','aac','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',mp4];
  const exportStart=performance.now();await exec(ffmpeg,exportArgs,{windowsHide:true,timeout:90000});const exportSeconds=(performance.now()-exportStart)/1000;
  const probe=JSON.parse((await exec(ffprobe,['-v','error','-select_streams','v','-show_frames','-show_streams','-show_format','-of','json',mp4],{maxBuffer:2000000,windowsHide:true})).stdout);
  const r=plan.rect,roi=[r.x+Math.ceil(r.width*.2),r.y+Math.ceil(r.height*.2),Math.floor(r.width*.6),Math.floor(r.height*.6)];
  const record={name,id,template,variant,baselineCommit:'2d38051',baselineSourceSha256:sha(baseline),implementationSha256:sha(implementation),source,sourceSha256:sourceHash,input,inputSha256:sha(bytes),sourceWidth:sw,sourceHeight:sh,normalization:'FFmpeg auto-orient, max1536 fit; browser Canvas bytes not claimed identical',ratio,motion,duration:3,frames:plan.frames,fps:24,prompt:null,seed:null,model:null,plan,args,exportArgs,renderSeconds,exportSeconds,video,mp4,videoSha256:sha(await readFile(video)),mp4Sha256:sha(await readFile(mp4)),width:plan.width,height:plan.height,roi,pts:probe.frames.map(f=>Number(f.best_effort_timestamp_time)),stream:probe.streams[0],container:probe.format};
  records.push(record);await writeFile(join(out,variant+'.json'),JSON.stringify({ffmpeg,version:(await exec(ffmpeg,['-version'])).stdout.split('\n')[0],videos:records},null,2));
  console.log(JSON.stringify({name,renderSeconds,exportSeconds,frames:probe.frames.length,roi}));
 }
 if(sha(await readFile(source))!==sourceHash)throw Error('Original source changed');
}
console.log('Private evidence:',out);
