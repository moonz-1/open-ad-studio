// Same-origin Qwen-only bridge over an authenticated SSH loopback tunnel.
// All ordinary outputs, brands/projects, other models and Director stay local.
import {readFile,writeFile,mkdir,open,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {HeroError,heroSha} from './hero-ad.ts';
import {validateQwenRequest,qwenWorkflow,qwenContract,inspectQwenPNG} from './qwen-hero.ts';
import {acceptanceGate,acceptanceRequest,acceptanceUnused,claimAcceptanceJob,loopbackOrigin,type GateFiles} from './qwen-app-session.ts';
import {qwenInferenceJSON,QWEN_INFERENCE_MAX_MS} from './qwen-inference-http.ts';
type Progress=(phase:any,message:string,more?:any)=>void;
export function createQwenRelay(root:string,remote:string,files:GateFiles){
 const base=loopbackOrigin(remote);if(base!=='http://127.0.0.1:28301')throw new HeroError(503,'Use the fixed private API SSH tunnel, not a public service.');
 async function get(path:string,options:RequestInit={}){const r=await fetch(base+path,{...options,redirect:'error'});if(!r.ok){const e=await r.json().catch(()=>({}));throw new HeroError(r.status>=400&&r.status<600?r.status:502,e.error||'Private remote API request failed.');}return r;}
 async function json(path:string,options:RequestInit={}){const r=await get(path,{signal:AbortSignal.timeout(15000),...options});const text=await r.text();if(text.length>512*1024)throw new HeroError(502,'Remote metadata is too large.');return JSON.parse(text);}
 const durable=async(path:string,data:Buffer|string)=>{const f=await open(path,'wx',0o600);try{await f.writeFile(data);await f.sync();}finally{await f.close();}};
 async function status(data:any){const path=files.receipt+'.status.json',temp=path+'.tmp';await writeFile(temp,JSON.stringify(data,null,2));await rename(temp,path);}
 return {
  async capability(origin:string){try{const gate=await acceptanceGate(files,origin);if(!await acceptanceUnused(files))return {id:'qwen-fp8',available:false,reason:'One-job acceptance already used. Collected images remain local.'};const remoteCaps=await json('/api/hero/capabilities');return {...remoteCaps.qwen,acceptance:true,podId:gate.lease.podId};}catch(e){return {id:'qwen-fp8',available:false,reason:(e as Error).message};}},
  async generate(body:any,origin:string,progress:Progress){
   const {plan,lease}=await acceptanceGate(files,origin),validated=await validateQwenRequest(body,root);acceptanceRequest(plan,body);if(plan.remoteOrigin!==base)throw new HeroError(503,'Approval does not match the tunnel.');
   if(!await acceptanceUnused(files))throw new HeroError(409,'This one-job acceptance session is already used.');const caps=await json('/api/hero/capabilities');if(!caps.qwen?.available)throw new HeroError(503,caps.qwen?.reason||'Remote Qwen is unavailable. No private upload.');
   const id=body._requestId;if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw new HeroError(400,'Acceptance requires a tracked browser request.');await claimAcceptanceJob(files,{podId:lease.podId,requestId:id});let stopped=false,polling=false;
   const poll=async()=>{if(stopped||polling)return;polling=true;try{const s=await json('/api/activity/'+id);if(!stopped&&!['complete','error'].includes(s.phase))progress(s.phase,s.message,{percent:s.percent,step:s.step,steps:s.steps});}catch{}finally{polling=false}};
   const timer=setInterval(()=>void poll(),700);
   try{
    await acceptanceGate(files,origin);progress('preparing','Transferring only the reviewed reference to the private app API.');
    const uploaded=await json('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,'+validated.source.bytes.toString('base64')})});if(!/^\/outputs\/[a-f0-9]{16}\.png$/.test(uploaded.url))throw new HeroError(502,'Invalid remote reference URL.');
    await acceptanceGate(files,origin);
    const inferenceDeadline=Math.min(Date.now()+QWEN_INFERENCE_MAX_MS,lease.deadline*1000-600000);
    const result=await qwenInferenceJSON(JSON.stringify({...body,image:uploaded.url}),id,inferenceDeadline);
    if(!/^[a-f0-9]{16}$/.test(result.provenanceId||'')||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(result.url||'')||result.model!=='qwen-fp8'||!result.jobId)throw new HeroError(502,'Invalid real-job result contract.');
    progress('encoding','Collecting and verifying raw image and provenance on this PC before completion.');
    const record=await json('/api/hero/qwen/provenance/'+result.provenanceId),graph=await qwenWorkflow(),contract=await qwenContract();graph['6'].inputs.prompt=body.settings.prompt;graph['13'].inputs.seed=body.settings.seed;graph['15'].inputs.filename_prefix='adstudio-qwen-'+result.provenanceId;
    if(record.status!=='complete'||record.projectId!==body.projectId||record.jobId!==result.jobId||record.modelPrompt!==body.settings.prompt||record.sourceSha256!==validated.source.sha256||record.originalSha256!==heroSha(validated.original)||record.sha256!==result.sha256||record.workflowSha256!==heroSha(JSON.stringify(graph))||result.workflowSha256!==record.workflowSha256||heroSha(JSON.stringify(record.workflow))!==record.workflowSha256||contract.files.some(f=>!record.weights?.some((w:any)=>w.file===f.file&&w.bytes===f.bytes&&w.sha256===f.sha256)))throw new HeroError(502,'Remote provenance does not match the approved source, model or job.');
    const response=await get(result.url,{signal:AbortSignal.timeout(60000)});const parts:Uint8Array[]=[];let length=0;for await(const chunk of response.body as any){length+=chunk.length;if(length>32*1024*1024)throw new HeroError(502,'Raw output is too large.');parts.push(chunk);}const bytes=Buffer.concat(parts),decoded=inspectQwenPNG(bytes,graph);
    if(heroSha(bytes)!==result.sha256||decoded.width!==result.width||decoded.height!==result.height)throw new HeroError(502,'Raw output transfer failed verification.');
    const localId=result.provenanceId,folder=join(root,'hero-qwen',result.provenanceId);await mkdir(folder,{recursive:true});
    const artifacts=[['comfy-output.png',bytes],['reference.png',validated.source.bytes],['original.'+(validated.originalType==='jpeg'?'jpg':validated.originalType),validated.original],['provenance.json',JSON.stringify(record,null,2)]] as const;
    const manifest:any={state:'collected',podId:lease.podId,jobId:result.jobId,provenanceId:result.provenanceId,localUrl:'/outputs/'+localId+'.png',files:[],checked:Date.now(),ownerApproved:false};
    for(const [name,data]of artifacts){const path=join(folder,name);await durable(path,data);manifest.files.push({path,sha256:heroSha(data)});}
    const target=join(root,localId+'.png');await durable(target,bytes);manifest.files.push({path:target,sha256:heroSha(bytes)});
    for(const f of manifest.files)if(heroSha(await readFile(f.path))!==f.sha256)throw new HeroError(500,'Local collection verification failed.');
    await durable(join(folder,'collection.json'),JSON.stringify(manifest,null,2));await status(manifest);
    return {...result,url:manifest.localUrl,collectionVerified:true};
   }catch(e){await status({state:'failed',podId:lease.podId,checked:Date.now(),error:(e as Error).message}).catch(()=>{});throw e;}finally{stopped=true;clearInterval(timer);}
  }
 };
}
