/** Model-agnostic creative-brief-v2. Reuses the existing Composition & Dynamics schema. */
import type {CreativePlan,CreativeInput,CreativeFact} from './creative-engine.ts';
import {buildCompositionPlan,type CompositionPlan} from './composition-dynamics.ts';
import {consumerCopyIssues,unsupportedCopyClaims,type ConsumerCopy} from './consumer-copy.ts';
export type ProductObservation={field:'description'|'silhouette'|'proportions'|'materials'|'texture'|'distinctiveFeatures'|'labels'|'packaging'|'count'|'arrangement'|'viewpoint'|'visibleSurfaces';value:string;basis:'owner-confirmed'|'owner-unconfirmed'|'vision';evidenceIds:string[]};
export type ProductAnalysis={version:1;sourceId:string;sourceSha256:string;observations:ProductObservation[];unknowns:string[];vision:{status:'unavailable'|'completed';pixelsInspected:boolean;provider?:string;reason:string}};
/** Optional open-weight vision adapter. No text model is allowed to claim pixel inspection. */
export interface ProductVisionProvider {id:string;analyze(request:{sourceId:string;sourceSha256:string;imagePath:string;signal:AbortSignal}):Promise<ProductAnalysis>}
export function ownerProductAnalysis(input:CreativeInput):ProductAnalysis{
 const basis=input.facts.confirmed?'owner-confirmed' as const:'owner-unconfirmed' as const;
 const observations:ProductObservation[]=([['description',input.facts.description],['texture',input.facts.texture],['packaging',input.facts.container],['arrangement',input.facts.arrangement],['count',input.facts.count==null?'':String(input.facts.count)]] as const).filter(([,v])=>v.trim()).map(([field,value])=>({field,value,basis,evidenceIds:['photo']}));
 return {version:1,sourceId:input.source.id,sourceSha256:input.source.sha256,observations,unknowns:['Silhouette, proportions, materials, distinctive features, labels, viewpoint and visible surfaces are not separately measured; use only the owner observations above.','Unseen faces, interiors and unreported ingredients or specifications are unknown.'],vision:{status:'unavailable',pixelsInspected:false,reason:'No vision-analysis provider is configured. Text planning reads owner/source descriptions; it has not inspected photograph pixels.'}};
}
export async function analyzeProduct(input:CreativeInput,imagePath:string,signal:AbortSignal,provider?:ProductVisionProvider){
 if(!provider)return ownerProductAnalysis(input);
 const result=await provider.analyze({sourceId:input.source.id,sourceSha256:input.source.sha256,imagePath,signal});
 if(result.version!==1||result.sourceId!==input.source.id||result.sourceSha256!==input.source.sha256||!result.vision.pixelsInspected||result.vision.status!=='completed'||result.vision.provider!==provider.id)throw Error('Vision analysis is not bound to this source/provider.');
 if(result.observations.some(o=>o.basis!=='vision'||!o.evidenceIds.length||!o.value.trim()))throw Error('Vision observations require explicit pixel-evidence references.');
 // Vision suggestions never overwrite confirmed owner facts.
 const owner=ownerProductAnalysis(input);return {...owner,observations:[...owner.observations,...result.observations],unknowns:[...new Set([...owner.unknowns,...result.unknowns])],vision:result.vision};
}
export type BriefIssue={code:string;field:string;message:string};
export type CreativeBriefV2={
 schema:'creative-brief-v2';projectId:string;planId:string;productId?:string;source:CreativeInput['source'];inputBinding:string;
 evidence:CreativeFact[];product:ProductAnalysis;identityAnchors:string[];unknownCharacteristics:string[];
 marketing:{conceptId:string;title:string;insight:string;objective:string;appeal:string;businessFit:string;visualHook:string;productEmphasis:string;copyDirection:string;interpretation:'hypothesis';evidenceIds:string[]};
 permissions:CreativePlan['context']['controls'];approvedClaims:string[];composition:CompositionPlan;sceneCaption:string;restrictions:string[];consumerCopy:ConsumerCopy;
 planning:CreativePlan['provider'];execution:{image:'not-run';planningResponseValidated:boolean;liveInferenceVerified:boolean};critic:{issues:BriefIssue[];repairs:string[];visualQualityVerified:false};
};
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):v;
export function briefInputBinding(input:CreativeInput){return JSON.stringify(canonical({...input,facts:{...input.facts,confirmed:false}}));}
export function auditCreativeBrief(b:CreativeBriefV2):BriefIssue[]{
 const issues:BriefIssue[]=[],add=(code:string,field:string,message:string)=>issues.push({code,field,message}),d=b.composition;
 if(!b.marketing.objective.trim()||!b.marketing.insight.trim()||!b.marketing.businessFit.trim())add('marketing','marketing','A marketing objective, argument and brand fit are required.');
 if(!b.marketing.evidenceIds.some(id=>b.evidence.some(f=>f.id===id&&['owner','source'].includes(f.kind))))add('evidence','marketing.evidenceIds','Bind this direction to retained business evidence.');
 for(const [field,value] of [['camera',d.camera.viewpoint+' '+d.camera.distance+' '+d.camera.framing],['lighting',d.light.key],['environment',b.sceneCaption.match(/Environment: ([^\n]+)/)?.[1]||'']] as const){if(value.trim().length<12||/^(?:beautiful|premium|cinematic|nice|dramatic|studio|soft light)\.?$/i.test(value.trim()))add('photography',field,'Concrete camera, lighting and environment direction is required.');}
 for(const o of b.product.observations.filter(o=>o.basis!=='vision'&&['description','texture','packaging'].includes(o.field)))if(o.value&&!b.sceneCaption.includes(o.value))add('identity','sceneCaption','A source observation was lost from the compiled caption: '+o.field);
 if(!b.sceneCaption.includes(`Target product count: ${d.product.count}`))add('count','sceneCaption','The compiled caption lost the reviewed target count.');
 if(b.permissions.exactCount&&b.product.observations.some(o=>o.field==='count'&&Number(o.value)!==d.product.count))add('count','composition.product.count','Target count contradicts the owner exact-count lock.');
 const countWords:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
 for(const text of [d.product.subjects,d.product.arrangement])for(const m of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:(?:hero|visible|recognizable|thick|irregular|chocolate.chip)\s+){0,3}(?:products?|units?|cookies?|bottles?|speakers?|rolls?)\b/gi)){const n=countWords[m[1].toLowerCase()]??Number(m[1]);if(typeof d.product.count==='number'&&n!==d.product.count)add('count','composition.product','Subject or arrangement contradicts the target count.');}
 for(const claim of unsupportedCopyClaims(b.sceneCaption,b.approvedClaims))add('claim','sceneCaption','Unsupported scene claim: '+claim);
 const stated=[...b.sceneCaption.matchAll(/\b(?:exactly|target product count:)\s+(\d+)\b/gi)].map(m=>Number(m[1]));if(typeof d.product.count==='number'&&stated.some(n=>n!==d.product.count))add('count','sceneCaption','Contradictory explicit product counts.');
 if(!b.sceneCaption.includes('Do not invent'))add('restrictions','sceneCaption','Missing explicit restrictions.');
 for(const message of consumerCopyIssues(b.consumerCopy,{approvedClaims:b.approvedClaims,internalTexts:[b.sceneCaption,b.composition.concept.memory]}))add('copy','consumerCopy',message);
 return issues;
}
export function photoOnlyDirection(text:string,plan:CreativePlan){
 const c=plan.concepts.find(c=>c.id===plan.selectedId),observed=[plan.input.facts.description,plan.input.facts.texture,plan.input.facts.container].join(' ').toLowerCase();
 // Strip consumer/marketing phrases entirely — do not replace with “graphic copy” (that invites FLUX lettering).
 const words=[plan.composition.headline,plan.composition.body,plan.composition.cta,c?.title].filter((v):v is string=>!!v&&v.trim().length>3&&!observed.includes(v.toLowerCase()));
 for(const phrase of words){let start=0,lower=text.toLowerCase(),needle=phrase.toLowerCase(),index=lower.indexOf(needle,start);while(index>=0){text=text.slice(0,index)+text.slice(index+phrase.length);start=index;lower=text.toLowerCase();index=lower.indexOf(needle,start);}}
 return text.replace(/\s{2,}/g,' ').replace(/\s+\b(?:for|of|to|with|about|reading)\s*(?=[.;,:]|$)/gi,'').trim();
}
export function compileCreativeBrief(plan:CreativePlan):CreativeBriefV2{
 const c=plan.concepts.find(c=>c.id===plan.selectedId);if(!c)throw Error('Select an existing creative direction.');const i=plan.input,d=structuredClone(plan.dynamics||buildCompositionPlan(plan));
 const owner=ownerProductAnalysis(i),previous=plan.brief?.product,product=previous?.sourceSha256===i.source.sha256&&previous.vision.status==='completed'?{...owner,observations:[...owner.observations,...previous.observations.filter(o=>o.basis==='vision')],vision:structuredClone(previous.vision)}:owner,evidence=structuredClone(plan.context.facts),claims=evidence.filter(f=>['owner','source'].includes(f.kind)).map(f=>f.text),repairs:string[]=[];
 if(plan.context.controls.angle==='none'&&!/match.*source|reference viewpoint|source viewpoint/i.test(d.camera.viewpoint)){d.camera.viewpoint='Match the supplied reference viewpoint; no alternate view.';repairs.push('Reinstated the owner source-viewpoint lock.');}
 const safe=(text:string)=>photoOnlyDirection(text,plan);
 const sourceFacts=[['Product description',i.facts.description],['Observed surface',i.facts.texture],['Observed packaging',i.facts.container],['Observed arrangement',i.facts.arrangement]].filter(([,s])=>s).map(([k,v])=>`${k}: ${v}`);
 const restrictions=['Do not invent ingredients, claims, variants, branding or product specifications.','Unseen faces/interiors are unknown; use only reference-supported surfaces.','Unlettered photograph: the only permitted writing is genuine product packaging printed on the identity reference. No posters, signs, slogans, captions, watermarks, random symbols or text-like patterns anywhere else.',...d.brand.constraints];
 const sceneCaption=[
 'Create one continuous reference-conditioned advertising photograph. Use the reviewed product reference for physical identity. This is generative restaging; output identity is unverified and must be compared with the original.',
 ...sourceFacts,`Target product count: ${d.product.count}. Source observed count: ${i.facts.count??'unknown'}. Follow the reviewed target; no accidental extra units.`,
 `Identity anchors: ${d.product.identityAnchors.join('; ')}. Packaging policy: ${d.product.packagingPolicy}.`,
 d.product.packagingPolicy==='preserve'?'Keep original container, packaging, labels and visible geometry.':'Only the reviewed packaging policy permits changes; invent no branding.',
 `Composition: ${safe(d.frame.heroPlacement)} ${safe(d.frame.hierarchy)} Depth: ${safe(d.frame.depth)}`,
 `Arrangement: ${safe(d.product.arrangement)}`,
 `Camera: ${safe(d.camera.viewpoint)} ${safe(d.camera.distance)} ${safe(d.camera.framing)} ${safe(d.camera.lensFeel)}`,
 `Environment: ${safe(c.environment)}`,
 `Lighting: ${safe(d.light.key)} Atmosphere: ${safe(d.light.atmosphere)}`,
 `Palette: ${c.photographicScene?'Proposed set palette (creative interpretation): '+safe(c.photographicScene.palette)+'; preserve real product colours.':i.brand.colors.length?'Brand surroundings may echo '+i.brand.colors.join(', ')+'; preserve real product colours.':'No confirmed brand palette; use neutral surroundings and preserve real product colours.'}`,
 `Open field (unlettered materials only): ${safe(d.typography.safeRegion)} ${safe(d.frame.negativeSpace)}`,
 'Product observations are owner/source descriptions, not a claim that the text model inspected pixels.',...restrictions,
 ].join('\n');
 const b:CreativeBriefV2={schema:'creative-brief-v2',projectId:i.projectId,planId:plan.id,productId:i.productId,source:structuredClone(i.source),inputBinding:briefInputBinding(i),evidence,product,identityAnchors:[...d.product.identityAnchors],unknownCharacteristics:product.unknowns,marketing:{conceptId:c.id,title:c.title,insight:c.idea,objective:c.strategy?.objective||i.request||'Proposed product consideration; owner review required.',appeal:c.strategy?.feeling||i.brand.dna.tone,businessFit:c.strategy?.businessFit||evidence.find(f=>f.id==='brand-description')?.text||i.brand.dna.name,visualHook:c.strategy?.memory||c.composition,productEmphasis:c.strategy?.focus||i.facts.description,copyDirection:'Separate consumer copy below; never use this visual hook as ad text.',interpretation:'hypothesis',evidenceIds:[...c.evidenceIds]},permissions:structuredClone(plan.context.controls),approvedClaims:claims,composition:d,sceneCaption,restrictions,consumerCopy:{headline:plan.composition.headline,body:plan.composition.body,cta:plan.composition.cta},planning:structuredClone(plan.provider),execution:{image:'not-run',planningResponseValidated:plan.provider.mode==='local-ai'&&plan.provider.execution?.status==='validated'&&!/^authored(?:-|$)/i.test(plan.provider.model||''),liveInferenceVerified:plan.provider.execution?.inference==='fresh'&&plan.provider.execution?.transport==='comfy-sdk'&&plan.provider.execution.status==='validated'&&!!plan.provider.execution.jobId},critic:{issues:[],repairs,visualQualityVerified:false}};
 b.critic.issues=auditCreativeBrief(b);return b;
}
export function assertCreativeBrief(plan:CreativePlan){
 const b=compileCreativeBrief(plan);if(plan.brief&&plan.brief.inputBinding!==b.inputBinding)throw Error('Creative brief is stale for this product/evidence. Develop and review again.');
 if(b.critic.issues.length)throw Error('Creative brief preflight: '+b.critic.issues.map(i=>i.message).join(' '));return b;
}
