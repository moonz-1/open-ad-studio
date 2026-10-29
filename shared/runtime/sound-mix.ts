/** Campaign sound analysis + FFmpeg mix onto a silent video master. Preserves the silent master. */
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import type {IncomingMessage} from 'node:http';
import type {ReferenceAudioAnalysis,SoundLayerAsset,SoundPlan} from '../lib/sound-director.ts';

export class SoundError extends Error{constructor(public status:number,message:string){super(message);}}
type Env=Record<string,string|undefined>;

function tools(env:Env){const ffmpeg=env.FFMPEG_PATH||'ffmpeg';return {ffmpeg,ffprobe:env.FFPROBE_PATH||(ffmpeg==='ffmpeg'?'ffprobe':join(dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe'))};}
async function run(exe:string,args:string[],timeout=180000):Promise<{stdout:string;stderr:string}>{
 return new Promise((ok,fail)=>{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timed=false;
  const timer=setTimeout(()=>{timed=true;p.kill();},timeout);
  p.stdout.on('data',(b:Buffer)=>stdout=(stdout+b.toString()).slice(-2_000_000));
  p.stderr.on('data',(b:Buffer)=>stderr=(stderr+b.toString()).slice(-120_000));
  p.on('error',()=>{clearTimeout(timer);fail(new SoundError(503,'FFmpeg/FFprobe unavailable. Set FFMPEG_PATH and restart.'));});
  p.on('close',code=>{clearTimeout(timer);if(timed)fail(new SoundError(504,'Audio processing timed out.'));else if(code!==0)fail(new SoundError(422,'Could not process audio. '+stderr.slice(-400)));else ok({stdout,stderr});});
 });
}

const outUrl=/^\/outputs\/[a-f0-9]{16}\.(mp4|webm|mov|flac|wav|m4a|aac|mp3)$/;
const videoUrl=/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/;
const audioUrl=/^\/outputs\/[a-f0-9]{16}\.(flac|wav|m4a|aac|mp3|mp4|webm)$/;

export async function probeMedia(path:string,env:Env){
 const {stdout}=await run(tools(env).ffprobe,['-v','error','-show_streams','-show_format','-of','json',path],20000);
 return JSON.parse(stdout);
}

export async function analyzeMediaAudio(path:string,env:Env):Promise<ReferenceAudioAnalysis>{
 const data=await probeMedia(path,env);
 const audio=data.streams?.find((s:any)=>s.codec_type==='audio');
 const duration=Number(data.format?.duration||audio?.duration||0);
 const warnings:string[]=[];
 if(!audio){
  return {version:1,hasAudio:false,duration:Number.isFinite(duration)?duration:0,rhythmicCues:[],silenceRegions:[],analysisMethod:'ffprobe-streams',warnings:['No audio stream present.'],note:'FFmpeg measurements only — no musical or semantic understanding claimed.'};
 }
 const rhythmicCues:number[]=[];
 const silenceRegions:{start:number;end:number}[]=[];
 let loudnessLufs:number|null=null,peakDb:number|null=null;
 try{
  const {stderr}=await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-i',path,'-af','silencedetect=noise=-35dB:d=0.25','-f','null','-'],90000);
  let silenceStart:number|undefined;
  for(const m of stderr.matchAll(/silence_start:\s*([0-9.]+)/g))silenceStart=Number(m[1]);
  for(const m of stderr.matchAll(/silence_end:\s*([0-9.]+)/g)){
   const end=Number(m[1]);
   if(Number.isFinite(silenceStart)&&Number.isFinite(end))silenceRegions.push({start:silenceStart!,end});
   if(Number.isFinite(end)&&end>0.15)rhythmicCues.push(+end.toFixed(2));
   silenceStart=undefined;
  }
  // Treat silence ends as approximate energy onsets; also add evenly spaced fallbacks if sparse.
 }catch{warnings.push('Silence detection unavailable; rhythmic cues not measured.');}
 try{
  const {stderr}=await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-i',path,'-af','ebur128=peak=true','-f','null','-'],90000);
  // ebur128 prints many momentary "I:" lines that start near −70; the Summary block is authoritative.
  const summary=stderr.split(/Summary:/i).pop()||stderr;
  const i=[...summary.matchAll(/I:\s*([-\d.]+)\s*LUFS/g)].pop();
  const p=[...summary.matchAll(/Peak:\s*([-\d.]+)\s*dBFS/g)].pop()
    ||[...summary.matchAll(/True peak:\s*[\s\S]*?([-\d.]+)\s*dBTP/gi)].pop()
    ||[...stderr.matchAll(/TPK:\s*([-\d.]+)/g)].pop();
  if(i)loudnessLufs=Number(i[1]);
  if(p)peakDb=Number(p[1]);
 }catch{warnings.push('Loudness (ebur128) not measured on this FFmpeg build.');}
 if(rhythmicCues.length<2&&duration>1){
  const n=duration>=6?4:2;
  for(let i=1;i<n;i++)rhythmicCues.push(+((duration*i)/n).toFixed(2));
  warnings.push('Few measured onsets; added evenly spaced timing hints (inferred, not musical analysis).');
 }
 return {
  version:1,hasAudio:true,duration,channels:Number(audio.channels)||undefined,sampleRate:Number(audio.sample_rate)||undefined,
  codec:String(audio.codec_name||''),loudnessLufs,peakDb,rhythmicCues:[...new Set(rhythmicCues)].sort((a,b)=>a-b).slice(0,12),
  silenceRegions:silenceRegions.slice(0,20),analysisMethod:'ffprobe+silencedetect(+ebur128 when available)',warnings,
  note:'FFmpeg measurements only — duration, loudness and silence breaks. No genre, lyric or full musical understanding claimed.'
 };
}

export async function analyzeOutputAudio(url:string,root:string,env:Env){
 if(typeof url!=='string'||!outUrl.test(url))throw new SoundError(400,'Analyze a local /outputs media URL.');
 return analyzeMediaAudio(join(root,url.slice('/outputs/'.length)),env);
}

/** Upload licensed or inspiration audio (wav/flac/mp3/m4a/aac) or extract from a video container. */
export async function importSoundtrack(req:IncomingMessage,root:string,env:Env,rights:'inspiration-only'|'user-owned-or-licensed'){
 const type=String(req.headers['content-type']||'').split(';')[0];
 const ext:Record<string,string>={
  'audio/wav':'wav','audio/x-wav':'wav','audio/flac':'flac','audio/mpeg':'mp3','audio/mp4':'m4a','audio/aac':'aac',
  'audio/x-m4a':'m4a','video/mp4':'mp4','video/webm':'webm'
 };
 if(!ext[type]){req.resume();throw new SoundError(415,'Upload WAV, FLAC, MP3, M4A, AAC, or a short video containing audio.');}
 const limit=40*1024*1024;
 if(Number(req.headers['content-length'])>limit){req.resume();throw new SoundError(413,'Keep soundtrack files under 40 MB.');}
 const data=await new Promise<Buffer>((ok,fail)=>{const chunks:Buffer[]=[];let size=0,failed=false;
  req.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){failed=true;req.removeAllListeners('data');req.resume();fail(new SoundError(413,'Keep soundtrack files under 40 MB.'));}else chunks.push(chunk);});
  req.on('end',()=>{if(!failed)ok(Buffer.concat(chunks));});req.on('error',fail);
 });
 if(!data.length)throw new SoundError(400,'Empty file.');
 await mkdir(root,{recursive:true});
 const id=randomBytes(8).toString('hex');
 const rawName=`snd-${id}.${ext[type]}`,rawPath=join(root,rawName);
 await writeFile(rawPath,data,{flag:'wx'});
 try{
  const analysis=await analyzeMediaAudio(rawPath,env);
  if(!analysis.hasAudio){await unlink(rawPath).catch(()=>{});throw new SoundError(400,'No audio track found in the upload.');}
  // Normalize to wav for predictable mixing.
  const wavName=randomBytes(8).toString('hex')+'.wav',wavPath=join(root,wavName);
  await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',rawPath,'-vn','-ac','2','-ar','48000','-c:a','pcm_s16le',wavPath],90000);
  const sha256=createHash('sha256').update(await readFile(wavPath)).digest('hex');
  return {url:'/outputs/'+wavName,originalUrl:'/outputs/'+rawName,sha256,bytes:data.length,rights,analysis};
 }catch(e){await unlink(rawPath).catch(()=>{});throw e;}
}

/** Extract audio from an already-imported reference original (only when audio rights allow reuse). */
export async function extractReferenceAudio(body:any,root:string,env:Env){
 if(!body||typeof body.url!=='string'||!/^\/outputs\/(ref-[a-f0-9]{16}|snd-[a-f0-9]{16}|[a-f0-9]{16})\.(mp4|webm|mov|wav|flac|m4a|aac|mp3)$/.test(body.url))
  throw new SoundError(400,'Provide a local reference media URL.');
 if(body.audioRights!=='user-owned-or-licensed')throw new SoundError(403,'Extracting reference audio requires separately confirmed audio rights (not video-only rights).');
 const src=join(root,body.url.slice('/outputs/'.length));
 const analysis=await analyzeMediaAudio(src,env);
 if(!analysis.hasAudio)throw new SoundError(400,'Reference has no audio track to extract.');
 const name=randomBytes(8).toString('hex')+'.wav',dest=join(root,name);
 await run(tools(env).ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',src,'-vn','-ac','2','-ar','48000','-c:a','pcm_s16le',dest],90000);
 return {url:'/outputs/'+name,analysis,rights:'user-owned-or-licensed' as const,note:'Extracted for authorized reuse only. Video footage rights alone are insufficient.'};
}

/**
 * Mix planned layers onto a silent (or video-only) master. Never modifies the silent master file.
 * Returns a new AAC MP4. Empty layers → copies video with no audio (silent download still valid).
 */
export async function mixCampaignSound(body:{
 silentMaster:string;
 duration?:number;
 layers:SoundLayerAsset[];
 plan?:SoundPlan;
},root:string,env:Env){
 if(typeof body.silentMaster!=='string'||!videoUrl.test(body.silentMaster))throw new SoundError(400,'silentMaster must be a local /outputs mp4|webm.');
 const master=join(root,body.silentMaster.slice('/outputs/'.length));
 try{await readFile(master);}catch{throw new SoundError(404,'Silent video master is missing; previous assets were kept.');}
 const probe=await probeMedia(master,env);
 const duration=Math.max(0.5,Number(body.duration||probe.format?.duration||probe.streams?.find((s:any)=>s.codec_type==='video')?.duration||4));
 const layers=(body.layers||[]).filter(l=>l&&l.kind!=='silence'&&typeof l.url==='string'&&audioUrl.test(l.url));
 const name=randomBytes(8).toString('hex')+'.mp4',dest=join(root,name);
 const {ffmpeg}=tools(env);
 if(!layers.length){
  // Explicit mute / silence: remux video without audio.
  await run(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',master,'-map','0:v:0','-an','-c:v','copy','-movflags','+faststart',dest],90000);
  return {url:'/outputs/'+name,silentMaster:body.silentMaster,seconds:duration,layers:0,note:'Silent master preserved; output has no audio by design.',hasAudio:false};
 }
 const args=['-nostdin','-hide_banner','-loglevel','error','-y','-i',master];
 const paths:string[]=[];
 for(const layer of layers){
  const p=join(root,layer.url.slice('/outputs/'.length));
  try{await readFile(p);}catch{throw new SoundError(404,'A soundtrack layer is missing.');}
  paths.push(p);args.push('-i',p);
 }
 const filters:string[]=[];
 const mixedLabels:string[]=[];
 layers.forEach((layer,i)=>{
  const input=i+1;
  const delayMs=Math.max(0,Math.round(layer.at*1000));
  const vol=Math.pow(10,(layer.gainDb||0)/20);
  const fadeIn=Math.max(0.01,layer.fadeIn||0.05);
  const fadeOut=Math.max(0.05,layer.fadeOut||0.2);
  const dur=Math.max(0.2,Math.min(duration,layer.duration||duration));
  const fadeOutStart=Math.max(0,dur-fadeOut);
  // adelay + trim + fade + volume; pad to full timeline
  filters.push(`[${input}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},volume=${vol.toFixed(4)},adelay=${delayMs}|${delayMs},apad=whole_dur=${duration}[a${i}]`);
  mixedLabels.push(`[a${i}]`);
 });
 // Mix layers to a temporary stereo bed, measure, then apply conservative gain + true-peak limit.
 // Empty layers never reach here (mute path above). Near-silence is not boosted into noise.
 const mixCore=mixedLabels.length===1
  ?`${mixedLabels[0]}anull[amixed]`
  :`${mixedLabels.join('')}amix=inputs=${mixedLabels.length}:duration=first:dropout_transition=0:normalize=0[amixed]`;
 filters.push(mixCore);
 const preName=randomBytes(8).toString('hex')+'.wav',prePath=join(root,preName);
 const preArgs=[...args,'-filter_complex',filters.join(';'),'-map','[amixed]','-t',String(duration),'-ac','2','-ar','48000','-c:a','pcm_s16le',prePath];
 try{await run(ffmpeg,preArgs,180000);}catch(e){await unlink(prePath).catch(()=>{});throw e;}
 let preI:number|null=null,preTp:number|null=null;
 try{
  const {stderr}=await run(ffmpeg,['-nostdin','-hide_banner','-i',prePath,'-af','ebur128=peak=true','-f','null','-'],90000);
  const summary=stderr.split(/Summary:/i).pop()||stderr;
  const i=[...summary.matchAll(/I:\s*([-\d.]+)\s*LUFS/g)].pop();
  const tp=[...summary.matchAll(/Peak:\s*([-\d.]+)\s*dBFS/g)].pop()
    ||[...summary.matchAll(/True peak:\s*[\s\S]*?([-\d.]+)\s*dBTP/gi)].pop();
  if(i)preI=Number(i[1]);
  if(tp)preTp=Number(tp[1]);
 }catch{/* measurement best-effort */}
 const targetI=-16;
 // Skip boost only for true noise-floor beds (no usable peak). Quiet real beds still get gain toward target.
 const nearSilent=preI==null||(preI<-60&&(preTp==null||preTp<-50));
 const gainDb=nearSilent?0:Math.max(-12,Math.min(28,targetI-(preI as number)));
 let loudnessNote=` Pre-mix I=${preI??'n/a'} LUFS, TP=${preTp??'n/a'}.`;
 if(nearSilent)loudnessNote+=' Near-silent bed left unboosted (silence is never normalized into noise).';
 else loudnessNote+=` Applied ${gainDb.toFixed(1)} dB toward I=${targetI} LUFS, then true-peak limit.`;
 const vol=Math.pow(10,gainDb/20);
 try{
  await run(ffmpeg,[
   '-nostdin','-hide_banner','-loglevel','error','-y',
   '-i',master,'-i',prePath,
   '-filter_complex',`[1:a]volume=${vol.toFixed(6)},alimiter=limit=0.89:level=false[aout]`,
   '-map','0:v:0','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2',
   '-t',String(duration),'-movflags','+faststart',dest
  ],180000);
 }catch(e){await unlink(dest).catch(()=>{});await unlink(prePath).catch(()=>{});throw e;}
 await unlink(prePath).catch(()=>{});
 let measured:{integratedLufs?:number|null;truePeakDb?:number|null;preIntegratedLufs?:number|null;gainDb?:number}={preIntegratedLufs:preI,gainDb};
 try{
  const info=await analyzeMediaAudio(dest,env);
  measured={...measured,integratedLufs:info.loudnessLufs,truePeakDb:info.peakDb};
  loudnessNote+=` Delivered I=${info.loudnessLufs??'n/a'} LUFS, peak=${info.peakDb??'n/a'} dBFS.`;
 }catch{/* measurement optional */}
 return {
  url:'/outputs/'+name,
  silentMaster:body.silentMaster,
  seconds:duration,
  layers:layers.length,
  hasAudio:true,
  loudness:{targetIntegratedLufs:targetI,targetTruePeakDbTp:-1.5,...measured},
  note:'Mixed with FFmpeg AAC stereo. Silent master unchanged. Conservative loudness + true-peak limiting; silence is never normalized into noise.'+loudnessNote
 };
}
