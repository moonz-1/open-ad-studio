import {framingNeedsManualReview} from '../../shared/lib/scene-framing-review.ts';
import {assertSceneExportable,sceneQualityBlocks} from '../../shared/lib/scene-quality.ts';
import {isDataImage} from '../../shared/lib/data-image.ts';
import type {GraphicDirection} from '../../shared/lib/graphic-art-director.ts';
import {withGraphicGeometry} from '../../shared/lib/graphic-art-director.ts';
import {buildCompositionPlan} from '../../shared/lib/composition-dynamics.ts';
import {dynamicsToFlux3Spatial} from '../../shared/lib/flux3-spatial.ts';
// React-facing actions. All jobs and writes share WorkspaceStore; no UI imports.
import {directedFilmPlan,filmAvailability,type FilmMode} from './film.ts';
import {WorkspaceStore} from './workspace-store.ts';
import {CreativeStudioService,type CreativeDraft} from './creative-service.ts';
import {OSH,type HeroResult} from '../../shared/runtime/client.ts';
import {newBrand,applyResearch,matchesWebsite,productImageChoices,productImageProof,researchSources,brandFields,validateResearch,type BrandProfile} from '../../shared/lib/brand.ts';
import {newStaticDesign,type StaticDesign} from '../../shared/lib/static-ad.ts';
import {validateWebsiteSource} from '../../shared/lib/source-provenance.ts';
import {heroRequestManifest} from './hero-flow.ts';
import {blobDataURL,normalizeProduct,rasterPalette} from './assets.ts';
import {newProject,type AdProject,type ProductAsset} from './projects.ts';
import type {HeroTake} from '../../shared/lib/hero-ad.ts';
import {creativeSnapshot,type CreativePlan} from '../../shared/lib/creative-engine.ts';
import {browserDownload,type Download} from './download.ts';
import {adCampaignPrompt,adScenePrompt,flux3ScenePrompt,campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignExecutionStrategy,fluxRestageBlock,isFluxEngine} from '../../shared/lib/campaign-presentation.ts';
import {allowsProductMotion,productFidelityReport} from '../../shared/lib/product-fidelity.ts';
import {campaignVideoSize} from '../../shared/lib/campaign-motion.ts';
import {assertAdvertisingGeneration,needsAdvertisingStrategy} from '../../shared/lib/advertising-strategy.ts';
import {buildCreativeIntelligence} from '../../shared/lib/creative-intelligence.ts';
import {planFromReference,planOriginalCampaign,motionPromptForShot,shotRenderDuration,shotPlanIssues,type ReferenceAnalysis,type CampaignShotPlan} from '../../shared/lib/reference-video.ts';
import {planCampaignSound,soundCapabilitiesNote,type AudioRights,type CampaignSoundState,type SoundLayerAsset,type SoundMode} from '../../shared/lib/sound-director.ts';
import {prepareCampaignKeyframe} from './reference.ts';
import {campaignFilmEndCard,campaignFilmPlate,campaignFilmSignature,campaignFilmPayoff} from './campaign-film-art.ts';
import {defaults,type Take} from './projects.ts';
import {resolveGenerationEngine,type GenerationEngineId,type GenerationReadiness} from './generation-engines.ts';
import type {InspirationRecord} from './creative-service.ts';
export type CopyEdit=Partial<Pick<StaticDesign,'productLine'|'headline'|'body'|'cta'|'size'|'concept'|'background'|'accent'|'textColor'>> & {graphic?:GraphicDirection};
/** Merge editable copy + graphic direction onto a campaign design without flattening campaign.graphic. */
export function applyCopyEdit(design:StaticDesign,copy:CopyEdit):StaticDesign{
 const {graphic,...rest}=copy;
 const next:StaticDesign={...design,...rest};
 if(graphic&&next.campaign)next.campaign={...next.campaign,graphic:{...next.campaign.graphic,...graphic}};
 return next;
}
export function journeyStage(p:AdProject):'product'|'direction'|'result'{const entry=p.creative?.plans.find(e=>e.id===p.creative?.activeId),take=p.hero?.takes.find(t=>t.id===p.hero?.activeId)||p.hero?.takes.at(-1),step=p.creative?.step;if(step==='product'||step==='direction'&&entry||step==='result'&&take)return step;return take&&(!entry||entry.preparedId&&take.settings.prompt===p.hero?.settings.prompt)?'result':entry?'direction':'product';}
export function savedBrand(p:AdProject,brands:BrandProfile[]){return p.creative?.onboarding?undefined:brands.find(b=>b.id===p.brandId)||(!p.brandId&&brands.length===1?brands[0]:undefined);}
export function websiteKey(value:string){try{const u=new URL(value.includes('://')?value:'https://'+value);u.hash='';return u.href.replace(/\/$/,'');}catch{return value.trim();}}
export function websiteSwitchPending(p:AdProject,brands:BrandProfile[]){const draft=p.creative?.websiteDraft;if(draft===undefined)return false;const previous=savedBrand(p,brands)?.website||'';return draft.trim()?![previous,...(savedBrand(p,brands)?.aliases||[])].filter(Boolean).some(u=>websiteKey(u)===websiteKey(draft)):!!previous;}
export function selectedBrand(p:AdProject,brands:BrandProfile[]){return websiteSwitchPending(p,brands)?undefined:savedBrand(p,brands);}
export function emptyProductDraft():CreativeDraft{return {sourceId:'',productType:'other',facts:{description:'',arrangement:'',texture:'',container:'',confirmed:false},request:'',intent:'campaign',format:'feed',seed:42};}
export function developBlockReason(i:{saving?:boolean;busy?:boolean;pending?:boolean;discovering?:boolean;sourceId:string;sourceReady?:boolean;metadataReady?:boolean;brandName:string;description:string;provenance?:ProductAsset['provenance'];productName?:string}){
 if(i.saving)return 'Finish saving your changes before continuing.';
 if(i.busy)return 'Finish the current operation before continuing.';
 if(i.discovering)return 'Wait for website discovery to finish.';
 if(i.pending)return 'Discover this website before selecting a product.';
 if(!i.sourceId)return 'Select a product photograph to continue.';
 if(i.sourceReady===false||i.metadataReady===false)return 'Wait for the selected photograph to load, or select another photograph.';
 if(i.provenance&&!i.provenance.accuracyConfirmed)return 'Confirm that this photograph shows your selected product.';
 if(i.provenance&&!i.provenance.permissionConfirmed)return 'Confirm permission to use this photograph, or upload your own.';
 if(!i.brandName.trim())return 'Add your business name to continue.';
 if(i.productName!==undefined&&!i.productName.trim())return 'Add a name for the selected product.';
 if(!i.description.trim())return "Add a short description of what's visible.";
 return '';
}
export function copyFor(p:AdProject,take:HeroTake):CopyEdit{return p.creative?.adDrafts?.[take.id]||(p.creative?.adDraft?.takeId===take.id?p.creative.adDraft.copy:{});}
export function planMatchesTake(plan:CreativePlan,take:HeroTake){return take.model==='qwen-fp8'&&take.settings.sourceKind==='original'&&plan.draft.modelPrompt===take.settings.prompt&&(plan.input.seed??42)===take.settings.seed&&plan.input.brand.id===take.settings.brandId&&plan.input.productId===take.settings.productId&&plan.input.source.id===take.settings.sourceId&&plan.input.source.sha256===take.sourceSha256&&plan.input.source.originalSha256===take.originalSha256;}
export function productSafeMatchesPlan(plan:CreativePlan,take:HeroTake){return (take.model==='product-safe'||take.model==='klein-background')&&take.settings.method==='finish'&&take.settings.sourceKind==='original'&&plan.draft.modelPrompt===take.settings.prompt&&plan.input.brand.id===take.settings.brandId&&plan.input.productId===take.settings.productId&&plan.input.source.id===take.settings.sourceId&&plan.input.source.sha256===take.sourceSha256&&plan.input.source.originalSha256===take.originalSha256;}
export function takeUsesPlan(plan:CreativePlan,take:HeroTake){return planMatchesTake(plan,take)||productSafeMatchesPlan(plan,take);}
export const sameFacts=(a:CreativeDraft['facts'],b:CreativeDraft['facts'])=>['description','count','arrangement','texture','container'].every(k=>a[k as keyof typeof a]===b[k as keyof typeof b]);
export function directionCurrent(p:AdProject,plan:CreativePlan,brand?:BrandProfile,ignoreFacts=false){const d=draftFor(p),i=plan.input,r=p.creative?.refinement;return !(r?.planId===plan.id&&r.text!==(i.request||''))&&p.creative?.activeId===plan.id&&p.id===plan.projectId&&brand?.id===i.brand.id&&brand.updated===i.brand.updated&&creativeSnapshot({...i,brand})===creativeSnapshot(i)&&d.sourceId===i.source.id&&d.productId===i.productId&&d.productType===i.productType&&(d.request||'')===(i.request||'')&&(d.intent||'campaign')===(i.intent||'campaign')&&(d.format||'feed')===(i.format||'feed')&&(d.seed??42)===(i.seed??42)&&(d.notes||'')===(i.notes||'')&&creativeSnapshot({...i,constraints:d.constraints})===creativeSnapshot(i)&&(ignoreFacts||sameFacts(d.facts,i.facts));}
export const blobHash=async(b:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function previewBlob(store:Pick<WorkspaceStore,'asset'>,id:string,expected?:string,raw=false){const asset=await store.asset(id);if(!asset)throw Error('The saved image is missing. Your history is still here.');const blob=raw?asset.original:asset.normalized;if(expected&&await blobHash(blob)!==expected)throw Error('The saved image failed its checksum.');return blob;}
export function draftFor(p:AdProject):CreativeDraft {
 if(p.creative?.draft)return structuredClone(p.creative.draft);
 const prior=p.hero?.settings.briefDraft?.input;
 const sourceId=prior?.source.kind==='original'?prior.source.id:p.hero?.settings.originalId||p.assetId||(p.hero?.settings.sourceKind==='original'?p.hero.settings.sourceId:'')||'';
 return {sourceId,facts:prior?.source.id===sourceId?structuredClone(prior.facts):{description:'',arrangement:'',texture:'',container:'',confirmed:false},productType:prior?.source.id===sourceId?prior.productType:'other',request:'',intent:'campaign',format:'feed'};
}
function gateWarning(warning:string|undefined,identityVerify?:{verdict?:string},framingQuality?:{verdict?:string}){
 let w=warning||'';
 if(identityVerify?.verdict==='FAIL')w=(w?w+' ':'')+'Identity geometry gate FAIL — product proportions diverge from the reference. Not publishable until corrected.';
 if(framingQuality?.verdict==='FAIL')w=(w?w+' ':'')+'Framing/composition gate FAIL — clipped, undersized, or disconnected product staging. Typography/fonts cannot repair this; regenerate an integrated photograph.';
 return w;
}
export type Readiness=GenerationReadiness;
export type WebsiteImage={image:string;requestedUrl:string;sourceUrl:string;contentType:string;sha256:string;association?:{key:string;sourceId:string;pageUrl:string;pageSha256:string;researchPageSha256:string;method:string}};
export type AppClient=Pick<typeof OSH,'upload'|'staticAd'|'shot'|'exportVideo'|'audio'> & {creativeStatus?:typeof OSH.creativeStatus;inspectScene?:typeof OSH.inspectScene;reviewSceneFraming?:typeof OSH.reviewSceneFraming;exportReviewedScene?:typeof OSH.exportReviewedScene;adBackground?:typeof OSH.adBackground;adScene?:typeof OSH.adScene;adCampaign?:typeof OSH.adCampaign;cancelBackground?:typeof OSH.cancelBackground;capabilities:()=>Promise<Readiness>;research:(website:string)=>Promise<Parameters<typeof applyResearch>[1]>;analyze?:(key:string)=>Promise<Parameters<typeof applyResearch>[1]>;image?:(body:{url:string;productKey:string;research:NonNullable<BrandProfile['research']>})=>Promise<WebsiteImage>};
export const appClient:AppClient={...OSH,capabilities:async()=>{const r=await fetch('/api/hero/capabilities',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('The local generation service could not be reached.');const data=await r.json() as Readiness;return {...data,zimage:data.zimage||{available:!!data.reimagine,reason:data.reimagine?'Local Z-Image Turbo graph is available.':'Z-Image Turbo is not available on this ComfyUI (weights or graph nodes missing).'}};},research:async website=>{const r=await fetch('/api/brand/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({website,analyze:false,deferAnalysis:true})});const b=await r.json();if(!r.ok)throw Error(b.error||'Website research failed.');return b;},analyze:async key=>{const r=await fetch('/api/brand/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key}),signal:AbortSignal.timeout(240000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Optional brand analysis failed. Website products are still available.');return data;},image:async body=>{const r=await fetch('/api/brand/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Website photograph could not be imported. Upload a photograph instead.');return data;}};
export class AdApplication {
 private websiteRevision=0;
 private discoveryTail:Promise<unknown>=Promise.resolve();
 private discoveries=new Map<string,{id:string;url:string;state:'loading'|'failed'|'ready';error?:string;promise?:Promise<BrandProfile|undefined>}>();
 private websiteImages=new Map<string,{time:number;value:Promise<WebsiteImage>}>();
 constructor(readonly store:WorkspaceStore,readonly creative=new CreativeStudioService(store.projects),readonly client:AppClient=appClient,private encode=blobDataURL){}
 private async rememberReference(p:AdProject){const d=draftFor(p),asset=d.sourceId?await this.store.asset(d.sourceId):undefined;if(asset){p.creative??={version:1,plans:[]};p.creative.references??={};const sha256=await blobHash(asset.normalized),prior=p.hero?.settings.briefDraft?.input,expected=p.creative.references[d.sourceId]?.sha256||(prior?.source.id===d.sourceId?prior.source.sha256:undefined);if(expected&&expected!==sha256)return;p.creative.references[d.sourceId]={sha256,facts:structuredClone(d.facts),productType:d.productType};}}
 private requireWebsiteContext(){if(websiteSwitchPending(this.store.active(),this.store.getSnapshot().brands))throw Error('Discover this website first, return to the saved website, or use + New for a manual advertisement.');}
 websiteDiscovery(projectId:string){return this.discoveries.get(projectId);}
 async newAdvertisement(){if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');this.websiteRevision++;this.discoveries.delete(this.store.active().id);const p=await this.store.createProject('Untitled advertisement',p=>{p.creative={version:1,plans:[],step:'product',websiteDraft:'',onboarding:{name:'',website:''},draft:emptyProductDraft()};});this.store.clearError();return p;}
 async measureSourceColors(){this.requireWebsiteContext();return this.store.run('Reading local photograph colors',async()=>{const p=this.store.active(),id=draftFor(p).sourceId,a=await this.store.asset(id);if(!a)throw Error('Select a saved photograph.');a.palette=await rasterPalette(a.normalized);await this.store.projects.save(p,a);});}
 private async savePhoto(asset:ProductAsset){this.requireWebsiteContext();const p=this.store.active();await this.rememberReference(p);p.assetId=asset.id;p.creative??={version:1,plans:[]};p.creative.activeId=undefined;p.creative.step='product';p.creative.draft={...draftFor(p),sourceId:asset.id,productId:undefined,productType:'other',facts:{description:'',arrangement:'',texture:'',container:'',confirmed:false}};p.creative.references??={};p.creative.references[asset.id]={sha256:await blobHash(asset.normalized),facts:p.creative.draft.facts,productType:'other'};await this.store.projects.save(p,asset);}
 async editWebsite(website:string){const p=this.store.active();if(p.creative?.websiteDraft===website)return;this.websiteRevision++;this.discoveries.delete(p.id);this.store.clearError();return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.websiteDraft=website.slice(0,2048);});}
 async discoverWebsite(website:string):Promise<BrandProfile|undefined>{
  if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');const origin=this.store.active(),raw=origin.creative?.websiteDraft,revision=this.websiteRevision;await this.store.flush();
  if(this.websiteRevision!==revision||this.store.getSnapshot().activeId!==origin.id||this.store.active().creative?.websiteDraft!==raw||this.store.getSnapshot().busy)return;
  const old=this.discoveries.get(origin.id);if(old?.state==='loading'&&websiteKey(old.url)===websiteKey(website)&&old.promise)return old.promise;
  const request={id:crypto.randomUUID(),url:website,state:'loading' as 'loading'|'failed'|'ready',error:undefined as string|undefined,promise:undefined as Promise<BrandProfile|undefined>|undefined};this.discoveries.set(origin.id,request);this.store.clearError();
  let applying=false;const current=()=>this.websiteRevision===revision&&this.store.getSnapshot().activeId===origin.id&&this.discoveries.get(origin.id)?.id===request.id&&(applying||this.store.active().creative?.websiteDraft===raw);
  const task=this.discoveryTail.catch(()=>{}).then(async()=>{
   if(!current())return;
   try{
    const research=await this.client.research(website);if(!current())return;
    const target=await this.store.run('Saving discovered brand and products',async()=>{
     if(!current())return;applying=true;
     const existing=this.store.active(),matches=this.store.getSnapshot().brands.filter(b=>matchesWebsite(b,research)),direct=matches.filter(b=>websiteKey(b.website)===websiteKey(research.website)),candidates=direct.length?direct:matches,known=candidates.find(b=>b.id===existing.brandId)||(candidates.length===1?candidates[0]:undefined),brand=applyResearch(known?structuredClone(known):newBrand(),research);const changed=!known||JSON.stringify({dna:known.dna,colors:known.colors,palette:known.palette,products:known.products.map(p=>[p.id,p.name,p.description,p.sellingPoints])})!==JSON.stringify({dna:brand.dna,colors:brand.colors,palette:brand.palette,products:brand.products.filter(p=>known.products.some(x=>x.id===p.id)).map(p=>[p.id,p.name,p.description,p.sellingPoints])});brand.updated=changed?Math.max(Date.now(),(known?.updated||0)+1):known!.updated;if(!changed&&known?.reviewedAt)brand.reviewedAt=known.reviewedAt;
     const visited=known?this.store.getSnapshot().projects.filter(p=>p.brandId===known.id&&!p.creative?.onboarding).sort((a,b)=>b.updated-a.updated)[0]:undefined;
     const hasWork=!!(existing.assetId||existing.brandId||existing.creative?.plans.length||existing.hero?.takes.length||existing.takes.length||existing.staticAds?.exports.length||existing.composition.shots.length),fresh=!existing.brandId&&!existing.creative?.plans.length&&!existing.hero?.takes.length&&!existing.takes.length&&!existing.staticAds?.exports.length,p=existing.brandId===brand.id||fresh?existing:visited|| (hasWork?newProject((brand.dna.name||'Website products').slice(0,60)):existing);
     p.brandId=brand.id;p.creative??={version:1,plans:[]};p.creative.websiteDraft=research.website;if(!known){p.creative.step='product';p.creative.activeId=undefined;}delete p.creative.onboarding;
     const writes=await Promise.allSettled([this.store.projects.saveBrand(brand),this.store.projects.save(p)]);for(const w of writes)if(w.status==='rejected')throw w.reason;
     // A's actual draft/plan/assets remain intact. A pending B URL moves to B's
     // new project so reopening A returns its last successful website.
     const previous=savedBrand(existing,this.store.getSnapshot().brands);
     if(p.id!==existing.id&&previous?.website&&raw!==undefined&&websiteKey(raw)===websiteKey(website)){existing.creative!.websiteDraft=previous.website;await this.store.projects.save(existing);}
     request.state='ready';return {id:p.id,brand};
    });
    if(!target)return;
    // All source/brand writes have completed; no network result may steal a
    // project selected while that network request was pending.
    if(this.store.getSnapshot().activeId!==origin.id||this.discoveries.get(origin.id)?.id!==request.id)return;
    if(this.store.active().id!==target.id)await this.store.switchProject(target.id);
    if(target.brand.research?.analysisState==='pending'&&target.brand.research.analysisKey&&this.client.analyze)void this.analyzeBrand(target.brand.id,target.brand.research.analysisKey).catch(()=>{});
    this.store.notify(target.brand.products.length?'Choose a product photograph. Website copy is evidence, not a visual inspection or permission to use its images.':'No reliably linked products were found. Add an authorized photograph manually; accessible brand evidence is saved.');return target.brand;
   }catch(error){if(!current())return;request.state='failed';request.error='Could not discover '+(()=>{try{return new URL(website.includes('://')?website:'https://'+website).host;}catch{return 'the entered website';}})()+': '+(error instanceof Error?error.message:String(error));this.store.report(Error(request.error));throw Error(request.error);}
  });request.promise=task.finally(()=>{if(request.state==='loading'&&this.discoveries.get(origin.id)?.id===request.id){this.discoveries.delete(origin.id);this.store.notify(this.store.getSnapshot().notice);}});this.discoveryTail=request.promise.catch(()=>{});return request.promise;
 }
 private analyses=new Map<string,{key:string;promise:Promise<void>}>();
 analysisPending(brandId:string){return this.analyses.has(brandId);}
 async waitForAnalysis(brandId:string){await this.analyses.get(brandId)?.promise;}
 async resumeBrandAnalysis(brandId:string){const b=this.store.getSnapshot().brands.find(b=>b.id===brandId);if(b?.research?.analysisState==='pending'&&b.research.analysisKey&&this.client.analyze)return this.analyzeBrand(brandId,b.research.analysisKey);}
 private analyzeBrand(brandId:string,key:string){
  const priorJob=this.analyses.get(brandId);if(priorJob?.key===key)return priorJob.promise;
  const work=(async()=>{try{const result=validateResearch(await this.client.analyze!(key)),latest=this.store.getSnapshot().brands.find(b=>b.id===brandId);if(!latest?.research||latest.research.analysisKey!==key||result.analysisKey!==key||result.analysisFingerprint!==latest.research.analysisFingerprint)return;
   // Read the newest profile after inference, preserving customer edits/photos.
   const b=structuredClone(latest),prior=latest.research,before=JSON.stringify({dna:b.dna,colors:b.colors,palette:b.palette});b.research={...prior,provider:result.provider,observations:[...prior.observations.filter(o=>o.kind==='source'),...result.observations.filter(o=>o.kind==='inference')],aiCompleted:result.aiCompleted,analysisState:result.analysisState,analysisRaw:result.analysisRaw,analysisMs:result.analysisMs,warnings:[...new Set([...prior.warnings,...result.warnings])]};
   for(const field of brandFields){const o=result.observations.find(o=>o.kind==='inference'&&o.field===field);if(o&&!b.overrides.includes(field)&&!b.approvedFields?.includes(field)&&!prior.observations.some(x=>x.kind==='source'&&x.field===field))b.dna[field]=o.value;}

   if(before!==JSON.stringify({dna:b.dna,colors:b.colors,palette:b.palette}))b.updated=Math.max(Date.now(),b.updated+1);await this.store.projects.saveBrand(b);
  }catch(e){const b=this.store.getSnapshot().brands.find(b=>b.id===brandId);if(b?.research?.analysisKey===key&&b.research.analysisState==='pending'){b.research.analysisState='failed';b.research.warnings.push('Optional local analysis failed: '+(e instanceof Error?e.message.slice(0,500):'Unavailable response')+'. Products and customer edits remain available.');await this.store.projects.saveBrand(b).catch(error=>this.store.report(error));}}})();this.analyses.set(brandId,{key,promise:work});return work.finally(()=>{if(this.analyses.get(brandId)?.promise===work)this.analyses.delete(brandId);});
 }
 async websiteImage(productId:string,url:string){
  this.requireWebsiteContext();const projectId=this.store.active().id;const b=selectedBrand(this.store.active(),this.store.getSnapshot().brands),product=b?.products.find(p=>p.id===productId);
  if(!b?.research||!product?.discovery||!productImageChoices(b,productId).includes(url)||!this.client.image)throw Error('No uniquely associated image is available. Upload the correct original photograph instead.');
  const key=JSON.stringify([b.id,b.research.created,researchSources(b.research).find(s=>s.id===product.discovery!.sourceId)?.sha256,product.discovery.key,url]),cached=this.websiteImages.get(key);if(cached&&Date.now()-cached.time<120000){const result=await cached.value;if(this.store.active().id!==projectId||selectedBrand(this.store.active(),this.store.getSnapshot().brands)?.id!==b.id||websiteSwitchPending(this.store.active(),this.store.getSnapshot().brands))throw Error('Website selection changed; previous image result discarded.');return result;}
  const pending=(async()=>{const result=await this.client.image!({url,productKey:product.discovery!.key,research:productImageProof(b,productId,url)});
   if(!result.association||result.association.key!==product.discovery!.key||result.requestedUrl!==url||result.association.sourceId!==product.discovery!.sourceId||result.association.researchPageSha256!==researchSources(b.research!).find(s=>s.id===product.discovery!.sourceId)?.sha256||!isDataImage(result.image)||result.image.length>7.1*1024*1024)throw Error('Website image association or transport could not be verified.');return result;
  })();this.websiteImages.set(key,{time:Date.now(),value:pending});if(this.websiteImages.size>8)this.websiteImages.delete(this.websiteImages.keys().next().value!);
  try{const result=await pending;if(this.store.active().id!==projectId||selectedBrand(this.store.active(),this.store.getSnapshot().brands)?.id!==b.id||websiteSwitchPending(this.store.active(),this.store.getSnapshot().brands))throw Error('Website selection changed; previous image result discarded.');return result;}catch(error){this.websiteImages.delete(key);throw error;}

 }
 async importWebsiteProduct(productId:string,url:string,normalize=normalizeProduct){return this.store.run('Importing the selected product photograph',async()=>{
  this.requireWebsiteContext();const p=this.store.active(),b=selectedBrand(p,this.store.getSnapshot().brands),product=b?.products.find(p=>p.id===productId);if(!b||!product)throw Error('Choose a product from this saved brand.');
  let asset:ProductAsset|undefined;
  for(const item of b.assets.filter(a=>a.productId===productId&&a.sourceUrl===url)){const found=await this.store.asset(item.assetId);if(found?.provenance&&found.provenance.discoveryKey===product.discovery?.key){validateWebsiteSource(found.provenance,{originalSha256:await blobHash(found.original),sha256:await blobHash(found.normalized),brandId:b.id,productId});asset=found;break;}}
  if(!asset){const result=await this.websiteImage(productId,url),blob=await(await fetch(result.image)).blob();if(await blobHash(blob)!==result.sha256)throw Error('Downloaded original checksum failed. No source selected.');
   const file=new File([blob],(product.name.replace(/[^a-z0-9 -]/gi,'').slice(0,100)||'Website product')+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[result.contentType]||''),{type:result.contentType});asset=await normalize(file);
   if(await blobHash(asset.original)!==result.sha256)throw Error('Image normalization changed the downloaded original.');
   asset.provenance={kind:'website',requestedUrl:url,url:result.sourceUrl,pageUrl:result.association!.pageUrl,pageSha256:result.association!.pageSha256,researchPageSha256:result.association!.researchPageSha256,discoveryKey:product.discovery!.key,association:result.association!.method as import('../../shared/lib/source-provenance.ts').WebsiteSource['association'],brandId:b.id,productId,originalSha256:result.sha256,normalizedSha256:await blobHash(asset.normalized),contentType:result.contentType,downloadedAt:Date.now(),accuracyConfirmed:false,permissionConfirmed:false};validateWebsiteSource(asset.provenance,{originalSha256:result.sha256,sha256:await blobHash(asset.normalized),brandId:b.id,productId});
   const record={id:crypto.randomUUID(),assetId:asset.id,name:asset.name,role:'product' as const,productId,sourceUrl:url};b.assets.push(record);product.imageIds.push(record.id);b.updated=Math.max(Date.now(),b.updated+1);await this.store.projects.saveBrand(b,[asset]);
  }
  await this.rememberReference(p);const cached=p.creative?.references?.[asset.id];p.assetId=asset.id;p.creative??={version:1,plans:[]};p.creative.activeId=undefined;p.creative.step='product';p.creative.draft={sourceId:asset.id,productId,productType:cached?.productType||'other',facts:cached?{...cached.facts,confirmed:false}:{description:'',arrangement:'',texture:'',container:'',confirmed:false},intent:'campaign',format:'feed',request:'',seed:42};await this.store.projects.save(p,asset);return asset;
 });}
 async editSelectedProduct(patch:Partial<Pick<BrandProfile['products'][number],'name'|'description'>>){
  if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');const p=this.store.active(),d=draftFor(p),b=selectedBrand(p,this.store.getSnapshot().brands),product=b?.products.find(product=>product.id===d.productId);if(!b||!product)throw Error('Choose a saved product first.');
  if(patch.name!==undefined&&(typeof patch.name!=='string'||patch.name.length>200)||patch.description!==undefined&&(typeof patch.description!=='string'||patch.description.length>5000))throw Error('Shorten the product information.');
  Object.assign(product,patch);product.overrides=[...new Set([...(product.overrides||[]),...Object.keys(patch) as ('name'|'description')[]])];b.updated=Math.max(Date.now(),b.updated+1);p.creative!.activeId=undefined;p.creative!.step='product';const writes=await Promise.allSettled([this.store.projects.saveBrand(b),this.store.projects.save(p)]);for(const w of writes)if(w.status==='rejected')throw w.reason;
 }
 /** Name an owner-supplied photograph as a brand product (seasonal or unlisted items). Website products keep their listed record. */
 async nameOwnProduct(name:string){
  this.requireWebsiteContext();if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');
  const n=name.trim();if(!n)throw Error('Add a product name.');if(n.length>200)throw Error('Shorten the product name.');
  const p=this.store.active(),d=draftFor(p),b=selectedBrand(p,this.store.getSnapshot().brands);if(!b)throw Error('Add your brand name first.');
  const asset=await this.store.asset(d.sourceId);if(!asset)throw Error('Select an original photograph.');if(asset.provenance)throw Error('Website photographs keep the listed product. Correct its name in brand details.');
  let product=d.productId?b.products.find(x=>x.id===d.productId&&!x.discovery):undefined;
  if(!product){if(b.products.length>=100)throw Error('This brand already has 100 products.');product={id:crypto.randomUUID(),name:n,description:'',sellingPoints:'',imageIds:[]};b.products.push(product);}
  product.name=n;product.overrides=[...new Set([...(product.overrides||[]),'name' as const])];
  let record=b.assets.find(a=>a.assetId===asset.id);if(!record){record={id:crypto.randomUUID(),assetId:asset.id,name:asset.name,role:'product'};b.assets.push(record);}
  record.productId=product.id;if(!product.imageIds.includes(record.id))product.imageIds.push(record.id);b.updated=Math.max(Date.now(),b.updated+1);
  p.creative??={version:1,plans:[]};p.creative.draft={...d,productId:product.id};p.creative.activeId=undefined;p.creative.step='product';
  const writes=await Promise.allSettled([this.store.projects.saveBrand(b),this.store.projects.save(p)]);for(const w of writes)if(w.status==='rejected')throw w.reason;
  return product;
 }
 async confirmWebsiteSource(accuracy:boolean,permission:boolean,expected?:{projectId:string;sourceId:string}){this.requireWebsiteContext();return this.store.run('Saving photograph confirmation',async()=>{
  const p=this.store.active(),d=draftFor(p);if(expected&&(expected.projectId!==p.id||expected.sourceId!==d.sourceId))throw Error('Selected photograph changed. Confirm the current source instead.');const asset=await this.store.asset(d.sourceId),b=selectedBrand(p,this.store.getSnapshot().brands);if(!asset?.provenance||!b)throw Error('Choose a website product photograph first.');
  validateWebsiteSource(asset.provenance,{originalSha256:await blobHash(asset.original),sha256:await blobHash(asset.normalized),brandId:b.id,productId:d.productId});
  asset.provenance={...asset.provenance,accuracyConfirmed:accuracy,permissionConfirmed:permission,...(accuracy&&permission?{confirmedAt:Date.now()}:{confirmedAt:undefined})};
  p.creative!.draft={...d,facts:{...d.facts,confirmed:false}};if(accuracy&&!d.facts.description.trim())p.creative!.draft.facts.description='Photograph of '+(b.products.find(p=>p.id===d.productId)?.name||'the selected product')+'.';
  p.creative!.activeId=undefined;p.creative!.step='product';await this.store.projects.save(p,asset);
 });}
 private async checkSourceUse(sourceId:string,brandId?:string,productId?:string){const a=await this.store.asset(sourceId);if(a?.provenance)validateWebsiteSource(a.provenance,{originalSha256:await blobHash(a.original),sha256:await blobHash(a.normalized),brandId,productId},true);return a;}
 async addPhoto(asset:ProductAsset){return this.store.run('Saving your original photograph',()=>this.savePhoto(asset));}
 async importPhoto(file:File,normalize=normalizeProduct){return this.store.run('Preparing your original photograph',async()=>this.savePhoto(await normalize(file)));}
 async editDraft(patch:Partial<CreativeDraft>){this.requireWebsiteContext();if(JSON.stringify({...draftFor(this.store.active()),...patch})===JSON.stringify(draftFor(this.store.active())))return;return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.draft={...draftFor(p),...patch};p.creative.activeId=undefined;p.creative.step='product';});}
 /** Merge one field into the stored facts; concurrent field edits never overwrite each other. */
 async patchFacts(patch:Partial<CreativeDraft['facts']>){this.requireWebsiteContext();return this.store.edit(p=>{p.creative??={version:1,plans:[]};const d=draftFor(p);p.creative.draft={...d,facts:{...d.facts,...patch,confirmed:false}};});}
 async editFacts(facts:CreativeDraft['facts']){this.requireWebsiteContext();return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.draft={...draftFor(p),facts:{...facts,confirmed:false}};});}
 async editRefinement(planId:string,text:string){this.requireWebsiteContext();return this.store.edit(p=>{if(p.creative?.activeId!==planId)throw Error('Open the current direction before refining it.');p.creative.refinement={planId,text};});}
 async refine(planId:string,text:string){this.requireWebsiteContext();return this.store.run('Developing your refinement',async()=>{const p=this.store.active();if(p.creative?.activeId!==planId)throw Error('Open the current direction before refining it.');
  // Prefer concrete composition-dynamics updates (diagonal, closer, depth, negative space, energy, brand feel).
  try{const next=await this.creative.refineComposition(p.id,planId,text);const current=this.store.active();delete current.creative!.refinement;await this.store.projects.save(current);return next;}catch(error){
   if(!/did not map to a concrete composition change|Refinement did not map/i.test(String((error as Error).message||error)))throw error;
  }
  const d={...draftFor(p),request:text};p.creative.draft=d;delete p.creative.refinement;p.creative.activeId=undefined;p.creative.step='product';await this.store.projects.save(p);return this.creative.plan(p.id,d.sourceId,{...d,planningMode:p.creative?.journey?.planningMode??d.planningMode??'ai'});});}
 async editCopy(takeId:string,patch:CopyEdit){return this.store.edit(p=>{const take=p.hero!.takes.find(t=>t.id===takeId);if(!take)throw Error('Choose a saved photograph.');p.creative??={version:1,plans:[]};p.creative.adDrafts??={};const prev=copyFor(p,take);const copy:CopyEdit={...prev,...patch};if(patch.graphic||prev.graphic)copy.graphic={...prev.graphic,...patch.graphic};p.creative.adDrafts[takeId]=copy;p.creative.adDraft={takeId,copy};});}
 async navigate(step:'product'|'direction'|'result'){await this.store.flush();return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.step=step;});}
 async selectTake(id:string){this.requireWebsiteContext();return this.store.edit(p=>{if(!p.hero!.takes.some(t=>t.id===id))throw Error('Saved photograph is missing.');p.hero!.activeId=id;p.creative??={version:1,plans:[]};p.creative.step='result';});}
 async editOnboarding(patch:Partial<{name:string;website:string}>){this.websiteRevision++;this.discoveries.delete(this.store.active().id);return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.onboarding={name:'',website:'',...p.creative.onboarding,...patch};p.creative.websiteDraft=p.creative.onboarding.website;p.creative.activeId=undefined;p.creative.step='product';p.brandId=undefined;});}
 async selectSource(sourceId:string){this.requireWebsiteContext();if(draftFor(this.store.active()).sourceId===sourceId)return;return this.store.run('Opening original photograph',async()=>{const p=this.store.active(),b=selectedBrand(p,this.store.getSnapshot().brands),allowed=[p.assetId,p.hero?.settings.originalId,p.hero?.settings.briefDraft?.input.source.id,...Object.keys(p.creative?.references||{}),...(p.creative?.plans.map(e=>e.sourceId)||[]),...(b?.assets.filter(a=>a.role==='product').map(a=>a.assetId)||[])];if(!allowed.includes(sourceId)||p.hero?.takes.some(t=>t.assetId===sourceId))throw Error('Choose a saved original product photograph.');const asset=await this.store.asset(sourceId);if(!asset)throw Error('The saved original is missing. Previous records were kept.');if(asset.provenance&&asset.provenance.brandId!==b?.id)throw Error('This website photograph belongs to another brand. Switch to its brand or select a matching photograph.');await this.rememberReference(p);const sha=await blobHash(asset.normalized),cached=p.creative?.references?.[sourceId],prior=p.hero?.settings.briefDraft?.input;let known:Pick<CreativeDraft,'facts'|'productType'>|undefined=cached?.sha256===sha?cached:prior?.source.id===sourceId&&prior.source.sha256===sha?prior:undefined;if(!known){const entry=p.creative?.plans.slice().reverse().find(e=>e.sourceId===sourceId);if(entry)try{const saved=await this.creative.open(p.id,entry.id);if(saved.input.source.sha256===sha)known=saved.input;}catch{this.store.notify('The original is available, but its prior brief could not be opened. Existing records are kept.');}}p.creative??={version:1,plans:[]};p.creative.draft={...draftFor(p),sourceId,productId:asset.provenance?asset.provenance.productId:b?.assets.find(a=>a.assetId===sourceId&&a.productId)?.productId,productType:known?.productType||'other',facts:known?{...known.facts,confirmed:false}:{description:'',arrangement:'',texture:'',container:'',confirmed:false}};p.creative.activeId=undefined;p.creative.step='product';await this.store.projects.save(p);});}
 async openWebsite(id:string){
  const b=this.store.getSnapshot().brands.find(b=>b.id===id);if(!b)throw Error('Select a saved website.');if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');this.websiteRevision++;this.discoveries.delete(this.store.active().id);await this.store.flush();
  const current=this.store.active(),target=this.store.getSnapshot().projects.filter(p=>p.brandId===id&&!p.creative?.onboarding).sort((a,b)=>Number(b.id===current.id)-Number(a.id===current.id)||b.updated-a.updated)[0];
  if(current.creative&&websiteSwitchPending(current,this.store.getSnapshot().brands)){const old=savedBrand(current,this.store.getSnapshot().brands);if(old){current.creative.websiteDraft=old.website;await this.store.projects.save(current);}}
  if(target){if(target.creative?.websiteDraft!==b.website){target.creative??={version:1,plans:[]};target.creative.websiteDraft=b.website;await this.store.projects.save(target);}await this.store.switchProject(target.id);}else await this.store.createProject(b.dna.name||'Website advertisement',p=>{p.brandId=id;p.creative={version:1,plans:[],step:'product',websiteDraft:b.website,draft:emptyProductDraft()};});this.store.clearError();
 }
 /** Attach a saved website to the fresh active campaign instead of reopening an older one. */
 async adoptWebsite(id:string){const b=this.store.getSnapshot().brands.find(b=>b.id===id);if(!b)throw Error('Select a saved website.');this.websiteRevision++;this.discoveries.delete(this.store.active().id);await this.store.edit(p=>{p.brandId=id;p.creative??={version:1,plans:[]};delete p.creative.onboarding;p.creative.websiteDraft=b.website;p.creative.step='product';});this.store.clearError();}
 async useBrand(id:string){return this.openWebsite(id);}
 async saveBrand(brand:BrandProfile,assets:ProductAsset[]=[]){this.requireWebsiteContext();return this.store.run('Saving your brand',async()=>{await this.store.projects.saveBrand({...brand,updated:Math.max(Date.now(),(this.store.getSnapshot().brands.find(b=>b.id===brand.id)?.updated||0)+1)},assets);const p=this.store.active();p.brandId=brand.id;p.creative??={version:1,plans:[]};delete p.creative.onboarding;p.creative.activeId=undefined;p.creative.step='product';await this.store.projects.save(p);});}
 private async registerBrand(name:string,website='',profile?:BrandProfile,assets:ProductAsset[]=[]){const b=profile?structuredClone(profile):newBrand(name.trim());b.dna.name=name.trim();if(!b.dna.name)throw Error('Add your brand name.');b.overrides=[...new Set([...b.overrides,'name'])];const p=this.store.active();p.brandId=b.id;p.creative??={version:1,plans:[]};p.creative.websiteDraft=b.website;delete p.creative.onboarding;p.creative.activeId=undefined;p.creative.step='product';const writes=await Promise.allSettled([this.store.projects.saveBrand(b,assets),this.store.projects.save(p)]);for(const write of writes)if(write.status==='rejected')throw write.reason;if(website){try{applyResearch(b,await this.client.research(website));}catch(e){this.store.report(e);}await this.store.projects.saveBrand(b);p.creative!.websiteDraft=b.website;await this.store.projects.save(p);}return b;}
 async createBrand(name:string,website='',profile?:BrandProfile,assets:ProductAsset[]=[]){this.requireWebsiteContext();return this.store.run(website?'Researching your website':'Saving your brand',()=>this.registerBrand(name,website,profile,assets));}
 async develop(planningMode:'ai'|'basic'='ai'){this.requireWebsiteContext();if(this.discoveries.get(this.store.active().id)?.state==='loading')throw Error('Wait for website discovery to finish.');return this.store.run('Developing your advertisement',async()=>{let p=this.store.active();const d=draftFor(p),asset=await this.store.asset(d.sourceId),brand=selectedBrand(p,this.store.getSnapshot().brands),reason=developBlockReason({sourceId:d.sourceId,sourceReady:!!asset,brandName:brand?.dna.name||p.creative?.onboarding?.name||'',description:d.facts.description,provenance:asset?.provenance,productName:d.productId?brand?.products.find(product=>product.id===d.productId)?.name:undefined});if(reason)throw Error(reason);if(brand&&!brand.dna.name.trim())throw Error('Add the business name using Correct brand details. No name was invented.');if(d.productId&&brand?.products.find(product=>product.id===d.productId)?.name.trim()==='')throw Error('Add the selected product name before developing a direction.');await this.checkSourceUse(d.sourceId,brand?.id,d.productId);if(!brand){await this.registerBrand(p.creative?.onboarding?.name||'',p.creative?.onboarding?.website.trim()||'');p=this.store.active();}else if(p.brandId!==brand.id){p.brandId=brand.id;await this.store.projects.save(p);}return this.creative.plan(p.id,d.sourceId,{...d,planningMode});});}
 async openPreparedCampaign(planId:string){return this.store.run('Opening your proposed campaign',async()=>{const plan=await this.creative.attachPlan(this.store.active().id,planId);this.store.notify('Campaign saved for your review. No acceptance or generation was performed.');return plan;});}
 async choose(planId:string,conceptId:string){this.requireWebsiteContext();return this.store.run('Saving your chosen direction',async()=>{const old=this.store.active().creative?.refinement,plan=await this.creative.choose(this.store.active().id,planId,conceptId);if(old?.planId===planId){const p=this.store.active();p.creative!.refinement={...old,planId:plan.id};await this.store.projects.save(p);}return plan;});}
 async approve(planId:string,factsConfirmed:boolean){this.requireWebsiteContext();return this.store.run('Saving your reviewed direction',async()=>{const p=this.store.active(),plan=await this.creative.open(p.id,planId),brand=this.store.getSnapshot().brands.find(b=>b.id===p.brandId);if(!directionCurrent(p,plan,brand,true))throw Error('Product, brand or direction changed. Develop and review the current direction.');if(!factsConfirmed)throw Error('An owner must confirm the photo facts and direction.');await this.checkSourceUse(plan.input.source.id,brand?.id,plan.input.productId);const current=sameFacts(draftFor(p).facts,plan.input.facts)?plan:await this.creative.choose(p.id,planId,plan.selectedId,draftFor(p).facts);return this.creative.approve(p.id,current.id,{direction:true,facts:true});});}
 async generate(planId:string,engine:GenerationEngineId='automatic'){this.requireWebsiteContext();return this.store.run('Generating your advertisement',async()=>{
  if(this.store.active().hero!.takes.length>=80)throw Error('This project has 80 saved photographs. Start a new project; previous images are retained.');
  let p=this.store.active();if(p.attempt?.status==='running'||p.attempt?.status==='interrupted')throw Error('Check the interrupted job and saved history before submitting another generation.');const plan=await this.creative.open(p.id,planId);if(!directionCurrent(p,plan,this.store.getSnapshot().brands.find(b=>b.id===p.brandId)))throw Error('This direction changed. Accept the current direction and facts before generation.');await this.request();
  let ready:Readiness;try{ready=await this.client.capabilities();}catch{if(engine!=='product-safe'&&engine!=='automatic')throw Error('The local generation service could not be reached. Choose Product-safe design, which works without ComfyUI.');ready={finish:true,qwen:{available:false,reason:'Local generation service unreachable'},reimagine:false};}
  // Digital/service: Product-safe layout. Physical products: prefer Klein generative paths when ready.
  // Missing advertising strategy still blocks expensive spend (product-safe only).
  const exec=campaignExecutionStrategy(plan);
  const forceLayout=exec==='product-safe'&&(engine==='automatic'||engine==='klein');
  const selected=resolveGenerationEngine(forceLayout?'product-safe':engine==='automatic'&&needsAdvertisingStrategy(plan)?'product-safe':engine,ready);
  const fluxBlock=isFluxEngine(selected.id)?fluxRestageBlock(plan):'';
  if(fluxBlock)throw Object.assign(Error(fluxBlock+' No generation was submitted.'),{code:'NOT_SUBMITTED'});
  if(selected.id!=='product-safe')assertAdvertisingGeneration(plan,(selected.id==='klein'&&ready.klein?.firstRunAvailable===true)||(selected.id==='flux3'&&!!ready.flux3?.available)||(selected.id==='flux3-cloud'&&!!ready.flux3Cloud?.available));
  p.attempt={id:crypto.randomUUID(),status:'running',created:Date.now(),takeIds:[],engine:selected.id};await this.store.projects.save(p);
  const previous=new Set(p.hero!.takes.map(t=>t.id));try{
   const take=selected.id==='klein'||selected.id==='flux3'||selected.id==='flux3-cloud'?await this.generateScene(planId,plan,p.attempt!.id,selected.id):selected.id==='product-safe'?await this.generateProductSafe(planId,plan,selected.reason):await this.creative.generate(p.id,planId,selected.id==='zimage'?'zimage':'qwen');
   p=this.store.active();p.attempt!.status='complete';p.attempt!.takeIds=[take.id];await this.store.projects.save(p);return take;
  }catch(e){p=this.store.active();const delivered=p.hero!.takes.filter(t=>!previous.has(t.id));p.attempt!.status=delivered.length?'complete':(selected.id==='klein'||selected.id==='flux3'||selected.id==='flux3-cloud')?'failed':'interrupted';p.attempt!.takeIds=delivered.map(t=>t.id);p.attempt!.error=delivered.length?'The result is in this tab. Retry saving; do not regenerate.':'The submission could not be confirmed. Check saved history and the runtime job before any new generation. '+(e instanceof Error?e.message:String(e));await this.store.projects.save(p).catch(()=>{});throw e;}
 });}
 async selectEngine(engine:GenerationEngineId){if(!['automatic','product-safe','klein','flux3','flux3-cloud','qwen','zimage'].includes(engine))throw Error('Unknown generation engine.');return this.store.edit(p=>{p.creative??={version:1,plans:[]};p.creative.generationEngine=engine;});}
 async cancelGeneration(){const p=this.store.active();if(p.attempt?.status!=='running'||(p.attempt.engine!=='klein'&&p.attempt.engine!=='flux3'&&p.attempt.engine!=='flux3-cloud')||!this.client.cancelBackground)throw Error('No cancellable local background job.');return this.client.cancelBackground(p.attempt.id.replaceAll('-',''),p.id);}
 private async generateScene(planId:string,plan:CreativePlan,requestId:string,engineId:'klein'|'flux3'|'flux3-cloud'='klein'){
  const started=Date.now(),p=this.store.active(),entry=p.creative?.plans.find(e=>e.id===planId),source=await this.store.asset(plan.input.source.id);
  if(!entry?.preparedId||!source)throw Error('Review the creative direction first. Product-safe remains available.');
  await this.checkSourceUse(source.id,plan.input.brand.id,plan.input.productId);
  if(await blobHash(source.original)!==plan.input.source.originalSha256||await blobHash(source.normalized)!==plan.input.source.sha256)throw Error('Restore the exact reviewed original.');
  const fluxScene=engineId==='flux3'||engineId==='flux3-cloud',fluxBlock=fluxScene?fluxRestageBlock(plan):'';
  if(fluxBlock)throw Error(fluxBlock+' No generation was submitted.');
  const execution=fluxScene?'creative-restage':campaignExecutionStrategy(plan);
  const image=await this.client.upload(await this.encode(source.normalized));
  const req={requestId:requestId.replaceAll('-',''),projectId:p.id,planId,preparedId:entry.preparedId,image:image.url,current:(await this.creative.context(p,source.id,plan.input)).input};
  let scene:import('../../shared/lib/ad-scene.ts').AdScene;
  let method:HeroTake['method'];
  if(fluxScene){
   if(!this.client.adScene)throw Error('FLUX 3 Creative Restage is unavailable. Choose Product-safe. No generation was submitted.');
   // Explicit FLUX 3 / Comfy Cloud only — never silent Klein. Refs are this project's uploaded source (+ optional identity).
   scene=await this.client.adScene({...req,engine:engineId,promptSha256:await blobHash(new Blob([flux3ScenePrompt(plan)]))});
   method='creative-restage';
  }else if(execution==='creative-restage'){
   if(!this.client.adScene)throw Error('Creative Restage is unavailable locally. Choose Product-locked Klein, Product-safe, or lower creativity. No generation was submitted.');
   // Klein Creative Restage only — never auto-route to FLUX 3.
   scene=await this.client.adScene({...req,engine:'klein',promptSha256:await blobHash(new Blob([adScenePrompt(plan)]))});
   method='creative-restage';
  }else{
   if(!this.client.adCampaign)throw Error('The local product-locked campaign adapter is unavailable. Product-safe remains available.');
   // Product-locked generative: BiRefNet isolate + Klein AI empty set + composite (not a deterministic poster).
   scene=await this.client.adCampaign({...req,promptSha256:await blobHash(new Blob([adCampaignPrompt(plan)]))});
   method='product-locked';
  }
  if(scene.sourceSha256!==plan.input.source.sha256)throw Error('The delivered campaign does not match this reviewed source.');
  const fidelity=productFidelityReport(scene);
  if(method==='product-locked'&&!fidelity.productLocked)throw Error(fidelity.reason+' Product-safe remains available.');
  if(method==='creative-restage'&&fidelity.productLocked){/* unexpected but acceptable */}
  const label=method==='creative-restage'?'Creative Restage.png':'Product-locked campaign.png';
  const raw=await this.outputAsset(scene.url,scene.sha256,label,scene.width,scene.height);await this.store.projects.save(p,raw);
  const archetype=scene.archetype||sceneDirection(plan).archetype;
  const dynamics=plan.dynamics||buildCompositionPlan(plan);
  let inspection:Partial<import('../../shared/lib/ad-scene.ts').AdScene>=scene;
  if(!scene.inspection&&this.client.inspectScene){try{inspection={...scene,...await this.client.inspectScene({projectId:p.id,planId,preparedId:entry.preparedId!,current:plan.input,image:image.url,output:scene.url})};}catch(error){inspection={...scene,inspectionError:String((error as Error).message)};}}
  const identity=inspection.identityProfile,identityVerify=inspection.identityVerify,framingQuality=inspection.framingQuality;
  const spatial=dynamicsToFlux3Spatial(dynamics,{environment:sceneDirection(plan).concept.environment,identity});
  const design=withGraphicGeometry(campaignDesign(plan.composition,archetype,raw.id,'composite',{signals:{tone:plan.input.brand.dna.tone,idea:sceneDirection(plan).concept.idea,title:sceneDirection(plan).concept.title}}),spatial.elements),settings=structuredClone(p.hero!.settings);
  settings.method='reimagine';settings.imageModel=scene.model==='editorial-original'?undefined:scene.model;
  const fidelityMode=scene.fidelityMode||(method==='creative-restage'?'creative-restage':fidelity.mode==='unknown'?'product-fidelity':fidelity.mode);
  let warning=method==='creative-restage'
   ?(scene.warning||'Creative Restage · AI re-photographs the product. Packaging, labels and geometry may change. Compare with the original; not product-locked.')
   :(scene.warning||fidelity.reason);
  warning=gateWarning(warning,identityVerify,framingQuality);
  const take:HeroTake={id:crypto.randomUUID(),assetId:raw.id,url:scene.url,created:Date.now(),settings,sourceSha256:plan.input.source.sha256,originalSha256:plan.input.source.originalSha256,sha256:scene.sha256,method,model:scene.model,scene:{...scene,...inspection,assetId:raw.id,fidelityMode,warning,...(identityVerify?{identityVerify}:{}),...(framingQuality?{framingQuality}:{}),...(identity?{identityProfile:identity}:{})},adDesign:design,seconds:(Date.now()-started)/1000,jobId:scene.jobId,provenanceId:scene.provenanceId,workflowSha256:scene.workflowSha256};
  p.hero!.takes.push(take);p.hero!.activeId=take.id;p.hero!.approvedId=undefined;p.creative!.step='result';
  p.creative!.adDrafts??={};p.creative!.adDrafts[take.id]={headline:design.headline,body:design.body,cta:design.cta,size:design.size};
  await this.store.projects.save(p);
  if(sceneQualityBlocks(take.scene).length){this.store.notify('Raw model result saved; product checks require correction before export.');return take;}
  await this.composeSceneTake(take,{});const current=this.store.active(),saved=current.hero!.takes.find(t=>t.id===take.id)!;saved.seconds=(Date.now()-started)/1000;await this.store.projects.save(current);return saved;
 }
 private async generateWithBackground(planId:string,plan:CreativePlan,requestId:string){
  const p=this.store.active(),entry=p.creative?.plans.find(e=>e.id===planId),source=await this.store.asset(plan.input.source.id);if(!entry?.preparedId||!source||!this.client.adBackground)throw Error('Local background adapter unavailable.');
  const image=await this.client.upload(await this.encode(source.normalized)),background=await this.client.adBackground({requestId:requestId.replaceAll('-',''),projectId:p.id,planId,preparedId:entry.preparedId,image:image.url,current:(await this.creative.context(p,source.id,plan.input)).input});
  const asset=await this.outputAsset(background.url,background.sha256,'Raw AI background.png',background.width,background.height);await this.store.projects.save(this.store.active(),asset);
  return this.generateProductSafe(planId,plan,'AI background with original product photograph',{...background,assetId:asset.id});
 }
 private async generateProductSafe(planId:string,plan:CreativePlan,_reason:string,background?:import('../../shared/lib/ad-background.ts').AdBackground){
  const started=Date.now(),p=this.store.active(),entry=p.creative?.plans.find(e=>e.id===planId);if(!entry?.preparedId)throw Error('Review the creative direction first.');
  const source=await this.store.asset(entry.sourceId);if(!source||p.hero!.settings.sourceId!==entry.sourceId)throw Error('Selected source changed. Review again.');
  await this.checkSourceUse(entry.sourceId,p.hero!.settings.brandId,p.hero!.settings.productId);
  const normalized=source.normalized,sourceSha=await blobHash(normalized),originalSha=await blobHash(source.original);
  if(sourceSha!==plan.input.source.sha256||originalSha!==plan.input.source.originalSha256)throw Error('Restore the exact reviewed original before generating.');
  const photo=await this.client.upload(await this.encode(normalized));if(!/^\/outputs\/[a-f0-9]{16}\.png$/.test(photo.url))throw Error('Invalid local upload URL.');
  const served=await fetch(photo.url,{cache:'no-store'});if(!served.ok)throw Error('Uploaded photograph is missing from the local runtime.');
  if(await blobHash(await served.blob())!==sourceSha)throw Error('Uploaded photograph checksum failed.');
  const brand=this.store.getSnapshot().brands.find(b=>b.id===(p.hero!.settings.brandId||p.brandId||plan.input.brand.id));if(!brand)throw Error('Choose the saved brand for this advertisement.');
  const copy={headline:plan.composition.headline,body:plan.composition.body,cta:plan.composition.cta,size:plan.composition.size},design={...campaignDesign(plan.composition,sceneDirection(plan).archetype,source.id,'editorial-original',{signals:{tone:plan.input.brand.dna.tone,idea:sceneDirection(plan).concept.idea,title:sceneDirection(plan).concept.title}}),...copy,brandReviewed:true};
  if(background){Object.assign(design,{supportId:background.assetId,supportGeneration:{model:background.model,prompt:background.prompt,seed:background.seed}});}
  const logo=design.logoId?await this.store.asset(design.logoId):undefined;if(design.logoId&&!logo)throw Error('Restore the saved original logo before generating.');
  const logoURL=logo?(await this.client.upload(await this.encode(logo.normalized))).url:undefined,r=await this.client.staticAd({design,photo:photo.url,logo:logoURL,...(background?{support:background.url}:{})});
  const composed=await this.outputAsset(r.url,r.sha256,'Product-safe advertisement.png',r.width,r.height);
  const {evaluateAdQuality}=await import('../../shared/lib/ad-quality.ts');
  const quality=evaluateAdQuality(design,{canvas:{width:r.width,height:r.height}});
  const settings=structuredClone(p.hero!.settings);settings.method='finish';delete settings.imageModel;
  const take:HeroTake={id:crypto.randomUUID(),assetId:composed.id,url:r.url,created:Date.now(),settings,sourceSha256:sourceSha,originalSha256:originalSha,sha256:r.sha256,method:background?'ai-background-original':'product-safe',model:background?'klein-background':'product-safe',adDesign:structuredClone(design),...(background?{background}:{}),seconds:(Date.now()-started)/1000+(background?.seconds||0),jobId:background?.jobId||'product-safe-'+Date.now().toString(16)};
  p.hero!.takes.push(take);p.hero!.activeId=take.id;p.hero!.approvedId=undefined;p.creative!.step='result';
  p.creative!.adDrafts??={};p.creative!.adDrafts[take.id]=copy;
  p.staticAds!.exports.push({id:crypto.randomUUID(),assetId:composed.id,created:Date.now(),url:r.url,sha256:r.sha256,sources:r.sources,design});
  if(quality.grade==='basic-draft')this.store.notify(quality.label+(quality.issues[0]?' · '+quality.issues[0]:''));
  else if(quality.grade==='usable')this.store.notify(quality.label);
  await this.store.projects.save(p,composed);return take;
 }
 async request(){this.requireWebsiteContext();await this.store.flush();const p=this.store.active();await this.checkSourceUse(p.hero!.settings.sourceId,p.hero!.settings.brandId,p.hero!.settings.productId);const s=p.hero!.settings,source=await this.store.asset(s.sourceId),brand=this.store.getSnapshot().brands.find(b=>b.id===p.brandId);if(!p.creative?.activeId||!p.creative.plans.find(e=>e.id===p.creative!.activeId)?.preparedId||!directionCurrent(p,await this.creative.open(p.id,p.creative.activeId),brand))throw Error('Accept the current direction and photo facts before exporting a request.');if(!source||await blobHash(source.normalized)!==s.briefDraft?.input.source.sha256||await blobHash(source.original)!==s.briefDraft.input.source.originalSha256)throw Error('Restore the exact reviewed original before exporting the request.');return heroRequestManifest(p,s,true,brand);}
 async exportTake(take:HeroTake,copy:CopyEdit,fidelityReviewed:boolean){return this.store.run('Composing your advertisement',()=>this.composeTake(take,copy,fidelityReviewed));}
 async exportAndDownload(take:HeroTake,copy:CopyEdit,fidelityReviewed:boolean,download:Download=browserDownload){return this.store.run('Exporting your advertisement',async()=>{const result=await this.composeTake(take,copy,fidelityReviewed),blob=await previewBlob(this.store,result.assetId,result.sha256,true);try{await download(blob,'advertisement.png');}catch{throw Error('Your advertisement is saved, but its download could not start. Download it from Saved advertisements; no new export or generation is needed.');}this.store.notify('Download requested. If your browser blocks it, the verified file is in Saved advertisements.');return result;});}
 /** Upload a short video as creative inspiration (analyzed locally; never pasted into ads). */
 async uploadInspiration(file:File,rights:'inspiration-only'|'user-owned-or-licensed'='inspiration-only'){
  return this.store.run('Reading your inspiration video',async()=>{
   const p=this.store.active();
   const type=file.type||(file.name.toLowerCase().endsWith('.mov')?'video/quicktime':file.name.toLowerCase().endsWith('.webm')?'video/webm':'video/mp4');
   if(!['video/mp4','video/webm','video/quicktime'].includes(type))throw Error('Use MP4, WebM, or MOV as inspiration.');
   if(file.size>40*1024*1024)throw Error('Keep inspiration videos under 40 MB.');
   const uploaded=await fetch('/api/reference/upload',{method:'POST',headers:{'Content-Type':type},body:file,signal:AbortSignal.timeout(120000)});
   const info=await uploaded.json();if(!uploaded.ok)throw Error(info.error||'Inspiration upload failed.');
   const analyzed=await fetch('/api/reference/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:info.url,originalUrl:info.originalUrl,bytes:info.bytes,rights}),signal:AbortSignal.timeout(180000)});
   const analysis=await analyzed.json() as ReferenceAnalysis & {error?:string};if(!analyzed.ok)throw Error(analysis.error||'Could not analyze the reference video.');
   let shotPlan:CampaignShotPlan|undefined;
   const planId=p.creative?.activeId;
   if(planId){
    try{
     const plan=await this.creative.open(p.id,planId);
     const intel=buildCreativeIntelligence(plan,analysis.creativeMechanism);
     shotPlan=planFromReference(plan,analysis,intel);
    }catch{/* analysis alone is still useful before a plan exists */}
   }
   const record:InspirationRecord={videoUrl:info.url,originalUrl:info.originalUrl,sha256:info.sha256,bytes:info.bytes,duration:info.duration,width:info.width,height:info.height,rights,audioRights:rights==='user-owned-or-licensed'?'inspiration-only':'inspiration-only',analysis,shotPlan,productReplacementAvailable:false};
   p.creative??={version:1,plans:[]};p.creative.inspiration=record;await this.store.projects.save(p);
   this.store.notify(shotPlan?'Inspiration analyzed into an original shot plan.':'Inspiration analyzed. Accept a creative direction to build a shot plan.');
   return record;
  });
 }
 /** Build an original shot plan from current creative direction (± optional inspiration). */
 async planCampaignShots(hook?:import('../../shared/lib/creative-intelligence.ts').CreativeHook){
  return this.store.run('Planning campaign shots',async()=>{
   const p=this.store.active(),planId=p.creative?.activeId;if(!planId)throw Error('Accept a creative direction first.');
   const plan=await this.creative.open(p.id,planId);
   const analysis=p.creative?.inspiration?.analysis;
   const intel=buildCreativeIntelligence(plan,hook||analysis?.creativeMechanism);
   const shotPlan=analysis?planFromReference(plan,analysis,intel):planOriginalCampaign(plan,hook);
   p.creative!.inspiration={...(p.creative!.inspiration||{videoUrl:'',rights:'inspiration-only',productReplacementAvailable:false}),shotPlan,productReplacementAvailable:false};
   if(!p.creative!.inspiration.videoUrl)p.creative!.inspiration.rights='inspiration-only';
   await this.store.projects.save(p);return {intelligence:intel,shotPlan};
  });
 }
 /** Commercial from a shot plan: directed source plates or distinct stills → LTX per beat → FFmpeg assemble. Mutates the caller's project clone so save persists takes. */
 private async produceMultiShotCommercial(p:import('./projects.ts').AdProject,take:HeroTake,plan:import('../../shared/lib/creative-engine.ts').CreativePlan,shotPlan:CampaignShotPlan,templatePrefix:string){
  if(shotPlan.shots.some(s=>s.execution==='ltx')){
   const ready=await filmAvailability();
   if(!ready.available)throw Error(ready.reason+' No film was generated. Choose photograph motion separately if you want that composition.');
  }
  if(shotPlan.shots.some(s=>s.execution==='ltx'))assertAdvertisingGeneration(plan);
  const issues=shotPlanIssues(shotPlan);if(issues.length)throw Error('Video preflight: '+issues.join(' '));
  if(shotPlan.shots.some(s=>s.execution==='ltx')&&!this.client.shot)throw Error('Local video generation is unavailable.');
  assertSceneExportable(take.scene);const hero=await this.store.asset(take.assetId);if(!hero||await blobHash(hero.original)!==take.sha256)throw Error('Restore the saved campaign photograph first.');
  await this.checkSourceUse(take.settings.sourceId,take.settings.brandId,take.settings.productId);
  const source=await this.store.asset(take.settings.sourceId);
  if(!source)throw Error('Restore the original product photograph used for this campaign.');
  // A product-safe take stores the finished advertisement, including text. Never feed that lettering back into LTX.
  const motionPhoto=take.scene?hero.original:source.original;
  const seed0=Number(plan.input.seed??take.settings.seed??61)||61;
  const intel=shotPlan.intelligence||buildCreativeIntelligence(plan,shotPlan.creativeHook);
  const generatedFilm=shotPlan.shots.some(s=>s.execution==='ltx');
  if(generatedFilm&&await blobHash(motionPhoto)!==(take.scene?take.sha256:take.originalSha256||plan.input.source.originalSha256))throw Error('Restore the unlettered campaign scene or exact reviewed original before generating motion.');
  const clips:{jobId?:string;motion?:'push-in'|'pull-out';overlay?:string;source:string;purpose:string;prompt:string;duration:number;seconds:number;kind?:'still';effect?:'fade-in'}[]=[];
  const prompts:string[]=[];
  // Generative beats seed from the approved campaign photograph — never the raw original as an opening plate.
  for(const brief of shotPlan.shots){
   this.store.notify(`Generating shot ${brief.index+1}/${shotPlan.shots.length} (${brief.purpose})…`);
   const still=brief.execution==='approved-still';
   if(still&&generatedFilm&&brief.purpose==='payoff'){
    const image=await campaignFilmPayoff(await this.encode(motionPhoto),{brand:plan.input.brand.dna.name||shotPlan.brandName,colors:plan.input.brand.colors,headline:take.adDesign?.headline||plan.composition.headline||'',cta:take.adDesign?.cta||plan.composition.cta||undefined});
    const uploaded=await this.client.upload(image),duration=shotRenderDuration(brief),prompt=brief.action||'Approved product payoff';prompts.push(prompt);
    clips.push({source:uploaded.url,purpose:brief.purpose,prompt,duration,seconds:duration,kind:'still'});continue;
   }
   if(still&&brief.motion){
    if(take.settings.sourceId!==plan.input.source.id||await blobHash(source.original)!==(take.originalSha256||plan.input.source.originalSha256))throw Error('Original photograph checksum changed.');
    const art=await campaignFilmPlate(await this.encode(source.original),{
     brand:plan.input.brand.dna.name||shotPlan.brandName,colors:plan.input.brand.colors,
     headline:take.adDesign?.headline||plan.composition.headline||shotPlan.brandName,
     cta:take.adDesign?.cta||plan.composition.cta||undefined
    },brief.index===0?'hook':'payoff');
    const photograph=await this.client.upload(art.source),lettering=await this.client.upload(art.overlay);
    const duration=shotRenderDuration(brief),prompt=brief.action||'Directed source photography';prompts.push(prompt);
    clips.push({source:photograph.url,overlay:lettering.url,motion:brief.motion,purpose:brief.purpose,prompt,duration,seconds:duration,kind:'still'});continue;
   }
   const fitted=await prepareCampaignKeyframe(await this.encode(generatedFilm?motionPhoto:hero.original),still?720:campaignVideoSize.width,still?1280:campaignVideoSize.height,brief.framing||'full');
   const uploaded=await this.client.upload(fitted);
   const duration=shotRenderDuration(brief);
   const prompt=motionPromptForShot({...brief,startKeyframeStrategy:'hero-still'},plan.input.facts.description,intel);
   prompts.push(prompt);
   if(still){clips.push({source:uploaded.url,purpose:brief.purpose,prompt,duration,seconds:duration,kind:'still',effect:brief.effect});continue;}
   const shot=await this.client.shot!([{image:uploaded.url,t:0}],prompt,duration,seed0+brief.index*17,{width:campaignVideoSize.width,height:campaignVideoSize.height,model:campaignVideoSize.model,workflow:'ad-film'});
   if(!shot?.url)throw Error(`Shot ${brief.index+1} returned no video. No automatic retry was made.`);
   clips.push({source:shot.url,jobId:shot.jobId,purpose:brief.purpose,prompt,duration:shot.duration??shot.frames/(shot.fps||24),seconds:shot.seconds??0});
   await new Promise(r=>setTimeout(r,1500));
  }
  this.store.notify(`Assembling ${clips.length}-shot commercial…`);
  if(!clips.length)throw Error('No shots were generated.');
  let mp4=clips[0].source,assembleNote='single-shot';
  let closing:string|undefined;
  if(!generatedFilm&&(shotPlan.editing.endingCta||shotPlan.editing.brandOverlay)){
   try{
    const endCard=(shotPlan.shots.some(s=>s.motion)?campaignFilmSignature:campaignFilmEndCard)({
     brand:plan.input.brand.dna.name||shotPlan.brandName,colors:plan.input.brand.colors,
     headline:take.adDesign?.headline||plan.composition.headline||shotPlan.shots.at(-1)?.textOverlay?.text||'',
     cta:take.adDesign?.cta||plan.composition.cta||undefined,
     silent:true
    },720,1280);
    closing=(await this.client.upload(endCard)).url;
   }catch(e){throw Error('Brand card could not be composed. No completed film was saved. '+(e as Error).message);}
  }
  try{
   const assembled=await fetch('/api/reference/assemble',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    shots:clips.map(c=>({source:c.source,...(c.kind==='still'?{kind:'still',duration:c.duration,effect:c.effect,motion:c.motion,overlay:c.overlay}: {})})),
    transition:shotPlan.editing.transition,
    width:720,
    closing:closing&&/^\/outputs\/[a-f0-9]{16}\.png$/.test(closing)?closing:undefined,
    ctaSeconds:closing?3:0
   }),signal:AbortSignal.timeout(180000)});
   const body=await assembled.json();
   if(!assembled.ok)throw Error(body.error||'Assemble failed');
   mp4=body.url;assembleNote=(body.note||shotPlan.editing.transition)+(generatedFilm?'; silent · product remains in branded payoff':'; silent · brand end card');
  }catch(e){throw Error('Campaign assembly failed; raw clips remain saved locally. No completed campaign was recorded. '+(e as Error).message);}
  const tagline=(take.adDesign?.headline||plan.composition.headline||'Campaign film')+' · silent';
  const exports:Take['exports']=/\.mp4$/.test(mp4)?[{id:crypto.randomUUID(),url:mp4,tagline,created:Date.now()}]:[];
  if(!exports.length){
   try{const exported=await this.client.exportVideo(clips[0].source);exports.push({id:crypto.randomUUID(),url:exported.url,tagline,created:Date.now()});if(!/\.mp4$/.test(mp4))mp4=exported.url;}catch{/* */}
  }
  const totalSec=clips.reduce((a,c)=>a+c.duration,0)+(closing?3:0);
  if(p.creative?.inspiration)p.creative.inspiration.shotPlan=shotPlan;
  const usedLtx=shotPlan.shots.some(s=>s.execution==='ltx');
  const playable=/\.mp4$/.test(mp4)?mp4:clips[0].source;
  const video:Take={film:{execution:usedLtx?'ltx':'photograph-motion',clips:clips.map(c=>({url:c.source,kind:c.kind==='still'?'still':'generated',duration:c.duration,jobId:c.jobId}))},id:crypto.randomUUID(),created:Date.now(),assetId:take.assetId,source:playable,kind:'generation',mode:'creative',ratio:'9:16',settings:{...defaults(),mode:'creative',ratios:['9:16'],duration:shotPlan.shots.reduce((a,s)=>a+shotRenderDuration(s),0),seed:seed0,pitch:prompts.join('\n---\n').slice(0,1500),tagline,model:usedLtx?campaignVideoSize.model:'editorial-source-motion',template:`${templatePrefix}:${take.id}:${shotPlan.id}:x${clips.length}:silent`},prompt:prompts.join('\n---\n').slice(0,2000),frames:Math.round(totalSec*24),fps:24,width:720,height:1280,seconds:totalSec,quality:{status:'unreviewed',technical:'assembled',limitations:['Product identity, motion, storytelling and advertising effectiveness require human review.'],shotPlanId:shotPlan.id},exports:exports.length?exports:[{id:crypto.randomUUID(),url:playable,tagline,created:Date.now()}]};
  p.takes.push(video);
  return {video,mp4:playable,shotPlan,clips,assembleNote,prompts,warning:`${clips.length}-shot silent commercial (${shotPlan.creativeHook}). ${assembleNote} ${usedLtx?'One LTX attention beat':'Directed original-photograph motion; no video-model inference'} with deterministic typography; resizing and video compression change RGB values; visual quality unreviewed. Compare product identity — LTX can drift. Fidelity: ${intel.fidelity}.`};
 }
 /** Reference-inspired multi-shot commercial from analyzed inspiration + brand stills. */
 async generateInspiredCommercial(takeId:string){
  return this.store.run('Producing multi-shot commercial',async()=>{
   const p=this.store.active();if(p.attempt?.status==='running')throw Error('Finish or cancel the current generation first.');
   const take=p.hero?.takes.find(t=>t.id===takeId);if(!take)throw Error('Select a saved advertisement photograph first.');
   const planId=p.creative?.activeId;if(!planId)throw Error('Accept a creative direction first.');
   const plan=await this.creative.open(p.id,planId);
   const analysis=p.creative?.inspiration?.analysis;
   const intel=buildCreativeIntelligence(plan,analysis?.creativeMechanism);
   const shotPlan=analysis?planFromReference(plan,analysis,intel):planOriginalCampaign(plan);
   p.creative!.inspiration={...(p.creative!.inspiration||{videoUrl:'',rights:'inspiration-only',productReplacementAvailable:false}),shotPlan,productReplacementAvailable:false};
   p.attempt={id:crypto.randomUUID(),status:'running',created:Date.now(),takeIds:[],engine:shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video'};await this.store.projects.save(p);
   try{
    const live=this.store.active();
    live.creative=p.creative;live.attempt=p.attempt;
    const result=await this.produceMultiShotCommercial(live,take,plan,shotPlan,p.creative?.inspiration?.analysis?'inspired':'original');
    live.attempt={id:live.attempt!.id,status:'complete',created:live.attempt!.created,takeIds:[result.video.id],engine:result.shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video'};
    await this.store.projects.save(live);
    this.store.notify(`${result.clips.length}-shot commercial ready (${shotPlan.creativeHook}). Visual quality is unreviewed; inspect identity and storytelling before publishing.`);
    return result;
   }catch(e){const live=this.store.active();live.attempt={id:p.attempt!.id,status:'failed',created:p.attempt!.created,takeIds:[],engine:shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video',error:(e as Error).message};await this.store.projects.save(live).catch(()=>{});throw e;}
  });
 }
 /** Animate a saved static take as an original multi-shot commercial (no reference required). */
 async animateCampaign(takeId:string,mode:FilmMode='photograph-motion'){
  return this.store.run('Animating your advertisement',async()=>{
   const p=this.store.active();if(p.attempt?.status==='running')throw Error('Finish or cancel the current generation first.');
   const take=p.hero?.takes.find(t=>t.id===takeId);if(!take)throw Error('Select a saved advertisement photograph first.');
   if(!(take.model==='flux3-klein-scene'||take.model==='klein-scene'||take.model==='klein-harmonized'||take.model==='klein-integrated'||take.model==='product-safe'||take.model==='klein-background'))throw Error('Animate works from a saved campaign photograph.');
   if(mode==='generative'&&take.scene&&!allowsProductMotion(take.scene)&&take.model!=='product-safe'&&take.model!=='klein-background')throw Error('This photograph is a generative restage. Animate only from product-locked or product-safe results so motion cannot invent packaging.');
   const planId=p.creative?.activeId;if(!planId)throw Error('Accept a creative direction before animating.');
   const plan=await this.creative.open(p.id,planId);
   const shotPlan=directedFilmPlan(plan,mode);
   p.creative!.inspiration={...(p.creative!.inspiration||{videoUrl:'',rights:'inspiration-only',productReplacementAvailable:false}),shotPlan,productReplacementAvailable:false};
   p.attempt={id:crypto.randomUUID(),status:'running',created:Date.now(),takeIds:[],engine:shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video'};await this.store.projects.save(p);
   try{
    const live=this.store.active();
    live.creative=p.creative;live.attempt=p.attempt;
    const result=await this.produceMultiShotCommercial(live,take,plan,shotPlan,'campaign');
    live.attempt={id:live.attempt!.id,status:'complete',created:live.attempt!.created,takeIds:[result.video.id],engine:result.shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video'};
    await this.store.projects.save(live);
    this.store.notify(`${result.clips.length}-shot commercial ready. Compare product identity across beats.`);
    return {...result,prompt:result.prompts.join('\n')};
   }catch(e){const live=this.store.active();live.attempt={id:p.attempt!.id,status:'failed',created:p.attempt!.created,takeIds:[],engine:shotPlan.shots.some(s=>s.execution==='ltx')?'ltx-video':'editorial-video',error:(e as Error).message};await this.store.projects.save(live).catch(()=>{});throw e;}
  });
 }
 /** Latest video take for a static hero take (convenience). Prefer exact videoTakeId APIs for sound actions. */
 commercialFor(heroTakeId:string){const p=this.store.active();return p.takes.slice().reverse().find(t=>{const tmpl=String(t.settings.template||'');return tmpl.startsWith('campaign:'+heroTakeId)||tmpl.startsWith('inspired:'+heroTakeId)||tmpl.startsWith('original:'+heroTakeId)||tmpl.includes(':'+heroTakeId+':');});}
 /** Exact video take by ID — required for sound/mute/replace/download so sibling commercials are never mixed up. */
 videoTake(videoTakeId:string){const v=this.store.active().takes.find(t=>t.id===videoTakeId);if(!v)throw Error('That commercial video is not in this project.');return v;}
 soundState(videoTakeId:string){return this.store.active().creative?.soundByTakeId?.[videoTakeId];}
 async soundCapabilities(){const r=await fetch('/api/sound/capabilities',{cache:'no-store',signal:AbortSignal.timeout(10000)});const b=await r.json();if(!r.ok)throw Error(b.error||'Sound capabilities unavailable.');return b as {stableAudio:{available:boolean;model?:string};ffmpeg:{available?:boolean};note:string;modes:SoundMode[]};}
 /**
  * Persist soundtrack rights only after an explicit user confirmation in the UI.
  * Uploading a reference video must never imply audio rights.
  */
 async setInspirationAudioRights(audioRights:AudioRights,confirmation?:{recordingAndMusic:boolean}){
  if(audioRights==='user-owned-or-licensed'&&confirmation?.recordingAndMusic!==true)throw Error('Confirm commercial rights to both the soundtrack recording and the underlying music before reuse.');
  return this.store.edit(p=>{if(!p.creative?.inspiration)throw Error('Upload a reference video before setting audio rights.');p.creative.inspiration.audioRights=audioRights;});
 }
 async uploadSoundtrack(file:File,rights:Extract<AudioRights,'inspiration-only'|'user-owned-or-licensed'>='user-owned-or-licensed'){
  return this.store.run('Saving soundtrack',async()=>{
   const type=file.type||(file.name.toLowerCase().endsWith('.wav')?'audio/wav':file.name.toLowerCase().endsWith('.flac')?'audio/flac':file.name.toLowerCase().endsWith('.mp3')?'audio/mpeg':'audio/mp4');
   const uploaded=await fetch('/api/sound/upload',{method:'POST',headers:{'Content-Type':type,'x-osh-audio-rights':rights},body:file,signal:AbortSignal.timeout(120000)});
   const body=await uploaded.json();if(!uploaded.ok)throw Error(body.error||'Soundtrack upload failed.');
   this.store.notify(rights==='user-owned-or-licensed'?'Licensed soundtrack saved for mixing.':'Soundtrack saved as inspiration-only; it will not be copied into exports.');
   return body as {url:string;originalUrl:string;sha256:string;rights:AudioRights;analysis:import('../../shared/lib/sound-director.ts').ReferenceAudioAnalysis};
  });
 }
 /** Plan sound for an exact video take ID (never silently targets a sibling commercial). */
 async planCampaignSoundForVideo(videoTakeId:string,preferSilence=false){
  return this.store.run('Planning campaign sound',async()=>{
   const p=this.store.active(),video=this.videoTake(videoTakeId);
   const planId=p.creative?.activeId;if(!planId)throw Error('Accept a creative direction first.');
   const plan=await this.creative.open(p.id,planId);
   let shotPlan=p.creative?.inspiration?.shotPlan;if(!shotPlan){shotPlan=planOriginalCampaign(plan);p.creative!.inspiration={...(p.creative!.inspiration||{videoUrl:'',rights:'inspiration-only',productReplacementAvailable:false}),shotPlan,productReplacementAvailable:false};}
   const silentMaster=video.exports.find(e=>/\.mp4$/i.test(e.url)&&!/sound/i.test(e.tagline||''))?.url||(/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/.test(video.source)?video.source:video.exports.find(e=>/\.mp4$/i.test(e.url))?.url);
   if(!silentMaster||!/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/.test(silentMaster))throw Error('Silent commercial master is missing for this video.');
   // Prefer the first silent/export master stored on sound state if already planned for this take.
   const prior=p.creative?.soundByTakeId?.[video.id]?.silentMaster;
   const master=prior&&/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/.test(prior)?prior:silentMaster;
   const audioRights=p.creative?.inspiration?.audioRights||'none';
   const soundPlan=planCampaignSound({
    takeId:video.id,creative:plan,shotPlan,videoDuration:video.seconds,
    referenceAudio:p.creative?.inspiration?.analysis?.audio,videoRights:p.creative?.inspiration?.rights||'inspiration-only',
    audioRights,preferSilence
   });
   const caps=await this.soundCapabilities().catch(()=>({stableAudio:{available:false}} as Awaited<ReturnType<AdApplication['soundCapabilities']>>));
   const state:CampaignSoundState={version:1,silentMaster:master,plan:soundPlan,mode:preferSilence?'mute':'auto',layers:[],provenance:{created:Date.now(),mixer:'ffmpeg-aac',stableAudioAttempted:false,stableAudioAvailable:!!caps.stableAudio?.available,note:'Plan only — silent master preserved for this video take.'}};
   p.creative!.soundByTakeId={...p.creative!.soundByTakeId,[video.id]:state};
   await this.store.projects.save(p);
   return state;
  });
 }
 /** @deprecated Prefer planCampaignSoundForVideo(videoTakeId) — this uses the latest commercial for a hero take. */
 async planCampaignSound(heroTakeId:string,preferSilence=false){
  const video=this.commercialFor(heroTakeId);if(!video)throw Error('Animate or produce a commercial first.');
  return this.planCampaignSoundForVideo(video.id,preferSilence);
 }
 /** Apply sound to an exact video take. Reference reuse requires confirmedAudioRights:true on this call. */
 async applyCampaignSoundForVideo(videoTakeId:string,mode:SoundMode='auto',opts?:{soundtrackUrl?:string;confirmedAudioRights?:boolean}){
  return this.store.run(mode==='mute'?'Saving silent commercial':mode==='reference'?'Applying authorized reference audio':'Producing campaign soundtrack',async()=>{
   const caps=await this.soundCapabilities();
   const video=this.videoTake(videoTakeId);
   let state=this.store.active().creative?.soundByTakeId?.[video.id];
   if(!state){await this.planCampaignSoundForVideo(video.id,mode==='mute');state=this.store.active().creative!.soundByTakeId![video.id];}
   const live=this.store.active();
   // Re-resolve this exact take from the live project so sibling takes cannot be overwritten.
   if(!live.takes.some(t=>t.id===video.id))throw Error('That commercial video is no longer in this project.');
   const silentMaster=state.silentMaster;
   const layers:SoundLayerAsset[]=[];
   let generated:CampaignSoundState['generated']|undefined;
   let stableAudioAttempted=false;
   if(mode==='mute'){
    const mixed=await fetch('/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster,duration:video.seconds,layers:[]}),signal:AbortSignal.timeout(120000)});
    const body=await mixed.json();if(!mixed.ok)throw Error(body.error||'Could not export silent master.');
    const next:CampaignSoundState={...state,mode:'mute',layers:[],mixedUrl:body.url,provenance:{created:Date.now(),mixer:'ffmpeg-aac',stableAudioAttempted:false,stableAudioAvailable:!!caps.stableAudio?.available,note:'Mute: intentional silence. Silent master unchanged; LTX video not regenerated.'}};
    live.creative!.soundByTakeId={...live.creative!.soundByTakeId,[video.id]:next};
    await this.store.projects.save(live);
    this.store.notify('Silent commercial ready for this video. Other versions unchanged.');
    return next;
   }
   if(mode==='reference'){
    // Require an explicit confirmation flag on this invocation — stored rights alone are insufficient.
    if(opts?.confirmedAudioRights!==true)throw Error('Confirm commercial rights to both the soundtrack recording and the underlying music before reusing reference audio.');
    await this.setInspirationAudioRights('user-owned-or-licensed',{recordingAndMusic:true});
    const sourceUrl=live.creative?.inspiration?.originalUrl||live.creative?.inspiration?.videoUrl;if(!sourceUrl)throw Error('Upload a reference with an audio track first.');
    if(!live.creative?.inspiration?.analysis?.audio?.hasAudio)throw Error('The reference has no measurable audio track to reuse.');
    const extracted=await fetch('/api/sound/extract-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:sourceUrl,audioRights:'user-owned-or-licensed'}),signal:AbortSignal.timeout(120000)});
    const ex=await extracted.json();if(!extracted.ok)throw Error(ex.error||'Could not extract reference audio.');
    layers.push({id:crypto.randomUUID(),kind:'reference',url:ex.url,at:0,duration:video.seconds,gainDb:-6,fadeIn:0.2,fadeOut:0.5,rights:'user-owned-or-licensed',provenance:'authorized-reference-extract'});
   }else if(mode==='replace'||opts?.soundtrackUrl){
    const url=opts?.soundtrackUrl;if(!url||!/^\/outputs\/[a-f0-9]{16}\.(wav|flac|m4a|aac|mp3|mp4|webm)$/.test(url))throw Error('Upload a licensed soundtrack first.');
    layers.push({id:crypto.randomUUID(),kind:'music',url,at:0,duration:video.seconds,gainDb:-8,fadeIn:0.3,fadeOut:0.6,rights:'user-owned-or-licensed',provenance:'user-upload-licensed'});
   }else{
    if(!caps.stableAudio?.available||!this.client.audio||!state.plan.modelPrompt)throw Error(soundCapabilitiesNote(false)+' Upload a licensed soundtrack (Replace) or choose Mute. Silent master remains downloadable.');
    stableAudioAttempted=true;
    const seed=Math.floor(Math.random()*1e9);
    const bed=await this.client.audio(state.plan.modelPrompt,Math.min(47,Math.max(1,video.seconds)),seed);
    generated={audioUrl:bed.audio,prompt:state.plan.modelPrompt,seed,model:'stable-audio-open-1.0',seconds:bed.seconds};
    layers.push({id:crypto.randomUUID(),kind:state.plan.ambienceAppropriate?'ambience':'music',url:bed.audio,at:0,duration:video.seconds,gainDb:state.plan.cues.find(c=>c.kind==='music'||c.kind==='ambience')?.gainDb??-8,fadeIn:0.35,fadeOut:0.7,rights:'none',provenance:'stable-audio-open-1.0'});
    for(const cue of state.plan.cues.filter(c=>c.kind==='sfx'||c.kind==='accent')){
     if(!cue.prompt)continue;
     try{
      const fx=await this.client.audio(cue.prompt,Math.min(8,Math.max(1,cue.duration+0.4)),seed+cue.at*1000|0);
      layers.push({id:crypto.randomUUID(),kind:'sfx',url:fx.audio,at:cue.at,duration:cue.duration,gainDb:cue.gainDb,fadeIn:cue.fadeIn,fadeOut:cue.fadeOut,rights:'none',provenance:'stable-audio-open-1.0'});
     }catch{/* accent failure is non-fatal; bed remains */}
    }
   }
   const mixed=await fetch('/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster,duration:video.seconds,layers,plan:state.plan}),signal:AbortSignal.timeout(180000)});
   const body=await mixed.json();if(!mixed.ok)throw Error(body.error||'Audio mix failed; silent master was kept.');
   const next:CampaignSoundState={version:1,silentMaster,plan:state.plan,mode,layers,mixedUrl:body.url,generated,provenance:{created:Date.now(),mixer:'ffmpeg-aac',stableAudioAttempted,stableAudioAvailable:!!caps.stableAudio?.available,note:(body.note||'Mixed soundtrack. Silent LTX master preserved.')+' videoTakeId='+video.id}};
   // Write only this take's sound slot.
   live.creative!.soundByTakeId={...live.creative!.soundByTakeId,[video.id]:next};
   const v=live.takes.find(t=>t.id===video.id);
   if(v&&body.url){
    v.exports=[...v.exports.filter(e=>e.url!==body.url),{id:crypto.randomUUID(),url:body.url,tagline:(v.settings.tagline||'')+' · sound',created:Date.now()}];
   }
   await this.store.projects.save(live);
   this.store.notify(mode==='reference'?'Authorized reference audio mixed for this video only.':'Soundtrack mixed for this video only. Sibling versions unchanged.');
   return next;
  });
 }
 /** @deprecated Prefer applyCampaignSoundForVideo(videoTakeId). */
 async applyCampaignSound(heroTakeId:string,mode:SoundMode='auto',opts?:{soundtrackUrl?:string;confirmedAudioRights?:boolean}){
  const video=this.commercialFor(heroTakeId);if(!video)throw Error('Animate or produce a commercial first.');
  return this.applyCampaignSoundForVideo(video.id,mode,opts);
 }
 async downloadCampaignVideoTake(videoTakeId:string,preferMixed=true,download:Download=browserDownload){
  if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');
  const video=this.videoTake(videoTakeId);
  const sound=this.soundState(video.id);
  const url=preferMixed&&sound?.mixedUrl?sound.mixedUrl:sound?.silentMaster||video.exports.at(-1)?.url||video.source;
  const r=await fetch(url);if(!r.ok)throw Error('The saved commercial file is missing.');
  const blob=await r.blob();
  try{await download(blob,/\.mp4$/i.test(url)?'campaign.mp4':'campaign-video');}catch{throw Error('The commercial is still saved. Your browser could not start the download.');}
  this.store.notify(preferMixed&&sound?.mixedUrl?'Download requested for this video’s mixed MP4.':'Download requested for this video’s silent master.');
  return {url,videoTakeId:video.id,silentMaster:sound?.silentMaster||url,mixed:!!(preferMixed&&sound?.mixedUrl)};
 }
 /** @deprecated Prefer downloadCampaignVideoTake(videoTakeId). */
 async downloadCampaignVideo(heroTakeId:string,preferMixed=true,download:Download=browserDownload){
  const video=this.commercialFor(heroTakeId);if(!video)throw Error('No commercial video is saved for this advertisement.');
  return this.downloadCampaignVideoTake(video.id,preferMixed,download);
 }
 async downloadAdvertisement(id:string,download:Download=browserDownload){if(this.store.getSnapshot().busy)throw Error('Finish the current operation first.');const p=this.store.active(),record=[...p.staticAds!.exports,...p.hero!.exports].find(e=>e.id===id);if(!record)throw Error('This advertisement is not in the current project.');const subject=p.hero!.takes.find(t=>('design' in record&&t.assetId===record.design.photoId)||('takeId' in record&&t.id===record.takeId));assertSceneExportable(subject?.scene);const blob=await previewBlob(this.store,record.assetId,record.sha256,true);try{await download(blob,'advertisement-'+id+'.png');}catch{throw Error('The advertisement is still saved. Your browser could not start the download; check its download permissions and try this saved file again.');}this.store.clearError();this.store.notify('Download requested from the saved advertisement.');}
 private async composeTake(take:HeroTake,copy:CopyEdit,fidelityReviewed:boolean){
  if(!fidelityReviewed)throw Error('Compare the generated photograph with your original before exporting.');const originalSource=await this.checkSourceUse(take.settings.sourceId,take.settings.brandId,take.settings.productId);if(take.settings.briefDraft?.input.source.provenance&&!originalSource?.provenance)throw Error('Restore the original website source and its permission record before export.');const p=this.store.active();if(take.model==='klein-scene'||take.model==='flux3-klein-scene'||take.model==='klein-integrated'||take.model==='klein-harmonized')return this.composeSceneTake(take,copy);const entry=p.creative?.plans.find(e=>e.id===p.creative?.activeId&&e.preparedId&&p.hero!.settings.prompt===take.settings.prompt&&e.sourceId===take.settings.sourceId);
  if(entry){let plan:CreativePlan|undefined;try{plan=await this.creative.open(p.id,entry.id);}catch(e){if(!/missing|unreadable|not saved/i.test((e as Error).message))throw e;}
  if(plan&&planMatchesTake(plan,take)&&take.provenanceId){try{return await this.creative.exportAd(p.id,entry.id,take.id,true,copy);}catch(e){if(!/missing or unreadable|Hero provenance|Select a saved delivered/i.test((e as Error).message))throw e;}}
  if(plan&&productSafeMatchesPlan(plan,take))return this.composeOriginalTake(take,copy,take.adDesign||plan.composition);}
  if(take.model==='product-safe'||take.model==='klein-background')return this.composeOriginalTake(take,copy);
  // Previously saved (pre-creative-engine) takes remain usable. Verify their raw
  // original bytes, then compose them with the existing deterministic exporter.
  const brand=this.store.getSnapshot().brands.find(b=>b.id===(take.settings.brandId||p.brandId));if(!brand)throw Error('Choose the saved brand for this photograph.');const asset=await this.store.asset(take.assetId);if(!asset||await blobHash(asset.original)!==take.sha256)throw Error('The saved generated image is missing or corrupt. Restore it before exporting.');
  const design={...newStaticDesign(brand,take.settings.productId).design,...copy,photoId:asset.id,photoConfirmed:true},photo=await this.client.upload(await this.encode(asset.original)),logo=design.logoId?await this.store.asset(design.logoId):undefined;if(design.logoId&&!logo)throw Error('Restore the saved original logo before exporting.');
  const logoURL=logo?(await this.client.upload(await this.encode(logo.normalized))).url:undefined,r=await this.client.staticAd({design,photo:photo.url,logo:logoURL});const exported=await this.outputAsset(r.url,r.sha256,'Advertisement.png',r.width,r.height);p.staticAds!.exports.push({id:crypto.randomUUID(),assetId:exported.id,created:Date.now(),url:r.url,sha256:r.sha256,sources:r.sources,design});await this.store.projects.save(p,exported);return {...r,design,assetId:exported.id};
 }
 private async savedSceneProof(take:HeroTake,planId:string,uploadedOutput?:string){
  const p=this.store.active(),entry=p.creative?.plans.find(e=>e.id===planId);if(!entry?.preparedId||!take.scene)throw Error('The saved scene review needs its original plan and receipt. No new generation is needed.');
  const plan=await this.creative.open(p.id,planId),source=await this.store.asset(plan.input.source.id),raw=await this.store.asset(take.assetId);
  if(!source||await blobHash(source.normalized)!==take.sourceSha256||await blobHash(source.original)!==take.originalSha256||take.originalSha256!==plan.input.source.originalSha256)throw Error('Restore the exact original reference before reviewing this photograph.');
  if(!raw||await blobHash(raw.original)!==take.sha256)throw Error('Restore the unchanged saved photograph before review.');
  const image=await this.client.upload(await this.encode(source.normalized)),output=uploadedOutput?{url:uploadedOutput}:await this.client.upload(await this.encode(raw.original));
  return {projectId:p.id,planId,preparedId:entry.preparedId,current:(await this.creative.context(p,source.id,plan.input)).input,image:image.url,output:output.url};
 }
 async decideSceneFraming(takeId:string,planId:string,decision:'accept'|'reject',confirmed:boolean){return this.store.run('Saving your framing decision',async()=>{
  const p=this.store.active(),take=p.hero?.takes.find(t=>t.id===takeId);if(!take?.scene||!this.client.reviewSceneFraming)throw Error('Saved photograph review is unavailable. Your images are retained.');
  const proof=await this.savedSceneProof(take,planId),r=await this.client.reviewSceneFraming({...proof,decision,confirmed});
  take.scene={...take.scene,...r.inspection,manualFramingReview:r.review};await this.store.projects.save(p);
  if(decision==='reject')return {take,exported:false};
  assertSceneExportable(take.scene);await this.composeSceneTake(take,copyFor(p,take));return {take,exported:true};
 });}
 private async composeSceneTake(take:HeroTake,copy:CopyEdit){
  assertSceneExportable(take.scene);
  const p=this.store.active(),source=await this.store.asset(take.settings.sourceId),raw=await this.store.asset(take.assetId);
  if(!source||await blobHash(source.original)!==take.originalSha256||await blobHash(source.normalized)!==take.sourceSha256)throw Error('Restore the exact original reference before exporting.');
  if(!raw||await blobHash(raw.original)!==take.sha256||!take.adDesign?.campaign)throw Error('Restore the saved generated scene and campaign recipe. No regeneration is needed.');
  const design=applyCopyEdit({...take.adDesign,photoId:raw.id,photoConfirmed:true},copy),photo=await this.client.upload(await this.encode(raw.original)),logo=design.logoId?await this.store.asset(design.logoId):undefined;
  if(design.logoId&&!logo)throw Error('Restore the original logo.');const logoURL=logo?(await this.client.upload(await this.encode(logo.normalized))).url:undefined;
  let r:Awaited<ReturnType<typeof OSH.staticAd>>&{framingReviewId?:string};
  if(framingNeedsManualReview(take.scene)){const review=take.scene!.manualFramingReview;if(!review||!this.client.exportReviewedScene)throw Error('Review the saved photograph before export.');r=await this.client.exportReviewedScene({...await this.savedSceneProof(take,review.planId,photo.url),reviewId:review.id,design,logo:logoURL});}
  else r=await this.client.staticAd({design,photo:photo.url,logo:logoURL});
  const exported=await this.outputAsset(r.url,r.sha256,'Campaign advertisement.png',r.width,r.height);
  p.staticAds!.exports.push({id:crypto.randomUUID(),assetId:exported.id,created:Date.now(),url:r.url,sha256:r.sha256,sources:r.sources,design,...(r.framingReviewId?{framingReviewId:r.framingReviewId}:{})});await this.store.projects.save(p,exported);return {...r,design,assetId:exported.id};
 }
 private async composeOriginalTake(take:HeroTake,copy:CopyEdit,recipe?:StaticDesign){
  const p=this.store.active(),source=await this.store.asset(take.settings.sourceId),brand=this.store.getSnapshot().brands.find(b=>b.id===take.settings.brandId);
  if(!source||!brand||await blobHash(source.normalized)!==take.sourceSha256||await blobHash(source.original)!==take.originalSha256)throw Error('Restore the exact saved original before exporting this advertisement.');
  const base=recipe||take.adDesign||p.staticAds!.exports.find(e=>e.assetId===take.assetId)?.design||newStaticDesign(brand,take.settings.productId).design;
  const design=applyCopyEdit({...base,photoId:source.id,photoConfirmed:true},copy),bg=take.background,background=bg?.assetId?await this.store.asset(bg.assetId):undefined;
  if(bg&&(!background||await blobHash(background.original)!==bg.sha256))throw Error('Restore the exact saved AI background before export.');
  if(bg)Object.assign(design,{supportId:bg.assetId,supportGeneration:{model:bg.model,prompt:bg.prompt,seed:bg.seed}});
  const support=background?(await this.client.upload(await this.encode(background.original))).url:undefined,photo=await this.client.upload(await this.encode(source.normalized)),logo=design.logoId?await this.store.asset(design.logoId):undefined;
  if(design.logoId&&!logo)throw Error('Restore the saved original logo before export.');const logoURL=logo?(await this.client.upload(await this.encode(logo.normalized))).url:undefined;
  const r=await this.client.staticAd({design,photo:photo.url,logo:logoURL,support}),exported=await this.outputAsset(r.url,r.sha256,'Advertisement.png',r.width,r.height);
  p.staticAds!.exports.push({id:crypto.randomUUID(),assetId:exported.id,created:Date.now(),url:r.url,sha256:r.sha256,sources:r.sources,design});await this.store.projects.save(p,exported);return {...r,design,assetId:exported.id};
 }
 /** Re-run the current product checks on a saved photograph. Never generates or bills. */
 async recheckSceneTake(takeId:string,planId:string,compose=true){return this.store.run('Checking the saved photograph again',async()=>{
  const p=this.store.active(),take=p.hero?.takes.find(t=>t.id===takeId),entry=p.creative?.plans.find(e=>e.id===planId);
  if(!take?.scene||!entry?.preparedId||!this.client.inspectScene)throw Error('This saved photograph cannot be checked again here. Open it from History.');
  const plan=await this.creative.open(p.id,planId),source=await this.store.asset(plan.input.source.id),raw=await this.store.asset(take.assetId);
  if(!source||await blobHash(source.normalized)!==take.sourceSha256)throw Error('Restore the original product photo first. No generation is needed.');
  if(!raw||await blobHash(raw.original)!==take.sha256)throw Error('Restore the saved photograph first. No generation is needed.');
  const image=await this.client.upload(await this.encode(source.normalized)),output=await this.client.upload(await this.encode(raw.original));
  const inspection=await this.client.inspectScene({projectId:p.id,planId,preparedId:entry.preparedId,current:(await this.creative.context(p,source.id,plan.input)).input,image:image.url,output:output.url});
  const base=String(take.scene.warning||'').split(/ (?=Identity geometry gate FAIL|Framing\/composition gate FAIL)/)[0];
  take.scene={...take.scene,...inspection,assetId:take.assetId,warning:gateWarning(base,inspection.identityVerify,inspection.framingQuality)};
  await this.store.projects.save(p);
  if(sceneQualityBlocks(take.scene).length){this.store.notify(framingNeedsManualReview(take.scene)?'Framing could not be measured. Review the saved photo beside your original; no new generation is needed.':'Checked again: independent image defects still block export.');return {take,exported:false};}
  if(!compose)return {take,exported:false};
  await this.composeSceneTake(take,copyFor(p,take));return {take,exported:true};
 });}
 async restoreTake(take:HeroTake){return this.store.run('Restoring the saved photograph',async()=>{const p=this.store.active(),existing=await this.store.asset(take.assetId),r=await fetch(take.url,{cache:'no-store'});if(!r.ok)throw Error('The local output file is also missing. Existing history was kept.');const raw=await r.blob();if(await blobHash(raw)!==take.sha256)throw Error('Local output checksum failed. History was not changed.');const bitmap=await createImageBitmap(raw);const asset={id:take.assetId,name:existing?.name||'Generated photograph.png',original:raw,normalized:raw,width:bitmap.width,height:bitmap.height,created:take.created};bitmap.close();await this.store.projects.save(p,asset);});}
 private async outputAsset(url:string,hash:string,name:string,width:number,height:number){if(!/^\/outputs\/[a-f0-9]{16}\.png$/.test(url))throw Error('Invalid output URL.');const r=await fetch(url);if(!r.ok)throw Error('The exported file is missing. Previous work was kept.');const blob=await r.blob();if(await blobHash(blob)!==hash)throw Error('Export checksum failed.');return {id:crypto.randomUUID(),name,original:blob,normalized:blob,width,height,created:Date.now()};}
}
