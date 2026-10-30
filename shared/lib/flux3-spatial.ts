/** Map Composition & Dynamics into FLUX 3 Image Klein Comfy spatial guidance.
 * Comfy caption format: element tags in prose + JSON list with bbox [top,left,bottom,right] on 0–1000.
 * Boxes guide placement/scale; they are not hard masks (BFL docs).
 * Product-agnostic: subjects, counts and environment come from Dynamics — never a fixed bakery template.
 * Silhouette boxes must follow measured Product Identity Profile when available — never force tall boxes on squat products. */
import type {CompositionPlan} from './composition-dynamics.ts';
import {
 identityAwareHeroBox,
 identityConstraintLines,
 silhouetteForSpatial,
 type ProductIdentityProfile,
} from './identity-constraints.ts';

export type Flux3BBox=[number,number,number,number];
export type Flux3LayoutElement={id:string;bbox:Flux3BBox;desc:string};
export type Flux3Silhouette='general'|'tall-bottle'|'squat-bottle'|'compact-irregular';
export type Flux3SpatialPlan={
 version:1;
 grid:1000;
 format:'comfy-caption-json';
 elements:Flux3LayoutElement[];
 /** Short director request for the prompt upsampler (constraints must survive expansion). */
 shortPrompt:string;
 /** Full structured director prompt for CLIP when the prompt upsampler is bypassed. */
 directorPrompt:string;
 /** Caption fragment with <id> tags + appended JSON layout list. */
 captionWithBoxes:string;
 constraints:string[];
 silhouette:Flux3Silhouette;
 identityProfileUsed:boolean;
};

const clamp=(n:number)=>Math.max(0,Math.min(1000,Math.round(n)));
const box=(t:number,l:number,b:number,r:number):Flux3BBox=>[clamp(t),clamp(l),clamp(b),clamp(r)];

function isBottleSubject(dynamics:CompositionPlan){
 const t=`${dynamics.product.subjects} ${dynamics.product.identityAnchors.join(' ')}`.toLowerCase();
 return /\b(bottle|perfume|fragrance|flacon|vial|atomizer|eau de)\b/.test(t);
}

/** Layout boxes — silhouette from measured identity when possible; never default all bottles to tall. */
export function defaultHeroCopyBoxes(
 energy:CompositionPlan['frame']['energy']='restrained',
 silhouette:Flux3Silhouette='general'
):{hero:Flux3BBox;copy:Flux3BBox;background:Flux3BBox}{
 if(silhouette==='squat-bottle'){
  // Wide, low hero with ≥10% inset — never hug the right/bottom edge (prior Green Cedar clip).
  if(energy==='dynamic')return{
   hero:box(500,140,900,620),
   copy:box(40,560,360,960),
   background:box(0,0,1000,1000),
  };
  return{
   hero:box(480,220,880,760), // inset squat hero, lower-centre bias
   copy:box(40,40,360,920),
   background:box(0,0,1000,1000),
  };
 }
 if(silhouette==='tall-bottle'){
  // Portrait hero mid-right — ONLY when identity evidence says tall-narrow.
  if(energy==='dynamic')return{
   hero:box(220,420,940,880),
   copy:box(40,40,360,480),
   background:box(0,0,1000,1000),
  };
  return{
   hero:box(260,400,900,820),
   copy:box(40,40,340,460),
   background:box(0,0,1000,1000),
  };
 }
 if(silhouette==='compact-irregular'){
  // Food / pastry heroes: inset with ≥12% margins so trays are not edge-cropped.
  if(energy==='dynamic')return{
   hero:box(360,200,820,700),
   copy:box(40,560,320,960),
   background:box(0,0,1000,1000),
  };
  return{
   hero:box(340,180,800,680),
   copy:box(40,80,300,920),
   background:box(0,0,1000,1000),
  };
 }
 if(energy==='dynamic')return{
  hero:box(380,220,900,780),
  copy:box(40,520,340,960),
  background:box(0,0,1000,1000),
 };
 return{
  hero:box(420,260,900,740),
  copy:box(40,80,360,920),
  background:box(0,0,1000,1000),
 };
}

function countConstraint(dynamics:CompositionPlan):string{
 const n=dynamics.product.count;
 if(n==='observed')return 'Keep the observed product count; do not invent additional units.';
 if(n===1)return 'Exactly one product unit in the entire frame. No second product, no multi-unit pile, no packaging that is not the product.';
 return `About ${n} recognizable product units only. Do not invent extra units or packaging.`;
}

function morphologyConstraints(dynamics:CompositionPlan):string[]{
 const subjects=dynamics.product.subjects.toLowerCase();
 const anchors=dynamics.product.identityAnchors.join(' ').toLowerCase();
 const cookie=/\bcookie\b/.test(subjects+anchors);
 if(cookie)return [
  'Preserve the cookie planform and surface actually visible in the identity reference; do not elongate it into a loaf or invent a different recipe.',
  'Retain observed inclusions and crust details only; do not add chocolate, fillings, or cracks absent from the reference.',
  'Prefer a supported three-quarter angle that shows observed thickness; avoid profiles that invent unseen geometry.',
 ];
 if(isBottleSubject(dynamics))return [
  'Preserve exact bottle silhouette proportions from the identity reference image — match measured width-to-height; do not invent a taller, thinner, cylinder, sphere or square flacon.',
  'A short broad bottle must stay short and broad; a tall bottle must stay tall. Layout boxes must not reshape the merchandise.',
  'Keep the observed material, liquid colour, surface finish and cap shape from the reference; do not substitute a generic bottle.',
  'Preserve front label layout and embossed brand mark from the reference; do not invent alternate branding or erase the label.',
  'Prefer a slightly elevated three-quarter only when the front-facing reference can support it; do not invent unseen back faces as facts.',
 ];
 return [
  'Preserve the reference product’s real silhouette proportions; do not invent hidden faces or alternate product variants.',
  'Prefer a camera angle the identity references can honestly support.',
 ];
}

function typographyConstraint(dynamics:CompositionPlan):string{
 if(isBottleSubject(dynamics)||dynamics.product.packagingPolicy==='preserve')
  return 'UNLETTERED SCENE: the only permitted writing is the product’s existing printed label and embossing copied from the identity reference. No posters, signs, captions, slogans, watermarks, random symbols, or text-like patterns anywhere else in the photograph.';
 return 'UNLETTERED SCENE: zero letters, words, logos, watermarks, numbers, symbols, posters, signs, or text-like patterns anywhere in the photograph — blank materials only outside the product itself.';
}

/** Build Comfy-native spatial guidance from a CompositionPlan (+ optional measured identity). */
export function dynamicsToFlux3Spatial(dynamics:CompositionPlan,options:{
 environment?:string;
 seedHint?:string;
 identity?:ProductIdentityProfile|null;
}={}):Flux3SpatialPlan{
 const measured=options.identity?silhouetteForSpatial(options.identity):null;
 // CRITICAL: do not map every bottle subject to tall-bottle — that elongated squat Green Cedar.
 let silhouette:Flux3Silhouette=measured||'general';
 if(!measured&&isBottleSubject(dynamics)){
  // Without pixels, stay neutral-general and demand reference proportions in text — never assume tall.
  silhouette='general';
 }
 const boxes=defaultHeroCopyBoxes(dynamics.frame.energy,silhouette);
 const bias=dynamics.layout?.placementBias||'lower-center';
 if(dynamics.layout?.productSafe){
  const p=dynamics.layout.productSafe;
  boxes.hero=box(p.y*1000,p.x*1000,(p.y+p.height)*1000,(p.x+p.width)*1000);
 }
 if(dynamics.layout?.copySafe){
  const c=dynamics.layout.copySafe;
  boxes.copy=box(c.y*1000,c.x*1000,(c.y+c.height)*1000,(c.x+c.width)*1000);
 }
 if(options.identity&&options.identity.geometry.confidence>=0.35){
  const place=bias==='lower-right'?'lower-right':bias==='lower-left'||bias==='mid-left'?'lower-left':bias==='center'?'center':'lower-center';
  boxes.hero=identityAwareHeroBox(options.identity,dynamics.frame.energy==='dynamic'?'dynamic':'restrained',place);
 }
 const framingLine=dynamics.layout?.framingMode==='intentional-closeup'
   ?'Intentional close-up as briefed — remaining branding must stay readable.'
   :'FULL PRODUCT IN FRAME: keep the entire product silhouette inside the canvas with clear breathing room on all sides; do not crop the bottle, cap or base at any edge.';
 const scaleLine=dynamics.layout?.productScale==='dominant'
  ?'PRODUCT SCALE: dominant hero — the product must read as the primary mass in frame (roughly half the frame height), never a tiny object in empty negative space.'
  :dynamics.layout?.productScale==='intimate'
   ?'PRODUCT SCALE: intimate close reading while remaining brand-legible.'
   :'PRODUCT SCALE: balanced hero — clearly readable, not postage-stamp small.';
 const anchors=dynamics.product.identityAnchors.join('; ')||'owner-confirmed product character';
 const pack=dynamics.product.packagingPolicy==='preserve'
  ?'Keep original packaging/container when it is the product.'
  :dynamics.product.packagingPolicy==='omit-if-not-product'
   ?'Omit packaging and containers that are not the product itself.'
   :'Packaging may be modestly restyled; invent no new marks.';
 const morph=morphologyConstraints(dynamics);
 const identityLines=options.identity?identityConstraintLines(options.identity):[
  'Match the identity reference photograph’s real physical proportions; do not redesign merchandise to suit the set.',
 ];
 const constraints=[
  countConstraint(dynamics),
  `Identity anchors (guide, not pixel lock): ${anchors}.`,
  pack,
  ...identityLines,
  ...morph,
  framingLine,
  scaleLine,
  'Do not invent ingredients, flavors, fillings, logos, or performance claims.',
  typographyConstraint(dynamics),
  'Do not paste a cutout onto flat colour; generate one continuous photographic environment with soft grounded contact shadow — no hard synthetic shelves, floating platforms, or fake elliptical ledges.',
  'Creative freedom applies to scene, light and camera — not to product geometry.',
  ...dynamics.brand.constraints,
 ];

 const environment=options.environment||dynamics.light.atmosphere||'A quiet supporting set with soft depth and brand-compatible materials.';
 const heroDesc=[
  dynamics.product.subjects,
  `Arrangement: ${dynamics.product.arrangement}`,
  `Camera: ${dynamics.camera.viewpoint} ${dynamics.camera.distance} ${dynamics.camera.lensFeel}`,
  `Light: ${dynamics.light.key}`,
  'The reviewed product arrangement at intentional prominence; preserve identity anchors and real proportions; no invented extras.',
 ].join(' ');
 const openFieldDesc='Empty calm open field of unlettered materials — no writing, symbols, posters or signs. No competing products or props that steal focus.';
 const bgDesc=`${environment} Atmosphere: ${dynamics.light.atmosphere} Brand tone: ${dynamics.brand.tone}. Continuous photographic depth behind the hero — real materials and light falloff, not flat colour fields; no competing subjects; no signage.`;

 const elements:Flux3LayoutElement[]=[
  {id:'background_1',bbox:boxes.background,desc:bgDesc.slice(0,420)},
  {id:'product_1',bbox:boxes.hero,desc:heroDesc.slice(0,420)},
  {id:'open_field_1',bbox:boxes.copy,desc:openFieldDesc},
 ];

 // Short request for official prompt upsampler — constraints must survive expansion; never invite slogans.
 const shortPrompt=[
  'Commercial product photograph only. Blank unlettered open field beside the product.',
  `Frame: ${dynamics.frame.heroPlacement}. Energy: ${dynamics.frame.energy}.`,
  `Product: ${dynamics.product.subjects}`,
  constraints.join(' '),
  options.seedHint||'',
 ].filter(Boolean).join('\n');

 const prose=[
  `Integrated commercial photograph.`,
  `Hero product <product_1> (${dynamics.product.subjects.slice(0,160)}) as the primary subject with a legible contact shadow.`,
  `Open field <open_field_1> stays blank — unlettered materials only; no writing rendered in-camera.`,
  `Environment <background_1> supports the brand without inventing extra product units or signs.`,
  `Reference images supply product identity for shape, material, packaging labels and surface — restage into a new coherent scene; do not collage or paste.`,
 ].join(' ');

 const captionWithBoxes=`${prose} ${JSON.stringify(elements)}`;

 // Dense validated caption used when TextGenerate (pup) is unavailable — equivalent expansion, not a shallow stub.
 const directorPrompt=[
  'Brand-directed commercial still photograph of the reviewed product arrangement. Unlettered scene except genuine product packaging from the reference.',
  `Product identity: ${dynamics.product.subjects}. Anchors: ${anchors}.`,
  `Arrangement: ${dynamics.product.arrangement}`,
  `Setting materials only (no signage, no posters, no writing): ${environment}`,
  `Camera: ${dynamics.camera.viewpoint} ${dynamics.camera.distance} ${dynamics.camera.framing} ${dynamics.camera.lensFeel}`,
  `Light: ${dynamics.light.key}. Atmosphere: ${dynamics.light.atmosphere}. Brand tone: ${dynamics.brand.tone}.`,
  `Frame energy ${dynamics.frame.energy}; hero ${dynamics.frame.heroPlacement}; negative space ${dynamics.frame.negativeSpace}.`,
  constraints.join(' '),
  `Spatial layout (0–1000 placement guides): product_1=${JSON.stringify(boxes.hero)}, open_field_1=${JSON.stringify(boxes.copy)}.`,
  'One continuous photograph with believable soft contact shadow and material-accurate reflections. No cutout paste, no flat-colour void backgrounds, no hard synthetic shelf/ledge graphics, no unrequested extra units, no invented packaging theatre, no background writing.',
  options.seedHint||'',
 ].filter(Boolean).join('\n');

 return{
  version:1,grid:1000,format:'comfy-caption-json',elements,shortPrompt,directorPrompt,captionWithBoxes,constraints,
  silhouette,identityProfileUsed:!!options.identity&&options.identity.geometry.confidence>=0.25
 };
}

/** Heuristic gate: expanded upsampler captions must not invent multi-units or forbidden packaging. */
export function flux3CaptionViolatesConstraints(caption:string,dynamics:CompositionPlan):string[]{
 const t=caption.toLowerCase();
 const violations:string[]=[];
 const affirmative=t
  .replace(/\b(no|not|without|omit|excluding|never)\b[^.!?\n]{0,80}/g,' ')
  .replace(/\bexactly one\b[^.!?\n]{0,40}/g,' ');
 const subjects=dynamics.product.subjects.toLowerCase();
 const unit=/\bcookies?\b/.test(subjects)?'cookies?':/\bbottles?\b/.test(subjects)?'bottles?':'products?';
 if(dynamics.product.count===1){
  if(new RegExp(`\\b(two|three|several|multiple|pile|stack|dozen)\\b.{0,40}\\b${unit}\\b|\\b${unit}\\b.{0,40}\\b(on a plate|on plates|tray)\\b`).test(affirmative))
   violations.push('Caption invents multiple product units or a plated/tray arrangement.');
  if(/\bplate of cookies\b|\bcookie platter\b|\bassortment of cookies\b/.test(affirmative)&&/\bcookie/.test(subjects))
   violations.push('Caption invents a multi-cookie plate.');
 }
 if(/\bfoil\b|\bbaking tray\b|\baluminum tray\b|\btin container\b/.test(affirmative)&&dynamics.product.packagingPolicy==='omit-if-not-product')
  violations.push('Caption reintroduces packaging that Dynamics omit.');
 if(/\b(certif|organic|gluten|allergen|award-winning|best[- ]selling)\b/.test(affirmative))
  violations.push('Caption invents unsupported marketing claims.');
 if(/\b(baguette|bread roll|loaf of bread|elongated (bread|roll))\b/.test(affirmative)&&/\bcookie/.test(subjects))
  violations.push('Caption describes bread/loaf morphology instead of cookie planform.');
 if(isBottleSubject(dynamics)&&/\b(cylinder bottle|round jar|square flacon|sphere bottle)\b/.test(affirmative))
  violations.push('Caption invents an alternate bottle silhouette.');
 return violations;
}

/** Choose the prompt that actually reaches CLIP — denser when pup is skipped. */
export function flux3RuntimePrompt(spatial:Flux3SpatialPlan,skipPup=process.env.ADSTUDIO_FLUX3_SKIP_PUP==='1'){
 return skipPup?spatial.directorPrompt:spatial.shortPrompt;
}
