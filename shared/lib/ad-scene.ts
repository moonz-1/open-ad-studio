import {identityConstraintLines} from './identity-constraints.ts';
import {assertCreativeBrief,photoOnlyDirection} from './creative-brief.ts';
import type {CreativePlan} from './creative-engine.ts';
import type {AdBackground} from './ad-background.ts';
import type {StaticDesign} from './static-ad.ts';
import {sourceViewpoint} from './campaign-presentation.ts';
import {buildCompositionPlan,compositionPlanPrompt} from './composition-dynamics.ts';
import {dynamicsToFlux3Spatial} from './flux3-spatial.ts';
import {assertPhotographyPromptClean,scrubPhotographyPrompt} from './photograph-prompt-scrub.ts';

export type CampaignArchetype='food-editorial'|'beauty-sensory'|'graphic-energy'|'material-study';
export type AdScene=Omit<AdBackground,'model'> & {identityProfile?:import('./product-identity-profile.ts').ProductIdentityProfile|null;identityVerify?:import('./product-identity-verify.ts').IdentityVerifyReport;framingQuality?:import('./framing-quality.ts').FramingQualityReport;letteringScan?:import('./photograph-lettering.ts').LetteringScan;inspection?:{method:string;sourceSha256:string;outputSha256:string};inspectionError?:string;executionKind?:'artifact-replay'|'model-output';transport?:'comfy-cloud'|'comfy-sdk';model:'klein-scene'|'flux3-klein-scene'|'klein-integrated'|'klein-harmonized'|'editorial-original';background?:AdBackground;cutout?:{url:string;sha256:string;jobId:string;method:string;box:{x:number;y:number;width:number;height:number};width:number;height:number;assetId?:string};placement?:{x:number;y:number;width:number;height:number;rotation?:number};sourceSha256:string;archetype:CampaignArchetype;warning:string;preHarmonize?:{url:string;sha256:string};fidelityMode?:'product-fidelity'|'creative-restage'|'hybrid-harmonize'};
export type CampaignSurfacePresentation='composite'|'editorial-original';
const bounded=(s:string|undefined,n=550)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);
/** Decisions are derived from the reviewed plan, not a hidden per-brand prompt. */
export function sceneDirection(plan:CreativePlan){
 const c=plan.concepts.find(c=>c.id===plan.selectedId);if(!c)throw Error('Choose a reviewed creative direction.');
 const i=plan.input,context=[i.productType,i.request,c.idea,c.environment,c.title,i.brand.dna.visualStyle,i.facts?.description,i.facts?.container].join(' ');
 const archetype:CampaignArchetype=['cookies','cinnamon-rolls','bakery'].includes(i.productType)?'food-editorial':/skin|beauty|perfume|serum|cosmetic|fragrance|parfum|eau de|cedar|botanical|woody|aromatic/i.test(context)||(i.productType==='packaged-goods'&&/bottle|glass|fragrance|perfume/i.test(i.facts?.description||''))?'beauty-sensory':/athlet|sport|bold|energy/i.test(context)?'graphic-energy':'material-study';
 // Treatment is a mood hint for compositing paths — never hardcode a kitchen-window set.
 const treatment=archetype==='food-editorial'?'Premium food campaign still: appetizing close presence, intentional directional light from the selected concept, tactile baked surfaces, and a distinctive set that serves the advertising idea (sculptural studio, texture study, or quiet still-life — not a generic kitchen window by default). Props only at edges when they do not compete with or impersonate the product.':archetype==='beauty-sensory'?'Luxury beauty campaign still: sculptural product hero, deliberate speculars, mineral or fabric staging, atmospheric depth and refined physical contact with the set. The mood follows brand tone; never invent ingredient or efficacy claims.':archetype==='graphic-energy'?'Bold campaign still life: graphic directional light, strong silhouette, deliberate diagonals and a striking material backdrop with physical depth.':'A considered material study: distinctive product silhouette, directional light, tactile surroundings and purposeful negative space.';
 return {archetype,treatment,concept:c};
}
/**
 * Reference-conditioned Creative Restage prompt.
 * Product-locked / high fidelity keeps packaging geometry; owner-authorized restage
 * conditions on recognizable product appearance and may restyle or drop original packaging.
 */
/** FLUX 3 request carries full director guidance and Dynamics boxes through either upsampler path. */
export function flux3ScenePrompt(plan:CreativePlan,identity?:import('./product-identity-profile.ts').ProductIdentityProfile|null){
 const {concept:c}=sceneDirection(plan);
 const dynamics=plan.dynamics||buildCompositionPlan(plan);
 const spatial=dynamicsToFlux3Spatial(dynamics,{environment:c.environment,identity});
 const raw=[assertCreativeBrief(plan).sceneCaption,identity?'Reference product proportions:\n'+identityConstraintLines(identity).filter(line=>!/^MISSING_IDENTITY_EVIDENCE:|^Viewpoint limitation:/.test(line)).join('\n'):'',photoOnlyDirection(spatial.captionWithBoxes,plan),'Reference geometry must not be reshaped to fit layout guides. Keep one continuous photographic environment with natural contact, not a floating graphic shelf. Background and open field must stay unlettered — blank materials only outside genuine product packaging from the reference.'].filter(Boolean).join('\n\n');
 return assertPhotographyPromptClean(scrubPhotographyPrompt(raw));
}
export function adScenePrompt(plan:CreativePlan){return assertCreativeBrief(plan).sceneCaption;}
/** Legacy caption retained for saved-plan diagnostics, not new scene requests. */
export function legacyAdScenePrompt(plan:CreativePlan){
 const {concept:c}=sceneDirection(plan),i=plan.input,f=i.facts,locks=plan.context.controls;
 const dynamics=plan.dynamics||buildCompositionPlan(plan);
 const dynamicsBlock=compositionPlanPrompt(dynamics);
 // Mirror campaignExecutionStrategy without importing it (avoids ad-scene ↔ presentation cycle).
 const packagingLocked=!!locks.exactCount||locks.arrangement==='exactly'||locks.fidelity==='high'||locks.fidelity==='strict';
 const restage=!packagingLocked&&(locks.fidelity==='medium'||locks.fidelity==='low'||(locks.angle!=='none'&&locks.crop!=='none'&&(locks.creativity==='high'||locks.creativity==='medium')));
 if(restage)return [
  'Create one continuous reference-conditioned advertising photograph. Image 1 is a product identity reference: match the recognizable visual character of the product (shape language, material, colour, surface texture, thickness or construction). Prefer the real product’s irregular geometry over a generic stock look. This is a new commercial photograph, not a background replace and not a cutout composite. No collage or generated typography.',
  `Product identity (guide, not a locked still life): ${bounded(f.description)} Texture: ${bounded(f.texture,300)}. ${f.arrangement?`Observed source arrangement for recognition only: ${bounded(f.arrangement,220)}.`:''}`,
  `Authorized creative reconstruction: restage the product for advertising. Original packaging/presentation in the reference may be removed or replaced when it is not the product itself. Keep ${locks.exactCount&&f.count?`exactly ${f.count}`:dynamics.product.count!=='observed'?`about ${dynamics.product.count}`:f.count?`about ${f.count}`:'the intended count of'} recognizable product unit(s). Do not invent distinctive fillings, flavors, ingredients, logos or performance claims as facts. Unobserved interiors (broken-open views) require explicit owner approval — do not invent them here.`,
  dynamicsBlock,
  `Setting materials: ${bounded(c.environment)}`,
  'Leave calm negative space for separately rendered typography. Believable contact shadows and continuous photographic depth. Identity fidelity is requested, not verified — compare recognizable features with the reference before publishing.'
 ].join('\n\n');
 return [
  'Create one continuous reference-conditioned advertising photograph. Image 1 supplies physical product identity, not a loose mood reference. No collage or generated typography.',
  `Reference: ${bounded(f.description)} Texture: ${bounded(f.texture,300)} Container: ${bounded(f.container,300)}. Arrangement: ${bounded(f.arrangement,280)}.`,
  `Keep ${f.count?'exactly '+f.count:'the observed count of'} products. Preserve real packaging, labels, geometry, colour and material. Keep the original container; never replace, remove or redesign it. Do not invent ingredients, props, extra products, logos or claims.`,
  dynamicsBlock,
  `Setting: ${locks.background==='keep'?'Keep the original surroundings.':locks.background==='clean'?'Clean distractions without replacing the source setting.':bounded(c.environment)} Styling: source product and permitted surroundings only.`,
  'Leave the approved copy area empty for separately rendered typography. Coherent contact shadows and true surface detail. This is generative restaging: identity preservation is requested, not verified. Compare every count, package and label with the original before publishing.'
 ].join('\n\n');
}
export function campaignDesign(base:StaticDesign,archetype:CampaignArchetype,photoId:string,presentation:CampaignSurfacePresentation='composite',graphic?:import('./graphic-art-director.ts').GraphicDirection):StaticDesign{
 const luxury=archetype==='beauty-sensory';
 const defaults:import('./graphic-art-director.ts').GraphicDirection={
  strategy:'auto',
  showCta:luxury?false:undefined,
  showBody:true,
  showBrand:true,
  ...base.campaign?.graphic,
  ...(graphic||{})
 };
 return {...base,photoId,photoConfirmed:true,supportId:undefined,supportGeneration:undefined,campaign:{version:1,archetype,presentation,graphic:defaults},textColor:base.textColor||'#fffaf0'};
}

/** Rich environment for product-fidelity compositing. Props allowed at edges; center stays landable. */
export function adCampaignPrompt(plan:CreativePlan){
 const {concept:c,archetype}=sceneDirection(plan),locks=plan.context.controls;
 const count=plan.input.facts.count;
 const food=archetype==='food-editorial';
 const vp=sourceViewpoint(plan.input);
 const camera=vp==='overhead'
  ?'Match a true overhead / top-down flat-lay camera on a continuous supporting surface. Do not invent an eye-level room or upright product view.'
  :vp==='eye-level'
   ?'Match a slightly elevated eye-level tabletop camera with a credible supporting plane compatible with a standing product.'
   :'Match a slightly elevated tabletop perspective and a credible supporting plane compatible with the source product viewpoint.';
 const landing=food?(vp==='overhead'?'one tray-sized landing zone centered in the flat-lay plane':'one tray-sized silhouette'):'one product-sized landing zone';
 const hard=food
  ?'Hard negatives: no cookies, rolls, food, trays, packaging, plates, crumbs, chips, people, hands, logos, typography, frames, collage panels, or second products.'
  :'Hard negatives: no products, packaging, bottles, people, hands, logos, typography, frames, collage panels, or second subjects that could be mistaken for the product.';
 return [
  `Photograph an EMPTY supporting set for later compositing of the exact original product pixels. ${camera} Do not invent an alternate product view.`,
  `Approved setting: ${locks.background==='keep'?'Echo the source surroundings without objects.':bounded(c.environment)}. Light: ${bounded(c.lighting)}. Palette: ${plan.context.grounding?.palette.slice(0,3).join(', ')||'source-compatible neutrals'}.`,
  `Advertising mood only (no objects): ${bounded(c.idea,280)}. ${c.strategy?'Memory cue for light/space, not props: '+bounded(c.strategy.memory,180):''}`,
  `EMPTY center and lower ${landing}${count?` (application will place exactly ${count} original product units)`:''}. Calm upper negative space for separately rendered typography.`,
  `${hard} The application restores original product pixels; this plate must stay empty.`
 ].join('\n\n');
}

/** Second-pass reference edit: harmonize a fidelity composite without claiming perfect product preservation. */
export function adHarmonizePrompt(plan:CreativePlan){
 const {concept:c}=sceneDirection(plan),f=plan.input.facts;
 return [
  'Image 1 is a nearly finished advertising composite: an original product cutout placed into a generated set. Harmonize contact lighting, soft edge blending and contact shadows so the product belongs physically in the scene.',
  `Keep the product identity: ${bounded(f.description)}. ${f.count?`Keep exactly ${f.count} products.`:'Keep the observed product count.'} Do not redesign packaging, labels, shapes or materials. Do not invent extra products or food props that could be mistaken for the product.`,
  `Art direction: ${bounded(c.environment)} ${bounded(c.lighting)}. Concept: ${bounded(c.idea)}. Improve only integration quality: edge light wrap, ambient occlusion at contact, subtle reflected light on packaging, natural shadow softness.`,
  'No typography, logos, frames, collage panels or poster borders. Output one continuous photograph. This is an AI harmonization pass; product fidelity is requested but not guaranteed.'
 ].join('\n\n');
}
