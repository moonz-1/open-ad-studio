import {photographicDirection} from './photographic-direction.ts';
import {promptResidue,websiteCopyResidue,genericCopy} from './consumer-copy.ts';
// Portable Ad Studio planning/compilation. No inference, UI or storage side effects.
import {strategyIssues,strategySetIssues,type AdvertisingStrategy} from './advertising-strategy.ts';
import {validateBrand,brandFieldStatus,brandContext,researchSources,type BrandProfile} from './brand.ts';
import {briefDefaults,effectiveControls,newGenerationDraft,recompileDraft,prepareConciseDraft,signalsFromBrand,validateBriefInput,type BriefControls,type BriefInput,type SourceFacts,type GenerationDraft,type Intent} from './product-brief.ts';
import {heroDefaults,type HeroSettings} from './hero-ad.ts';
import {newStaticDesign,staticSizes,staticSVG,luminance,type StaticDesign,type StaticConcept} from './static-ad.ts';
import {creativeGrounding,conceptQuality,conceptConstraintIssues,conceptRecommendation,type CreativeGrounding} from './creative-direction.ts';
import {presentationMode} from './campaign-presentation.ts';
import {claimEvidence} from './claim-repair.ts';
import type {CompositionPlan} from './composition-dynamics.ts';
import {buildCompositionPlan,applyDynamicsToConcept,refineCreativeComposition,parseCompositionRefinement} from './composition-dynamics.ts';
export {parseCompositionRefinement,buildCompositionPlan,compositionPlanPrompt,refineCompositionPlan} from './composition-dynamics.ts';
export type CreativeInput={version:1;projectId:string;brand:BrandProfile;productId?:string;source:BriefInput['source'];facts:SourceFacts;productType:BriefInput['productType'];request?:string;notes?:string;intent?:Intent;format?:keyof typeof staticSizes;seed?:number;constraints?:Partial<BriefControls>};
export type CreativeFact={id:string;text:string;kind:'source'|'owner'|'inferred'|'unconfirmed';sourceIds:string[]};
export type CreativeConcept={strategy?:AdvertisingStrategy;id:string;title:string;idea:string;composition:string;camera:string;environment:string;lighting:string;hierarchy:string;layout:StaticConcept;copyId:string;evidenceIds:string[];scores:{impact:number;relevance:number;accuracy:number;feasibility:number};rationale:string};
export type CreativeContext={facts:CreativeFact[];missing:string[];copyOptions:{id:string;headline:string;body:string;kind:'identity'|'creative-proposal'|'source'}[];controls:BriefControls;productName:string;grounding?:CreativeGrounding;observedCount?:number};
export type PlanningMode='ai'|'basic';
export type PlanningExecution={status:'validated';transport:'comfy-sdk'|'unverified-adapter';inference?:'fresh'|'cached'|'unverified';jobId?:string;responseSha256?:string};
export type CreativePlan={brief?:import('./creative-brief.ts').CreativeBriefV2;version:1;id:string;parentId?:string;projectId:string;created:number;input:CreativeInput;provider:{origin?:'model'|'authored'|'basic';execution?:PlanningExecution;planningVersion?:2;mode:'local-ai'|'deterministic';model?:string;reason:string;contribution?:{bindings?:import('./planning-visual-contract.ts').PhotographicBinding[];claimRepairs?:import('./claim-repair.ts').ClaimRepair[];format:string;modelFields:string[];appFields:string[]}};context:CreativeContext;concepts:(CreativeConcept&{evaluation:{score:number;method:string}})[];selectedId:string;selectionReason:string;draft:GenerationDraft;composition:StaticDesign;/** Structured spatial direction for still/video generation; optional on legacy plans. */dynamics?:CompositionPlan;layout:{width:number;height:number;photoBox:{x:number;y:number;width:number;height:number};textBounds:{text:string;x:number;y:number;width:number;height:number;fontSize:number}[];fit:'contain';exportIntent:'png'};warnings:string[];reviewRequired:true;generationRun:false};
export type CreativePrepared={brief?:import('./creative-brief.ts').CreativeBriefV2;version:1;planId:string;preparedId:string;projectId:string;draft:GenerationDraft;composition:StaticDesign;payload:{image:string;original:string;settings:HeroSettings;projectId:string};status:'REVIEWED_REQUEST_NOT_A_RUN';generationRun:false;paidApproved:false;privateUploadApproved:false};
const identity=(s:unknown,max=160)=>typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s)&&s.length<=max;
const str=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max;
export function campaignControls(input:CreativeInput):BriefControls{
 const intent=input.intent||'campaign',base=briefDefaults(intent);
 if(intent==='campaign')Object.assign(base,{fidelity:'high',exactCount:input.facts.count!==undefined,arrangement:'roughly',angle:'slight',crop:'moderate',background:'replace',creativity:'high'});
 if(intent==='closeup')Object.assign(base,{exactCount:false,angle:'slight',crop:'moderate',background:'replace',creativity:'medium'});
 return effectiveControls({...base,...input.constraints,intent});
}
export function validateCreativeInput(input:CreativeInput){
 if(!input||input.version!==1||!identity(input.projectId)||!input.brand)throw Error('Select a saved project and brand.');
 validateBrand(input.brand);if(!identity(input.brand.id,120)||!Number.isFinite(input.brand.updated))throw Error('Invalid brand identity/revision.');
 if(input.source?.kind!=='original')throw Error('Choose the genuine saved original for Qwen planning.');
 if(!['campaign','closeup','enhancement'].includes(input.intent||'campaign')||!Object.hasOwn(staticSizes,input.format||'feed')||!str(input.request||'',2000)||!str(input.notes||'',3000))throw Error('Invalid creative request or format.');
 if(input.productId){const p=input.brand.products.find(p=>p.id===input.productId);if(!p)throw Error('Product does not belong to this brand.');if(!input.brand.assets.some(a=>a.assetId===input.source.id&&p.imageIds.includes(a.id)))throw Error('Associate this original with the product in Brand DNA, or choose no named product.');}
 validateBriefInput(creativeBriefInput(input));return input;
}
export function creativeBriefInput(input:CreativeInput):BriefInput{
 const product=input.brand.products.find(p=>p.id===input.productId);
 return {version:1,source:structuredClone(input.source),facts:structuredClone(input.facts),productType:input.productType,productName:product?.name.slice(0,80)||'',...(input.productId?{productId:input.productId}:{}),notes:input.notes||'',brand:signalsFromBrand(input.brand,input.productId),execution:{adapter:'qwen-fp8',seed:input.seed??42},controls:campaignControls(input)};
}
// Stable identity includes brand evidence, request, constraints, source and seed.
// The explicit confirmation checkbox alone is allowed to change during review.
export function creativeSnapshot(input:CreativeInput){const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;return JSON.stringify(canonical({...input,facts:{...input.facts,confirmed:false}}));}
export function creativeContext(input:CreativeInput):CreativeContext{
 validateCreativeInput(input);const b=input.brand,context=brandContext(b,input.productId?[input.productId]:['__unmapped__']);
 const facts:CreativeFact[]=[{id:'photo',text:[input.facts.description,input.facts.texture,input.facts.container,`Count: ${input.facts.count??'unknown'}. ${input.facts.arrangement}`].join('\n'),kind:input.facts.confirmed?'owner':'unconfirmed',sourceIds:[]}];
 for(const field of ['name','description','story','tone','visualStyle','positioning','audience','differentiators','guidelines','messaging','creativePreferences'] as const){const value=b.dna[field];if(!value?.trim())continue;const status=brandFieldStatus(b,field),o=b.research?.observations.find(o=>o.field===field);facts.push({id:'brand-'+field,text:value.slice(0,1000),kind:status==='inferred'?'inferred':status==='source'?'source':'owner',sourceIds:status==='user'||status==='reviewed'?[]:o?.sourceIds||[]});}
 if(context.products[0]){const p=context.products[0],proof=!p.overrides?.length&&p.discovery&&b.research&&researchSources(b.research).some(s=>s.id===p.discovery!.sourceId);facts.push({id:'product',text:p.name+': '+p.description+(p.sellingPoints?'\nSelling points ('+(p.overrides?.includes('sellingPoints')?'customer input':'website statement')+'): '+p.sellingPoints:''),kind:proof?'source':p.overrides?.length||!p.sourceUrl?'owner':'unconfirmed',sourceIds:proof?[p.discovery!.sourceId]:[]});}
 const missing=['name','description','tone','visualStyle'].filter(k=>!b.dna[k as keyof typeof b.dna]?.trim());if(!input.facts.confirmed)missing.push('photo observations need owner confirmation');
 // Copy is constrained to grounded identity/excerpts and clearly non-factual
 // creative language. The model cannot invent printed offers/ingredients/claims.
 // Brand messaging (taglines) is preferred when present — never hardcode a bakery line.
 const copyOptions:CreativeContext['copyOptions']=[];
 const messagingLine=(b.dna.messaging||'').split(/\n/).map(s=>s.trim()).find(s=>s.length>=3&&s.length<=80&&!isInternalAdCopy(s)&&!isWebsiteMetaCopy(s)&&!isGenericAdHeadline(s));
 if(messagingLine)copyOptions.push({id:'messaging',headline:messagingLine.slice(0,80),body:'',kind:'identity'});
 const productName=(context.products[0]?.name||'').trim();
 const evidenceHeadline=evidenceCampaignHeadline(input,context);
 if(evidenceHeadline)copyOptions.push({id:'evidence',headline:evidenceHeadline.slice(0,80),body:'',kind:'creative-proposal'});
 if(productName||b.dna.name.trim())copyOptions.push({id:'identity',headline:(productName||b.dna.name.trim()).slice(0,80),body:'',kind:'identity'});
 for(const [i,o]of (b.research?.observations||[]).entries())if(o.kind==='source'&&o.value===o.quote&&o.value.length<=70&&!/\d|[$€£%]|\b(price|sale|offer|free|off|certified|organic|vegan)\b/i.test(o.value)&&!isWebsiteMetaCopy(o.value)&&o.sourceIds.some(id=>b.research!.sources.some(s=>s.id===id&&s.text.includes(o.value))))copyOptions.push({id:'source-'+i,headline:o.value,body:'',kind:'source'});
 return {facts,missing,copyOptions,controls:campaignControls(input),productName:context.products[0]?.name||'',grounding:creativeGrounding(input),observedCount:input.facts.count};
}
/** Strategy.memory / fidelity / production language must never appear as customer-facing advertising. */
export const isInternalAdCopy=promptResidue;
export const isWebsiteMetaCopy=websiteCopyResidue;
export const isGenericAdHeadline=genericCopy;
/** Concise headline from product / material evidence — industry-agnostic, never brand-hardcoded. */
export function evidenceCampaignHeadline(input:CreativeInput,context:{products?:{name?:string;description?:string;sellingPoints?:string}[]}){
 const product=context.products?.[0];
 const pool=[product?.name,product?.description,product?.sellingPoints,input.facts.description,input.brand.dna.visualStyle,input.brand.dna.tone,input.request].filter(Boolean).join(' ').toLowerCase();
 const name=(product?.name||'').trim();
 // Food texture (cream frosting) must not route bakery copy into skincare.
 if(['cookies','cinnamon-rolls'].includes(input.productType)||/\b(cookies?|cinnamon rolls?|bakery|pastry)\b/i.test(pool))return input.facts.count===1?'Worth finishing.':'Made to share.';
 if(/\b(cedar|sandalwood|oak|pine|woody|woodsmoke|vetiver)\b/i.test(pool))return 'Wood, held close.';
 if(/\b(green|botanical|herb|leaf|moss|fern|garden)\b/i.test(pool)&&/\b(cedar|wood|perfume|fragrance|scent|oil|serum)\b/i.test(pool))return 'A quieter green.';
 if(/\b(amber|smoke|smoky|resin|incense|oud)\b/i.test(pool))return 'Warmth that lingers.';
 if(/\b(citrus|bergamot|lemon|yuzu|neroli)\b/i.test(pool))return 'Bright, then gone.';
 if(/\b(mineral|stone|salt|coastal|sea)\b/i.test(pool))return 'Cool mineral calm.';
 if(/\b(linen|cotton|laundry|clean musk)\b/i.test(pool))return 'Soft as linen air.';
 // Prefer single-hero bakery language when count is one; avoid tray-sharing lines that invent companions.
 if(/\b(chocolate|cookie|bakery)\b/i.test(pool)){
  if(input.facts.count===1||/\bleave nothing|last bite|one (hero )?cookie\b/i.test(pool))return 'Worth finishing.';
  return 'Made to share.';
 }
 if(/\b(serum|skincare|skin|cream|lotion)\b/i.test(pool))return 'Quiet on the skin.';
 if(name&&name.length>=3&&name.length<=36&&!isGenericAdHeadline(name)&&!/^fixture\b/i.test(name)&&/\b(perfume|fragrance|eau de|parfum)\b/i.test(pool))return name;
 return '';
}
/** Public marketing lines from brand messaging / identity — never strategy.memory. */
export function consumerCampaignCopy(input:CreativeInput,concept:CreativeConcept,context:CreativeContext){
 const messaging=context.copyOptions.find(c=>c.id==='messaging');
 const evidence=context.copyOptions.find(c=>c.id==='evidence');
 const identity=context.copyOptions.find(c=>c.id==='identity');
 const selected=context.copyOptions.find(c=>c.id===concept.copyId);
 const usable=(s?:string)=>!!s?.trim()&&!isInternalAdCopy(s)&&!isWebsiteMetaCopy(s)&&!isGenericAdHeadline(s);
 let headline=(messaging?.headline||'').trim();
 if(!usable(headline))headline='';
 if(!headline&&usable(evidence?.headline))headline=evidence!.headline;
 if(!headline&&concept.title&&usable(concept.title)&&!/^(the shared|counted|foil on)\b/i.test(concept.title))headline=concept.title.slice(0,80);
 if(!headline&&selected&&selected.kind!=='identity'&&usable(selected.headline))headline=selected.headline;
 if(!headline&&usable(identity?.headline))headline=identity!.headline;
 if(!headline)headline=evidenceCampaignHeadline(input,{products:input.brand.products.filter(p=>!!input.productId&&p.id===input.productId)})||(input.brand.dna.name||'Untitled').slice(0,80);
 const product=input.productId?input.brand.products.find(p=>p.id===input.productId):undefined;
 const productLine=[product?.sellingPoints,product?.description].map(s=>(s||'').split(/[.!\n]/).map(x=>x.trim()).find(x=>x.length>=8&&x.length<=120&&usable(x))).find(Boolean)||'';
 const desc=(input.brand.dna.description||'').split(/[.!\n]/).map(s=>s.trim()).find(s=>s.length>=12&&s.length<=120&&usable(s))||'';
 const feeling=(concept.strategy?.feeling||'').trim();
 let body='';
 if(productLine)body=productLine.slice(0,120);
 else if(desc)body=desc.slice(0,120);
 else if(feeling&&feeling.length<=100&&usable(feeling))body=feeling;
 else if(selected?.body&&usable(selected.body))body=selected.body.slice(0,120);
 const cta=messaging?'Explore':'Discover';
 return {headline:headline.slice(0,80),body:body.slice(0,120),cta:cta.slice(0,48)};
}
const visualKeys=['title','idea','composition','camera','environment','lighting','hierarchy','rationale'] as const;
// Text proposals are not business facts. Refuse common unsupported physical /
// commercial assertions; copy itself uses only the closed grounded catalog.
const unsafe=/[$€£%]|\b(organic|vegan|gluten.free|sugar.free|certified|award.winning|guaranteed|sale|discount|free shipping|daily fresh|fresh daily|add ingredients|extra products|duplicate products|new logo|redesign the product|change the label|garnish|sprinkle|topped with|add steam|steaming hot)\b/i;
// Model-authored title/idea may repeat owner/source wording verbatim (for example
// "100% Natural Perfume"); app-compiled photographic fields stay strictly unsafe-free.
function unsupportedAssertion(text:string,key:string,context:CreativeContext){
 if(!unsafe.test(text))return false;if(key!=='title'&&key!=='idea')return true;
 const evidence=claimEvidence(context),norm=(s:string)=>s.toLowerCase().replace(/[-\s]+/g,' ').trim();
 for(const m of text.matchAll(new RegExp(unsafe.source,'gi'))){
  const token=/^[$€£%]$/.test(m[0])?(text.slice(0,m.index).match(/\S*$/)![0]+text.slice(m.index).match(/^\S*/)![0]).replace(/^[^\w$€£%]+|[^\w$€£%]+$/g,''):m[0];
  if(!evidence.includes(norm(token)))return true;
 }
 return false;
}
export function validateCreativeConcepts(raw:unknown,context:CreativeContext):CreativeConcept[]{
 const issues=creativeConceptIssues(raw,context);if(issues.length)throw Error(issues.join(' '));return structuredClone((raw as {concepts:CreativeConcept[]}).concepts);
}
// Report every blocking issue from a completed response. Nothing is repaired or
// promoted by this audit; schema normalization lives solely in the strict reader.
export function creativeConceptIssues(raw:unknown,context:CreativeContext):string[]{
 const value=raw as {concepts:CreativeConcept[]};if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>k!=='concepts')||!Array.isArray(value.concepts)||value.concepts.length!==3)return ['Expected three distinct creative concepts.'];
 const ids=new Set<string>(),directions=new Set<string>(),issues:string[]=[],visual:CreativeConcept[]=[];
 for(const [index,c]of value.concepts.entries()){
  const prefix=`Concept ${index+1}: `;if(!c||typeof c!=='object'||Array.isArray(c)){issues.push(prefix+'Invalid concept identity.');continue;}
  if(Object.keys(c).some(k=>!['id',...visualKeys,'layout','copyId','evidenceIds','scores','strategy'].includes(k))||!identity(c.id,60)||ids.has(c.id))issues.push(prefix+'Invalid concept identity/fields.');ids.add(c.id);
  let validVisual=true;for(const key of visualKeys){if(!str(c[key],key==='title'?100:700)||!c[key].trim()){issues.push(prefix+'Invalid creative direction: '+key);validVisual=false;}else if(unsupportedAssertion(c[key],key,context))issues.push(prefix+'Unsupported assertion: '+key);else if(/<[^>]+>/.test(c[key]))issues.push(prefix+'Unfilled schema example: '+key);}
  if(!['spotlight','editorial','poster'].includes(c.layout)||!context.copyOptions.some(o=>o.id===c.copyId)||!Array.isArray(c.evidenceIds)||!c.evidenceIds.length||c.evidenceIds.some(id=>!context.facts.some(f=>f.id===id&&f.kind!=='inferred'&&f.kind!=='unconfirmed')))issues.push(prefix+'Ungrounded concept/copy reference.');
  if(!c.scores||Array.isArray(c.scores)||Object.keys(c.scores).length!==4||(['impact','relevance','accuracy','feasibility'] as const).some(k=>!Number.isInteger(c.scores[k])||c.scores[k]<1||c.scores[k]>5))issues.push(prefix+'Invalid concept evaluation.');
  if(c.strategy)issues.push(...strategyIssues(c.strategy,context).map(s=>prefix+s));
  if(validVisual){
   const signature=(c.environment+'|'+c.composition+'|'+c.lighting).toLowerCase().replace(/\W/g,'');if(directions.has(signature))issues.push(prefix+'Concepts differ only in labels/copy.');directions.add(signature);
   issues.push(...conceptConstraintIssues(c.strategy?{...c,idea:[c.idea,c.strategy.focus,c.strategy.opening,c.strategy.payoff,c.strategy.memory].join(' ')}:c,context).map(s=>prefix+s));visual.push(c);
  }
 }
 if(visual.length===3)issues.push(...conceptQuality(visual,context).issues,...strategySetIssues(visual));return issues;
}
const argumentFields=['title','idea','objective','audienceHypothesis','tension','businessFit','feeling','memory','focus','opening','payoff','proofId','proofQuote'] as const;
/** Flatten nested strategy/proof so small local models emit valid JSON more reliably. */
export function strategyFromFlatArgument(arg:any):AdvertisingStrategy{
 if(!arg||typeof arg!=='object')throw Error('Invalid advertising argument.');
 return {version:2,objective:arg.objective,audienceHypothesis:arg.audienceHypothesis,tension:arg.tension,businessFit:arg.businessFit,feeling:arg.feeling,memory:arg.memory,focus:arg.focus,opening:arg.opening,payoff:arg.payoff,proof:[{id:arg.proofId,quote:arg.proofQuote}]};
}
/** Argument-first live planning: model supplies marketing arguments; app owns photographic direction. */
export function conceptsFromArguments(value:any,input:CreativeInput,context:CreativeContext):CreativeConcept[]{
 if(!value||Object.keys(value).some(k=>k!=='arguments')||!Array.isArray(value.arguments)||value.arguments.length!==3)throw Error('Expected three advertising arguments.');
 const templates=fallbackConcepts(input,context);
 const concepts:CreativeConcept[]=value.arguments.map((arg:any,i:number)=>{
  let strategy:AdvertisingStrategy;let title:string;let idea:string;
  if(arg&&arg.strategy&&!arg.proofId){
   // Legacy nested shape retained for fixtures/tests.
   if(Object.keys(arg).some(k=>!['title','idea','strategy'].includes(k)))throw Error('Unknown argument fields.');
   title=arg.title;idea=arg.idea;strategy=arg.strategy;
  }else{
   if(!arg||Object.keys(arg).some(k=>!argumentFields.includes(k as typeof argumentFields[number])))throw Error('Unknown argument fields.');
   title=arg.title;idea=arg.idea;strategy=strategyFromFlatArgument(arg);
  }
  if(typeof title!=='string'||title.trim().length<2||title.length>100)throw Error('Invalid argument title.');
  if(typeof idea!=='string'||idea.trim().length<12||idea.length>700)throw Error('Invalid marketing argument.');
  const issues=strategyIssues(strategy,context);if(issues.length)throw Error(issues.join(' '));
  const visual={...templates[i%templates.length],...photographicDirection(input,context,strategy,i)};
  return {...visual,id:'director-'+i,title:title.trim(),idea:idea.trim(),strategy,evidenceIds:[...new Set(strategy.proof.map(p=>p.id))],scores:{impact:3,relevance:3,accuracy:3,feasibility:3},rationale:'Marketing reasoning is stored separately with exact evidence citations; audience and feelings remain hypotheses. Physical direction is compiled from selected source observations and permitted camera/light relationships.'};
 });
 const setIssues=strategySetIssues(concepts);if(setIssues.length)throw Error(setIssues.join(' '));
 return validateCreativeConcepts({concepts},context);
}
export function fallbackConcepts(input:CreativeInput,context:CreativeContext):CreativeConcept[]{
 const bakery=['cinnamon-rolls','cookies'].includes(input.productType),g=context.grounding||creativeGrounding(input),c=context.controls;
 const product=input.brand.products.find(p=>p.id===input.productId);
 const evidence=`${context.productName} ${product?.name||''} ${product?.description||''} ${input.facts.description} ${input.brand.dna.visualStyle} ${input.brand.dna.tone} ${input.request}`.toLowerCase();
 const botanical=/cedar|wood|botanical|herb|moss|green|vetiver|sandal|pine|oak/i.test(evidence);
 const mineral=/mineral|stone|coastal|salt|linen|ceramic|cool/i.test(evidence);
 const palette=g.palette.length?`Surroundings may echo ${g.palette.join(', ')}; keep the product's real colours.`:'Use neutral surroundings; no brand palette has been confirmed.';
 // Bakery: three genuinely different advertising modes — not three kitchen-window variants.
 const environments=bakery
  ?['Sculptural dark food studio: charcoal seamless sweep, single warm key from camera-left, deep falloff; product alone on a low matte plinth with a crisp contact shadow.','Extreme texture study: close three-quarter crop filling the lower two-thirds; soft linen plane barely visible; no kitchen architecture.','Asymmetric paper still-life: warm cream vertical plane left, deep cocoa field right; product rests off-centre on a quiet walnut ledge with generous upper negative space.']
  :botanical
   ?['Asymmetric cedar-inspired architecture: vertical wood grain plane left, soft atmospheric depth right; product rests on a cool stone ledge with a believable contact shadow — no inventing fragrance ingredients.','Low moss-and-mineral vignette: shallow natural ground, restrained foliage at the far edges only, soft haze; product three-quarter and slightly off-centre.','Quiet editorial still-life: matte walnut tabletop, distant soft-focus green field, generous upper negative space; product as the sole object.']
   :mineral
    ?['A cool mineral set beside soft architectural light; stone or linen plane, product alone.','A matte stone sweep and low horizon emphasizing glass and material transitions.','A quiet tonal field with soft specular control; package remains the only object.']
    :['A quiet functional setting with soft architectural light, a proportionate supporting plane and the reference product as the only object.','A matte mineral sweep and a low horizon emphasizing surface construction and material transitions.','A plain geometric colour field and a flat supporting surface; the original package stays the only object.'];
 const enhancement=c.intent==='enhancement';
 const compositions=botanical
  ?['Environmental editorial: place the bottle lower-left to mid-frame on a ledge; leave a tall quiet column of negative space on the right for headline lettering; keep a soft contact shadow.','Material study: three-quarter hero slightly below centre on a diagonal path; reserve a calm upper band for copy; graze light across glass and label.','Graphic campaign: silhouette right of centre against broad horizontal earth/sage planes; reserve the left third empty for brand artwork.']
  :bakery
   ?['Sculptural hero: place one product unit slightly below centre on a quiet plinth; reserve a tall calm upper band for lettering; keep planform readable (not elongated).','Texture macro: fill lower two-thirds with a slightly elevated three-quarter reading of surface cracks and inclusions; leave a quiet upper strip empty.','Asymmetric still-life: product lower-left on a walnut ledge; leave the right and upper fields empty for brand artwork.']
   :['An environmental editorial: place the intact grouping in the lower-left with a generous upper-right copy area and visible contact shadow.','A material study: use a centered, frame-filling grouping on a diagonal visual path; reserve a narrow quiet strip above for separate copy.','A graphic campaign: frame the complete silhouette right of centre against broad horizontal colour planes; reserve the left third for separate brand artwork.'];
 const titles=enhancement
  ?['Balanced exposure','Tactile detail','Quiet cleanup']
  :bakery
   ?['Last bite','Crust up close','Off-centre quiet']
   :botanical
    ?['Cedar light','Moss vignette','Walnut quiet']
    :mineral
     ?['Mineral calm','Material grain','Quiet silhouette']
     :['Present and still','Material grain','Clear silhouette'];
 const copyIdFor=(i:number)=>context.copyOptions.some(o=>o.id==='messaging')?'messaging':context.copyOptions.some(o=>o.id==='evidence')?'evidence':i===0&&context.copyOptions.some(o=>o.id==='identity')?'identity':context.copyOptions[Math.min(i,context.copyOptions.length-1)]?.id||'identity';
 const ideaLines=botanical
  ?['Argue for a premium woody atmosphere: sunlight, grain and stone make the bottle feel held in nature without inventing notes or performance claims.','Argue for intimacy: bring the observed bottle close in a moss-mineral vignette so the viewer leans in — product identity stays exact.','Argue for editorial calm: walnut and soft green depth create space for a restrained headline; silhouette remains the only subject.']
  :bakery
   ?['Argue that finishing the last bite is inevitable: one recognizable product unit, sculptural and alone, so desire comes from presence not kitchen lifestyle.','Argue with surface truth: cracked crust and uneven inclusions fill the frame so appetite comes from touchable texture, not a generic bakery set.','Argue with quiet asymmetry: product off-centre on a simple ledge so the brand message can land in empty space without props theatre.']
   :['Make the product feel present in a believable everyday setting','Let observed texture and construction carry the visual hook','Make a memorable product silhouette through graphic contrast'];
 const bakeryLight=['Single warm key from camera-left with deep studio falloff, soft fill from below, and a sharp natural contact shadow on the plinth.','Low grazing key across crust relief with gentle opposing fill; no window architecture; keep inclusions readable without melting into flat disks.','Soft key from upper-left, quiet rim separation against the cocoa field, and a believable ledge contact shadow.'];
 const defaultLight=['Broad soft side-light with gradual falloff, soft reflected fill and a legible natural contact shadow.','Low grazing soft light across observed relief, with gentle opposing fill to separate texture from shine.','A broad frontal key and subtle edge separation create a crisp silhouette and an even, quiet background.'];
 return environments.map((environment,i)=>({id:'fallback-'+i,title:titles[i],idea:enhancement?`Improve ${['light balance while retaining natural shadows','surface readability without smoothing texture','background clarity without replacing the scene'][i]}; retain the original grouping and viewpoint.`:`${ideaLines[i]}. Proposed treatment: ${g.direction}.`,composition:enhancement?'Retain the original grouping, field of view and position.':c.crop==='none'?'Retain the complete source framing and grouping; use light and background separation within the existing boundaries.':compositions[i],camera:c.angle==='none'?'Keep the source viewpoint.':i===1?'A slightly closer three-quarter view that keeps every locked unit and the container inside frame.':'A small perspective adjustment only where permitted; retain recognizable geometry.',environment:c.background==='keep'?'Retain the original surroundings.':c.background==='clean'?'Clean incidental distractions in the original background; retain the setting and materials.':environment+' '+palette,lighting:(botanical?['Directional late-afternoon sunlight with soft leaf-shadow mottling on the rear plane, warm reflected fill from wood, and a crisp natural contact shadow under the bottle.','Soft overcast daylight with cool fill; gentle volumetric haze; low grazing accents on glass edges without blowing the label.','Broad soft key from camera-left, subtle rim separation against earthy depth, and a quiet specular on glass only where the source shows it.']:bakery?bakeryLight:defaultLight)[i],hierarchy:'Product first; leave the stated quiet area empty for later headline and original brand artwork. No model-generated typography.',layout:(['editorial','spotlight','poster'] as const)[i],copyId:copyIdFor(i),evidenceIds:context.facts.filter(f=>['brand-name','brand-tone','brand-visualStyle','photo','product'].includes(f.id)&&['owner','source'].includes(f.kind)).map(f=>f.id).slice(0,4),scores:{impact:3,relevance:3,accuracy:3,feasibility:3},rationale:'Rule-based proposal using declared preferences, physical constraints and distinct visual decisions; no AI evaluation or proven image quality.'}));
}
// Keep original evidence verbatim in the draft; do not turn legacy imperative
// clauses inside a photo observation into hidden campaign-preservation locks.
const observation=(s:string)=>s.split(/[;\n]/).filter(v=>!/^\s*(preserve|keep|do not|never)\b/i.test(v)).join('; ').slice(0,900);
export function compileCreativeDraft(input:CreativeInput,concept:CreativeConcept):GenerationDraft{
 const i=creativeBriefInput(input),c=i.controls,d=newGenerationDraft(i),enhancement=c.intent==='enhancement';
 const camera=c.angle==='none'?'Keep the source viewpoint.':c.angle==='slight'?'At most a slight perspective change from the source viewpoint. '+concept.camera:concept.camera;
 const composition=c.crop==='none'?'Retain the original field of view, product boundaries and grouping; create separation through light and permitted surroundings.':concept.composition;
 const background=c.background==='keep'?'Retain the original surroundings.':c.background==='clean'?'Clean incidental distractions in the original surroundings without replacing the setting or materials.':concept.environment;
 d.sections.transformation=`${concept.idea}${concept.strategy?' Advertising purpose: '+concept.strategy.tension+' Product emphasis: '+concept.strategy.focus:''}\nCamera proposal: ${camera}\nPermissions: angle ${c.angle}, crop ${c.crop}, creativity ${c.creativity}; explicit product locks win.`;
 d.sections.composition=composition+' '+concept.hierarchy;d.sections.background=background;
 d.decisions={direction:concept.idea,lighting:concept.lighting,background};recompileDraft(d);prepareConciseDraft(d);
 const texture=i.productType==='cinnamon-rolls'?'Where visible, retain pillowy baked folds, individual spiral seams, uneven icing thickness and brown filling traces; do not invent unseen ingredients.':i.productType==='cookies'?'Retain the observed spread, baked edges, crumb and existing inclusions; never add chips.':i.productType==='packaged-goods'?'Keep the exact package silhouette, seams, cap and printed label geometry; do not redraw branding.':'Keep distinguishing source material and surface landmarks.';
 d.modelPrompt=[`Reference-conditioned product photograph. Image 1 supplies product identity. ${enhancement?(c.background==='replace'?'Authentic enhancement: retain product and viewpoint; replace only the explicitly permitted surroundings.':'Authentic enhancement: improve the existing photograph without reimagining the scene.'):'Create a new advertising photograph, not a copy of the source snapshot.'}`,
 `Visible reference: ${observation(i.facts.description)}. Texture: ${observation(i.facts.texture)}. ${texture} Container: ${observation(i.facts.container)}.`,
 `Preserve recognizable shape, material, real surface irregularity and printed artwork. ${c.exactCount?`Keep exactly ${i.facts.count??'the owner-confirmed count of'} visible products; no additions/removals/merging, all units inside frame.`:'Only the permitted close crop may hide existing units; invent no extra products.'} ${c.arrangement==='exactly'?'Keep individual positions and spacing exactly within the source grouping/container; frame the intact assembly as a unit rather than re-staging its products.':'Retain the source grouping and relative scale; modest staging changes are allowed.'} Observed arrangement: ${observation(i.facts.arrangement)}.`,
 enhancement?`Authentic improvement: ${concept.idea}\nUse the existing camera perspective. Composition: ${composition}\nSetting: ${background}`:`Creative idea: ${concept.idea}${concept.strategy?' Product emphasis: '+concept.strategy.focus+' Visual memory: '+concept.strategy.memory:''}\nComposition: ${composition}\nCamera: ${camera}\nSetting: ${background}`,
 `Light: ${concept.lighting} Angle permission: ${c.angle}; crop permission: ${c.crop}. ${c.crop==='none'?'Retain the original field of view.':'Reframe deliberately within the count/arrangement locks.'} ${concept.hierarchy}`,
 `No added food/ingredients, invented products, false labels, extra garnish or product redesign. Keep true texture and plausible contact shadows. No new text, logos, prices or offers: those are composed separately. All unseen geometry is inferred and needs owner inspection.`].join('\n\n');
 if(d.modelPrompt.length>6000)throw Error('Creative prompt exceeds Qwen limit.');return d;
}
export function creativeComposition(input:CreativeInput,concept:CreativeConcept,context:CreativeContext):StaticDesign{
 const d=newStaticDesign(input.brand,input.productId,concept.layout).design;
 const {headline,body,cta}=consumerCampaignCopy(input,concept,context);
 const base={...d,copyInternalTexts:[concept.strategy?.memory||'',concept.idea,concept.composition,concept.lighting],copyEvidence:context.facts.filter(f=>['owner','source'].includes(f.kind)).map(f=>f.text),photoId:input.source.id,photoConfirmed:false,size:input.format||'feed',headline,body,cta,website:d.website||'',brandName:input.brand.dna.name.slice(0,60)};
 // Campaign intent uses full-bleed campaign surfaces (not editorial split panels) so product-safe and Klein share one quality bar.
 if((input.intent||'campaign')==='campaign'){
  const ctx=[input.productType,input.request,concept.idea,concept.environment,concept.title,input.brand.dna.visualStyle,context.productName,input.facts.description,input.facts.container].join(' ');
  const archetype=['cookies','cinnamon-rolls','bakery'].includes(input.productType)?'food-editorial'
   :/skin|beauty|perfume|serum|cosmetic|fragrance|parfum|eau de|cedar|botanical|woody|aromatic/i.test(ctx)||(input.productType==='packaged-goods'&&/bottle|glass|fragrance|perfume/i.test(input.facts.description||''))
    ?'beauty-sensory'
    :/athlet|sport|bold|energy/i.test(ctx)?'graphic-energy':'material-study';
  const mode=presentationMode({input,context} as CreativePlan);
  const presentation=mode==='editorial-original'?'editorial-original':'composite';
  // Brand-directed plate colors — never mid-gray catalogue fields for beauty/fragrance.
  const evidence=ctx.toLowerCase();
  const woody=/cedar|wood|botanical|earthy|oak|pine|vetiver|sandal|aromatic wood|green cedar/i.test(evidence);
  const background=archetype==='beauty-sensory'
   ?(woody?'#1c241c':luminance(d.background)>0.35?'#1a2228':d.background)
   :archetype==='food-editorial'
    ?(luminance(d.background)>0.4?'#2a1810':d.background)
    :d.background;
  const accent=archetype==='beauty-sensory'?(woody?'#6b7f5a':luminance(d.accent)>0.45?'#7a5a3a':d.accent):d.accent;
  return {...base,background,accent,photoConfirmed:true,supportId:undefined,supportGeneration:undefined,campaign:{version:1,archetype,presentation,graphic:{strategy:'auto',signals:{tone:context.facts.filter(f=>['owner','source'].includes(f.kind)&&['brand-tone','brand-visualStyle','brand-creativePreferences'].includes(f.id)).map(f=>f.text).join(' ').slice(0,2000),idea:concept.idea.slice(0,800),title:concept.title,energy:context.controls.creativity}}},textColor:'#fffaf0'};
}
 return base;
}
export function creativeHeroSettings(input:CreativeInput,draft:GenerationDraft):HeroSettings{return {...heroDefaults().settings,sourceId:input.source.id,brandId:input.brand.id,productId:input.productId,sourceKind:'original',imageModel:'qwen-fp8',method:'reimagine',seed:input.seed??42,productName:draft.input.productName,prompt:draft.modelPrompt!,briefDraft:structuredClone(draft),headline:'',website:''};}
// 1×1 transparent PNG — layout measurement only; never used as a published product plate.
const layoutProbe='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
export function assembleCreativePlan(input:CreativeInput,concepts:CreativeConcept[],provider:CreativePlan['provider'],id:string):CreativePlan{
 if(/^authored(?:-|$)/i.test(provider.model||'')||provider.origin==='authored')provider={...provider,origin:'authored',mode:'deterministic',reason:'Authored arguments; no model inference. '+provider.reason,execution:undefined};
 provider={...provider,origin:provider.origin||(provider.mode==='local-ai'?'model':'basic')};
 const context=creativeContext(input);const evaluated=concepts.map(c=>({...c,evaluation:conceptRecommendation(c,context)})).sort((a,b)=>b.evaluation.score-a.evaluation.score);
 let selected=evaluated[0];
 // Structured dynamics first, then sync selected concept prose so cards/prompts share one spatial decision.
 const skeleton={version:1 as const,id,projectId:input.projectId,created:Date.now(),input:structuredClone(input),provider,context,concepts:evaluated,selectedId:selected.id,selectionReason:selected.evaluation.method+' '+selected.rationale,draft:compileCreativeDraft(input,selected),composition:creativeComposition(input,selected,context),layout:{width:1,height:1,photoBox:{x:0,y:0,width:1,height:1},textBounds:[],fit:'contain' as const,exportIntent:'png' as const},warnings:[] as string[],reviewRequired:true as const,generationRun:false as const};
 const dynamics=buildCompositionPlan(skeleton);
 selected=applyDynamicsToConcept(selected,dynamics) as typeof selected;
 const conceptsSynced=evaluated.map(c=>c.id===selected.id?{...selected,evaluation:c.evaluation}:c);
 const draft=compileCreativeDraft(input,selected);
 const composition=creativeComposition(input,selected,context),layout=staticSVG(composition,{photo:layoutProbe});
 return {version:1,id,projectId:input.projectId,created:Date.now(),input:structuredClone(input),provider,context,concepts:conceptsSynced,selectedId:selected.id,selectionReason:selected.evaluation.method+' '+selected.rationale,draft,composition,dynamics,layout:{width:layout.width,height:layout.height,photoBox:layout.photoBox,textBounds:layout.textBounds,fit:'contain',exportIntent:'png'},warnings:[...context.missing.map(k=>'Missing: '+k),...context.grounding!.warnings,...layout.warnings,...(input.constraints?.fidelity==='strict'&&input.intent!=='enhancement'?['Strict owner constraints limit campaign reframing; choose a less restrictive intent to explore.']:[]),...(provider.mode==='deterministic'?['Basic visual studies only: no model-generated advertising strategy. Owner direction is needed; these are not evidence of creative intelligence.']:[]),'Text planning has no vision model: source observations require owner confirmation.','Camera/background proposals and model scores are not verified facts or fidelity guarantees.','Copy is selected from grounded identity/source excerpts or non-factual proposals; no invented offers or product claims.'],reviewRequired:true,generationRun:false};
}
export function selectCreativePlan(previous:CreativePlan,conceptId:string,id:string):CreativePlan {
 const concept=previous.concepts.find(c=>c.id===conceptId);if(!concept)throw Error('Choose an existing concept.');
 const p=structuredClone(previous);p.selectedId=conceptId;
 const dynamics=buildCompositionPlan(p);
 const synced=applyDynamicsToConcept(concept,dynamics);
 const composition=creativeComposition(p.input,synced,p.context),layout=staticSVG(composition,{photo:layoutProbe});
 return {...p,id,parentId:previous.id,created:Date.now(),selectedId:conceptId,selectionReason:'User selected this alternative; direction and source review are still required.',concepts:p.concepts.map(c=>c.id===conceptId?{...synced,evaluation:c.evaluation}:c),draft:compileCreativeDraft(p.input,synced),composition,dynamics,layout:{width:layout.width,height:layout.height,photoBox:layout.photoBox,textBounds:layout.textBounds,fit:'contain',exportIntent:'png'}};
}
/** Owner composition refinement: updates structured dynamics + concept prose + draft when the text maps to concrete spatial fields. */
export function refinePlanComposition(previous:CreativePlan,text:string,id:string):CreativePlan{
 if(!Object.keys(parseCompositionRefinement(text)).length)throw Error('Refinement did not map to a concrete composition change. Try diagonal arrangement, closer hero, more depth, more negative space, or calmer energy.');
 const refined=refineCreativeComposition(previous,text);
 const concept=refined.concepts.find(c=>c.id===refined.selectedId);if(!concept)throw Error('Choose a reviewed creative direction.');
 const composition=creativeComposition(refined.input,concept,refined.context),layout=staticSVG(composition,{photo:layoutProbe});
 return {...refined,id,parentId:previous.id,created:Date.now(),selectionReason:'Owner refined composition dynamics; review still required before generation.',draft:compileCreativeDraft(refined.input,concept),composition,layout:{width:layout.width,height:layout.height,photoBox:layout.photoBox,textBounds:layout.textBounds,fit:'contain',exportIntent:'png'},reviewRequired:true,generationRun:false};
}
