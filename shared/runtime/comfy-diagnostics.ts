/** Optional read-only adapter for ComfyUI's version-dependent console buffer. Never runs workflows. */
export type ComfyDiagnostic={at:number;source:'comfy-server'|'managed-server'|'sdk';message:string};
export function loadingLog(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const line=value.replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ').trim();
 if(!line||/token|authorization|bearer|password|secret|api[_ -]?key|https?:\/\/|prompt\s*[:=]|\bhf_[A-Za-z0-9]{10,}|\bsk-[A-Za-z0-9]{10,}/i.test(line))return null;
 if(!/requested to load|load(?:ed|ing)? (?:completely|partially|model|checkpoint|weights|text encoder|diffusion|vae)|unload|offload|model weight dtype|model_type|clip\/text encoder|downloading|\d+%\|/i.test(line))return null;
 return line.replace(/(?:[A-Za-z]:[\\/]|\/(?:[\w.-]+\/)+)[^\s"']+/g,path=>path.split(/[\\/]/).at(-1)||'[local file]').slice(0,350);
}
export function loopbackDiagnosticsUrl(value:string):string|null{
 try{const url=new URL(value);return url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'?url.origin:null}catch{return null}
}
export class LogCursor{
 private seen=new Set<string>();
 read(value:unknown,baseline=false):string[]{
  const entries=(value as {entries?:unknown[]})?.entries;if(!Array.isArray(entries))throw Error('Unsupported ComfyUI log response');
  const fresh:string[]=[],next=new Set<string>();
  for(const raw of entries.slice(-600)){
   const entry=raw as {t?:unknown;m?:unknown};if(typeof entry?.t!=='string'||typeof entry.m!=='string')continue;
   const key=entry.t+'\0'+entry.m;next.add(key);
   if(!baseline&&!this.seen.has(key))for(const part of entry.m.slice(-4096).split(/[\r\n]+/)){const line=loadingLog(part);if(line)fresh.push(line)}
  }
  this.seen=next;return fresh.slice(-12);
 }
}
export class ComfyDiagnostics{
 private listeners=new Map<string,Set<(entry:ComfyDiagnostic)=>void>>();
 private unavailableUntil=new Map<string,number>();
 private fragments=new Map<string,string>();
 capture(url:string,chunk:string){
  const key=loopbackDiagnosticsUrl(url);if(!key)return;
  const combined=((this.fragments.get(key)||'')+chunk).slice(-16000),parts=combined.split(/[\r\n]+/);this.fragments.set(key,parts.pop()!.slice(-2000));
  for(const part of parts){const message=loadingLog(part);if(message)for(const listener of this.listeners.get(key)||[])listener({at:Date.now(),source:'managed-server',message})}
 }
 async watch(url:string,receive:(entry:ComfyDiagnostic)=>void):Promise<()=>void>{
  const key=loopbackDiagnosticsUrl(url);if(!key)return()=>{};
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;const abort=new AbortController(),cursor=new LogCursor();
  const listeners=this.listeners.get(key)||new Set();listeners.add(receive);this.listeners.set(key,listeners);
  const stop=()=>{stopped=true;clearTimeout(timer);abort.abort();listeners.delete(receive);if(!listeners.size)this.listeners.delete(key)};
  const read=async()=>{
   const response=await fetch(key+'/internal/logs/raw',{redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(1200)])});
   if(!response.ok||!response.body)throw Error('ComfyUI console unavailable');
   const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512*1024)throw Error('ComfyUI console response too large');text+=decoder.decode(value,{stream:true})}text+=decoder.decode();return JSON.parse(text)}finally{await reader.cancel().catch(()=>{})}
  };
  const poll=async()=>{if(stopped)return;try{const value=await read();if(!stopped)for(const message of cursor.read(value))receive({at:Date.now(),source:'comfy-server',message})}catch{this.unavailableUntil.set(key,Date.now()+30000);return}if(!stopped)timer=setTimeout(()=>void poll(),900)};
  if((this.unavailableUntil.get(key)||0)<=Date.now())try{cursor.read(await read(),true);timer=setTimeout(()=>void poll(),900)}catch{this.unavailableUntil.set(key,Date.now()+30000)}
  return stop;
 }
}
export function nodeProgressMessage(node:{class_type?:string;inputs?:Record<string,unknown>}|undefined):string|null{
 if(!node?.class_type)return null;
 const name=node.class_type;
 if(/Loader|Checkpoint/i.test(name)){
  const model=Object.entries(node.inputs||{}).find(([key,value])=>typeof value==='string'&&/(?:unet|ckpt|clip|vae|model)_name$/.test(key))?.[1];
  const file=typeof model==='string'?model.split(/[\\/]/).at(-1)?.slice(0,120):null;
  return `Loading ${/CLIP|Text/i.test(name)?'text encoder':/VAE/i.test(name)?'VAE':'model'}${file?' · '+file:''}`;
 }
 if(/CLIPTextEncode|TextEncode/i.test(name))return 'Encoding your prompt';
 return null;
}
