// Model suggestions only. Identity, physical locks, composition, evidence, copy
// and the complete plan schema remain owned by trusted application code.
import {fallbackConcepts,validateCreativeConcepts,type CreativeContext,type CreativeInput,type CreativeConcept} from './creative-engine.ts';
export const proposalApproaches=['EDITORIAL','DETAIL','GRAPHIC'] as const;
export type VisualProposal={approach:typeof proposalApproaches[number];hook:string;setting?:string;lighting:string};
export const proposalFields=(context:CreativeContext)=>context.controls.background==='replace'?['hook','setting','lighting'] as const:['hook','lighting'] as const;
export function parseVisualProposals(raw:string,context:CreativeContext):VisualProposal[]{
 if(raw.length>6000)throw Error('Visual proposals exceed limit.');
 const lines=raw.trim().split(/\r?\n/).filter(line=>line.trim());if(lines.length!==3)throw Error('Expected exactly three compact visual-proposal lines.');
 const fields=proposalFields(context),seen=new Set<string>(),proposals:VisualProposal[]=[];
 for(const line of lines){const parts=line.split('|').map(part=>part.trim()),approach=parts.shift()?.toUpperCase();
  if(!proposalApproaches.includes(approach as any)||seen.has(approach!)||parts.length!==fields.length)throw Error('Invalid, repeated or incomplete visual-proposal approach.');seen.add(approach!);
  if(parts.some(s=>s.length<8||s.length>240||s.split(/\s+/).length>35||/[<>\u0000-\u001f]/.test(s)))throw Error('Use concise complete visual decisions without placeholders or control characters.');
  const proposal={approach,...Object.fromEntries(fields.map((field,i)=>[field,parts[i]]))} as VisualProposal;
  // A suggestion cannot smuggle a camera/crop/package override into a free text
  // field merely because those technical fields are now supplied by the app.
  if(/\b(camera|viewpoint|perspective|crop|zoom|close.up|overhead shot|low.angle shot|side view|redesign|replace the dish|change the label)\b/i.test(parts.join(' ')))throw Error('Visual proposal overrides app-owned camera/crop/product controls.');
  // Surroundings cannot restage or describe the locked physical assembly. In
  // the real bounded attempt, "baking dish covered in fine flour dust" parsed
  // correctly but changed the product. Reject, never remove/repair that phrase.
  if(proposal.setting&&/\b(dish|tray|pan|container|package|packaging|bottle|label|rolls?|cookies?|product|frosting|icing)\b/i.test(proposal.setting))throw Error('Surrounding-setting proposal modifies or restages the app-owned product/container.');
  if(/\b(dish|tray|pan|container|package|packaging|label)\b/i.test(proposal.hook))throw Error('Visual hook describes app-owned packaging/container; propose atmosphere instead.');
  const source=context.facts.find(f=>f.id==='photo')?.text||'';
  for(const term of ['milk','coffee','cookies','berries','fruit','chocolate','nuts','wooden tray','wooden box','cutting board','flowers','utensils','steam','flour','apron','linen cloth','napkin','hands','spoon','fork','plate','basket','ribbon'])if(new RegExp('\\b'+term+'\\b','i').test(parts.join(' '))&&!new RegExp('\\b'+term+'\\b','i').test(source))throw Error('Visual proposal introduces an unobserved food/prop/container: '+term+'.');
  if(/\b(freshly baked|handmade|made from|contains|ingredients|certified|award.winning)\b/i.test(parts.join(' ')))throw Error('Visual proposal asserts product/commercial properties owned by source evidence, not the model.');
  proposals.push(proposal);
 }
 return proposalApproaches.map(tag=>proposals.find(p=>p.approach===tag)!);
}
export function conceptsFromProposals(input:CreativeInput,context:CreativeContext,proposals:VisualProposal[]):CreativeConcept[]{
 if(proposals.length!==3||proposalApproaches.some((tag,i)=>proposals[i]?.approach!==tag))throw Error('Complete all three known visual approaches.');
 const scaffold=fallbackConcepts(input,context);
 const concepts=scaffold.map((base,i)=>{
  const p=proposals[i];return {...base,id:'direction-'+p.approach.toLowerCase(),idea:p.hook,environment:p.setting??base.environment,lighting:p.lighting,
   scores:{impact:3,relevance:3,accuracy:3,feasibility:3},
   rationale:'AI proposed only the visual hook, permitted surroundings and light. Application rules supplied source constraints, framing, evidence references, copy and neutral compatibility scores; recommendation is not measured commercial quality.'};
 });
 // Validate the entire proposal, including all raw model decisions. No invented
 // food, missing units, conflicting geometry or unsupported claim is repaired.
 return validateCreativeConcepts({concepts},context);
}
