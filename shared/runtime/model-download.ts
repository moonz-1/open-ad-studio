import { createWriteStream,createReadStream } from 'node:fs';
import {createHash} from 'node:crypto';
import { mkdir, stat, link, open, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
export type ModelFile={file:string;size_gb:number;used_by:string;license:string;url:string;gated?:boolean;alternates?:string[];sha256?:string};
export type ModelPack={id:string;capability:'video'|'image'|'audio'|'geometry';tier:'best'|'balanced'|'fast';label:string;minVramGB:number;gated?:boolean;note?:string;/** When true, default installer never auto-selects this pack (owner-authorized evaluation packs). */optIn?:boolean};
export type DownloadUpdate={phase:'downloading';file:string;received:number;total:number|null;index:number;count:number};
export async function validModel(path:string,sha256?:string):Promise<boolean>{
 if(sha256){if(!/^[a-f0-9]{64}$/.test(sha256))return false;try{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')===sha256}catch{return false}}
 try{const fd=await open(path,'r');try{const prefix=Buffer.alloc(8);await fd.read(prefix,0,8,0);const length=Number(prefix.readBigUInt64LE());const size=(await fd.stat()).size;if(length<2||length>16*1024*1024||size<=length+8)return false;const bytes=Buffer.alloc(length);await fd.read(bytes,0,length,8);const header=JSON.parse(bytes.toString('utf8'));const tensors=Object.entries(header).filter(([key])=>key!=='__metadata__').map(([,value])=>value as any),payload=size-length-8;return tensors.length>0&&tensors.every(value=>value&&Array.isArray(value.data_offsets)&&value.data_offsets.length===2&&value.data_offsets.every((n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)&&value.data_offsets[0]<=value.data_offsets[1]&&value.data_offsets[1]<=payload)&&tensors.reduce((max,value)=>Math.max(max,value.data_offsets[1]),0)===payload}finally{await fd.close()}}catch{return false}
}
export async function downloadModels(root:string,models:ModelFile[],options:{signal?:AbortSignal;onProgress?:(update:DownloadUpdate)=>void;fetcher?:typeof fetch;token?:string}={}):Promise<void>{
 for(const[index,model]of models.entries()){
  options.signal?.throwIfAborted();const destination=join(root,model.file);if(await validModel(destination,model.sha256))continue;
  try{await stat(destination);throw new Error(`${model.file} already exists but is incomplete or invalid. Move it aside before retrying; it has not been overwritten.`)}catch(error:any){if(error.code!=='ENOENT')throw error}
  await mkdir(dirname(destination),{recursive:true});const part=destination+'.part';if(await validModel(part,model.sha256)){await link(part,destination);await rm(part);continue}let offset=await stat(part).then(s=>s.size).catch(()=>0);
  const response=await(options.fetcher||fetch)(model.url,{headers:{...(offset?{Range:`bytes=${offset}-`}:{}),...(options.token&&new URL(model.url).hostname==='huggingface.co'?{Authorization:`Bearer ${options.token}`}:{})},signal:options.signal,redirect:'follow'});
  if(response.status===401||response.status===403)throw new Error(`${model.file} is gated (HTTP ${response.status}). Accept the model license on Hugging Face and set HF_TOKEN to a read token.`);
  if(!response.ok||!response.body)throw new Error(`Download failed for ${model.file} (HTTP ${response.status}). Check the model source/license and your connection.`);
  if(response.status===206){const range=response.headers.get('content-range');if(!range?.startsWith(`bytes ${offset}-`))throw new Error('Download server returned an unexpected byte range.')}else offset=0;
  const length=Number(response.headers.get('content-length')),total=Number.isFinite(length)&&length>0?offset+length:null;let received=offset,last=0;
  const report=()=>options.onProgress?.({phase:'downloading',file:model.file,received,total,index:index+1,count:models.length});report();
  const stream=Readable.fromWeb(response.body as any);stream.on('data',(chunk:Buffer)=>{received+=chunk.length;if(Date.now()-last>200){last=Date.now();report()}});
  await pipeline(stream,createWriteStream(part,{flags:offset?'a':'w'}),{signal:options.signal});report();
  if(total!==null&&received!==total)throw new Error(`Incomplete download: ${model.file}. Retry to resume it.`);
  if(!await validModel(part,model.sha256)){await rm(part,{force:true});throw new Error(model.sha256?`Downloaded model failed hash validation: ${model.file}.`:`Downloaded file is not a valid safetensors model: ${model.file}.`)}
  await link(part,destination);await rm(part);
 }
}
