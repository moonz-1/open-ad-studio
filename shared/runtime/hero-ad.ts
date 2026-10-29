import {Resvg} from '@resvg/resvg-js';
import {spawn} from 'node:child_process';
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {heroDirections,heroCrop,heroAdSVG,validateHeroSettings,type HeroSettings} from '../lib/hero-ad.ts';
export class HeroError extends Error{constructor(public status:number,message:string){super(message);}}
export const heroSha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export async function heroSource(root:string,url:unknown){
 if(typeof url!=='string'||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(url))throw new HeroError(400,'Choose an API-owned PNG source.');const path=join(root,url.slice(9));let bytes:Buffer;
 try{bytes=await readFile(path);}catch{throw new HeroError(404,'The source image is missing. Restore its saved original and retry.');}
 if(bytes.length<33||bytes.length>8*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR')throw new HeroError(400,'Invalid PNG source.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(width<1||height<1||width>2048||height>2048)throw new HeroError(400,'Use a PNG up to 2048 pixels.');
 const data='data:image/png;base64,'+bytes.toString('base64');try{const r=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><image href="${data}" width="16" height="16"/></svg>`);if(!r.getBBox()||!r.render().pixels.some((v,i)=>i%4===3&&v>0))throw Error();}catch{throw new HeroError(422,'The source PNG could not be decoded. Originals are unchanged.');}
 return {path,bytes,width,height,data,sha256:heroSha(bytes)};
}
let busy=false;
export async function finishHero(body:any,root:string,env:Record<string,string|undefined>){
 let s:HeroSettings;try{s=validateHeroSettings(body?.settings);}catch(e){throw new HeroError(400,(e as Error).message);}if(s.method!=='finish')throw new HeroError(400,'Choose photographic finishing. AI generation has a separate endpoint.');
 const source=await heroSource(root,body.image),crop=heroCrop(source.width,source.height,s),d=heroDirections[s.direction];
 if(busy)throw new HeroError(409,'Another hero is developing. Please wait.');busy=true;await mkdir(root,{recursive:true});const name=randomBytes(8).toString('hex')+'.png',path=join(root,name),start=Date.now();
 const filter=`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},scale=1080:1350:flags=lanczos,eq=contrast=${d.contrast}:saturation=${d.saturation}:gamma=${d.gamma},colorbalance=rs=${d.red-1}:bs=${d.blue-1},unsharp=5:5:0.18:5:5:0,setsar=1`;
 try{await new Promise<void>((ok,fail)=>{const p=spawn(env.FFMPEG_PATH||'ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-n','-protocol_whitelist','file,pipe','-i',source.path,'-vf',filter,'-frames:v','1','-threads','1',path],{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';const timer=setTimeout(()=>{p.kill();fail(new HeroError(504,'Photographic finish timed out. Originals are unchanged.'));},45000);p.stderr.on('data',b=>err=(err+b).slice(-2000));p.on('error',()=>{clearTimeout(timer);fail(new HeroError(503,'FFmpeg is unavailable. No hero was generated.'));});p.on('close',code=>{clearTimeout(timer);if(code===0)ok();else{console.error('[hero finish]',err);fail(new HeroError(422,'Source could not be developed. Re-upload a valid PNG.'));}});});
 const bytes=await readFile(path);return {url:'/outputs/'+name,width:1080,height:1350,sha256:heroSha(bytes),sourceSha256:source.sha256,seconds:(Date.now()-start)/1000,method:'FFmpeg photographic finish (no AI)',crop,filter,sourceKind:s.sourceKind};
 }catch(e){await unlink(path).catch(()=>{});throw e;}finally{busy=false;}
}
export async function exportHeroAd(body:any,root:string){
 if(body?.reviewed!==true)throw new HeroError(400,'Compare the hero with the original and confirm product fidelity before export.');
 const hero=await heroSource(root,body.hero),logo=body.logo?await heroSource(root,body.logo):undefined;let svg:string;
 try{svg=heroAdSVG(hero.data,logo?.data,body.copy);}catch(e){throw new HeroError(400,(e as Error).message);}
 const start=Date.now(),bytes=new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:'Georgia'}}).render().asPng(),name=randomBytes(8).toString('hex')+'.png';await mkdir(root,{recursive:true});await writeFile(join(root,name),bytes,{flag:'wx'});
 return {url:'/outputs/'+name,width:1080,height:1350,sha256:heroSha(bytes),sources:{hero:hero.sha256,...(logo?{logo:logo.sha256}:{})},seconds:(Date.now()-start)/1000};
}
