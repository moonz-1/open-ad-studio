// React-ready application service. No mounting, navigation, model downloads or
// browser storage initialization. Caller supplies the existing Projects instance.
import {assertAdvertisingGeneration} from '../../shared/lib/advertising-strategy.ts';
import {OSH,type HeroResult} from '../../shared/runtime/client.ts';
import {Projects,type AdProject,type ProductAsset} from './projects.ts';
import {blobDataURL} from './assets.ts';
import {heroTakeFromDelivery} from './hero-delivery.ts';
import type {CreativeInput,CreativePlan,CreativePrepared} from '../../shared/lib/creative-engine.ts';
import {validateWebsiteSource} from '../../shared/lib/source-provenance.ts';
import {creativeSnapshot} from '../../shared/lib/creative-engine.ts';
import {productImageProof,validProductEvidence} from '../../shared/lib/brand.ts';
import type {HeroSettings} from '../../shared/lib/hero-ad.ts';
type Entry={id:string;created:number;sourceId:string;brandId:string;summary:string;provider:string;basisHero:string;previousHero?:HeroSettings;preparedId?:string};
export type CreativeDraft={planningMode?:'ai'|'basic'} & Pick<CreativeInput,'facts'|'productType'|'request'|'intent'|'format'|'productId'|'constraints'|'seed'|'notes'|'productEvidence'> & {sourceId:string};
export type InspirationRecord={videoUrl:string;originalUrl?:string;sha256?:string;bytes?:number;duration?:number;width?:number;height?:number;rights:'inspiration-only'|'user-owned-or-licensed';/** Soundtrack rights are separate from video footage rights. */
 audioRights?:import('../../shared/lib/sound-director.ts').AudioRights;analysis?:import('../../shared/lib/reference-video.ts').ReferenceAnalysis;shotPlan?:import('../../shared/lib/reference-video.ts').CampaignShotPlan;productReplacementAvailable:false};
/** Journey UI state + optional reference-video inspiration + per-take sound; both optional so older projects remain readable. */
export type CreativeWorkspace={version:1;journey?:import('./journey-service.ts').JourneyState;generationEngine?:import('./generation-engines.ts').GenerationEngineId;plans:Entry[];activeId?:string;draft?:CreativeDraft;step?:'product'|'direction'|'result';websiteDraft?:string;onboarding?:{name:string;website:string};handoffs?:{planId:string;created:number;draft?:CreativeDraft;activeId?:string;step?:string;refinement?:{planId:string;text:string}}[];references?:Record<string,{sha256:string;facts:CreativeDraft['facts'];productType:CreativeDraft['productType']}>;inspiration?:InspirationRecord;/** Optional per video-take sound state; absent on older projects. */
 soundByTakeId?:Record<string,import('../../shared/lib/sound-director.ts').CampaignSoundState>;refinement?:{planId:string;text:string};adDrafts?:Record<string,Partial<Pick<import('../../shared/lib/static-ad.ts').StaticDesign,'headline'|'body'|'cta'|'size'>>>;adDraft?:{takeId:string;copy:Partial<Pick<import('../../shared/lib/static-ad.ts').StaticDesign,'headline'|'body'|'cta'|'size'>>}};
type Client=Partial<Pick<typeof OSH,'productEvidence'>>&Pick<typeof OSH,'upload'|'creativePlan'|'creativeSelect'|'creativeRefineComposition'|'creativePlanRecord'|'creativePrepare'|'creativeCompose'|'qwenHero'|'reimagineHero'>;
type Options={planningMode?:'ai'|'basic'} & Partial<Pick<CreativeInput,'request'|'intent'|'format'|'seed'|'constraints'|'notes'|'productType'|'facts'|'productId'|'productEvidence'>>;
const hash=async(blob:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
export class CreativeStudioService{
 private planningController?:AbortController;
 cancelPlanning(){this.planningController?.abort(Error('Creative planning cancelled by the user.'));}
 constructor(private projects:Projects,private client:Client=OSH,private encode=blobDataURL){}
 private async project(id:string){const p=(await this.projects.list()).find(p=>p.id===id);if(!p)throw Error('Saved advertising project is missing.');return p;}
 private workspace(p:AdProject):CreativeWorkspace{p.creative??={version:1,plans:[]};if(p.creative.version!==1||!Array.isArray(p.creative.plans))throw Error('Unsupported saved creative workspace; existing data was kept.');return p.creative;}
 async context(p:AdProject,sourceId:string,options:Options):Promise<{input:CreativeInput;asset:ProductAsset}>{
  const brand=(await this.projects.brands()).find(b=>b.id===p.brandId);if(!brand)throw Error('Choose a saved brand for this project.');const asset=await this.projects.asset(sourceId);if(!asset)throw Error('Restore the original product photo from this project.');
  if(sourceId!==p.assetId&&sourceId!==p.hero?.settings.sourceId&&!brand.assets.some(a=>a.assetId===sourceId))throw Error('This original is not associated with the selected project or brand.');
  if(p.hero?.takes.some(t=>t.assetId===sourceId)||p.staticAds?.exports.some(e=>e.assetId===sourceId)||(p.hero?.settings.sourceId===sourceId&&p.hero.settings.sourceKind==='supplied-ai'))throw Error('Choose the genuine original, not an enhanced or generated take.');
  const sha256=await hash(asset.normalized),originalSha256=await hash(asset.original),old=p.hero?.settings.briefDraft?.input;
  const facts=options.facts||(old?.source.id===sourceId&&old.source.sha256===sha256?old.facts:{description:'',arrangement:'',texture:'',container:'',confirmed:false});
  if(asset.provenance)validateWebsiteSource(asset.provenance,{sha256,originalSha256,brandId:brand.id,productId:options.productId});
  return {asset,input:{version:1,projectId:p.id,brand,source:{id:sourceId,name:asset.name,kind:'original',sha256,originalSha256,...(asset.provenance?{provenance:structuredClone(asset.provenance)}:{})},facts:structuredClone(facts),productType:options.productType||(old?.source.id===sourceId?old.productType:'other'),request:options.request||'',notes:options.notes||'',intent:options.intent||'campaign',format:options.format||'feed',seed:options.seed??42,...(options.constraints?{constraints:options.constraints}:{}),...(options.productId?{productId:options.productId}:{}),...(options.productEvidence?{productEvidence:options.productEvidence}:{})}};
 }
 async plan(projectId:string,sourceId:string,options:Options={}):Promise<CreativePlan>{
  const p=await this.project(projectId),w=this.workspace(p);if(w.plans.length>=40)throw Error('This project has 40 saved plans. Use a new project; existing plans were kept.');
  const controller=new AbortController();this.planningController=controller;let plan:CreativePlan;
  try{
   const selectedBrand=(await this.projects.brands()).find(b=>b.id===p.brandId),product=selectedBrand?.products.find(x=>x.id===options.productId);
   let productEvidence=options.productEvidence||(!product?.overrides?.includes('description')?product?.evidence:undefined);
   if(options.planningMode!=='basic'&&selectedBrand&&product?.discovery&&!productEvidence&&!product.overrides?.includes('description')&&this.client.productEvidence){
    const image=product.discovery.imageUrls[0];
    if(image){productEvidence=await this.client.productEvidence({productKey:product.discovery.key,research:productImageProof(selectedBrand,product.id,image)});controller.signal.throwIfAborted();
     if(!validProductEvidence(productEvidence)||productEvidence.productKey!==product.discovery.key)throw Error('Selected product evidence could not be verified.');
    }
   }
   // Evidence is bound to this plan, not written into the shared brand. Enriching a
   // second product must not stale the first product's reviewed plan or paid image.
   const {asset,input}=await this.context(p,sourceId,{...options,...(productEvidence?{productEvidence}:{})}),uploaded=await this.client.upload(await this.encode(asset.normalized));
   controller.signal.throwIfAborted();plan=await this.client.creativePlan({image:uploaded.url,input,planningMode:options.planningMode??'ai'},controller.signal);controller.signal.throwIfAborted();
  }finally{if(this.planningController===controller)this.planningController=undefined;}
  const input=plan.input;if(w.draft){w.draft.planningMode=options.planningMode??'ai';w.draft.productEvidence=structuredClone(input.productEvidence);}
  w.plans.push({id:plan.id,created:plan.created,sourceId,brandId:input.brand.id,summary:plan.concepts.find(c=>c.id===plan.selectedId)!.idea,provider:plan.provider.mode,basisHero:JSON.stringify(p.hero?.settings)});w.activeId=plan.id;w.step='direction';await this.projects.save(p);return plan;
 }
 async open(projectId:string,planId:string){const p=await this.project(projectId);if(!this.workspace(p).plans.some(e=>e.id===planId))throw Error('Plan is not saved in this project.');return this.client.creativePlanRecord(planId,projectId);}
 // Owner-opened same-origin link: attach an existing proposed plan, never rerun
 // inference or simulate acceptance. All checks precede the first project write.
 async attachPlan(projectId:string,planId:string){
  const p=await this.project(projectId),w=this.workspace(p),plan=await this.client.creativePlanRecord(planId,projectId);
  if(w.plans.some(e=>e.id===planId))return plan; // refresh/link replay preserves review and later edits
  if(w.onboarding)throw Error('Finish or cancel the pending brand setup before opening this campaign. Existing drafts were kept.');
  if(w.plans.length>=40)throw Error('This project has 40 saved plans. Existing work was kept.');
  if(plan.projectId!==p.id||plan.generationRun!==false||plan.draft.reviewedSnapshot)throw Error('Open a genuine unreviewed proposal for this project.');
  const {input}=await this.context(p,plan.input.source.id,plan.input);
  if(creativeSnapshot({...plan.input,brand:input.brand,source:input.source,projectId:input.projectId})!==creativeSnapshot(plan.input))throw Error('Saved brand/source differs from this campaign. Re-export current context; no project data was changed.');
  w.handoffs??=[];w.handoffs.push({planId,created:Date.now(),draft:structuredClone(w.draft),activeId:w.activeId,step:w.step,refinement:structuredClone(w.refinement)});
  w.plans.push({id:plan.id,created:plan.created,sourceId:plan.input.source.id,brandId:plan.input.brand.id,summary:plan.concepts.find(c=>c.id===plan.selectedId)!.idea,provider:plan.provider.mode,basisHero:JSON.stringify(p.hero?.settings)});
  const i=plan.input;w.draft={sourceId:i.source.id,facts:{...structuredClone(i.facts),confirmed:false},productType:i.productType,productId:i.productId,request:i.request||'',intent:i.intent||'campaign',format:i.format||'feed',seed:i.seed??42,notes:i.notes||'',constraints:structuredClone(i.constraints),...(i.productEvidence?{productEvidence:structuredClone(i.productEvidence)}:{})};
  w.activeId=plan.id;w.step='direction';w.refinement=undefined;await this.projects.save(p);return plan;
 }
 async choose(projectId:string,planId:string,conceptId:string,facts?:CreativeInput['facts']){const p=await this.project(projectId),w=this.workspace(p);if(!w.plans.some(e=>e.id===planId))throw Error('Plan is not saved in this project.');if(w.plans.length>=40)throw Error('This project already has 40 plans. Previous work was kept.');const plan=await this.client.creativeSelect({planId,projectId,conceptId,...(facts?{facts}: {})});w.plans.push({id:plan.id,created:plan.created,sourceId:plan.input.source.id,brandId:plan.input.brand.id,summary:plan.concepts.find(c=>c.id===plan.selectedId)!.idea,provider:plan.provider.mode,basisHero:JSON.stringify(p.hero?.settings)});w.activeId=plan.id;w.step='direction';await this.projects.save(p);return plan;}
 /** Map owner text onto concrete composition dynamics when possible; otherwise caller may fall back to full re-plan. */
 async refineComposition(projectId:string,planId:string,text:string){const p=await this.project(projectId),w=this.workspace(p);if(!w.plans.some(e=>e.id===planId))throw Error('Plan is not saved in this project.');if(w.plans.length>=40)throw Error('This project already has 40 plans. Previous work was kept.');const plan=await this.client.creativeRefineComposition({planId,projectId,text});w.plans.push({id:plan.id,created:plan.created,sourceId:plan.input.source.id,brandId:plan.input.brand.id,summary:plan.concepts.find(c=>c.id===plan.selectedId)!.idea,provider:plan.provider.mode,basisHero:JSON.stringify(p.hero?.settings)});w.activeId=plan.id;w.step='direction';w.refinement=undefined;await this.projects.save(p);return plan;}
 async approve(projectId:string,planId:string,confirmation:{direction:boolean;facts:boolean}):Promise<CreativePrepared>{
  const p=await this.project(projectId),entry=this.workspace(p).plans.find(e=>e.id===planId);if(!entry)throw Error('Plan does not belong to this project.');
  if(entry.basisHero!==JSON.stringify(p.hero?.settings)&&!entry.preparedId)throw Error('Hero inputs changed after planning. Plan and review again.');
  const plan=await this.client.creativePlanRecord(planId,projectId),{asset,input}=await this.context(p,entry.sourceId,plan.input),image=await this.client.upload(await this.encode(asset.normalized));
  const prepared=await this.client.creativePrepare({planId,current:input,image:image.url,original:await this.encode(asset.original),confirmation});
  entry.previousHero??=structuredClone(p.hero!.settings);entry.preparedId=prepared.preparedId;p.hero!.settings=structuredClone(prepared.payload.settings);await this.projects.save(p);return prepared;
 }
 // Call ONLY from an explicit Generate action. Planning/review never calls this.
 async generate(projectId:string,planId:string,engine:'qwen'|'zimage'='qwen'){const p=await this.project(projectId),entry=this.workspace(p).plans.find(e=>e.id===planId);if(!entry?.preparedId)throw Error('Review the creative direction first.');assertAdvertisingGeneration(await this.client.creativePlanRecord(planId,projectId));const s=structuredClone(p.hero!.settings),source=await this.projects.asset(entry.sourceId);if(!source||s.sourceId!==entry.sourceId)throw Error('Selected source changed. Review again.');if(s.briefDraft?.input.source.provenance&&!source.provenance)throw Error('Restore the website source permission record before generation.');if(source.provenance)validateWebsiteSource(source.provenance,{originalSha256:await hash(source.original),sha256:await hash(source.normalized),brandId:s.brandId,productId:s.productId},true);s.method='reimagine';s.imageModel=engine==='zimage'?'zimage-local':'qwen-fp8';const image=await this.client.upload(await this.encode(source.normalized));const result=engine==='zimage'?await this.client.reimagineHero(image.url,s):await this.client.qwenHero(image.url,s,await this.encode(source.original),p.id);return this.acceptDelivery(projectId,planId,result,s);}
 async acceptDelivery(projectId:string,planId:string,result:HeroResult,settings:HeroSettings){
  const p=await this.project(projectId),entry=this.workspace(p).plans.find(e=>e.id===planId);if(!entry?.preparedId||JSON.stringify(p.hero!.settings)!==JSON.stringify(settings))throw Error('Delivery belongs to a different or changed direction.');const old=p.hero!.takes.find(t=>t.jobId===result.jobId);if(old)return old;
  const asset=await this.download(result.url,result.sha256,result.width,result.height,'Generated Hero.png'),take=await heroTakeFromDelivery(result,asset,settings);p.hero!.takes.push(take);p.hero!.activeId=take.id;p.hero!.approvedId=undefined;this.workspace(p).step='result';await this.projects.save(p,asset);return take;
 }
 async exportAd(projectId:string,planId:string,takeId:string,fidelityReviewed:boolean,copy?:Partial<Pick<import('../../shared/lib/static-ad.ts').StaticDesign,'headline'|'body'|'cta'|'size'>>){
  const p=await this.project(projectId),entry=this.workspace(p).plans.find(e=>e.id===planId),take=p.hero!.takes.find(t=>t.id===takeId);if(!entry?.preparedId||!take?.provenanceId)throw Error('Choose this plan and a delivered Qwen take.');
  const plan=await this.client.creativePlanRecord(planId,projectId),sourceAsset=await this.projects.asset(entry.sourceId);if(plan.input.source.provenance&&!sourceAsset?.provenance)throw Error('Restore the website source permission record before export.');if(sourceAsset?.provenance)validateWebsiteSource(sourceAsset.provenance,{originalSha256:plan.input.source.originalSha256,sha256:plan.input.source.sha256,brandId:plan.input.brand.id,productId:plan.input.productId},true);const logoId=plan.composition.logoId,logo=logoId?await this.projects.asset(logoId):undefined;if(logoId&&!logo)throw Error('Restore the saved original brand logo before export.');
  const logoURL=logo?(await this.client.upload(await this.encode(logo.normalized))).url:undefined;
  const r=await this.client.creativeCompose({projectId,planId,preparedId:entry.preparedId,hero:take.url,provenanceId:take.provenanceId,heroAssetId:take.assetId,logo:logoURL,logoAssetId:logoId,fidelityReviewed,...(copy?{copy}:{})});
  const asset=await this.download(r.url,r.sha256,r.width,r.height,'Advertisement.png');p.staticAds!.exports.push({id:crypto.randomUUID(),assetId:asset.id,url:r.url,created:Date.now(),design:r.design,sha256:r.sha256,sources:r.sources});await this.projects.save(p,asset);return {...r,assetId:asset.id};
 }
 private async download(url:string,sha256:string,width:number,height:number,name:string):Promise<ProductAsset>{if(!/^\/outputs\/[a-f0-9]{16}\.png$/.test(url))throw Error('Invalid delivered image URL.');const r=await fetch(url);if(!r.ok)throw Error('Delivered image is missing; previous assets were kept.');const blob=await r.blob();if(await hash(blob)!==sha256)throw Error('Delivered image checksum failed.');return {id:crypto.randomUUID(),name,original:blob,normalized:blob,width,height,created:Date.now()};}
}
