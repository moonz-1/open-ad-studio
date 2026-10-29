/** Local reference-video import + FFmpeg analysis. Inspiration metadata only — never reuse footage in ads. */
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import type {IncomingMessage} from 'node:http';
import type {CreativeHook} from '../lib/creative-intelligence.ts';
import type {ReferenceAnalysis,ReferenceRights,ReferenceShot,Confidence} from '../lib/reference-video.ts';
import {analyzeMediaAudio} from './sound-mix.ts';

export class ReferenceError extends Error{constructor(public status:number,message:string){super(message);}}
type Env=Record<string,string|undefined>;

function tools(env:Env){const ffmpeg=env.FFMPEG_PATH||'ffmpeg';return {ffmpeg,ffprobe:env.FFPROBE_PATH||(ffmpeg==='ffmpeg'?'ffprobe':join(dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe'))};}
async function run(exe:string,args:string[],timeout=120000):Promise<{stdout:string;stderr:string}>{
 return new Promise((ok,fail)=>{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timed=false;
  const timer=setTimeout(()=>{timed=true;p.kill();},timeout);
  p.stdout.on('data',(b:Buffer)=>stdout=(stdout+b.toString()).slice(-2_000_000));
  p.stderr.on('data',(b:Buffer)=>stderr=(stderr+b.toString()).slice(-80_000));
  p.on('error',()=>{clearTimeout(timer);fail(new ReferenceError(503,'FFmpeg/FFprobe unavailable. Set FFMPEG_PATH and restart.'));});
  p.on('close',code=>{clearTimeout(timer);if(timed)fail(new ReferenceError(504,'Reference analysis timed out.'));else if(code!==0)fail(new ReferenceError(422,'Could not decode the reference video. Try MP4/WebM under 60s.'));else ok({stdout,stderr});});
 });
}

async function probe(path:string,env:Env){
 const {stdout}=await run(tools(env).ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',path],20000);
 const data=JSON.parse(stdout);
 const video=data.streams?.find((s:any)=>s.codec_type==='video'&&s.disposition?.attached_pic!==1);
 if(!video)throw new ReferenceError(400,'The file has no video track.');
 const duration=Number(data.format?.duration||video.duration);
 const fpsRaw=String(video.avg_frame_rate||video.r_frame_rate||'24/1');
 const [a,b]=fpsRaw.split('/').map(Number);const fps=b?a/b:Number(fpsRaw)||24;
 if(!Number.isFinite(duration)||duration<=0||duration>60)throw new ReferenceError(400,'Use a reference video between 0.5 and 60 seconds.');
 if(!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width*video.height>3840*2160)throw new ReferenceError(400,'Reference resolution exceeds the local limit.');
 return {duration,width:video.width as number,height:video.height as number,fps:Math.min(60,Math.max(1,Math.round(fps*100)/100))};
}

function inferMechanism(shotCount:number,sceneCuts:number,avgDur:number):{hook:CreativeHook;confidence:Confidence;principles:string[]}{
 if(shotCount>=3&&avgDur<2.2)return {hook:'rhythmic-comparison',confidence:'observed',principles:['Stable matched framing','Repeated interaction or beat','Variation across similar shots','Timed brand payoff']};
 if(sceneCuts>=1&&shotCount>=2)return {hook:'dramatic-reveal',confidence:'observed',principles:['Anticipation beat','Obscuring or decisive transition','Compelling product reveal','Brand payoff']};
 if(shotCount===1)return {hook:'sensory-reveal',confidence:'inferred',principles:['Single hero presence','Texture or material emphasis','Calm ending']};
 return {hook:'lifestyle-moment',confidence:'inferred',principles:['Believable context','Product as the clear subject','Brand ending']};
}

function purposeFor(i:number,n:number,hook:CreativeHook):ReferenceShot['purpose']{
 if(hook==='dramatic-reveal')return i===0?'anticipation':i===n-1?'payoff':'reveal';
 if(hook==='rhythmic-comparison')return i===n-1?'payoff':'comparison';
 if(i===0&&n>1)return 'anticipation';
 return i===n-1?'payoff':'interaction';
}

/** Import MP4/WebM/MOV as inspiration reference (stored separately; not for ad export footage). */
export async function importReferenceVideo(req:IncomingMessage,root:string,env:Env){
 const type=String(req.headers['content-type']||'').split(';')[0];
 const ext:Record<string,string>={'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
 if(!ext[type]){req.resume();throw new ReferenceError(415,'Upload MP4, WebM, or MOV as inspiration.');}
 const limit=40*1024*1024;
 if(Number(req.headers['content-length'])>limit){req.resume();throw new ReferenceError(413,'Keep reference videos under 40 MB.');}
 const data=await new Promise<Buffer>((ok,fail)=>{const chunks:Buffer[]=[];let size=0,failed=false;
  req.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){failed=true;req.removeAllListeners('data');req.resume();fail(new ReferenceError(413,'Keep reference videos under 40 MB.'));}else chunks.push(chunk);});
  req.on('end',()=>{if(!failed)ok(Buffer.concat(chunks));});req.on('error',fail);req.on('aborted',()=>fail(new ReferenceError(400,'Upload interrupted.')));
 });
 if(!data.length)throw new ReferenceError(400,'Empty file.');
 await mkdir(root,{recursive:true});
 const id=randomBytes(8).toString('hex');
 const rawName=`ref-${id}.${ext[type]}`,rawPath=join(root,rawName);
 let workPath=rawPath,normalizedUrl=`/outputs/${rawName}`;
 try{
  await writeFile(rawPath,data,{flag:'wx'});
  if(ext[type]==='mov'){
   const mp4Name=`ref-${id}.mp4`,mp4Path=join(root,mp4Name);
   await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',rawPath,'-c:v','libx264','-pix_fmt','yuv420p','-an','-movflags','+faststart',mp4Path],90000);
   workPath=mp4Path;normalizedUrl=`/outputs/${mp4Name}`;
  }
  const info=await probe(workPath,env);
  const sha256=createHash('sha256').update(await readFile(workPath)).digest('hex');
  return {url:normalizedUrl,originalUrl:`/outputs/${rawName}`,sha256,bytes:data.length,...info,rights:'inspiration-only' as ReferenceRights,productReplacementAvailable:false};
 }catch(e){await unlink(rawPath).catch(()=>{});throw e;}
}

export async function analyzeReferenceVideo(body:any,root:string,env:Env):Promise<ReferenceAnalysis>{
 if(!body||typeof body.url!=='string'||!/^\/outputs\/(ref-[a-f0-9]{16}|[a-f0-9]{16})\.(mp4|webm|mov)$/.test(body.url))
  throw new ReferenceError(400,'Analyze a locally imported reference video URL.');
 const path=join(root,body.url.slice('/outputs/'.length));
 const rights:ReferenceRights=body.rights==='user-owned-or-licensed'?'user-owned-or-licensed':'inspiration-only';
 const info=await probe(path,env);
 const work=join(tmpdir(),'osh-ref-'+randomBytes(6).toString('hex'));
 await mkdir(work,{recursive:true});
 const warnings:string[]=[];
 try{
  let sceneTimes:number[]=[0];
  try{
   const {stderr}=await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-i',path,'-filter:v',"select='gt(scene,0.28)',showinfo",'-f','null','-'],90000);
   for(const m of stderr.matchAll(/pts_time:([0-9.]+)/g)){const t=Number(m[1]);if(Number.isFinite(t)&&t>0.15&&t<info.duration-0.15)sceneTimes.push(t);}
  }catch{warnings.push('Scene-change detection fell back to equal time splits.');}
  sceneTimes=[...new Set(sceneTimes.map(t=>+t.toFixed(2)))].sort((a,b)=>a-b);
  if(sceneTimes.length<2){
   const n=info.duration>=6?3:info.duration>=3?2:1;
   sceneTimes=Array.from({length:n},(_,i)=>+(i*info.duration/n).toFixed(2));
   warnings.push('No strong scene cuts measured; shot boundaries are equal-time splits (inferred).');
  }
  const ends=[...sceneTimes.slice(1),info.duration];
  const segments=sceneTimes.map((start,i)=>({start,end:ends[i],duration:Math.max(0.4,ends[i]-start)})).filter(s=>s.duration>=0.4).slice(0,6);
  const keyTimes=new Set<number>();
  for(const s of segments){keyTimes.add(+s.start.toFixed(2));keyTimes.add(+((s.start+s.end)/2).toFixed(2));keyTimes.add(+Math.max(s.start,s.end-0.05).toFixed(2));}
  keyTimes.add(0);keyTimes.add(+(info.duration/2).toFixed(2));keyTimes.add(+Math.max(0,info.duration-0.05).toFixed(2));
  const times=[...keyTimes].sort((a,b)=>a-b).slice(0,18);
  const frames:{t:number;url:string}[]=[];
  for(const t of times){
   const name=`kf-${randomBytes(4).toString('hex')}.jpg`,out=join(root,name);
   try{
    await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-ss',String(t),'-i',path,'-frames:v','1','-q:v','4',out],30000);
    frames.push({t,url:`/outputs/${name}`});
   }catch{/* skip failed frame */}
  }
  let cameraMotion='subtle-or-static';let camConf:Confidence='inferred';
  try{
   if(frames.length>=2){
    const {stderr}=await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-i',path,'-vf','fps=6,scale=160:-2,format=gray,tblend=all_mode=difference,blackframe=98:32','-f','null','-'],60000);
    const blacks=(stderr.match(/blackframe/g)||[]).length;
    cameraMotion=blacks>info.duration*4?'mostly-static':blacks>info.duration*2?'subtle-move':'active-camera-or-subject';
    camConf='observed';
   }
  }catch{warnings.push('Camera-motion heuristic unavailable; marked inferred.');}

  const avg=segments.reduce((a,s)=>a+s.duration,0)/segments.length;
  const {hook,confidence,principles}=inferMechanism(segments.length,Math.max(0,segments.length-1),avg);
  const shots:ReferenceShot[]=segments.map((s,i)=>{
   const kfs=frames.filter(f=>f.t>=s.start-0.05&&f.t<=s.end+0.05).map(f=>f.url).slice(0,3);
   return {
    index:i,start:s.start,end:s.end,duration:+s.duration.toFixed(2),
    purpose:purposeFor(i,segments.length,hook),
    composition:i===0?'opening-frame':'matched-or-progressing',
    camera:{motion:cameraMotion,confidence:camConf},
    interaction:hook==='rhythmic-comparison'?'repeated-hand-or-object-beat (inferred from pacing)':'product-or-scene-focus (inferred)',
    keyframeUrls:kfs
   };
  });
  const sum=shots.reduce((a,s)=>a+s.duration,0)||1;
  const analysis:ReferenceAnalysis={
   version:1,id:randomBytes(8).toString('hex'),created:Date.now(),
   sourceUrl:body.url,originalUrl:body.originalUrl||body.url,bytes:Number(body.bytes)||0,
   duration:info.duration,width:info.width,height:info.height,fps:info.fps,rights,
   creativeMechanism:hook,mechanismConfidence:confidence,shots,
   transitions:segments.slice(1).map(s=>({at:s.start,kind:'cut-or-wipe',confidence:(sceneTimes.length>1?'measured':'inferred') as Confidence})),
   pacing:{avgShotSec:+avg.toFixed(2),relative:shots.map(s=>({index:s.index,share:+(s.duration/sum).toFixed(3)})),note:'Relative durations measured from scene boundaries or equal splits.'},
   visualStyle:{lighting:'not visually classified (no vision model)',graphics:'end treatment not OCR’d',ending:shots.at(-1)?.purpose==='payoff'?'likely brand/product payoff':'open',confidence:'inferred'},
   transferablePrinciples:principles,
   analysisMethod:'ffmpeg-ffprobe scene-change + keyframe extract + difference blackframe heuristic; no generative vision model',
   warnings:[...warnings,'Inspiration-only: do not copy frames, logos or distinctive footage into exported ads.','Direct product replacement in reference video is unavailable on this install.']
  };
  try{
   analysis.audio=await analyzeMediaAudio(path,env);
   if(analysis.audio.hasAudio)analysis.warnings.push('Reference audio detected. Video rights ≠ soundtrack rights; confirm audio rights separately before reuse.');
  }catch{analysis.warnings.push('Reference audio analysis skipped.');}
  await writeFile(join(root,`ref-analysis-${analysis.id}.json`),JSON.stringify(analysis,null,2));
  return analysis;
 }finally{await rm(work,{recursive:true,force:true}).catch(()=>{});}
}

/** Optional Pexels search — queries only; never customer photos. Graceful empty if no key. */
export async function searchInspiration(body:any,env:Env){
 const q=String(body?.query||'').trim().slice(0,120);
 if(!q)throw new ReferenceError(400,'Provide a research query derived from category/feeling/technique — not a private photo.');
 const key=env.PEXELS_API_KEY||'';
 if(!key)return {configured:false,provider:'pexels',query:q,results:[],note:'Set PEXELS_API_KEY on the server to enable licensed stock inspiration search. App works without it via upload or original planning.'};
 const kind=body?.media==='video'?'videos':'photos';
 const url=`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=8`;
 const videoUrl=`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=6`;
 const r=await fetch(kind==='videos'?videoUrl:url,{headers:{Authorization:key},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new ReferenceError(502,'Inspiration provider request failed.');
 const data=await r.json() as any;
 const results=(kind==='videos'?data.videos:data.photos||[]).slice(0,8).map((item:any)=>({
  id:String(item.id),
  url:item.url||item.image||'',
  preview:kind==='videos'?(item.image||item.video_pictures?.[0]?.picture||''):(item.src?.medium||item.src?.large||''),
  creator:item.user?.name||item.photographer||'Unknown',
  license:'Pexels License — review before commercial use; inspiration metadata only by default',
  width:item.width,height:item.height,
  note:'Internal inspiration only. Do not paste into ads without separate rights review.'
 }));
 return {configured:true,provider:'pexels',query:q,media:kind,results};
}

export function researchQueries(intel:{category:string;intendedFeeling:string;creativeHook:string;photographicApproach:string;marketingGoal:string}){
 return [
  `${intel.category} advertising ${intel.creativeHook.replace(/-/g,' ')} cinematography`,
  `${intel.intendedFeeling} product commercial lighting composition`,
  `${intel.photographicApproach} brand film still`
 ].map(s=>s.replace(/\s+/g,' ').trim().slice(0,100));
}

const clipUrl=/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/;
const pngUrl=/^\/outputs\/[a-f0-9]{16}\.png$/;

/**
 * Assemble original shot clips into one vertical commercial.
 * Transitions are deterministic FFmpeg edits (not AI motion). Optional end-card PNG.
 */
export async function assembleCommercial(body:any,root:string,env:Env){
 if(!body||!Array.isArray(body.shots)||body.shots.length<1||body.shots.length>6)throw new ReferenceError(400,'Provide 1–6 generated shot clips.');
 const transition=body.transition==='wipe'||body.transition==='dissolve'||body.transition==='cut'?body.transition:'dissolve';
 const width=body.width===1080?1080:720,height=Math.round(width*16/9),fps=24;
 const paths:string[]=[],stillDurations:(number|undefined)[]=[],reveals:boolean[]=[],motions:(string|undefined)[]=[],overlays:(string|undefined)[]=[];
 for(const s of body.shots){
  if(!s||typeof s!=='object')throw new ReferenceError(400,'Invalid shot record.');
  const still=s?.kind==='still';
  if(s.motion!==undefined&&(!still||!['push-in','pull-out'].includes(s.motion)))throw new ReferenceError(400,'Unsupported photographic motion.');
  if(s.overlay!==undefined&&(!still||typeof s.overlay!=='string'||!pngUrl.test(s.overlay)))throw new ReferenceError(400,'Lettering must be a local PNG.');
  if(s.overlay)try{await readFile(join(root,s.overlay.slice(9)));}catch{throw new ReferenceError(404,'Lettering PNG missing.');}
  motions.push(s.motion);overlays.push(s.overlay?join(root,s.overlay.slice(9)):undefined);
  if(s?.effect!==undefined&&(!still||s.effect!=='fade-in'))throw new ReferenceError(400,'Only a controlled fade-in effect is supported on still beats.');
  if(still&&(!Number.isFinite(s.duration)||s.duration<1.5||s.duration>3))throw new ReferenceError(400,'Still beat duration must be 1.5-3 seconds.');
  if(typeof s?.source!=='string'||!(still?pngUrl:clipUrl).test(s.source))throw new ReferenceError(400,'Each shot needs a local /outputs/*.webm|mp4 clip.');
  const p=join(root,s.source.slice('/outputs/'.length));
  try{await readFile(p);}catch{throw new ReferenceError(404,'A shot clip is missing; regenerate before assembling.');}
  paths.push(p);stillDurations.push(still?s.duration:undefined);reveals.push(s.effect==='fade-in');
 }
 let closing:string|undefined;
 if(body.closing){
  if(typeof body.closing!=='string'||!pngUrl.test(body.closing))throw new ReferenceError(400,'End card must be a local PNG output.');
  closing=join(root,body.closing.slice('/outputs/'.length));
  try{await readFile(closing);}catch{throw new ReferenceError(404,'End card PNG missing.');}
 }
 const cta=typeof body.ctaSeconds==='number'&&Number.isFinite(body.ctaSeconds)?Math.min(3,Math.max(0,body.ctaSeconds)):closing?1.4:0;
 const name=randomBytes(8).toString('hex')+'.mp4',destination=join(root,name);
 const fade=transition==='cut'?0:0.35;
 const wipeBlack=transition==='wipe'?0.35:0;
 const started=Date.now();
 try{
  const args=['-nostdin','-hide_banner','-loglevel','error','-y'];
  paths.forEach((p,i)=>{if(stillDurations[i])args.push('-loop','1','-framerate',String(fps),'-t',String(stillDurations[i]));args.push('-protocol_whitelist','file,pipe','-i',p);});
  let idx=paths.length;
  const blackIdx=wipeBlack?idx++:-1;
  if(wipeBlack)args.push('-f','lavfi','-i',`color=c=0x050505:s=${width}x${height}:d=${wipeBlack}:r=${fps}`);
  const closeIdx=closing&&cta?idx++:-1;
  if(closing&&cta)args.push('-loop','1','-framerate',String(fps),'-t',String(cta),'-i',closing);
  const overlayIndices=overlays.map(p=>{if(!p)return -1;const index=idx++;args.push('-loop','1','-framerate',String(fps),'-i',p);return index;});
  const filters:string[]=[];
  // Cover/crop to the campaign ratio — never letterbox with black bars or stretch.
  const norm=`scale=${width}:${height}:force_original_aspect_ratio=increase:force_divisible_by=2:flags=lanczos,crop=${width}:${height},setsar=1,fps=${fps},format=yuv420p,settb=AVTB`;
  paths.forEach((_,i)=>{
   const frames=Math.round((stillDurations[i]||3)*fps),t=`min(on/${frames-1},1)`,ease=`(${t}*${t}*(3-2*${t}))`;
   const zoom=motions[i]==='push-in'?`1+0.12*${ease}`:`1.12-0.12*${ease}`;
   const move=motions[i]?`scale=${width*3}:${height*3}:flags=lanczos,format=gbrp,zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${width*2}x${height*2}:fps=${fps},scale=${width}:${height}:flags=lanczos,setsar=1,format=yuv420p,settb=AVTB`:norm;
   const label=overlayIndices[i]>=0?`photo${i}`:`v${i}`;
   filters.push(`[${i}:v]${move}${reveals[i]?',fade=t=in:st=0:d=0.5':''}[${label}]`);
   if(overlayIndices[i]>=0){
    filters.push(`[${overlayIndices[i]}:v]scale=${width}:${height},format=rgba,settb=AVTB[type${i}]`);
    filters.push(`[${label}][type${i}]overlay=shortest=1:format=auto,format=yuv420p[v${i}]`);
   }
  });
  if(blackIdx>=0)filters.push(`[${blackIdx}:v]${norm}[vblack]`);
  if(closeIdx>=0)filters.push(`[${closeIdx}:v]${norm}${motions.some(Boolean)?'':',fade=t=in:st=0:d=0.25'}[vend]`);
  // Build concat list: v0 (+ black) + v1 (+ black) ...
  const labels:string[]=[];
  paths.forEach((_,i)=>{labels.push(`v${i}`);if(wipeBlack&&i<paths.length-1)labels.push('vblack');});
  if(closeIdx>=0)labels.push('vend');
  if(labels.length===1){
   filters.push(`[${labels[0]}]format=yuv420p[outv]`);
  }else if(fade<=0||transition==='wipe'){
   filters.push(`${labels.map(l=>`[${l}]`).join('')}concat=n=${labels.length}:v=1:a=0[outv]`);
  }else{
   // dissolve xfade across clips only (no black)
   let cur='v0',elapsed=0;
   // probe durations via ffprobe for offsets
   const durs:number[]=[];
   for(const [i,p] of paths.entries()){
    if(stillDurations[i])durs.push(stillDurations[i]!);else{const info=await probe(p,env);durs.push(Math.max(0.5,info.duration));}
   }
   elapsed=durs[0];
   for(let i=1;i<paths.length;i++){
    const next=`xf${i}`;
    const offset=Math.max(0,elapsed-fade);
    filters.push(`[${cur}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${next}]`);
    cur=next;elapsed+=durs[i]-fade;
   }
   if(closeIdx>=0){
    const next='xfend';
    filters.push(`[${cur}][vend]xfade=transition=fade:duration=${fade}:offset=${Math.max(0,elapsed-fade).toFixed(3)}[${next}]`);
    cur=next;
   }
   filters.push(`[${cur}]format=yuv420p[outv]`);
  }
  args.push('-filter_complex',filters.join(';'),'-map','[outv]','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',destination);
  await run(tools(env).ffmpeg,args,180000);
  return {url:'/outputs/'+name,width,height,fps,seconds:(Date.now()-started)/1000,transition,shots:paths.length,note:transition==='wipe'||transition==='dissolve'||transition==='cut'?`FFmpeg ${transition} edit — not generative AI motion.`:'Assembled'};
 }catch(e){await unlink(destination).catch(()=>{});throw e;}
}
