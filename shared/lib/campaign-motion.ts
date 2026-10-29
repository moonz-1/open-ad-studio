import type {CreativePlan} from './creative-engine.ts';
import {sceneDirection,type CampaignArchetype} from './ad-scene.ts';
import type {CreativeHook} from './creative-intelligence.ts';

/** Vertical campaign commercial size for LTX-2B on 10GB (matches productFormats 9:16). */
export const campaignVideoSize={width:288,height:512,ratio:'9:16' as const,duration:3,fps:24,model:'ltxv-2b-0.9.8-distilled.safetensors'};

export type CampaignVideoMode='ltx-creative'|'product-locked'|'camera'|'reference-inspired';
export type CampaignVideo={
 version:1;id:string;parentTakeId:string;created:number;
 mode:CampaignVideoMode;model:string;prompt:string;seed:number;
 width:number;height:number;frames:number;fps:number;duration:number;seconds:number;
 startImage:string;rawWebm:string;mp4?:string;warning:string;
 sourceSha256:string;startSha256:string;jobNote:string;
};

const clip=(s:string|undefined,n=280)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);

/** Subtle cinematic motion derived from the approved static campaign — no new creative brief. */
export function campaignMotionPrompt(plan:CreativePlan,archetype?:CampaignArchetype,hook?:CreativeHook){
 const {archetype:a,concept:c}=sceneDirection(plan),kind=archetype||a;
 const product=clip(plan.input.facts.description,220);
 const base='Short cinematic product commercial. Slow gentle camera push-in. Keep the product recognizable, sharp and stable. Preserve count, silhouette, materials and printed blank areas. No morphing, melting, duplicated products, new text, logos or hands.';
 const hookBeat=hook==='dramatic-reveal'?'Build anticipation then settle on a clear product reveal.'
  :hook==='rhythmic-comparison'?'Keep framing stable so repeated beats feel intentional.'
  :hook==='sensory-reveal'?'Emphasize tactile surface and light on material quality.'
  :hook==='artistic-metaphor'?'Let atmosphere and materials carry mood without inventing claims.'
  :'';
 if(kind==='food-editorial')return `${base} Warm morning light softly drifts across the baked surface. Faint atmospheric haze. Appetizing food still life. ${hookBeat} ${product} Concept: ${clip(c.idea)}.`;
 if(kind==='beauty-sensory')return `${base} Soft water caustics and reflected light gently shift on mineral surfaces. Refined spa atmosphere. ${hookBeat} ${product} Concept: ${clip(c.idea)}.`;
 return `${base} Subtle environmental light shift. ${hookBeat} ${product} Concept: ${clip(c.idea)}.`;
}

export function validateCampaignVideo(v:unknown):CampaignVideo{
 const x=v as CampaignVideo,fail=()=>{throw Error('Invalid campaign video record.');};
 if(!x||x.version!==1||typeof x.id!=='string'||!x.id||typeof x.parentTakeId!=='string')return fail();
 if(!['ltx-creative','product-locked','camera'].includes(x.mode))return fail();
 if(typeof x.rawWebm!=='string'||!/^\/outputs\/[a-f0-9]{16}\.webm$/.test(x.rawWebm))return fail();
 if(x.mp4&&!/^\/outputs\/[a-f0-9]{16}\.mp4$/.test(x.mp4))return fail();
 if(typeof x.prompt!=='string'||x.prompt.length>2000||!Number.isFinite(x.seconds))return fail();
 return x;
}
