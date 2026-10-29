export type ActivityPhase='queued'|'running'|'preparing'|'downloading'|'generating'|'encoding'|'complete'|'error';
export type Activity={id:string;phase:ActivityPhase;message:string;phaseStartedAt:number;startedAt:number;updatedAt:number;percent:number|null;step:number|null;steps:number|null;diagnostics?:ComfyDiagnostic[]};
export class JobActivity{
 private jobs=new Map<string,Activity>();
 begin(id:unknown):string|null{if(id===undefined)return null;if(typeof id!=='string'||! /^[a-f0-9]{32}$/.test(id))throw new Error('Invalid request ID.');if(this.jobs.has(id))throw new Error('Request ID has already been used.');while(this.jobs.size>=128){const removable=[...this.jobs.values()].find(v=>v.phase==='complete'||v.phase==='error');if(!removable)throw new Error('Progress tracker busy.');this.jobs.delete(removable.id)}const now=Date.now();this.jobs.set(id,{id,phase:'queued',message:'Waiting for the local generation worker.',phaseStartedAt:now,startedAt:now,updatedAt:now,percent:null,step:null,steps:null});return id}
 update(id:string|null|undefined,phase:ActivityPhase,message:string,more:Partial<Pick<Activity,'percent'|'step'|'steps'>>={}){if(!id)return;const current=this.jobs.get(id);if(!current||['complete','error'].includes(current.phase))return;const now=Date.now();this.jobs.set(id,{...current,phase,message,updatedAt:now,phaseStartedAt:phase===current.phase?current.phaseStartedAt:now,percent:phase===current.phase?current.percent:null,...more})}
 note(id:string|null|undefined,entry:ComfyDiagnostic){if(!id)return;const current=this.jobs.get(id),message=loadingLog(entry.message);if(!current||!message||['complete','error'].includes(current.phase))return;const previous=current.diagnostics||[];if(previous.at(-1)?.message===message)return;current.diagnostics=[...previous,{...entry,message}].slice(-8);current.updatedAt=Date.now()}
 get(id:string){const value=this.jobs.get(id);return value?{...value,...(value.diagnostics?{diagnostics:value.diagnostics.map(entry=>({...entry}))}:{})}:null}
}
export function phaseForProgress(progress:{currentNodeClass?:string|null;step?:number|null;steps?:number|null}):ActivityPhase{
 const node=progress.currentNodeClass||'';if(!node&&progress.step==null)return'running';if(/Save|VideoCombine|Decode|VAEEncode|Mux/i.test(node))return'encoding';if((/Sampler|Sampling/i.test(node)&&!/Select|Scheduler|Noise/i.test(node))||(progress.step!=null&&progress.steps!=null&&progress.steps>0))return'generating';return'preparing';
}
import {loadingLog,type ComfyDiagnostic} from './comfy-diagnostics.ts';
