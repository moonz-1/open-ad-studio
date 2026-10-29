// Real Qwen adapter orchestration. Dependency injection is for CPU tests, never
// selected by HTTP input. Production supplies the SDK transport, no fake mode.
import {readFile,writeFile,mkdir,stat,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {heroSource,heroSha,HeroError} from './hero-ad.ts';
import {validateHeroSettings} from '../lib/hero-ad.ts';
import {reviewedPromptFor,generationPrompt,type GenerationDraft} from '../lib/product-brief.ts';
const workflows=join(dirname(fileURLToPath(import.meta.url)),'../workflows');
type Graph=Record<string,{class_type:string;inputs:Record<string,any>}>;
type Weight={file:string;bytes:number;sha256:string};
export async function qwenContract(){return JSON.parse(await readFile(join(workflows,'hero_qwen2511_contract.json'),'utf8')) as {id:string;graphSha256:string;files:Weight[];upstream:unknown};}
export function verifiedWorkflowText(bytes:Buffer,expected:string){const text=bytes.toString('utf8').replace(/\r\n/g,'\n');if(heroSha(text)!==expected)throw new HeroError(503,'Pinned Qwen workflow changed. No inference started.');return text;}
export async function qwenWorkflow(){const bytes=await readFile(join(workflows,'hero_qwen2511_benchmark.json')),pins=await qwenContract();return JSON.parse(verifiedWorkflowText(bytes,pins.graphSha256)) as Graph;}
export function inspectQwenNodes(graph:Graph,nodes:any){
 const missingNodes:string[]=[],missingModels:string[]=[],invalid:string[]=[];
 for(const [id,n]of Object.entries(graph)){const spec=nodes[n.class_type];if(!spec){missingNodes.push(n.class_type);continue;}
  for(const key of Object.keys(spec.input?.required||{}))if(!(key in n.inputs))invalid.push(id+'.'+key+': required');
  for(const [key,value]of Object.entries(n.inputs)){const def=spec.input?.required?.[key]||spec.input?.optional?.[key];if(!def){invalid.push(id+'.'+key+': unsupported');continue;}if(Array.isArray(value))continue;
   const choices=Array.isArray(def[0])?def[0]:def[1]?.options;if(choices&&!choices.includes(value)){if(['unet_name','clip_name','vae_name'].includes(key))missingModels.push(String(value));else if(key!=='image')invalid.push(id+'.'+key+': unsupported');}}
 }
 return {ready:!missingNodes.length&&!missingModels.length&&!invalid.length,missingNodes:[...new Set(missingNodes)],missingModels,invalid};
}
export async function qwenAvailability(nodes:any,modelsDir?:string){
 const contract=await qwenContract(),check=inspectQwenNodes(await qwenWorkflow(),nodes||{}),missingFiles:string[]=[];
 for(const f of contract.files)try{if(!modelsDir||(await stat(join(modelsDir,f.file))).size!==f.bytes)missingFiles.push(f.file);}catch{missingFiles.push(f.file);}
 const available=check.ready&&!missingFiles.length;
 return {id:'qwen-fp8',name:'Qwen-Image-Edit-2511 FP8',available,...check,missingFiles,weightsVerified:false,
  reason:available?'Installed names/nodes and local file sizes match. SHA256 verification runs before the first job. Product fidelity remains unproven.':'Qwen unavailable: connect compatible ComfyUI, install the three pinned FP8 files yourself, and configure its readable models folder. No download or fallback.',requiredFiles:contract.files.map(f=>({file:f.file,bytes:f.bytes,sha256:f.sha256}))};
}
const verified=new Map<string,{fingerprint:string;sha256:string}>();
export async function verifyWeightFiles(folder:string,files:Weight[]){
 const results=[];for(const f of files){const path=join(folder,f.file);let info;try{info=await stat(path);}catch{throw new HeroError(503,'Missing pinned weight: '+f.file);}const fingerprint=[info.size,info.mtimeMs,info.ctimeMs,info.ino].join(':');
  if(info.size!==f.bytes)throw new HeroError(503,'Pinned weight size mismatch: '+f.file);let digest=verified.get(path)?.fingerprint===fingerprint?verified.get(path)!.sha256:'';
  if(!digest){const hash=(await import('node:crypto')).createHash('sha256');for await(const b of createReadStream(path))hash.update(b);digest=hash.digest('hex');const after=await stat(path);if([after.size,after.mtimeMs,after.ctimeMs,after.ino].join(':')!==fingerprint)throw new HeroError(409,'Weight changed during verification.');}
  if(digest!==f.sha256)throw new HeroError(503,'Pinned weight SHA256 mismatch: '+f.file);verified.set(path,{fingerprint,sha256:digest});results.push({...f});}return results;
}
function crc32(bytes:Buffer){let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function inspectQwenPNG(bytes:Buffer,expected:Graph,referenceNode='4'){
 if(bytes.length<60||bytes.length>32*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new HeroError(422,'ComfyUI returned an invalid raw PNG.');
 let offset=8,width=0,height=0,channels=0,ended=false,prompt:any;const idat:Buffer[]=[];
 while(offset+12<=bytes.length){const size=bytes.readUInt32BE(offset),end=offset+12+size;if(end>bytes.length)throw new HeroError(422,'Truncated Comfy PNG.');const type=bytes.subarray(offset+4,offset+8).toString(),data=bytes.subarray(offset+8,end-4);if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw new HeroError(422,'Corrupt Comfy PNG checksum.');
  if(type==='IHDR'){if(offset!==8||size!==13)throw new HeroError(422,'Invalid Comfy PNG header.');width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=({0:1,2:3,4:2,6:4} as Record<number,number>)[data[9]];if(!width||!height||width>4096||height>4096||data[8]!==8||!channels||data[10]||data[11]||data[12])throw new HeroError(422,'Unsupported Comfy PNG encoding or size.');}
  if(type==='IDAT')idat.push(data);if(type==='tEXt'&&data.subarray(0,7).toString()==='prompt\0')try{prompt=JSON.parse(data.subarray(7).toString());}catch{throw new HeroError(422,'Invalid executed-prompt metadata.');}
  if(type==='IEND'){if(size||end!==bytes.length)throw new HeroError(422,'Invalid PNG ending.');ended=true;break;}offset=end;
 }
 if(!ended||!idat.length||!width||!prompt)throw new HeroError(422,'Missing PNG pixels or Comfy executed-workflow metadata. Enable SaveImage metadata.');
 const stride=width*channels+1;let pixels:Buffer;try{pixels=inflateSync(Buffer.concat(idat),{maxOutputLength:stride*height+1});}catch{throw new HeroError(422,'Comfy PNG pixels could not be decoded.');}if(pixels.length!==stride*height)throw new HeroError(422,'Incomplete Comfy PNG pixels.');for(let y=0;y<height;y++)if(pixels[y*stride]>4)throw new HeroError(422,'Invalid PNG pixel filter.');
 for(const [id,n]of Object.entries(expected)){const actual=prompt[id];if(actual?.class_type!==n.class_type)throw new HeroError(422,'Raw output workflow does not match the submitted Qwen job.');for(const [k,v]of Object.entries(n.inputs))if(!(id===referenceNode&&k==='image')&&JSON.stringify(actual.inputs?.[k])!==JSON.stringify(v))throw new HeroError(422,'Raw output prompt/settings mismatch.');}
 return {width,height,executedGraph:prompt};
}
type Progress=(phase:'preparing'|'queued'|'generating'|'encoding'|'running',message:string,more?:{percent?:number|null;step?:number|null;steps?:number|null})=>void;
export type QwenTransport={check:()=>Promise<any>;weights:()=>Promise<Weight[]>;execute:(graph:Graph,reference:string,output:string,progress:Progress)=>Promise<{jobId:string}>;progress:Progress};
export async function validateQwenRequest(body:any,root:string){
 if(!body||Object.keys(body).some(k=>!['image','settings','original','projectId','_requestId'].includes(k)))throw new HeroError(400,'Unsupported Qwen request fields.');
 if(body.projectId!==undefined&&(typeof body.projectId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(body.projectId)))throw new HeroError(400,'Invalid project identity.');
 let s;try{s=validateHeroSettings(body?.settings);}catch(e){throw new HeroError(400,(e as Error).message);}const d=s.briefDraft as GenerationDraft;
 if(s.method!=='reimagine'||s.imageModel!=='qwen-fp8'||s.sourceKind!=='original'||!d)throw new HeroError(400,'Select Qwen and an original photograph with a reviewed brief.');
 try{if(reviewedPromptFor(d,{sourceId:s.sourceId,sourceKind:s.sourceKind,adapter:'qwen-fp8',seed:s.seed})!==s.prompt||generationPrompt(d)!==s.prompt)throw Error('Prompt differs from the reviewed text.');if(d.input.brand?.id!==(s.brandId||undefined)||d.input.productName!==s.productName||d.input.productId!==s.productId)throw Error('Brand/product selection differs from the reviewed brief.');}catch(e){throw new HeroError(409,(e as Error).message);}
 const source=await heroSource(root,body.image);if(source.sha256!==d.input.source.sha256)throw new HeroError(409,'Reference bytes changed after review. Re-upload and review the source.');
 const match=typeof body.original==='string'&&body.original.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw new HeroError(400,'Send the saved original photograph for hash verification.');const original=Buffer.from(match[2],'base64');
 if(original.length>10*1024*1024||original.length<16||heroSha(original)!==d.input.source.originalSha256)throw new HeroError(409,'Original photograph bytes do not match the reviewed source.');
 const originalType=original.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':original.subarray(0,3).toString('hex')==='ffd8ff'?'jpeg':original.subarray(0,4).toString()==='RIFF'&&original.subarray(8,12).toString()==='WEBP'?'webp':null;if(originalType!==match[1])throw new HeroError(400,'Original photo format does not match its media type.');
 return {s,d,source,original,originalType};
}
export async function generateQwenHero(body:any,root:string,transport:QwenTransport){
 const {s,d,source,original,originalType}=await validateQwenRequest(body,root);
 const ready=await transport.check();if(!ready.available)throw new HeroError(503,ready.reason||'Qwen is unavailable. No fallback or download.');
 transport.progress('preparing','Verifying pinned Qwen weights before inference.');const weights=await transport.weights(),contract=await qwenContract();if(weights.length!==contract.files.length||contract.files.some(f=>!weights.some(w=>w.file===f.file&&w.bytes===f.bytes&&w.sha256===f.sha256)))throw new HeroError(503,'Pinned model verification is incomplete.');
 const id=randomBytes(8).toString('hex'),folder=join(root,'hero-qwen',id),raw=join(folder,'comfy-output.png'),target=join(root,id+'.png'),graph=await qwenWorkflow();graph['6'].inputs.prompt=s.prompt;graph['13'].inputs.seed=s.seed;graph['15'].inputs.filename_prefix='adstudio-qwen-'+id;
 await mkdir(folder,{recursive:true});await writeFile(join(folder,'reference.png'),source.bytes,{flag:'wx'});await writeFile(join(folder,'original.'+(originalType==='jpeg'?'jpg':originalType)),original,{flag:'wx'});
 const record:any={version:1,status:'preparing',ownerApproved:false,model:contract.id,projectId:body.projectId,weights,sourceSha256:source.sha256,originalSha256:heroSha(original),sourceId:s.sourceId,brief:structuredClone(d),fullEvidencePrompt:d.prompt,modelPrompt:s.prompt,workflow:graph,workflowSha256:heroSha(JSON.stringify(graph)),started:new Date().toISOString()};const save=()=>writeFile(join(folder,'provenance.json'),JSON.stringify(record,null,2));await save();const started=Date.now();
 try{transport.progress('queued','Qwen ready; submitting the reviewed reference and prompt.');const result=await transport.execute(graph,join(folder,'reference.png'),raw,transport.progress);if(typeof result.jobId!=='string'||!result.jobId)throw new HeroError(422,'Missing real Comfy job identity.');record.jobId=result.jobId;
  transport.progress('encoding','Checking raw Comfy PNG and executed-workflow metadata.');const bytes=await readFile(raw),checked=inspectQwenPNG(bytes,graph);record.executedWorkflowSha256=heroSha(JSON.stringify(checked.executedGraph));record.sha256=heroSha(bytes);record.width=checked.width;record.height=checked.height;record.seconds=(Date.now()-started)/1000;record.status='complete';record.url='/outputs/'+id+'.png';await writeFile(target,bytes,{flag:'wx'});await save();
  return {url:record.url,width:checked.width,height:checked.height,sha256:record.sha256,sourceSha256:source.sha256,originalSha256:record.originalSha256,seconds:record.seconds,method:'Qwen-Image-Edit-2511 FP8 (raw Comfy PNG)',model:'qwen-fp8',jobId:result.jobId,workflowSha256:record.workflowSha256,provenanceId:id,prompt:s.prompt,fullEvidencePrompt:d.prompt,weights,warning:'Prompt fidelity controls are requests, not physical geometry enforcement. Owner review required.'};
 }catch(error){await unlink(target).catch(()=>{});record.status='failed';record.jobId=(error as any)?.jobId;record.cancelRequested=(error as any)?.cancelRequested;record.error=String((error as Error).message||error);record.seconds=(Date.now()-started)/1000;await save().catch(()=>{});if(error instanceof HeroError)throw error;throw new HeroError(502,'Qwen generation failed; no substitute result was saved. Check the local job record before retrying.');}
}
