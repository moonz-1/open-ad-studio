import {assertSceneExportable} from '../../shared/lib/scene-quality.ts';
﻿import {needsAdvertisingStrategy} from '../../shared/lib/advertising-strategy.ts';
import {AdApplication,draftFor} from './ad-application.ts';
import type {CreativeDraft} from './creative-service.ts';
import {creativeSnapshot,type CreativePlan} from '../../shared/lib/creative-engine.ts';
import {resolveGenerationEngine,type GenerationEngineId} from './generation-engines.ts';
import type {AdProject} from './projects.ts';
export type JourneySource={id:string;name:string;draft:CreativeDraft;permission:boolean;planId?:string;review?:string};
export type JourneyCard={id:string;sourceId:string;planId:string;conceptId:string;title:string;state:'waiting'|'preparing'|'generating'|'composing'|'saving'|'ready'|'failed'|'cancelled';takeId?:string;exportId?:string;error?:string;message?:string};
export type JourneyState={planningMode?:'ai'|'basic';version:1;stage:number;sources:JourneySource[];quantity:number;cards:JourneyCard[];batchId?:string;introduction?:{website:string;name:string};format?:'static'|'video'};
export const emptyJourney=():JourneyState=>({version:1,stage:1,sources:[],quantity:1,cards:[]});
export function journeyFor(p:AdProject):JourneyState {const j=p.creative?.journey;if(!j)return emptyJourney();if(j.version!==1||!Array.isArray(j.sources)||!Array.isArray(j.cards)||!Number.isInteger(j.stage)||j.stage<1||j.stage>6)throw Error('Unsupported journey record. Your saved project has been kept.');return structuredClone(j);}
export const reviewKey=(plan:CreativePlan)=>creativeSnapshot(plan.input)+'\n'+JSON.stringify(plan.concepts)+'\n'+plan.selectedId;
export function campaignQueue(sources:JourneySource[],plans:CreativePlan[],quantity:number):JourneyCard[]{
 if(!sources.length||!Number.isInteger(quantity)||quantity<sources.length||quantity>Math.min(6,sources.length*3))throw Error('Choose one to three directions per product, up to six advertisements.');
 const result:JourneyCard[]=[];
 for(let i=0;i<quantity;i++){const s=sources[i%sources.length],p=plans.find(p=>p.id===s.planId);if(!p||!s.permission||s.review!==reviewKey(p))throw Error('Review every selected photograph and direction first.');const choices=[p.concepts.find(c=>c.id===p.selectedId)!,...p.concepts.filter(c=>c.id!==p.selectedId)],c=choices[Math.floor(i/sources.length)];if(!c)throw Error('No distinct reviewed concept remains.');result.push({id:crypto.randomUUID(),sourceId:s.id,planId:p.id,conceptId:c.id,title:c.title,state:'waiting'});}
 return result;
}
// Optional state in the EXISTING project record; no new database or asset store.
export class JourneyService {
 running=false;private stopped=false;
 constructor(readonly app:AdApplication){}
 state(){return journeyFor(this.app.store.active());}
 async save(change:(j:JourneyState)=>void){const p=this.app.store.active();p.creative??={version:1,plans:[]};const j=journeyFor(p);change(j);p.creative.journey=j;await this.app.store.projects.save(p);}
 async stage(stage:number){if(this.running)throw Error('Stop the campaign before navigating.');await this.save(j=>{j.stage=stage;});}
 async rememberSource(permission=false){const d=draftFor(this.app.store.active()),a=await this.app.store.asset(d.sourceId);if(!a)throw Error('Select an original photograph.');await this.save(j=>{const old=j.sources.find(s=>s.id===a.id);if(!old){if(j.sources.length>=3)throw Error('Use up to three products per campaign.');j.sources.push({id:a.id,name:a.name,draft:d,permission});}else {old.draft=d;old.permission=permission;delete old.review;}j.quantity=Math.max(j.quantity,j.sources.length);});}
 async focus(id:string){if(this.running)throw Error('A campaign is running.');const s=this.state().sources.find(s=>s.id===id);if(!s)throw Error('Select a saved source.');await this.app.selectSource(id);await this.app.editDraft(s.draft);}
 async sourceChanged(permission:boolean){const d=draftFor(this.app.store.active());await this.save(j=>{const s=j.sources.find(s=>s.id===d.sourceId);if(s){s.draft=d;s.permission=permission;delete s.planId;delete s.review;}});}
 async develop(planningMode=this.state().planningMode??'ai'){const d=draftFor(this.app.store.active()),s=this.state().sources.find(s=>s.id===d.sourceId);if(!s?.permission)throw Error('Confirm permission to use this original photograph.');const plan=await this.app.develop(planningMode);await this.save(j=>{const s=j.sources.find(s=>s.id===d.sourceId)!;s.draft=d;s.planId=plan.id;delete s.review;j.stage=4;});return plan;}
 async choose(plan:CreativePlan,conceptId:string){const next=await this.app.choose(plan.id,conceptId);await this.save(j=>{const s=j.sources.find(s=>s.id===next.input.source.id)!;s.planId=next.id;delete s.review;});return next;}
 async refine(plan:CreativePlan,text:string){const next=await this.app.refine(plan.id,text);await this.save(j=>{const s=j.sources.find(s=>s.id===next.input.source.id)!;s.planId=next.id;s.draft=draftFor(this.app.store.active());delete s.review;});return next;}
 async review(plan:CreativePlan,confirmed:boolean){if(!confirmed)throw Error('Confirm the visible source facts and this direction.');await this.app.approve(plan.id,true);await this.save(j=>{const s=j.sources.find(s=>s.id===plan.input.source.id)!;s.review=reviewKey(plan);s.draft=draftFor(this.app.store.active());});}
 async plans(){return Promise.all(this.state().sources.map(s=>{if(!s.planId)throw Error('Develop a direction for each selected product.');return this.app.creative.open(this.app.store.active().id,s.planId);}));}
 async recover(){const j=this.state();if(j.cards.some(c=>!['ready','failed','cancelled'].includes(c.state)))await this.save(j=>{for(const c of j.cards)if(!['ready','failed','cancelled'].includes(c.state)){c.state='failed';c.error='This tab closed during the campaign. No job was resubmitted. Check saved results and the local queue before starting a new campaign.';}});}
 async cancel(){this.stopped=true;const p=this.app.store.active();if(p.attempt?.status==='running'&&(p.attempt.engine==='klein'||p.attempt.engine==='flux3'))await this.app.cancelGeneration();}
 async run(engine:GenerationEngineId,approved:boolean){
 if(this.running)throw Error('The campaign is already running.');if(!approved)throw Error('Review the listed directions before generating.');this.running=true;this.stopped=false;
 const projectId=this.app.store.active().id;let active:string|undefined;
 const progress=(event:Event)=>{const detail=(event as CustomEvent<{id:string;phase:string;message:string}>).detail,id=active,attempt=this.app.store.active().attempt;
  if(!id||!attempt||detail.id!==attempt.id.replaceAll('-',''))return;
  void this.save(j=>{const card=j.cards.find(c=>c.id===id);if(card?.state==='generating'){card.message=detail.message;if(detail.phase==='complete')card.state='composing';}}).catch(error=>this.app.store.report(error));
 };
 if(typeof window!=='undefined')window.addEventListener('osh-generation-progress',progress);
 const patch=async(id:string,change:Partial<JourneyCard>)=>this.save(j=>{const c=j.cards.find(c=>c.id===id);if(c)Object.assign(c,change);});
 try{
  await this.app.store.flush();const initial=this.state(),plans=await this.plans(),cards=campaignQueue(initial.sources,plans,initial.quantity);
  // Pin one real engine for this campaign; never silently switch after a failure.
  // Product-safe must not wait on Comfy probes (busy GPU / hung /object_info).
  const want=engine==='automatic'&&plans.some(needsAdvertisingStrategy)?'product-safe':engine;
  const offline={finish:true,qwen:{available:false,reason:'Local generation service unreachable'},reimagine:false as const};
  const ready=want==='product-safe'?offline:await this.app.client.capabilities().catch(()=>{
   if(want!=='automatic')throw Error('The local generation service could not be reached. Choose Product-safe design, which works without ComfyUI.');
   return offline;
  });
  const chosen=resolveGenerationEngine(want,ready);
  for(const s of initial.sources){const plan=plans.find(p=>p.id===s.planId)!,p=this.app.store.active(),context=await this.app.creative.context(p,s.id,s.draft);if(reviewKey(plan)!==s.review||creativeSnapshot(context.input)!==creativeSnapshot(plan.input))throw Error('Brand, source or direction changed. Review again before generation.');}
  await this.save(j=>{j.stage=6;j.batchId=crypto.randomUUID();j.cards.push(...cards);});
  for(const card of cards){if(this.stopped){await patch(card.id,{state:'cancelled',message:'Not submitted'});continue;}active=card.id;
   if(this.app.store.active().id!==projectId)throw Error('Project changed; campaign stopped.');
   await patch(card.id,{state:'preparing'});const base=plans.find(p=>p.id===card.planId)!,source=initial.sources.find(s=>s.id===card.sourceId)!;
   await this.app.selectSource(source.id);await this.app.editDraft(source.draft);
   // Fresh child plan + receipt for EACH explicitly reviewed concept. No spent
   // receipt reuse, invented confirmation, duplicate output, or auto retry.
   const child=await this.app.choose(base.id,card.conceptId);await this.app.approve(child.id,true);
   if(this.stopped){await patch(card.id,{state:'cancelled',message:'Not submitted'});continue;}
   await patch(card.id,{state:chosen.id==='product-safe'?'composing':'generating',message:chosen.id==='flux3'?'Preparing GPU':chosen.label,planId:child.id});
   const take=await this.app.generate(child.id,chosen.id);await patch(card.id,{state:'saving',takeId:take.id,planId:child.id,message:chosen.id==='flux3'?'Designing advertisement':chosen.label});await this.app.store.flush();assertSceneExportable(take.scene);
   const p=this.app.store.active(),record=p.staticAds!.exports.slice().reverse().find(e=>e.assetId===take.assetId||take.adDesign?.campaign&&e.design.photoId===take.assetId);
   if(!record)throw Error('Raw result saved; final advertisement export is missing. Open history instead of regenerating.');
   await patch(card.id,{state:'ready',exportId:record.id,message:chosen.label,planId:child.id});active=undefined;
  }
 }catch(error){const message=error instanceof Error?error.message:String(error);if(active)await patch(active,{state:this.stopped?'cancelled':'failed',error:message}).catch(()=>{});await this.save(j=>{for(const c of j.cards)if(c.state==='waiting')Object.assign(c,{state:'cancelled',message:'Not submitted after campaign stopped'});}).catch(()=>{});throw error;
 }finally{if(typeof window!=='undefined')window.removeEventListener('osh-generation-progress',progress);this.running=false;}
 }
}
