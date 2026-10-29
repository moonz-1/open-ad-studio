// Local, non-destructive media composition. No ComfyUI/model dependency.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,unlink,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import type {IncomingMessage} from 'node:http';

export class ComposeError extends Error {constructor(public status:number,message:string){super(message);}}
export type MediaInfo={url:string;kind:'video'|'audio';duration:number;width:number;height:number;audio:boolean;bytes:number};
export type ComposeShot={source:string;start:number;end:number};
type Env=Record<string,string|undefined>;
const videoPattern=/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/;
const audioPattern=/^\/outputs\/[a-f0-9]{16}\.(mp3|wav|m4a|flac|ogg)$/;
const pngPattern=/^\/outputs\/[a-f0-9]{16}\.png$/;
export const mediaTypes:Record<string,string>={mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',flac:'audio/flac',ogg:'audio/ogg'};
function number(value:unknown,min:number,max:number,name:string){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new ComposeError(400,`Invalid ${name}`);return value;}
async function run(exe:string,args:string[],timeout=240000):Promise<string>{
 return new Promise((ok,fail)=>{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timed=false;
 const timer=setTimeout(()=>{timed=true;p.kill();},timeout);
 p.stdout.on('data',(b:Buffer)=>stdout=(stdout+b.toString()).slice(-1000000));p.stderr.on('data',(b:Buffer)=>stderr=(stderr+b.toString()).slice(-12000));
 p.on('error',()=>{clearTimeout(timer);fail(new ComposeError(503,'Local FFmpeg/FFprobe unavailable. Check the runtime configuration.'));});
 p.on('close',code=>{clearTimeout(timer);if(timed)fail(new ComposeError(504,'Local render timed out. Originals are unchanged.'));else if(code!==0){console.error('[ad-compose]',stderr);fail(new ComposeError(422,'Media could not be decoded or composed. Check the source files; originals are unchanged.'));}else ok(stdout);});
 });
}
function tools(env:Env){const ffmpeg=env.FFMPEG_PATH||'ffmpeg';return {ffmpeg,ffprobe:env.FFPROBE_PATH||(ffmpeg==='ffmpeg'?'ffprobe':join(dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe'))};}
async function pathFor(root:string,url:unknown,pattern:RegExp){if(typeof url!=='string'||!pattern.test(url))throw new ComposeError(400,'Choose a local API-owned media file.');const path=join(root,url.slice('/outputs/'.length));try{await stat(path);}catch{throw new ComposeError(404,'A source file is missing. Re-import it; the saved composition is kept.');}return path;}
export async function probeMedia(path:string,env:Env){
 const data=JSON.parse(await run(tools(env).ffprobe,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,mp3,wav,flac,ogg','-show_streams','-show_format','-of','json',path],15000));
 const video=data.streams.find((s:any)=>s.codec_type==='video'&&s.disposition?.attached_pic!==1),audio=data.streams.some((s:any)=>s.codec_type==='audio');
 const duration=Number(data.format.duration||video?.duration);
 if(!Number.isFinite(duration)||duration<=0||duration>600||(!video&&!audio))throw new ComposeError(400,'Use a video or audio file between 0 and 600 seconds.');
 if(video&&(!Number.isInteger(video.width)||!Number.isInteger(video.height)||video.width*video.height>4096*4096))throw new ComposeError(400,'Video dimensions exceed the local import limit.');
 return {duration,width:video?.width||0,height:video?.height||0,audio,kind:video?'video' as const:'audio' as const};
}
export async function importMedia(req:IncomingMessage,root:string,env:Env):Promise<MediaInfo>{
 const type=String(req.headers['content-type']||'').split(';')[0],ext:Record<string,string>={'video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/flac':'flac','audio/ogg':'ogg'};
 if(!ext[type]){req.resume();throw new ComposeError(415,'Import MP4/WebM video or MP3/WAV/M4A/FLAC/Ogg audio.');}
 const limit=100*1024*1024;
 if(Number(req.headers['content-length'])>limit){req.resume();throw new ComposeError(413,'Choose a media file under 100 MB.');}
 const data=await new Promise<Buffer>((ok,fail)=>{const chunks:Buffer[]=[];let size=0,failed=false;
  req.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>limit){failed=true;req.removeAllListeners('data');req.resume();fail(new ComposeError(413,'Choose a media file under 100 MB.'));}else chunks.push(chunk);});
  req.on('end',()=>{if(!failed)ok(Buffer.concat(chunks));});req.on('error',fail);req.on('aborted',()=>fail(new ComposeError(400,'Import interrupted; retry the original file.')));
 });
 const size=data.length;if(!size)throw new ComposeError(400,'The selected file is empty.');
 await mkdir(root,{recursive:true});const name=randomBytes(8).toString('hex')+'.'+ext[type],path=join(root,name);
 try{await writeFile(path,data,{flag:'wx'});const info=await probeMedia(path,env);if(type.startsWith('video/')&&info.kind!=='video')throw new ComposeError(400,'The selected video contains no video track.');if(type.startsWith('audio/')&&info.kind!=='audio')throw new ComposeError(400,'Choose an audio-only music file.');return {url:'/outputs/'+name,...info,bytes:size};}
 catch(error){await unlink(path).catch(()=>{});throw error;}
}
let active=false;
export async function composeAd(body:any,root:string,env:Env){
 if(!body||!Array.isArray(body.shots)||!body.shots.length||body.shots.length>12)throw new ComposeError(400,'Add between 1 and 12 shots.');
 if(!['cut','dissolve'].includes(body.transition))throw new ComposeError(400,'Choose cuts or dissolve.');
 const width=body.width===720?720:body.width===1080?1080:0;if(!width)throw new ComposeError(400,'Choose 720 or 1080 pixel vertical export.');
 const height=width*16/9,fps=24,ctaSeconds=number(body.ctaSeconds,0,8,'ending duration');
 if(typeof body.keepAudio!=='boolean')throw new ComposeError(400,'Choose whether to keep shot audio.');
 const overlay=body.overlay?await pathFor(root,body.overlay,pngPattern):undefined;
 const closing=ctaSeconds?await pathFor(root,body.closing,pngPattern):undefined;
 const shots=await Promise.all(body.shots.map(async(s:any)=>{
  const path=await pathFor(root,s?.source,videoPattern),info=await probeMedia(path,env);
  const start=number(s.start,0,600,'trim start'),end=number(s.end,0,600,'trim end');
  if(info.kind!=='video'||end<=start||end>info.duration+.05||end-start<.5)throw new ComposeError(400,'Each shot needs at least 0.5 seconds inside its source duration.');
  return {path,source:s.source,start,end,duration:Math.round((end-start)*fps)/fps,audio:info.audio};
 }));
 const music=body.music?await pathFor(root,body.music.source,audioPattern):undefined;
 const volume=body.music?number(body.music.volume,0,1,'music volume'):0;
 if(music&&(await probeMedia(music,env)).kind!=='audio')throw new ComposeError(400,'Choose an audio-only music file.');
 const durations=shots.map(s=>s.duration);if(closing)durations.push(Math.round(ctaSeconds*fps)/fps);
 if(durations.some(d=>d<.5))throw new ComposeError(400,'Ending card needs at least 0.5 seconds.');
 const fade=body.transition==='dissolve'?.3:0,total=Math.ceil((durations.reduce((a,b)=>a+b,0)-fade*(durations.length-1))*fps)/fps;
 if(total>90||total<=0)throw new ComposeError(400,'Keep the advertisement under 90 seconds.');
 if(active)throw new ComposeError(409,'An ad is already rendering. Wait for it to finish, then retry.');active=true;
 const name=randomBytes(8).toString('hex')+'.mp4',destination=join(root,name),started=Date.now();
 try{
  const args=['-nostdin','-hide_banner','-loglevel','error','-n','-filter_complex_threads','1'];
  for(const s of shots)args.push('-protocol_whitelist','file,pipe','-i',s.path);
  let index=shots.length,closingIndex=-1,overlayIndex=-1,musicIndex=-1;
  if(closing){closingIndex=index++;args.push('-loop','1','-framerate',String(fps),'-i',closing);}
  if(overlay){overlayIndex=index++;args.push('-i',overlay);}
  if(music){musicIndex=index++;args.push('-stream_loop','-1','-protocol_whitelist','file,pipe','-i',music);}
  const filters:string[]=[];
  const normalize=`scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x141519,setsar=1,fps=${fps},format=yuv420p,settb=AVTB`;
  shots.forEach((s,i)=>filters.push(`[${i}:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,${normalize},tpad=stop_mode=clone:stop_duration=0.1,trim=duration=${s.duration}[v${i}]`));
  if(closing)filters.push(`[${closingIndex}:v]${normalize},trim=duration=${durations.at(-1)},setpts=PTS-STARTPTS[v${shots.length}]`);
  // Branding overlay applies to footage; the ending card has its own design.
  let footage='v0';
  if(shots.length>1){
   if(!fade){filters.push(`${shots.map((_,i)=>`[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0[footage]`);footage='footage';}
   else {let elapsed=durations[0];for(let i=1;i<shots.length;i++){const next='f'+i;filters.push(`[${footage}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(elapsed-fade).toFixed(6)}[${next}]`);footage=next;elapsed+=durations[i]-fade;}}
  }
  if(overlay){filters.push(`[${overlayIndex}:v]scale=${width}:${height},format=rgba[branding]`);filters.push(`[${footage}][branding]overlay=0:0:format=auto[branded]`);footage='branded';}
  let video=footage;
  if(closing){const footageDuration=durations.slice(0,shots.length).reduce((a,b)=>a+b,0)-fade*(shots.length-1);filters.push(`[${footage}][v${shots.length}]${fade?`xfade=transition=fade:duration=${fade}:offset=${(footageDuration-fade).toFixed(6)}`:'concat=n=2:v=1:a=0'}[finalv]`);video='finalv';}
  const sound=body.keepAudio&&shots.some(s=>s.audio),hasAudio=sound||Boolean(music);let audio='';
  if(sound){
   durations.forEach((duration,i)=>{const s=shots[i];filters.push(s?.audio?`[${i}:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration}[a${i}]`:`anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[a${i}]`);});
   audio='a0';if(!fade&&durations.length>1){filters.push(`${durations.map((_,i)=>`[a${i}]`).join('')}concat=n=${durations.length}:v=0:a=1[shotAudio]`);audio='shotAudio';}
   else if(fade)for(let i=1;i<durations.length;i++){filters.push(`[${audio}][a${i}]acrossfade=d=${fade}:c1=tri:c2=tri[ax${i}]`);audio='ax'+i;}
  }
  if(music){filters.push(`[${musicIndex}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${total},asetpts=PTS-STARTPTS,volume=${volume},afade=t=out:st=${Math.max(0,total-.5)}:d=0.5[music]`);if(audio){filters.push(`[${audio}][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[mixed]`);audio='mixed';}else audio='music';}
  args.push('-filter_complex',filters.join(';'),'-map',`[${video}]`);
  if(hasAudio)args.push('-map',`[${audio}]`,'-c:a','aac','-b:a','192k');else args.push('-an');
  args.push('-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-r',String(fps),'-t',String(total),'-movflags','+faststart',destination);
  await run(tools(env).ffmpeg,args);
  return {url:'/outputs/'+name,width,height,fps,duration:total,seconds:(Date.now()-started)/1000,audio:hasAudio};
 }catch(error){await unlink(destination).catch(()=>{});throw error;}finally{active=false;}
}
