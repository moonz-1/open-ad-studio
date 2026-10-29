import type {CreativePlan} from './creative-engine.ts';
import {sceneDirection,type CampaignArchetype} from './ad-scene.ts';

/** Abstract creative mechanisms — not scene templates. */
export const creativeHooks=[
 'sensory-reveal','product-transformation','dramatic-reveal','human-interaction',
 'lifestyle-moment','artistic-metaphor','unexpected-perspective','craftsmanship-detail',
 'emotional-story','graphic-juxtaposition','rhythmic-comparison','variety-showcase'
] as const;
export type CreativeHook=typeof creativeHooks[number];

export type MarketingGoal='awareness'|'desire'|'consideration'|'launch'|'retention'|'catalog';
export type FidelityNeed='exact-packaging'|'recognizable-product'|'creative-interpretation';
/** Lightweight product-sense tags derived from disclosed copy/facts — not fixed industry templates. */
export type SensoryLane='indulgent-food'|'comfort-care'|'refreshing-scent'|'athletic-energy'|'refined-object'|'general';

export type CreativeIntelligence={
 version:1;
 brandDistinctiveness:string;
 category:string;
 sensoryLane:SensoryLane;
 marketingGoal:MarketingGoal;
 occasion?:string;
 productAttributes:string[];
 intendedFeeling:string;
 consumerMotivation:string;
 creativeHook:CreativeHook;
 visualReaction:string;
 photographicApproach:string;
 videoConcept:string;
 copyDirection:string;
 factualConstraints:string[];
 fidelity:FidelityNeed;
 archetype:CampaignArchetype;
 rationale:string;
};

const clip=(s:string|undefined,n=240)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const lower=(...parts:(string|undefined)[])=>parts.map(p=>p||'').join(' ').toLowerCase();

export function sensoryLaneFor(plan:CreativePlan):SensoryLane{
 const text=lower(plan.input.productType,plan.input.request,plan.input.facts.description,plan.input.facts.texture,plan.input.brand.dna.tone,plan.concepts.find(c=>c.id===plan.selectedId)?.idea);
 if(/cookie|bakery|pastry|chocolate|bread|cinnamon|food|meal|snack|coffee|dessert/i.test(text))return 'indulgent-food';
 if(/lotion|cream|serum|skincare|moisturizer|balm|spa|comfort|soft fabric|cashmere|calm care/i.test(text))return 'comfort-care';
 if(/fragrance|perfume|cologne|scent|marine|woody|floral|citrus|fresh breeze/i.test(text))return 'refreshing-scent';
 if(/sport|athletic|run|train|energy|sneaker|jersey|performance/i.test(text))return 'athletic-energy';
 if(/jewel|ring|necklace|watch|metal|glass|lens|device|tech|elegant|craft/i.test(text))return 'refined-object';
 return 'general';
}

/** Propose 2–3 meaningfully different hooks for this plan (deterministic, extensible). */
export function proposeCreativeHooks(plan:CreativePlan):{hook:CreativeHook;why:string}[]{
 const {archetype}=sceneDirection(plan);
 const lane=sensoryLaneFor(plan);
 const text=lower(plan.input.productType,plan.input.request,plan.input.facts.description,plan.input.brand.dna.tone,plan.input.brand.dna.visualStyle,plan.concepts.find(c=>c.id===plan.selectedId)?.idea);
 const out:{hook:CreativeHook;why:string}[]=[];
 const add=(hook:CreativeHook,why:string)=>{if(!out.some(o=>o.hook===hook))out.push({hook,why});};
 if(lane==='indulgent-food'||archetype==='food-editorial'){
  add('sensory-reveal','Make texture, warmth or freshness the persuasion.');
  add('lifestyle-moment','Show a believable serving or sharing ritual.');
  add('unexpected-perspective','A closer or overhead vantage that centers the product.');
 }else if(lane==='comfort-care'){
  add('artistic-metaphor','Soft materials and diffused light communicate comfort without invented claims.');
  add('craftsmanship-detail','Quiet attention to vessel, viscosity cue and tactile contrast.');
  add('emotional-story','A calm before/after-of-feeling beat that stays non-clinical.');
 }else if(lane==='refreshing-scent'){
  add('artistic-metaphor','Atmosphere and materials echo disclosed scent character only.');
  add('dramatic-reveal','Build toward the bottle as a refined payoff.');
  add('unexpected-perspective','Air, light and surface as sensory metaphors — never invented notes.');
 }else if(lane==='athletic-energy'||archetype==='graphic-energy'){
  add('graphic-juxtaposition','Bold contrast and silhouette carry energy.');
  add('product-transformation','Motion that suggests capability without false performance claims.');
  add('human-interaction','A credible use beat where the product stays identifiable.');
 }else if(lane==='refined-object'){
  add('craftsmanship-detail','Reflection, edge light and material precision are the hook.');
  add('dramatic-reveal','Anticipation then a clear object payoff.');
  add('unexpected-perspective','A striking angle that still reads as the real product.');
 }else{
  add('lifestyle-moment','Show the product in a credible desire or use context.');
  add('craftsmanship-detail','Make material quality and design the persuasion.');
  add('emotional-story','Lead with feeling, land on the product truthfully.');
 }
 if(/variant|flavor|shade|color|collection|lineup|set of/i.test(text))add('rhythmic-comparison','Repeated framing across variants builds catalog clarity.');
 if(/reveal|launch|new|unbox|open/i.test(text))add('dramatic-reveal','Anticipation then payoff fits a launch story.');
 return out.slice(0,3);
}

function photographicFor(hook:CreativeHook,lane:SensoryLane){
 if(hook==='sensory-reveal')return lane==='indulgent-food'
  ?'Close, appetizing light that makes surface and crumb undeniable.'
  :'Close, tactile lighting that makes material quality undeniable.';
 if(hook==='dramatic-reveal')return 'Composed negative space that stages a reveal payoff.';
 if(hook==='rhythmic-comparison')return 'Matched framing so variants or beats read as a set.';
 if(hook==='artistic-metaphor'){
  if(lane==='refreshing-scent')return 'Mineral, air or botanical atmosphere that echoes disclosed scent character only.';
  if(lane==='comfort-care')return 'Soft fabric, warm diffusion and gentle material contrast.';
  return 'Metaphorical materials and light that echo brand feeling — no invented claims.';
 }
 if(hook==='graphic-juxtaposition')return 'High-contrast silhouette, graphic light, decisive crop.';
 if(hook==='craftsmanship-detail')return 'Edge light, reflection and finish detail at hero scale.';
 if(hook==='human-interaction')return 'Believable hands-or-body scale with the product still readable.';
 return 'Intentional hero composition with coherent light and contact.';
}

function videoFor(hook:CreativeHook,lane:SensoryLane){
 if(hook==='dramatic-reveal')return 'Anticipation beat → brief obscuring or decisive move → product payoff → brand end.';
 if(hook==='rhythmic-comparison')return 'Repeated interaction or angle across beats with timed brand payoff.';
 if(hook==='sensory-reveal')return lane==='indulgent-food'
  ?'Slow approach or light shift that heightens texture and appetite.'
  :'Slow approach or light shift that heightens tactile material quality.';
 if(hook==='artistic-metaphor')return lane==='comfort-care'
  ?'Soft environmental drift toward a calm product landing.'
  :'Atmospheric motion that supports mood, then settles on the product.';
 if(hook==='graphic-juxtaposition'||hook==='product-transformation')return 'Energetic but controlled camera or subject motion that lands on a clear product hold.';
 return 'Opening context → product-focused motion → branded payoff.';
}

export function buildCreativeIntelligence(plan:CreativePlan,hook?:CreativeHook):CreativeIntelligence{
 const {archetype,concept:c}=sceneDirection(plan);
 const strategy=c.strategy;
 const lane=sensoryLaneFor(plan);
 const proposals=proposeCreativeHooks(plan);
 const chosen=hook||proposals[0].hook;
 if(hook&&!proposals.some(p=>p.hook===hook))proposals.unshift({hook,why:'Adapted from reference pacing/structure for this brand.'});
 const f=plan.input.facts;
 const attrs=[f.texture,f.container,f.arrangement,f.description].map(s=>clip(s,120)).filter(Boolean);
 const feeling=clip(strategy?.feeling||plan.input.brand.dna.tone||c.idea,160)||'Clear, distinctive, brand-true.';
 const fidelity:FidelityNeed=plan.input.productType==='packaged-goods'||/exact|label|logo|ingredient|packaging must/i.test((plan.input.request||'')+f.description)?'exact-packaging'
  :chosen==='artistic-metaphor'||chosen==='dramatic-reveal'?'creative-interpretation':'recognizable-product';
 return {
  version:1,
  brandDistinctiveness:clip(strategy?.proof.map(p=>p.quote).join('; ')||plan.input.brand.dna.visualStyle||plan.input.brand.dna.positioning||plan.input.brand.dna.name,200),
  category:plan.input.productType,
  sensoryLane:lane,
  marketingGoal:strategy?.objective||(/\bconsideration\b/i.test(plan.input.request||'')?'consideration':/\b(?:launch|introduc\w*|new (?:product|release|collection))\b/i.test(plan.input.request||'')?'launch':/\b(?:catalog|collection|variant)\b/i.test(plan.input.request||'')?'catalog':'desire'),
  productAttributes:attrs.slice(0,6),
  intendedFeeling:feeling,
  consumerMotivation:clip(strategy?strategy.audienceHypothesis+' '+strategy.tension:c.idea,300),
  creativeHook:chosen,
  visualReaction:strategy?.memory||proposals.find(p=>p.hook===chosen)?.why||'Make the product feel desirable and specific.',
  photographicApproach:strategy?clip(strategy.focus+' '+c.composition+' '+c.lighting,650):photographicFor(chosen,lane),
  videoConcept:strategy?clip(strategy.opening+' then '+strategy.payoff,650):videoFor(chosen,lane),
  copyDirection:clip(plan.composition.headline+' — '+c.title,180),
  factualConstraints:[
   f.count?`Keep exactly ${f.count} product(s) when fidelity requires it.`:'Do not invent product count.',
   'Do not invent ingredients, clinical claims, scent notes or unstated benefits.',
   clip(f.description,200)
  ].filter(Boolean),
  fidelity,
  archetype,
  rationale:strategy?strategy.businessFit+' Argument checked; output quality unreviewed.':`Hook ${chosen} · lane ${lane} · archetype ${archetype}: ${proposals.find(p=>p.hook===chosen)?.why||''}`
 };
}
