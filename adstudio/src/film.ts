import {planOriginalCampaign,type CampaignShotPlan} from '../../shared/lib/reference-video.ts';
import type {CreativePlan} from '../../shared/lib/creative-engine.ts';
export type FilmMode='photograph-motion'|'generative';
export type FilmAvailability={available:boolean;reason:string;model:string;inferenceVerified:false};
export async function filmAvailability():Promise<FilmAvailability>{
 try{const r=await fetch('/api/film/capabilities',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return await r.json();}catch{return {available:false,reason:'The local video engine could not be reached.',model:'LTX-Video 2B',inferenceVerified:false};}
}
/** The inferred attention beat is explicitly chosen; exact packaging is only guaranteed by the held payoff. */
export function directedFilmPlan(plan:CreativePlan,mode:FilmMode):CampaignShotPlan{
 const base=planOriginalCampaign(plan);if(mode==='photograph-motion')return base;
 if(mode!=='generative')throw Error('Choose generated motion or photograph motion.');
 const concept=plan.concepts.find(c=>c.id===plan.selectedId);if(!concept)throw Error('Choose a current creative concept.');
 const first=base.shots[0];
 return {...base,shots:[{...first,execution:'ltx',motion:undefined,effect:undefined,duration:4,framing:'full',startKeyframeStrategy:'hero-still',
 sceneBrief:'The approved product remains intact and stationary. Setting: '+concept.environment+' Lighting: '+concept.lighting,
 action:'The product stays completely still. Light moves gradually over the observed surface; the camera makes a shallow lateral glide, revealing visible surface relief through restrained parallax. No orbit or unseen rear view.',
 cameraMovement:'One slow lateral glide, less than one tenth of the frame; ease to rest in the final second.',
 endingComposition:'Settle on the recognizable complete product before cutting to the approved photograph.',
 motionConstraints:[...first.motionConstraints,'Do not change count, labels, ingredients, cap, container, silhouette or arrangement. No new subjects, hands, smoke or props.']},
 {...base.shots[1],motion:undefined,duration:2,startKeyframeStrategy:'hero-still',action:'Hold the complete approved campaign photograph beneath the brand message.',endingComposition:'The product remains visible through the final branded payoff.'}],
 note:'Real LTX attention beat, then the approved campaign image with separate brand typography. Generated identity and motion are unreviewed. Failed or unavailable inference stops; photograph motion is a separate choice.'};
}
export function filmKind(model:string,execution?:'ltx'|'photograph-motion'){return model==='editorial-source-motion'?'Photograph motion · no AI video':model.includes('ltx')&&execution==='ltx'?'Generated video · LTX':'Saved prior video';}
