import type {Comfy} from '@comfyorg/sdk';
import type {QwenTransport} from './qwen-hero.ts';
import {phaseForProgress} from './job-activity.ts';
// Same Comfy SDK -> existing proxy -> ComfyUI. Exactly one submit, no retry.
export function qwenSDKTransport(client:Comfy,before:()=>Promise<void>):QwenTransport['execute']{
 return async(graph,reference,output,progress)=>{
  await before();const workflow=client.workflows.fromJson(structuredClone(graph));workflow.setInput('4','image',client.assets.fromFile(reference));let job:Awaited<ReturnType<Comfy['submit']>>|undefined;const controller=new AbortController();
  try{progress('preparing','Loading Qwen. First model load can take several minutes.');job=await client.submit(workflow);const current=job;
   const stream=(async()=>{try{for await(const event of current.events(controller.signal)){
    if(event.kind==='progress'){const phase=phaseForProgress({...event,currentNodeClass:event.currentNode?(graph[event.currentNode]?.class_type):event.currentNodeClass});progress(phase==='generating'||phase==='encoding'||phase==='running'||phase==='queued'?phase:'preparing',phase==='generating'?'Generating Qwen photograph.':phase==='encoding'?'Decoding and saving raw Qwen image.':'Loading / conditioning Qwen; sampler progress may not be available yet.',{percent:Number.isFinite(event.value)?Math.max(0,Math.min(100,event.value*100)):null,step:event.step,steps:event.steps});}
    else if(event.kind==='statusChange'&&event.status==='queued')progress('queued','Waiting for the ComfyUI worker.');
   }}catch{/* job.wait/result are authoritative; lost progress never substitutes success. */}})();
   try{await job.wait(30*60*1000);await job.result();const outputs=job.getOutputs('15');if(outputs.length!==1)throw Error('Expected one raw SaveImage output.');await outputs[0].toFile(output);return {jobId:job.id};}finally{controller.abort();void stream;}
  }catch(error){controller.abort();if(job){let cancelled=false;try{await job.cancel(AbortSignal.timeout(5000));cancelled=true;}catch{}throw Object.assign(new Error('Qwen job failed; inspect its queue status before retrying.'),{jobId:job.id,cancelRequested:cancelled});}throw error;}
 };
}
