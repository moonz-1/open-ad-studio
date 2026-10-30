/** A proposed set is creative interpretation, never an additional product fact. */
import type {CreativeContext} from './creative-engine.ts';
import {unsupportedClaims,claimEvidence,removeClaims,type ClaimRepair} from './claim-repair.ts';
export const sceneCameras=[{id:'reference-shallow',text:'Match the source viewpoint with natural perspective and shallow background depth.'},{id:'reference-texture',text:'Match the source viewpoint with precise material detail and a gently defocused background.'},{id:'reference-layered',text:'Match the source viewpoint with restrained compressed depth and readable spatial layers.'}] as const;
export const scenePlacements=[{id:'hero-lower-left',text:'Place the complete product grouping lower-left at readable hero scale with calm empty upper-right open field.'},{id:'hero-lower-right',text:'Place the complete product grouping right of centre at dominant but uncropped scale with an empty left third.'},{id:'hero-lower-centre',text:'Place the whole product grouping below centre at balanced scale with a broad quiet upper open field.'}] as const;
export const sceneProposalFields=['sceneInterpretation','sceneEnvironment','sceneLighting','scenePalette'] as const;
export const sceneFields=['sceneEvidenceId','sceneEvidenceQuote','sceneInterpretation','sceneEnvironment','sceneLighting','sceneCamera','sceneComposition','scenePalette'] as const;
export type PhotographicScene={version:1;basis:{id:string;quote:string};interpretation:string;environment:string;lighting:string;camera:string;composition:string;palette:string;status:'creative-proposal'};
export function bindPhotographicScene(a:any,context:CreativeContext):PhotographicScene{
 for(const k of sceneFields)if(typeof a[k]!=='string'||a[k].trim().length<(k==='sceneEvidenceId'?2:12)||a[k].length>(k==='sceneEnvironment'?350:220)||/[<>]/.test(a[k]))throw Error('Incomplete photographic scene: '+k+'. Your previous campaign was kept.');
 const camera=sceneCameras.find(x=>x.id===a.sceneCamera),placement=scenePlacements.find(x=>x.id===a.sceneComposition);
 if(!camera||!placement)throw Error('Choose a supplied reference-supported camera and complete-product placement.');
 const proof=context.facts.find(f=>f.id===a.sceneEvidenceId&&['source','owner'].includes(f.kind));
 if(!proof||!proof.text.includes(a.sceneEvidenceQuote)||a.sceneEvidenceQuote.length>200)throw Error('Photographic interpretation must cite an exact selected product or owner evidence excerpt.');
 const prose=sceneFields.filter(k=>k!=='sceneEvidenceId'&&k!=='sceneEvidenceQuote').map(k=>a[k]).join(' ');
 if(unsupportedClaims(prose,claimEvidence(context)).length)throw Error('Photographic scene adds unsupported factual claims. Existing work was kept.');
 return {version:1,basis:{id:proof.id,quote:a.sceneEvidenceQuote},interpretation:a.sceneInterpretation.trim(),environment:a.sceneEnvironment.trim(),lighting:a.sceneLighting.trim(),camera:camera.text,composition:placement.text,palette:a.scenePalette.trim(),status:'creative-proposal'};
}

/** The same recorded claim-removal policy used for marketing. Geometry is never repaired here. */
export function repairSceneClaims(value:any,context:CreativeContext){
 const evidence=claimEvidence(context),repairs:ClaimRepair[]=[];
 if(!Array.isArray(value?.arguments))return {value,repairs};
 const args=value.arguments.map((a:any,index:number)=>{const next={...a};
  for(const field of ['sceneInterpretation','sceneEnvironment','sceneLighting','scenePalette']){
   if(typeof next[field]!=='string')continue;const from=next[field],claims=unsupportedClaims(from,evidence);if(!claims.length)continue;
   const kept=removeClaims(from,claims,'idea'),fallback=field==='sceneInterpretation'?'The cited description inspires the proposed set materials and lighting; it establishes no additional product benefit.':'';
   if(!kept&&!fallback)throw Error('Unsupported claim leaves an incomplete photographic '+field+'. No scene was substituted.');
   next[field]=kept||fallback;repairs.push({argument:index,field,from,to:next[field],claims,method:kept?'removed':'replaced',reason:'Unsupported factual phrase removed from the proposed set; original model response and exact evidence citation retained. No physical identity or quality gate was changed.'});
  }return next;
 });return {value:{...value,arguments:args},repairs};
}
