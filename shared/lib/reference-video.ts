import type {CreativePlan} from './creative-engine.ts';
import {buildCreativeIntelligence,type CreativeHook,type CreativeIntelligence} from './creative-intelligence.ts';
import {campaignVideoSize} from './campaign-motion.ts';

export type ReferenceRights='inspiration-only'|'user-owned-or-licensed';
export type Confidence='measured'|'observed'|'inferred';

export type ReferenceShot={
 index:number;
 start:number;
 end:number;
 duration:number;
 purpose:'anticipation'|'reveal'|'interaction'|'comparison'|'payoff'|'other';
 composition:string;
 camera:{motion:string;confidence:Confidence};
 interaction:string;
 keyframeUrls:string[];
};

export type ReferenceAnalysis={
 version:1;
 id:string;
 created:number;
 sourceUrl:string;
 originalUrl:string;
 bytes:number;
 duration:number;
 width:number;
 height:number;
 fps:number;
 rights:ReferenceRights;
 creativeMechanism:CreativeHook;
 mechanismConfidence:Confidence;
 shots:ReferenceShot[];
 transitions:{at:number;kind:string;confidence:Confidence}[];
 pacing:{avgShotSec:number;relative:{index:number;share:number}[];note:string};
 visualStyle:{lighting:string;graphics:string;ending:string;confidence:Confidence};
 transferablePrinciples:string[];
 analysisMethod:string;
 warnings:string[];
 /** Optional FFmpeg audio measurements — never implies soundtrack reuse rights. */
 audio?:import('./sound-director.ts').ReferenceAudioAnalysis;
};

export type CampaignShotBrief={
 index:number;
 execution?:'ltx'|'approved-still';
 effect?:'fade-in';
 motion?:'push-in'|'pull-out';
 framing?:'detail'|'full';
 action?:string;
 endingComposition?:string;
 purpose:ReferenceShot['purpose'];
 duration:number;
 sceneBrief:string;
 /** Which still seeds LTX for this beat. */
 startKeyframeStrategy:'source-still'|'hero-still'|'generated-open'|'hold';
 endKeyframeStrategy:'hero-still'|'generated-close'|'hold';
 cameraMovement:string;
 motionConstraints:string[];
 textOverlay?:{when:'start'|'mid'|'end';text:string};
 fidelity:string;
};

export type CampaignShotPlan={
 version:1;
 id:string;
 created:number;
 projectId:string;
 brandName:string;
 productSummary:string;
 concept:string;
 intendedOutcome:string;
 creativeHook:CreativeHook;
 sourceAnalysisId?:string;
 rights:ReferenceRights;
 shots:CampaignShotBrief[];
 editing:{transition:'cut'|'dissolve'|'wipe';brandOverlay:boolean;endingCta:boolean};
 fidelityRequirements:string[];
 intelligence:CreativeIntelligence;
 note:string;
};

const clip=(s:string|undefined,n=220)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);

function scaleDurations(raw:number[],n:number,totalTarget:number){
 const base=raw.length?raw.slice(0,n):Array.from({length:n},()=>totalTarget/n);
 const sum=base.reduce((a,b)=>a+b,0)||1;
 const scaled=base.map(d=>Math.max(1.5,Math.min(3,+(d/sum*totalTarget).toFixed(2))));
 while(scaled.reduce((a,b)=>a+b,0)>totalTarget+.05&&scaled.length){const i=scaled.indexOf(Math.max(...scaled));scaled[i]=Math.max(1.5,+(scaled[i]-0.15).toFixed(2));}
 return scaled;
}

/** Map measured pacing + inferred mechanism into an original brand shot plan (not a frame copy). */
export function planFromReference(plan:CreativePlan,analysis:ReferenceAnalysis,intel?:CreativeIntelligence):CampaignShotPlan{
 const intelligence=intel||buildCreativeIntelligence(plan,analysis.creativeMechanism);
 const product=clip(plan.input.facts.description,180)||clip(plan.input.productType,80);
 const brand=plan.input.brand.dna.name||'Brand';
 const hook=intelligence.creativeHook;
 const principles=analysis.transferablePrinciples;
 // One bounded LTX beat followed by an exact-pixel product payoff. No second near-identical LTX job.
 const n=2,scaled=scaleDurations(analysis.shots.map(s=>s.duration),n,4);
 const c=plan.concepts.find(c=>c.id===plan.selectedId)!,strategy=c.strategy;
 // Exact count/packaging locks never spend LTX: generative motion cannot certify unit count.
 const productSafeStill=intelligence.fidelity==='exact-packaging'||!!plan.context.controls.exactCount;
 const detail=plan.context.controls.crop!=='none'&&!productSafeStill;
 const opening=strategy?.opening||`Earn attention through the observed ${clip(plan.input.facts.texture||plan.input.facts.description,130)}; establish this product's material character.`;
 const payoff=strategy?.payoff||`Resolve the material cue into the complete ${product}; give the viewer time to recognize the actual product and brand.`;
 const constraints=['Preserve source identity, count, geometry, container and artwork.','No hands, package opening, fluids, consumption, transformations or invented props.','No generated typography or logos; copy is composed separately.',...intelligence.factualConstraints.slice(0,2)];
 const transition='cut' as const;
 const shots:CampaignShotBrief[]=[{
  index:0,purpose:'reveal',duration:scaled[0]??2,execution:productSafeStill?'approved-still':'ltx',effect:productSafeStill?'fade-in':undefined,framing:detail?'detail':'full',
  sceneBrief:`${brand}: ${opening} Product emphasis: ${strategy?.focus||clip(plan.input.facts.texture,150)}. Stay in the approved photograph's world.`,
  action:productSafeStill?'A half-second editorial light-up from black reveals the exact approved image; no synthesized package motion.':'Product remains still; camera tracks gently across the visible surface. No subject interaction.',
  endingComposition:detail?'A clearly disclosed central detail crop, ready for a decisive wider cut.':'The complete source grouping remains legible; cut to the product payoff without inventing another view.',
  startKeyframeStrategy:'hero-still',endKeyframeStrategy:'hold',
  cameraMovement:productSafeStill?'Locked source pixels; editorial fade-in only.':detail?'Small lateral camera drift across the cropped detail; finish without a reverse move.':'Restrained lateral camera drift, keeping the whole grouping in view; no orbit or invented rear geometry.',
  motionConstraints:constraints,fidelity:intelligence.fidelity
 },{
  index:1,purpose:'payoff',duration:scaled[1]??2,execution:'approved-still',framing:'full',sceneBrief:`${brand}: ${payoff}`,
  action:'Hard cut to the complete approved product image, held as exact pixels for recognition; no additional inference.',
  endingComposition:'Full source framing and recognizable packaging, then separately composed brand end card.',
  startKeyframeStrategy:'hero-still',endKeyframeStrategy:'hold',cameraMovement:'Locked editorial hold; no simulated subject motion.',
  motionConstraints:constraints,textOverlay:{when:'end',text:clip(plan.composition.headline||brand,48)},fidelity:intelligence.fidelity
 }];
 return {
  version:1,id:crypto.randomUUID().replace(/-/g,'').slice(0,16),created:Date.now(),
  projectId:plan.projectId,brandName:brand,productSummary:product,
  concept:clip(intelligence.videoConcept,280),
  intendedOutcome:clip(intelligence.visualReaction+' '+intelligence.intendedFeeling,220),
  creativeHook:hook,sourceAnalysisId:analysis.id,rights:analysis.rights,
  shots,editing:{transition,brandOverlay:true,endingCta:true},
  fidelityRequirements:[
   ...intelligence.factualConstraints,
   'Motion may soften edges or micro-geometry — compare each beat to the approved still before publishing.',
   `Fidelity mode: ${intelligence.fidelity}.`
  ],
  intelligence,
  note:'Attention beat, decisive cut to exact-pixel product recognition, then brand card. Detail reframing respects owner crop/count locks. Exact packaging uses an editorial reveal without video inference. Inspiration-only references must never be exported as source footage. Render completion is not visual-quality approval.'
 };
}

/** Original multi-beat plan when no reference is provided. */
export function planOriginalCampaign(plan:CreativePlan,hook?:CreativeHook):CampaignShotPlan{
 const intelligence=buildCreativeIntelligence(plan,hook);
 // Two beats + deterministic end card: reliable on 10GB and a clear advertising arc.
 const n=2;
 const fake:ReferenceAnalysis={
  version:1,id:'original',created:Date.now(),sourceUrl:'',originalUrl:'',bytes:0,duration:n*2.4,width:0,height:0,fps:24,
  rights:'inspiration-only',creativeMechanism:intelligence.creativeHook,mechanismConfidence:'inferred',
  shots:Array.from({length:n},(_,i)=>({index:i,start:i*2.4,end:(i+1)*2.4,duration:2.4,purpose:'other' as const,composition:'planned',camera:{motion:i===0?'push-in':'hold',confidence:'inferred' as const},interaction:'none',keyframeUrls:[]})),
  transitions:[],pacing:{avgShotSec:2.4,relative:Array.from({length:n},(_,i)=>({index:i,share:1/n})),note:'Original multi-beat plan'},
  visualStyle:{lighting:'brand-led',graphics:'end-card',ending:'brand payoff',confidence:'inferred'},
  transferablePrinciples:[intelligence.videoConcept,intelligence.photographicApproach],
  analysisMethod:'creative-intelligence-only',warnings:[]
 };
 return productSafeFilmPlan(planFromReference(plan,fake,intelligence));
}

/** One execution experience: default to directed source photography; LTX stays an explicit reference tool. */
export function productSafeFilmPlan(plan:CampaignShotPlan):CampaignShotPlan{
 return {...plan,shots:plan.shots.map((s,i)=>({...s,execution:'approved-still',framing:'full',effect:undefined,
  duration:3,motion:i===0?'push-in':'pull-out',startKeyframeStrategy:'source-still',
  action:i===0?'Move closer to the intact original photograph beneath stationary headline typography.':'Cut to a smaller complete photograph; widen to make room for the invitation.',
  cameraMovement:i===0?'Smooth 12 percent editorial push; all photograph edges remain visible.':'Smooth editorial pull back; no inferred depth or alternate view.',
  endingComposition:'Complete original photograph, original perspective and count. Separately composed lettering.'})),
  editing:{...plan.editing,transition:'cut'},note:'Directed source-photograph motion, two distinct layouts and readable brand payoff. CPU composition, not video-model inference. Human review pending.'};
}

export function motionPromptForShot(brief:CampaignShotBrief,product:string,intel?:CreativeIntelligence){
 const lane=intel?` Sensory lane: ${intel.sensoryLane}. Feeling: ${intel.intendedFeeling}.`:'';
 const fidelity=intel?` Fidelity: ${intel.fidelity} — keep count, silhouette and packaging truthful.`:'';
 return `Short original product commercial shot (${brief.purpose}). ${brief.sceneBrief} Action: ${brief.action||'Keep the product still.'} Ending: ${brief.endingComposition||'Stable product view.'}${lane}${fidelity} Camera: ${brief.cameraMovement} Keep the same product recognizable and stable across this beat. No new logos, on-image text, hands morphing or second product plate. Constraints: ${brief.motionConstraints.join(' ')} Product: ${clip(product,160)}`;
}

/** Per-shot LTX duration clamp for 10GB sequential jobs (short beats keep multi-shot reliable). */
export function shotRenderDuration(brief:CampaignShotBrief){
 return Math.max(1.5,Math.min(brief.execution==='approved-still'?3:4,Number(brief.duration)||1.8));
}

/** Cheap executable-contract gate before any upload or inference; does not judge the resulting video. */
export function shotPlanIssues(plan:CampaignShotPlan){
 const issues:string[]=[];
 if(!Array.isArray(plan.shots)||plan.shots.length!==2)return ['Expected an attention beat and a product payoff.'];
 const [a,b]=plan.shots;
 if(a.execution===b.execution&&a.framing===b.framing&&a.effect===b.effect&&a.motion===b.motion)issues.push('Beats repeat the same keyframe treatment; use a controlled reveal or a permitted detail-to-full cut.');
 if(a.purpose===b.purpose||a.sceneBrief===b.sceneBrief||a.action===b.action)issues.push('Shot plan repeats purpose or action.');
 if(b.execution!=='approved-still'||b.framing!=='full')issues.push('Product payoff must use the complete approved image.');
 for(const s of plan.shots){
  if(!s.action||!s.endingComposition||!['ltx','approved-still'].includes(s.execution||''))issues.push('Every beat needs executable action and ending composition.');
  if(s.duration<1.5||s.duration>(s.execution==='ltx'?4:3)||!Number.isFinite(s.duration))issues.push('Shot duration exceeds bounded execution.');
  if(/\b(?:pour|bite|unwrap|unscrew|melt|explode|morph|hand grabs)\b/i.test(s.sceneBrief+' '+s.action))issues.push('Unsupported physical interaction in shot plan.');
 }
 return issues;
}
