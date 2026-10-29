import type {CreativePlan} from './creative-engine.ts';
export function planningPresentation(provider:CreativePlan['provider']){
 const authored=provider.origin==='authored'||/^authored(?:-|$)/i.test(provider.model||'');
 if(authored)return {kind:'authored' as const,label:'Authored creative direction - no AI planning',reason:provider.reason};
 if(provider.mode!=='local-ai')return {kind:'basic' as const,label:'Basic draft - no AI planning',reason:provider.reason};
 if(provider.execution?.transport==='comfy-sdk'&&provider.execution.inference==='fresh'&&provider.execution.status==='validated'&&provider.execution.jobId)return {kind:'live-ai' as const,label:'Local AI - verified model response',reason:provider.reason};
 if(provider.execution?.inference==='cached')return {kind:'cached-ai' as const,label:'Cached AI response - no fresh inference',reason:provider.reason};
 return {kind:'unverified-ai' as const,label:'AI-format response - execution unverified',reason:provider.reason};
}
