/** Composition & Dynamics — structured advertising spatial direction.
 * Derived from Creative Director decisions; compiles into Klein/Qwen prompts.
 * Shared language for still frames and (later) video shot progression.
 * Not a vision model: identity anchors come from owner-confirmed facts. */
import type {CreativePlan,CreativeConcept,CreativeInput} from './creative-engine.ts';

export type PackagingPolicy='preserve'|'restyle'|'omit-if-not-product';
export type CompositionMode='static'|'video-progression';
/** Local copy of sensory lanes — avoids creative-intelligence ↔ creative-engine import cycles. */
type SensoryLane='indulgent-food'|'comfort-care'|'refreshing-scent'|'athletic-energy'|'refined-object'|'general';
function sensoryLane(input:CreativeInput,concept:CreativeConcept):SensoryLane{
 const products=(input.brand.products||[]).map(p=>`${p.name} ${p.description}`).join(' ');
 const text=`${input.productType} ${input.request||''} ${input.facts.description} ${input.facts.texture} ${input.facts.arrangement} ${input.brand.dna.tone} ${input.brand.dna.description} ${input.brand.dna.visualStyle} ${concept.idea} ${products}`.toLowerCase();
 // Word-bounded where short tokens collide (e.g. train/run inside unrelated words).
 if(/\b(cookie|bakery|pastry|chocolate|bread|cinnamon|dessert|snack)s?\b|\b(food|meal|coffee)\b/.test(text))return 'indulgent-food';
 if(/\b(lotion|cream|serum|skincare|moisturizer|balm|spa)\b|soft fabric|cashmere|calm care/.test(text))return 'comfort-care';
 if(/\b(fragrance|perfume|cologne|scent)\b|\b(marine|woody|floral|citrus)\b|fresh breeze/.test(text))return 'refreshing-scent';
 if(/\b(laptop|notebook|computer|electronics|aluminium|aluminum|device)\b|\b(hinge|bezel|specular)s?\b|\b(jewel|watch|lens|metal)\b/.test(text))return 'refined-object';
 if(/\b(sport|athletic|sneaker|jersey)\b|\b(train|run|energy|performance)\b/.test(text))return 'athletic-energy';
 return 'general';
}

export type PlacementBias='lower-left'|'lower-center'|'lower-right'|'mid-left'|'center';
export type ProductScale='dominant'|'balanced'|'intimate';
export type FramingModeIntent='full-product'|'intentional-closeup';
export type NormLayoutRect={x:number;y:number;width:number;height:number};

export type CompositionLayout={
 /** Normalized product-safe zone planned *before* generation. */
 productSafe:NormLayoutRect;
 /** Normalized copy-safe zone planned *before* generation. */
 copySafe:NormLayoutRect;
 placementBias:PlacementBias;
 productScale:ProductScale;
 framingMode:FramingModeIntent;
 /** Target export aspect for margin safety (feed 4:5, story 9:16, square 1:1). */
 outputAspect:'feed'|'story'|'square'|'landscape';
 lightDirection:'camera-left'|'camera-right'|'overhead-soft'|'back-rim';
 balanceNote:string;
};

 export type CompositionPlan={
 version:1;
 mode:CompositionMode;
 concept:{title:string;idea:string;audienceResponse:string;memory:string};
 product:{
  subjects:string;
  identityAnchors:string[];
  count:number|'observed';
  arrangement:string;
  packagingPolicy:PackagingPolicy;
 };
 frame:{
  heroPlacement:string;
  depth:string;
  negativeSpace:string;
  hierarchy:string;
  energy:'restrained'|'balanced'|'dynamic';
 };
 camera:{viewpoint:string;distance:string;framing:string;lensFeel:string};
 light:{key:string;atmosphere:string};
 brand:{tone:string;flexibility:string;constraints:string[]};
 supports:{allowed:boolean;note:string};
 typography:{safeRegion:string};
 /** Structured product/copy zones — drives FLUX boxes + post-gen framing checks. */
 layout:CompositionLayout;
 /** Optional shared video language — still acceptance uses beat[0] only. */
 progression:{beats:{at:string;attention:string;change:string}[]};
 acceptance:string[];
};

const clip=(s:string|undefined,n=320)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const anchorsFromFacts=(input:CreativeInput)=>{
 // Owner-confirmed observations remain literal; category words are not evidence of
 // cap colour, material, crust, chocolate, or a particular silhouette.
 return [
  input.facts.description&&`Observed product identity: ${clip(input.facts.description,280)}`,
  input.facts.texture&&`Observed surface: ${clip(input.facts.texture,200)}`,
  input.facts.container&&`Observed container: ${clip(input.facts.container,160)}`,
 ].filter((s):s is string=>!!s);
};

function packagingPolicy(input:CreativeInput,controls:CreativePlan['context']['controls']):PackagingPolicy{
 if(controls.fidelity==='strict'||controls.fidelity==='high'||controls.arrangement==='exactly'||controls.exactCount)return 'preserve';
 const container=(input.facts.container||'').toLowerCase();
 if(/none|not the product|packaging only|omit|n\/a/.test(container))return 'omit-if-not-product';
 // Glass bottles / vials ARE the product — restaging the set must not drop packaging geometry.
 const productBlob=`${input.facts.container} ${input.facts.description} ${input.productType}`;
 if(/\b(bottle|vial|atomizer|flacon|glass jar|pump bottle)\b/i.test(productBlob))return 'preserve';
 if(controls.fidelity==='medium'||controls.fidelity==='low'||controls.background==='replace')return 'omit-if-not-product';
 return 'restyle';
}

function energyFor(lane:SensoryLane,idea:string,tone:string):CompositionPlan['frame']['energy']{
 const t=`${idea} ${tone}`.toLowerCase();
 if(/restrain|quiet|calm|minimal|negative space|asymmetric luxury/.test(t)||lane==='refreshing-scent')return 'restrained';
 if(/diagonal|stagger|energetic|bold|dynamic|motion|graphic/.test(t)||lane==='athletic-energy')return 'dynamic';
 return 'balanced';
}

function arrangementFor(input:CreativeInput,lane:SensoryLane,concept:CreativeConcept,policy:PackagingPolicy):string{
 const count=input.facts.count;
 if(policy==='preserve'&&input.facts.arrangement)return clip(input.facts.arrangement,220);
 if(lane==='indulgent-food'){
  if(count&&count>=3)return `Arrange ${count} recognizable units in a loose diagonal grouping with breathing room; preserve their observed shape and surface. Packaging follows the reviewed policy.`;
  if(count===2)return 'Pair the two observed units with slight overlap while keeping both recognizable. Preserve their actual surface and proportions.';
  if(count===1)return 'Single hero unit slightly off-centre; keep the observed product silhouette and surface readable. Packaging follows the reviewed policy.';
  return clip(input.facts.arrangement,220)||'Keep the observed product count and grouping; do not assume a single unit or invent hidden geometry.';
 }
 if(lane==='refined-object'){
  if(count&&count>=2)return `Arrange ${count} units at precise staggered angles: one emphasizing the primary face/display, another the thin profile or construction edge; controlled gaps, no floating chaos.`;
  return 'Single refined object with deliberate asymmetric placement; one clear silhouette and one secondary material reading.';
 }
 if(lane==='refreshing-scent')return 'Asymmetric bottle placement with generous negative space; reflections and architecture support, never invent notes.';
 if(lane==='athletic-energy')return 'Strong silhouette with diagonal energy and graphic depth; product remains the only performance claim.';
 return clip(concept.composition,220)||clip(input.facts.arrangement,220)||'Readable product grouping with intentional negative space.';
}

function cameraFor(lane:SensoryLane,controls:CreativePlan['context']['controls'],concept:CreativeConcept){
 if(controls.angle==='none')return {viewpoint:'Match the source viewpoint.',distance:'Match source scale.',framing:clip(concept.composition,160),lensFeel:'Natural photographic perspective.'};
 // Avoid forbidden viewpoint tokens (overhead/profile) even in negations — preflight scans the camera string.
 if(lane==='indulgent-food')return {viewpoint:'Slightly elevated three-quarter tabletop, only where supported by the reference.',distance:'Close enough to read the actually observed surface; full product height visible.',framing:clip(concept.composition,160)||'Compact hero slightly below centre with open upper copy field.',lensFeel:'Shallow depth; tactile food editorial — prefer viewpoints the identity reference can support.'};
 if(lane==='refined-object')return {viewpoint:'Controlled three-quarter that reveals real geometry.',distance:'Product-dominant with architectural breathing room.',framing:clip(concept.composition,160)||'Asymmetric hero with graphic negative space.',lensFeel:'Precise, low distortion, material-accurate reflections.'};
 return {viewpoint:clip(concept.camera,160),distance:'Product-readable — keep the complete product silhouette inside the frame with breathing room.',framing:clip(concept.composition,160)||'Full-product hero with intentional negative space for typography.',lensFeel:'Believable commercial still.'};
}

/** Evidence-driven placement — vary by concept signals, never hardcode fragrance→right / bakery→center. */
export function planCompositionLayout(
 input:CreativeInput,
 concept:CreativeConcept,
 energy:CompositionPlan['frame']['energy'],
 lane:SensoryLane
):CompositionLayout{
 const blob=`${concept.title} ${concept.idea} ${concept.composition} ${concept.hierarchy} ${concept.lighting} ${input.request||''}`.toLowerCase();
 const framingMode:FramingModeIntent=
  /\b(intentional close-?up|detail crop|macro crop|extreme crop)\b/.test(blob)
  ||(input.constraints?.crop==='slight'&&/\b(close-?up|macro|fill the frame)\b/.test(blob))
   ?'intentional-closeup':'full-product';
 const fmt=String((input as {format?:string}).format||'feed');
 const outputAspect:CompositionLayout['outputAspect']=
  fmt==='story'?'story':fmt==='square'?'square':fmt==='landscape'?'landscape':'feed';

 let placementBias:PlacementBias='lower-center';
 if(/\b(lower[- ]left|left third|left of centre|left of center)\b/.test(blob))placementBias='lower-left';
 else if(/\b(lower[- ]right|right third|right of centre|right of center)\b/.test(blob))placementBias='lower-right';
 else if(/\b(mid[- ]left|centre-left|center-left)\b/.test(blob))placementBias='mid-left';
 else if(/\b(centred|centered|dead centre|dead center)\b/.test(blob))placementBias='center';
 else if(/\b(asymmetric|off[- ]centre|off[- ]center|negative space on the right|lettering on the right)\b/.test(blob))placementBias='lower-left';
 else if(/\b(negative space on the left|lettering on the left|quiet column)\b/.test(blob))placementBias='lower-right';
 else if(energy==='dynamic')placementBias='lower-left';
 else if(energy==='restrained')placementBias='lower-center';
 else placementBias=lane==='indulgent-food'?'lower-center':'lower-left';

 // Premium heroes default to dominant product scale — postage-stamp products fail later gates.
 const productScale:ProductScale=
  framingMode==='intentional-closeup'?'intimate':
  /\b(wide set|environmental wide|tiny product|distant hero|lifestyle wide)\b/.test(blob)?'balanced':
  /\b(closer|dominant|fill|large|prominen|hero scale)\b/.test(blob)
  ||lane==='refreshing-scent'||lane==='refined-object'||lane==='indulgent-food'||lane==='comfort-care'
   ?'dominant':'balanced';

 /** Larger product-safe zones for intentional prominence; still leave ≥8% canvas margin. */
 const productSafe=productSafeZone(placementBias,productScale);

 const copySafe:NormLayoutRect=
  placementBias==='lower-right'||placementBias==='center'
   ?{x:0.06,y:0.05,width:0.40,height:0.28}
   :placementBias==='lower-left'||placementBias==='mid-left'
    ?{x:0.54,y:0.05,width:0.40,height:0.28}
    :{x:0.08,y:0.05,width:0.84,height:0.24};

 const lightDirection:CompositionLayout['lightDirection']=
  /\b(from the right|camera-right|right key)\b/.test(blob)?'camera-right':
  /\b(backlight|rim|contre)\b/.test(blob)?'back-rim':
  /\b(overhead|soft overcast)\b/.test(blob)?'overhead-soft':'camera-left';

 const balanceNote=
  `Product ${placementBias} at ${productScale} scale (intentional prominence); copy ${copySafe.x<0.3?'left/upper':'right/upper'}; `+
  `continuous photographic environment with grounded contact — not a cutout on flat colour; framing=${framingMode}.`;

 return {productSafe,copySafe,placementBias,productScale,framingMode,outputAspect,lightDirection,balanceNote};
}

/** Pre-gen product-safe box sized for prominence without edge clipping. */
export function productSafeZone(placementBias:PlacementBias,productScale:ProductScale):NormLayoutRect{
 const size=productScale==='intimate'?{w:0.62,h:0.64}:productScale==='dominant'?{w:0.56,h:0.58}:{w:0.48,h:0.50};
 const y=productScale==='intimate'?0.22:productScale==='dominant'?0.30:0.36;
 if(placementBias==='lower-left')return {x:0.08,y,width:size.w,height:size.h};
 if(placementBias==='lower-right')return {x:Math.max(0.08,0.92-size.w),y,width:size.w,height:size.h};
 if(placementBias==='mid-left')return {x:0.08,y:Math.max(0.18,y-0.08),width:size.w*0.95,height:size.h};
 if(placementBias==='center')return {x:(1-size.w)/2,y:Math.max(0.22,y-0.04),width:size.w,height:size.h};
 return {x:(1-size.w)/2,y,width:size.w,height:size.h}; // lower-center
}

export function heroPlacementProse(layout:CompositionLayout):string{
 const map:Record<PlacementBias,string>={
  'lower-left':'Lower-left hero with calm right/upper field for lettering — complete product inside frame with breathing room.',
  'lower-right':'Lower-right hero with calm left/upper field for lettering — complete product inside frame with breathing room.',
  'lower-center':'Lower-centre hero with balanced side margins and open upper lettering band — full silhouette visible.',
  'mid-left':'Mid-left hero with open right column for typography — product fully inside frame.',
  'center':'Centred hero with equal margins and open upper band — full product readable.',
 };
 return map[layout.placementBias];
}

/** Build a compact composition plan from the selected Creative Director concept. */
export function buildCompositionPlan(plan:CreativePlan,mode:CompositionMode='static'):CompositionPlan{
 const concept=plan.concepts.find(c=>c.id===plan.selectedId);if(!concept)throw Error('Choose a reviewed creative direction.');
 const input=plan.input,controls=plan.context.controls,lane=sensoryLane(input,concept);
 const policy=packagingPolicy(input,controls);
 const strategy=concept.strategy;
 const energy=energyFor(lane,concept.idea,input.brand.dna.tone);
 const arrangement=arrangementFor(input,lane,concept,policy);
 const camera=cameraFor(lane,controls,concept);
 const layout=planCompositionLayout(input,concept,energy,lane);
 const count=controls.exactCount&&input.facts.count!=null?input.facts.count:input.facts.count??'observed';
 const identityAnchors=anchorsFromFacts(input);
 const progression=mode==='video-progression'
  ?{beats:[
    {at:'0-2s',attention:'Establish spatial hierarchy and product recognition.',change:'Restrained camera or light shift; keep identity anchors stable.'},
    {at:'2-4s',attention:'Resolve on the clearest product reading.',change:'Hold or cut to recognition frame; no invented product action.'},
    {at:'end',attention:'Brand/typography zone remains clear.',change:'Separate end card; do not bake logos into pixels.'},
   ]}
  :{beats:[{at:'still',attention:'Immediate product recognition and advertising idea.',change:'Single decisive arrangement; no temporal progression.'}]};
 return {
  version:1,mode,
  concept:{title:concept.title,idea:clip(concept.idea,280),audienceResponse:clip(strategy?.feeling||strategy?.audienceHypothesis,200),memory:clip(strategy?.memory,200)},
  product:{
   subjects:clip(strategy?.focus||input.facts.description,220),
   identityAnchors,
   count,
   arrangement,
   packagingPolicy:policy,
  },
  frame:{
   heroPlacement:heroPlacementProse(layout),
   depth:lane==='refined-object'?'Controlled layered depth; geometric light falloff.':lane==='indulgent-food'?'Tactile near-field product; soft environmental depth behind.':layout.balanceNote,
   negativeSpace:clip(concept.hierarchy,180)||`Reserve copy-safe region (${Math.round(layout.copySafe.x*100)}%,${Math.round(layout.copySafe.y*100)}%) for typography; keep product fully inside product-safe zone.`,
   hierarchy:clip(concept.hierarchy,200)||'Product first; supports never impersonate the product; type later in the planned copy-safe zone.',
   energy,
  },
  camera:{
   ...camera,
   distance:layout.productScale==='intimate'?camera.distance:layout.productScale==='dominant'
    ?'Product-dominant but complete silhouette stays inside the frame with breathing room.'
    :'Balanced product scale — neither edge-cropped nor lost in the set.',
   framing:layout.framingMode==='intentional-closeup'
    ?'Intentional close-up only as briefed; remaining branding must stay readable.'
    :'Full-product hero: entire silhouette inside frame with ≥8% breathing room on all sides.',
  },
  light:{key:clip(concept.lighting,220),atmosphere:clip(input.brand.dna.visualStyle||input.brand.dna.tone,180)},
  brand:{
   tone:clip(input.brand.dna.tone,160),
   flexibility:policy==='preserve'?'Strict appearance locks win over drama.':policy==='omit-if-not-product'?'Owner-authorized creative reconstruction; packaging may be omitted when it is not the product.':'Modest restyling within disclosed brand signals.',
   constraints:[
    'Do not invent ingredients, specs, performance or certifications.',
    'Unobserved interiors require explicit owner approval.',
    ...(controls.exactCount?[`Keep exactly ${input.facts.count} visible units.`]:[]),
   ],
  },
  supports:{
   allowed:policy!=='preserve'&&controls.creativity!=='low',
   note:policy==='preserve'?'No invented supports that alter packaging geometry.':'Minimal brand-appropriate supports only when they serve the advertising idea.',
  },
  typography:{safeRegion:`Normalized copy-safe ${JSON.stringify(layout.copySafe)}; keep free of competing product mass.`},
  layout,
  progression,
  acceptance:[
   'Recognizable product identity anchors remain visible.',
   'Full product silhouette inside frame (unless intentional close-up was briefed).',
   'Product has intentional prominence — not a tiny object lost in empty set.',
   'Environment is one continuous photograph with soft grounded contact shadow; no floating cutouts, flat colour voids, or hard synthetic shelves.',
   'Arrangement matches the planned spatial relationships and product-safe zone.',
   'Composition serves the advertising idea and intended response.',
   'Typography-safe region remains usable after generation.',
   'No unsupported product claims appear as facts.',
  ],
};
}

/** Compile structured dynamics into generation-facing prose (still or first video beat). */
export function compositionPlanPrompt(dynamics:CompositionPlan){
 const p=dynamics.product,f=dynamics.frame,c=dynamics.camera;
 const pack=p.packagingPolicy==='preserve'?'Keep original packaging/container geometry.':p.packagingPolicy==='omit-if-not-product'?'Original packaging may be omitted when it is not the product itself.':'Packaging may be modestly restyled; do not invent new marks.';
 return [
  `Advertising concept: ${dynamics.concept.title} — ${dynamics.concept.idea}`,
  `Intended response (hypothesis): ${dynamics.concept.audienceResponse||'owner-reviewed consideration.'} Visual memory: ${dynamics.concept.memory||'product recognition.'}`,
  `Product subjects: ${p.subjects}. Identity anchors to retain: ${p.identityAnchors.join('; ')}. Count: ${p.count}. Arrangement: ${p.arrangement}. Packaging policy: ${pack}`,
  `Frame: hero ${f.heroPlacement} Depth: ${f.depth} Energy: ${f.energy}. Hierarchy: ${f.hierarchy} Negative space: ${f.negativeSpace}`,
  `Camera: ${c.viewpoint} Distance: ${c.distance} Framing: ${c.framing} Lens: ${c.lensFeel}`,
  `Light: ${dynamics.light.key} Atmosphere: ${dynamics.light.atmosphere}`,
  `Brand tone: ${dynamics.brand.tone}. Flexibility: ${dynamics.brand.flexibility}. Constraints: ${dynamics.brand.constraints.join(' ')}`,
  `Supports: ${dynamics.supports.allowed?dynamics.supports.note:'None beyond disclosed product surfaces.'}`,
  `Typography-safe region: ${dynamics.typography.safeRegion}`,
  dynamics.mode==='video-progression'
   ?`Shot progression: ${dynamics.progression.beats.map(b=>`${b.at}: ${b.attention} (${b.change})`).join(' · ')}`
   :`Still delivery: ${dynamics.progression.beats[0]?.attention||'One compelling arrangement.'}`,
  `Acceptance: ${dynamics.acceptance.join(' ')}`,
 ].join('\n');
}

/** Sync concrete concept prose fields from a dynamics plan (keeps UI/cards coherent). */
export function applyDynamicsToConcept(concept:CreativeConcept,dynamics:CompositionPlan):CreativeConcept{
 return {
  ...concept,
  composition:clip(`${dynamics.frame.heroPlacement} ${dynamics.product.arrangement} ${dynamics.frame.negativeSpace}`,500),
  camera:clip(`${dynamics.camera.viewpoint} ${dynamics.camera.distance} ${dynamics.camera.lensFeel}`,400),
  lighting:clip(dynamics.light.key,400),
  hierarchy:clip(`${dynamics.frame.hierarchy} ${dynamics.typography.safeRegion}`,400),
  environment:concept.environment,
 };
}

type RefinementPatch=Partial<{
 arrangement:string;heroPlacement:string;depth:string;negativeSpace:string;energy:CompositionPlan['frame']['energy'];
 viewpoint:string;distance:string;framing:string;atmosphere:string;supportsNote:string;
}>;

/** Map owner refinement language onto concrete composition fields — not vague prompt append. */
export function parseCompositionRefinement(text:string):RefinementPatch{
 const t=text.toLowerCase().trim();if(!t)return {};
 const patch:RefinementPatch={};
 if(/diagonal/.test(t)){patch.arrangement='Arrange products on a clear diagonal with staggered spacing and readable silhouettes.';patch.energy='dynamic';patch.heroPlacement='Diagonal hero path from lower-left toward upper-right.';}
 if(/closer|bring .+ closer|tighter crop|fill the frame/.test(t)){patch.distance='Move closer: product fills more of the frame while identity anchors stay complete.';patch.framing='Tighter product-dominant framing with reduced peripheral set.';}
 if(/depth|separation|layers|foreground/.test(t)){patch.depth='Increase foreground/mid/background separation; keep the hero sharp against softer depth.';}
 if(/energetic|energy|dynamic|bold/.test(t)){patch.energy='dynamic';patch.heroPlacement='Energetic off-centre hero with graphic diagonals.';}
 if(/negative space|more copy|space for (copy|type|lettering)|breathing room/.test(t)){patch.negativeSpace='Expand calm negative space for typography; reduce competing mid-ground detail.';patch.framing='Leave a generous open field adjacent to the hero for lettering.';patch.energy=patch.energy||'restrained';}
 if(/restrain|calmer|quieter|minimal|less busy/.test(t)){patch.energy='restrained';patch.arrangement='Simplify grouping; fewer competing angles; clearer single hero.';}
 if(/like this brand|more brand|brand.feel|on.brand/.test(t)){patch.atmosphere='Lean harder into disclosed brand tone and visual style; avoid generic stock mood.';}
 if(/overhead|top.?down|flat.?lay/.test(t)){patch.viewpoint='True overhead flat-lay on a continuous plane.';}
 if(/eye.?level|three.?quarter|tabletop/.test(t)){patch.viewpoint='Slightly elevated three-quarter tabletop viewpoint.';}
 if(/no props|remove props|fewer props/.test(t)){patch.supportsNote='No supporting props; product and primary surface only.';}
 return patch;
}

export function refineCompositionPlan(dynamics:CompositionPlan,text:string):CompositionPlan{
 const patch=parseCompositionRefinement(text);if(!Object.keys(patch).length)return dynamics;
 const energy=patch.energy||dynamics.frame.energy;
 let layout=dynamics.layout;
 const t=text.toLowerCase();
 if(/lower[- ]left|left third/.test(t)){const productScale=layout.productScale||'dominant';layout={...layout,placementBias:'lower-left',productScale,productSafe:productSafeZone('lower-left',productScale),copySafe:{x:0.54,y:0.05,width:0.40,height:0.28}};}
 else if(/lower[- ]right|right third/.test(t)){const productScale=layout.productScale||'dominant';layout={...layout,placementBias:'lower-right',productScale,productSafe:productSafeZone('lower-right',productScale),copySafe:{x:0.06,y:0.05,width:0.40,height:0.28}};}
 else if(/negative space|more copy|breathing room/.test(t))layout={...layout,productScale:layout.productScale==='intimate'?'balanced':layout.productScale||'dominant',framingMode:'full-product',productSafe:productSafeZone(layout.placementBias,layout.productScale==='intimate'?'balanced':layout.productScale||'dominant')};
 else if(/closer|tighter crop|fill the frame|more prominen|larger product|bigger bottle/.test(t)&&!/full product|entire bottle|complete silhouette/.test(t)){
  const intimate=/\b(intentional|detail|macro)\b/.test(t);
  const productScale:ProductScale=intimate?'intimate':'dominant';
  layout={...layout,productScale,framingMode:intimate?'intentional-closeup':layout.framingMode,productSafe:productSafeZone(layout.placementBias,productScale)};
 }
 const next:CompositionPlan={
  ...dynamics,
  product:{...dynamics.product,arrangement:patch.arrangement||dynamics.product.arrangement},
  frame:{
   ...dynamics.frame,
   heroPlacement:patch.heroPlacement||heroPlacementProse(layout),
   depth:patch.depth||dynamics.frame.depth,
   negativeSpace:patch.negativeSpace||dynamics.frame.negativeSpace,
   energy,
  },
  camera:{
   ...dynamics.camera,
   viewpoint:patch.viewpoint||dynamics.camera.viewpoint,
   distance:patch.distance||dynamics.camera.distance,
   framing:patch.framing||dynamics.camera.framing,
  },
  light:{...dynamics.light,atmosphere:patch.atmosphere||dynamics.light.atmosphere},
  supports:patch.supportsNote?{allowed:true,note:patch.supportsNote}:dynamics.supports,
  layout,
 };
 return next;
}

/** Apply owner refinement onto a CreativePlan: updates dynamics + selected concept prose + leaves draft to recompile. */
export function refineCreativeComposition(plan:CreativePlan,text:string):CreativePlan{
 const base=plan.dynamics||buildCompositionPlan(plan);
 const dynamics=refineCompositionPlan(base,text);
 const concepts=plan.concepts.map(c=>c.id===plan.selectedId?applyDynamicsToConcept(c,dynamics):c);
 return {...plan,dynamics,concepts:concepts as CreativePlan['concepts']};
}
