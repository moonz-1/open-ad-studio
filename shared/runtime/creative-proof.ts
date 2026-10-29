/** Read-only native verification for Qwen planning; never submits or cancels work. */
import type {PlanningExecution} from '../lib/creative-engine.ts';
export function verifyPlanningExecution(history:any,jobId:string,model:string,system:string,content:string):PlanningExecution{
 const h=history?.[jobId],graph=h?.prompt?.[2];
 if(!h||h.prompt?.[1]!==jobId||h.status?.completed!==true||h.status?.status_str!=='success')throw Error('Planning worker has no verified successful native completion for this job.');
 if(graph?.['1']?.class_type!=='CLIPLoader'||graph['1'].inputs?.clip_name!==model||graph?.['2']?.class_type!=='TextGenerate'||graph['2'].inputs?.system_prompt!==system||graph['2'].inputs?.prompt!==content)throw Error('Executed Qwen graph does not match this planning request/model.');
 const cached=h.status.messages?.some((m:any)=>m?.[0]==='execution_cached'&&m?.[1]?.nodes?.includes('2'))===true;
 return {status:'validated',transport:'comfy-sdk',jobId,inference:cached?'cached':'fresh'};
}

/** Never globally interrupts an unknown worker; pending deletion names only our SDK job. */
export async function cancelOwnedPlanningJob(job:{id:string},base:string,fetcher:typeof fetch=fetch){
 const u=new URL(base);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return 'skipped: cancellation requires verified loopback worker';
 try{
  const response=await fetcher(base.replace(/\/$/,'')+'/queue',{signal:AbortSignal.timeout(2000)});if(!response.ok)return 'skipped: queue unreadable';const q=await response.json();
  if(!Array.isArray(q.queue_running)||!Array.isArray(q.queue_pending))return 'skipped: queue unknown';
  if(q.queue_running.length===1&&q.queue_running[0]?.[1]===job.id){const cancelled=await fetcher(base.replace(/\/$/,'')+'/api/jobs/'+encodeURIComponent(job.id)+'/cancel',{method:'POST',signal:AbortSignal.timeout(5000)});if(!cancelled.ok)return 'skipped: atomic owned-job cancellation unsupported; no global interrupt';const result=await cancelled.json();return result.cancelled===true?'atomic owned-job cancellation requested (not proof of termination)':'owned job already terminal or unknown; no interrupt dispatched';}
  if(q.queue_pending.some((r:any)=>r?.[1]===job.id)){const deleted=await fetcher(base.replace(/\/$/,'')+'/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({delete:[job.id]}),signal:AbortSignal.timeout(2000)});return deleted.ok?'requested exact owned pending-job deletion (not proof of termination)':'pending-job deletion failed';}
  return 'skipped: no exclusively running or pending owned job';
 }catch{return 'failed: cancellation state unknown; do not retry';}
}
