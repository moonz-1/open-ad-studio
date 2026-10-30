/** Universal campaign presentation — physical cutout vs source layout. Cookie bakery is one archetype, not the only path. */
import type {CreativePlan,CreativeInput} from './creative-engine.ts';
import {sceneDirection,type CampaignArchetype} from './ad-scene.ts';
import {productTypes,type ProductType} from './product-brief.ts';
export {productTypes,type ProductType};

export type SourceViewpoint='overhead'|'eye-level'|'unknown';
export type CampaignPresentation='editorial-original'|'flat-lay-composite'|'perspective-composite'|'digital-layout';
/** Journey / Klein execution — generative first; product-safe is fallback only. */
export type CampaignExecution='product-locked-generative'|'creative-restage'|'product-safe';

/** Physical products may use BiRefNet isolation. Digital/service never require a cutout. */
export function needsPhysicalCutout(input:Pick<CreativeInput,'productType'|'facts'>|CreativePlan['input']){
 if(input.productType==='digital'||input.productType==='service')return false;
 if(['cookies','cinnamon-rolls','packaged-goods'].includes(input.productType))return true;
 // "other": cut out only when the owner described a physical container or countable units.
 const physical=/\b(bottle|jar|box|tray|bag|tube|can|tin|pouch|pump|cap|pack|wrapper|carton|foil|dish|plate)\b/i.test(`${input.facts.container} ${input.facts.description}`);
 return physical||input.facts.count!==undefined;
}

/** Infer camera height from owner photo observations — never invent a conflicting set. */
export function sourceViewpoint(input:Pick<CreativeInput,'facts'>|CreativePlan['input']):SourceViewpoint{
 const blob=`${input.facts.description} ${input.facts.arrangement} ${input.facts.container} ${input.facts.texture}`.toLowerCase();
 if(/\b(overhead|top[-\s]?down|flat[-\s]?lay|from above|bird'?s?[-\s]?eye|looking down)\b/.test(blob))return 'overhead';
 if(/\b(eye[-\s]?level|three[-\s]?quarter|front[-\s]?facing|standing|upright|hero bottle|neck and cap)\b/.test(blob))return 'eye-level';
 // Tray/batch food shot as an overlapping plan view is almost always overhead.
 if(/\b(overlapping|lengthwise|column along|in one rectangular)\b/.test(blob)&&/\b(tray|foil|baking dish|pan)\b/.test(blob))return 'overhead';
 return 'unknown';
}

/**
 * Select generative strategy from owner constraints + product evidence — not bakery templates.
 * Product-locked keeps real product pixels in an AI photographic set.
 * Creative Restage re-photographs under reference conditioning when the owner allows interpretation.
 */
export function campaignExecutionStrategy(plan:CreativePlan):CampaignExecution{
 if(!needsPhysicalCutout(plan.input))return 'product-safe';
 const c=plan.context.controls;
 const locked=!!c.exactCount||c.arrangement==='exactly'||c.fidelity==='high'||c.fidelity==='strict';
 // Locked packaging/count/geometry → product-locked generative (AI set + cutout), never silent restage.
 if(locked)return 'product-locked-generative';
 // Owner-authorized creative interpretation (explicit lower fidelity or open angle/crop + creativity).
 if(c.fidelity==='medium'||c.fidelity==='low')return 'creative-restage';
 if(c.angle!=='none'&&c.crop!=='none'&&(c.creativity==='high'||c.creativity==='medium'))return 'creative-restage';
 return 'product-locked-generative';
}

/**
 * FLUX 3 (local or Comfy Cloud) always re-photographs from the reference: lighting, setting, camera and
 * background follow the direction, while shape, proportions, labels and packaging are bound by the reference
 * image and the measured identity profile in `flux3ScenePrompt`, then checked after delivery. Fidelity and
 * count locks therefore stay in force as identity requirements rather than routing the plan away from FLUX.
 * Returns why a plan cannot be rendered this way, or '' when it can.
 */
export function fluxRestageBlock(plan:Pick<CreativePlan,'input'|'context'>):string{
 if(plan.input.productType==='digital'||plan.input.productType==='service')return 'FLUX 3 re-photographs a physical product, and this direction is for a digital or service offer. Choose Product-safe design.';
 if(plan.context.controls.fidelity==='strict')return 'This direction asks for strict photo fidelity (same camera, framing and setting), which a FLUX 3 re-photograph cannot keep. Choose Product-locked Klein or Product-safe design.';
 return '';
}
export const isFluxEngine=(engine:string|undefined)=>engine==='flux3'||engine==='flux3-cloud';

/**
 * Deterministic SVG plates are a last resort when Klein empty-set generation is unavailable —
 * never the default for high fidelity / exact count (that caused the poster regression).
 */
export function preferDeterministicEmpty(plan:CreativePlan,aiEmptyAvailable=true){
 if(!aiEmptyAvailable)return true;
 return plan.context.controls.fidelity==='strict'&&plan.context.controls.background==='keep';
}

/**
 * Lettering the original photograph is Product-safe / offline fallback only.
 * Must not short-circuit product-locked generative or Creative Restage.
 */
export function preferEditorialOriginal(plan:CreativePlan){
 return campaignExecutionStrategy(plan)==='product-safe';
}

export function presentationMode(plan:CreativePlan):CampaignPresentation{
 const exec=campaignExecutionStrategy(plan);
 if(exec==='product-safe')return needsPhysicalCutout(plan.input)?'editorial-original':'digital-layout';
 if(sourceViewpoint(plan.input)==='overhead')return 'flat-lay-composite';
 return 'perspective-composite';
}

export type EmptySetSpec={
 archetype:CampaignArchetype;
 presentation:CampaignPresentation;
 viewpoint:SourceViewpoint;
 top:string;mid:string;deep:string;accent:string;grain:string;
 lightOpacity:number;grainFreq:string;grainOpacity:number;strokeCount:number;
 material:'walnut'|'stone'|'studio'|'graphic'|'screen';
 /** flat-lay = uniform overhead plane (no wall horizon); perspective = table + falloff */
 plane:'flat-lay'|'perspective';
 prompt:string;
};

function hex(v:string|undefined,fallback:string){return v&&/^#[a-f0-9]{6}$/i.test(v)?v:fallback;}

/** Business- and argument-aware plate specification. Not a single bakery template. */
export function emptySetSpec(plan:CreativePlan):EmptySetSpec{
 const {archetype,concept}=sceneDirection(plan);
 const viewpoint=sourceViewpoint(plan.input);
 const presentation=presentationMode(plan);
 const plane=viewpoint==='overhead'||presentation==='flat-lay-composite'?'flat-lay':'perspective';
 const raw=plan.context.grounding?.palette?.length?plan.context.grounding.palette:(plan.input.brand.colors||[]);
 // Drop neon/high-chroma website accents from beauty/studio plates (Abel’s #dbdf16 chartreuse reads as a bug, not a set).
 const calm=raw.filter(c=>{const n=c.replace('#','');if(n.length!==6)return false;const r=parseInt(n.slice(0,2),16),g=parseInt(n.slice(2,4),16),b=parseInt(n.slice(4,6),16);const max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max? (max-min)/max:0;return sat<0.55||max<210;});
 const palette=calm.length?calm:raw;
 const brand0=hex(palette[0],archetype==='beauty-sensory'?'#e8eef1':archetype==='graphic-energy'?'#1a1a1a':archetype==='food-editorial'?'#3d2418':'#2a2e32');
 const brand1=hex(palette[1],archetype==='beauty-sensory'?'#c5d0d4':archetype==='graphic-energy'?'#e62828':archetype==='food-editorial'?'#2c1810':'#4a5560');
 const brand2=hex(palette[2],archetype==='beauty-sensory'?'#8a9aa3':archetype==='graphic-energy'?'#f5f0e8':archetype==='food-editorial'?'#9a5528':'#9aa3ad');
 const env=`${concept.environment} ${concept.lighting} ${plan.input.brand.dna.visualStyle||''} ${concept.strategy?.memory||''} ${plan.context.productName||''} ${plan.input.request||''}`.toLowerCase();
 const cool=/stone|marble|mineral|linen|ceramic|cool|steel|concrete|slate/i.test(env);
 const warm=/walnut|wood|warm|amber|honey|oak|cocoa|brass/i.test(env);
 const botanical=/cedar|botanical|woody|earth|moss|vetiver|sandal|pine|herb|green cedar/i.test(env);
 const graphic=/bold|graphic|poster|high.?contrast|sport/i.test(env)||archetype==='graphic-energy';
 const screen=plan.input.productType==='digital'||plan.input.productType==='service'||/interface|screen|app|saas|dashboard/i.test(env);
 let material:EmptySetSpec['material']=archetype==='food-editorial'?'walnut':archetype==='beauty-sensory'?'stone':archetype==='graphic-energy'?'graphic':'studio';
 if(screen)material='screen';
 else if(botanical)material='walnut'; // earthy/woody plate — still beauty-safe, not bakery props
 else if(cool)material='stone';
 else if(warm&&archetype!=='beauty-sensory')material='walnut';
 else if(graphic)material='graphic';
 // Flat-lay: keep tones close so the plate reads as one overhead surface, not a wall-to-table room.
 // Botanical beauty: deep olive / bark — never mid-gray catalogue fill.
 const woodyTop=botanical?'#2a3224':undefined,woodyMid=botanical?'#1c241c':undefined,woodyDeep=botanical?'#0e140f':undefined,woodyAccent=botanical?hex(brand2,'#6b7f5a'):undefined;
 const top=woodyTop||(plane==='flat-lay'?(material==='stone'?brand0:brand1):material==='stone'?brand0:material==='graphic'?brand1:brand0);
 const mid=woodyMid||(plane==='flat-lay'?brand0:material==='graphic'?brand0:brand1);
 const deep=woodyDeep||(plane==='flat-lay'?(material==='walnut'?'#2a1810':material==='stone'?'#2a3238':'#1c2024'):material==='walnut'?'#120a08':material==='stone'?'#1a2228':material==='graphic'?'#0a0a0a':material==='screen'?'#0d1117':'#14181c');
 const accent=woodyAccent||brand2;
 const grain=material==='walnut'?brand0:material==='stone'?'#ffffff':material==='graphic'?brand2:material==='screen'?'#58a6ff':brand2;
 const brandName=plan.input.brand.dna.name||'brand';
 const prompt=[
  `deterministic-empty-set:${material}`,
  `plane=${plane}`,
  `viewpoint=${viewpoint}`,
  `presentation=${presentation}`,
  `archetype=${archetype}`,
  `brand=${brandName}`,
  `idea=${(concept.idea||'').slice(0,120)}`,
  `env=${(concept.environment||'').slice(0,100)}`,
  `light=${(concept.lighting||'').slice(0,80)}`
 ].join(' | ');
 return {
  archetype,presentation,viewpoint,plane,top,mid,deep,accent,grain,material,prompt,
  lightOpacity:plane==='flat-lay'?0.1:material==='stone'?0.28:material==='screen'?0.18:material==='graphic'?0.12:0.22,
  grainFreq:material==='walnut'?'0.045 0.85':material==='stone'?'0.7':material==='screen'?'0.15 0.4':'0.55',
  grainOpacity:material==='walnut'?0.11:material==='stone'?0.08:material==='screen'?0.06:0.09,
  strokeCount:plane==='flat-lay'?0:material==='walnut'?8:material==='stone'?4:material==='graphic'?3:0
 };
}
