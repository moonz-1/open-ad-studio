/** Source-bound planning interface. No inferred product facts or alternate model. */
import type {CreativeInput,CreativeContext} from './creative-engine.ts';
import {sceneFields,sceneCameras,scenePlacements,bindPhotographicScene} from './photographic-scene.ts';
const mechanisms=[
 {id:'surface-light',memory:'Grazing light makes the supplied surface recognizable before the complete product holds.',opening:'Move a broad grazing key across the visible reference surface without changing its geometry.',payoff:'Hold the complete product at the supported source viewpoint with clear breathing room.'},
 {id:'detail-to-whole',memory:'Attention travels from an observed detail to the complete reference-supported product.',opening:'Begin near the selected visible detail without exposing any unseen product faces.',payoff:'Widen gently to the full product grouping, retaining the original proportions and count.'},
 {id:'silhouette-contrast',memory:'Controlled background light separates the observed silhouette from a quiet continuous set.',opening:'Lift background contrast behind the actual product outline without altering that outline.',payoff:'Resolve on the intact silhouette with empty space reserved for separately approved brand copy.'},
] as const;
export function photoPlanningOptions(input:CreativeInput){
 const anchors=(['description','texture','container'] as const).flatMap(field=>{
  const text=(input.facts[field]||'').replace(/\s+/g,' ').trim().slice(0,280);
  return text.length>=12?[{id:'photo-'+field,field,text,basis:'owner-supplied observation; not model vision'}]:[];
 });
 if(!anchors.length)throw Error('Describe an actually visible product before AI planning.');
 return {anchors,mechanisms};
}
export type PhotographicBinding={argument:number;focusId:string;mechanismId:string;sourceField:string;focus:string;memory:string;opening:string;payoff:string};
export function bindPhotographicArguments(value:any,input:CreativeInput,context?:CreativeContext):{value:any;bindings:PhotographicBinding[]}{
 if(!value||Object.keys(value).some(k=>k!=='arguments')||!Array.isArray(value.arguments)||value.arguments.length!==3)throw Error('Expected three source-bound advertising arguments.');
 const options=photoPlanningOptions(input),seen=new Set<string>(),bindings:PhotographicBinding[]=[];
 const sceneMode=value.arguments.some((a:any)=>sceneFields.some(k=>k in (a||{})));
 if(sceneMode&&!context)throw Error('Photographic scenes require the verified planning context; no generic substitution.');
 const fields=['title','idea','objective','audienceHypothesis','tension','businessFit','feeling','focusId','mechanismId','proofId','proofQuote',...(sceneMode?sceneFields:[])];
 const scenePlacementsUsed=new Set<string>();
 const args=value.arguments.map((original:any,index:number)=>{
  const a=sceneMode&&original&&typeof original==='object'?{sceneEvidenceId:original.proofId,sceneEvidenceQuote:original.proofQuote,sceneCamera:sceneCameras[index].id,sceneComposition:scenePlacements[index].id,...original}:original;
  if(!a||Object.keys(a).some(k=>!fields.includes(k))||fields.some(k=>typeof a[k]!=='string'))throw Error('Invalid source-bound argument fields.');
  const anchor=options.anchors.find(x=>x.id===a.focusId),mechanism=options.mechanisms.find(x=>x.id===a.mechanismId);
  if(!anchor)throw Error('Unknown photographic focus ID; no visual observation was invented.');
  if(!mechanism||seen.has(mechanism.id))throw Error('Choose three different supported photographic mechanisms.');seen.add(mechanism.id);
  const {focusId,mechanismId,...marketing}=a;
  const binding={argument:index,focusId,mechanismId,sourceField:anchor.field,focus:anchor.text,memory:mechanism.memory,opening:mechanism.opening,payoff:mechanism.payoff};bindings.push(binding);
  if(sceneMode){if(scenePlacementsUsed.has(a.sceneComposition))throw Error('Use three different complete-product placements.');scenePlacementsUsed.add(a.sceneComposition);}
  const photographicScene=sceneMode&&context?bindPhotographicScene(a,context):undefined;
  for(const k of sceneFields)delete marketing[k];
  return {...marketing,...(photographicScene?{photographicScene}:{}),focus:binding.focus,memory:binding.memory,opening:binding.opening,payoff:binding.payoff};
 });
 return {value:{arguments:args},bindings};
}
