/** Adaptive Sound Director — plans campaign audio from creative direction + shot timeline.
 * Does not invent invisible actions. Never copies reference waveforms without explicit audio rights.
 * Stable Audio Open is optional; silence and licensed uploads remain valid.
 */
import type {CreativePlan} from './creative-engine.ts';
import {buildCreativeIntelligence,type CreativeHook,type CreativeIntelligence,type SensoryLane} from './creative-intelligence.ts';
import type {CampaignShotPlan} from './reference-video.ts';

export type AudioRights='none'|'inspiration-only'|'user-owned-or-licensed';
export type SoundMode='auto'|'mute'|'reference'|'replace';
export type SoundLayerKind='music'|'ambience'|'sfx'|'reference'|'silence';

export type ReferenceAudioAnalysis={
 version:1;
 hasAudio:boolean;
 duration:number;
 channels?:number;
 sampleRate?:number;
 codec?:string;
 /** Integrated loudness when measurable; undefined if unavailable. */
 loudnessLufs?:number|null;
 peakDb?:number|null;
 /** Approximate onset / silence-break times from FFmpeg measurements only. */
 rhythmicCues:number[];
 silenceRegions:{start:number;end:number}[];
 analysisMethod:string;
 warnings:string[];
 note:string;
};

export type SoundCue={
 id:string;
 kind:Exclude<SoundLayerKind,'silence'>|'accent';
 at:number;
 duration:number;
 purpose:string;
 /** Stable Audio / generation prompt when source is generate. */
 prompt?:string;
 source:'generate'|'user-upload'|'reference-extract'|'silence';
 gainDb:number;
 fadeIn:number;
 fadeOut:number;
 tiedTo?:{shotIndex:number;event:'start'|'mid'|'end'|'transition'};
};

export type SoundPlan={
 version:1;
 id:string;
 created:number;
 takeId:string;
 atmosphere:string;
 musicAppropriate:boolean;
 ambienceAppropriate:boolean;
 silencePreferred:boolean;
 brandRevealAt?:number;
 cues:SoundCue[];
 levels:{music:number;sfx:number;reference:number};
 referenceInspiration?:{
  videoUrl?:string;
  audioAnalysis?:ReferenceAudioAnalysis;
  /** Timing/dynamics only — never a claim of musical understanding. */
  transferNote:string;
 };
 rights:{video:AudioRights;audio:AudioRights};
 modelPrompt?:string;
 warnings:string[];
 intelligenceSummary:{hook:CreativeHook;lane:SensoryLane;feeling:string};
};

export type SoundLayerAsset={
 id:string;
 kind:SoundLayerKind;
 url:string;
 at:number;
 duration:number;
 gainDb:number;
 fadeIn:number;
 fadeOut:number;
 rights:AudioRights;
 provenance:string;
};

export type CampaignSoundState={
 version:1;
 silentMaster:string;
 plan:SoundPlan;
 mode:SoundMode;
 layers:SoundLayerAsset[];
 mixedUrl?:string;
 generated?:{audioUrl:string;prompt:string;seed:number;model:string;seconds:number};
 provenance:{created:number;mixer:'ffmpeg-aac';stableAudioAttempted:boolean;stableAudioAvailable:boolean;note:string};
};

const clip=(s:string|undefined,n=220)=>(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const id=()=>crypto.randomUUID?.()||('snd'+Math.random().toString(16).slice(2)+Date.now().toString(16));

function shotStarts(plan:CampaignShotPlan):number[]{
 let t=0;const starts:number[]=[];
 for(const s of plan.shots){starts.push(t);t+=Math.max(0.4,s.duration);}
 return starts;
}

function totalDuration(plan:CampaignShotPlan):number{
 return Math.max(0.5,plan.shots.reduce((a,s)=>a+Math.max(0.4,s.duration),0)+(plan.editing.endingCta?1.4:0));
}

/** Only propose action SFX when the disclosed creative content supports them. */
function sfxAllowed(intel:CreativeIntelligence,hook:CreativeHook,purpose:string):{ok:boolean;prompt?:string;purpose:string}{
 const text=clip([intel.category,intel.productAttributes.join(' '),intel.videoConcept,intel.visualReaction,purpose].join(' '),400).toLowerCase();
 if(intel.sensoryLane==='indulgent-food'&&(hook==='sensory-reveal'||/texture|crisp|warm|fresh|serve/i.test(text)))
  return {ok:true,prompt:'Soft warm bakery ambience, gentle ceramic plate settle, no voices, no music melody',purpose:'texture settle'};
 if(intel.sensoryLane==='comfort-care'&&(hook==='craftsmanship-detail'||/soft|lotion|cream|fabric/i.test(text)))
  return {ok:true,prompt:'Soft fabric brush and quiet lotion jar open, intimate close mic, no voices',purpose:'tactile cue'};
 if(intel.sensoryLane==='refreshing-scent'&&(hook==='artistic-metaphor'||/breeze|air|atmosphere/i.test(text)))
  return {ok:true,prompt:'Soft airy whoosh and delicate glass bottle tap, spacious quiet, no voices',purpose:'air accent'};
 if(intel.sensoryLane==='athletic-energy'&&(hook==='graphic-juxtaposition'||hook==='product-transformation'))
  return {ok:true,prompt:'Tight rhythmic whoosh accent, dry and modern, no crowd, no voices',purpose:'energy accent'};
 if(intel.sensoryLane==='refined-object'&&(hook==='craftsmanship-detail'||hook==='dramatic-reveal'))
  return {ok:true,prompt:'Subtle metallic micro detail and soft glass resonance, luxury quiet, no voices',purpose:'material accent'};
 if(purpose==='payoff'||purpose==='reveal')
  return {ok:true,prompt:'Soft brand accent chime, short and clean, no melody loop, no voices',purpose:'brand accent'};
 return {ok:false,purpose:'none'};
}

function bedPrompt(intel:CreativeIntelligence,hook:CreativeHook,silence:boolean):string|undefined{
 if(silence)return undefined;
 const feel=clip(intel.intendedFeeling,80);
 const lane=intel.sensoryLane;
 const base=
  lane==='indulgent-food'?`Warm intimate acoustic bed, soft low piano and muted strings, inviting and calm, ${feel}`:
  lane==='comfort-care'?`Soft ambient pads, gentle breath-like textures, serene spa-adjacent but non-clinical, ${feel}`:
  lane==='refreshing-scent'?`Airy minimal electronic bed, light sparkling textures, spacious and clean, ${feel}`:
  lane==='athletic-energy'?`Modern pulse bed, restrained percussion, energetic but not aggressive, ${feel}`:
  lane==='refined-object'?`Elegant sparse piano and soft drone, precise and premium, ${feel}`:
  `Tasteful brand film underscore, restrained and supportive, ${feel}`;
 return clip(`${base}. Hook ${hook}. Instrumental only, no vocals, no lyrics.`,280);
}

/**
 * Build a SoundPlan from the approved creative plan + multi-shot campaign timeline.
 * Reference audio analysis informs timing only unless audio rights are licensed.
 */
export function planCampaignSound(opts:{
 takeId:string;
 creative:CreativePlan;
 shotPlan:CampaignShotPlan;
 videoDuration?:number;
 referenceAudio?:ReferenceAudioAnalysis;
 videoRights?:AudioRights;
 audioRights?:AudioRights;
 preferSilence?:boolean;
}):SoundPlan{
 const intel=opts.shotPlan.intelligence||buildCreativeIntelligence(opts.creative,opts.shotPlan.creativeHook);
 const hook=opts.shotPlan.creativeHook;
 const starts=shotStarts(opts.shotPlan);
 const duration=Math.max(opts.videoDuration||0,totalDuration(opts.shotPlan));
 const audioRights:AudioRights=opts.audioRights||'none';
 const videoRights:AudioRights=opts.videoRights||opts.shotPlan.rights||'inspiration-only';
 const silencePreferred=!!opts.preferSilence||(!opts.referenceAudio?.hasAudio&&hook==='craftsmanship-detail'&&intel.sensoryLane==='refined-object'&&false);
 // Silence is intentional when explicitly requested; otherwise music/ambience default on for filmic hooks.
 const musicAppropriate=!silencePreferred;
 const ambienceAppropriate=musicAppropriate&&(intel.sensoryLane==='comfort-care'||intel.sensoryLane==='refreshing-scent'||hook==='lifestyle-moment');
 const warnings:string[]=[];
 const cues:SoundCue[]=[];
 const brandRevealAt=starts[opts.shotPlan.shots.findIndex(s=>s.purpose==='payoff'||s.purpose==='reveal')];
 const revealAt=Number.isFinite(brandRevealAt)?brandRevealAt:Math.max(0,duration-1.2);

 if(musicAppropriate){
  const prompt=bedPrompt(intel,hook,false);
  cues.push({
   id:id(),kind:ambienceAppropriate?'ambience':'music',at:0,duration,purpose:'campaign bed',
   prompt,source:'generate',gainDb:-8,fadeIn:0.35,fadeOut:0.7
  });
 }else{
  warnings.push('Silence preferred for this direction; music bed omitted.');
 }

 // Transition accents at dissolve/wipe boundaries — soft, not literal Foley inventions.
 if(opts.shotPlan.editing.transition!=='cut'&&opts.shotPlan.shots.length>1){
  for(let i=1;i<starts.length;i++){
   cues.push({
    id:id(),kind:'accent',at:Math.max(0,starts[i]-0.12),duration:0.35,purpose:`${opts.shotPlan.editing.transition} accent`,
    prompt:'Soft whoosh transition accent, very short, no melody, no voices',source:'generate',gainDb:-14,fadeIn:0.02,fadeOut:0.15,
    tiedTo:{shotIndex:i,event:'transition'}
   });
  }
 }

 for(let i=0;i<opts.shotPlan.shots.length;i++){
  const shot=opts.shotPlan.shots[i];
  const allowed=sfxAllowed(intel,hook,shot.purpose);
  if(!allowed.ok)continue;
  // Skip inventing food crunch / pour / footsteps unless lane+hook support tactile content above.
  if(/pour|footstep|crunch|chew|splash/i.test(allowed.prompt||'')&&!allowed.ok)continue;
  const at=starts[i]+(shot.purpose==='payoff'?Math.max(0,shot.duration*0.55):shot.purpose==='reveal'?Math.max(0,shot.duration*0.35):0.15);
  cues.push({
   id:id(),kind:'sfx',at,duration:Math.min(1.2,Math.max(0.25,shot.duration*0.35)),purpose:allowed.purpose,
   prompt:allowed.prompt,source:'generate',gainDb:-11,fadeIn:0.02,fadeOut:0.2,
   tiedTo:{shotIndex:i,event:shot.purpose==='payoff'||shot.purpose==='reveal'?'end':'mid'}
  });
 }

 if(opts.shotPlan.editing.endingCta||opts.shotPlan.editing.brandOverlay){
  cues.push({
   id:id(),kind:'accent',at:Math.max(0,duration-1.1),duration:0.9,purpose:'brand reveal',
   prompt:'Soft resolved brand sting, warm and short, instrumental only',source:'generate',gainDb:-10,fadeIn:0.05,fadeOut:0.35,
   tiedTo:{shotIndex:opts.shotPlan.shots.length-1,event:'end'}
  });
 }

 let referenceInspiration:SoundPlan['referenceInspiration'];
 if(opts.referenceAudio?.hasAudio){
  const cuesFromRef=opts.referenceAudio.rhythmicCues.filter(t=>t>0.2&&t<duration-0.2).slice(0,6);
  referenceInspiration={
   audioAnalysis:opts.referenceAudio,
   transferNote:audioRights==='user-owned-or-licensed'
    ?'Authorized reference audio may be reused as a soundtrack layer with confirmed rights.'
    :'Reference audio informed pacing only. Waveform will not be copied unless audio rights are separately confirmed.',
  };
  if(audioRights!=='user-owned-or-licensed'){
   warnings.push('Reference soundtrack is inspiration-only; generating or uploading an original bed instead of copying audio.');
   // Nudge accent timings toward measured cues without copying audio.
   for(let i=0;i<Math.min(cuesFromRef.length,cues.length);i++){
    if(cues[i].kind==='accent'||cues[i].kind==='sfx')cues[i]={...cues[i],at:cuesFromRef[i]};
   }
  }
  if(opts.referenceAudio.warnings?.length)warnings.push(...opts.referenceAudio.warnings);
 }else if(opts.referenceAudio&&!opts.referenceAudio.hasAudio){
  warnings.push('Reference video has no audio track; visual pacing alone informs the sound plan.');
 }

 if(videoRights==='user-owned-or-licensed'&&audioRights!=='user-owned-or-licensed'){
  warnings.push('Video footage rights do not grant soundtrack rights. Confirm audio rights separately before reuse.');
 }

 return {
  version:1,
  id:id(),
  created:Date.now(),
  takeId:opts.takeId,
  atmosphere:clip(`${intel.intendedFeeling}; ${intel.photographicApproach}`,160),
  musicAppropriate,
  ambienceAppropriate,
  silencePreferred:!!silencePreferred||!musicAppropriate,
  brandRevealAt:revealAt,
  cues,
  levels:{music:0.55,sfx:0.35,reference:0.6},
  referenceInspiration,
  rights:{video:videoRights,audio:audioRights},
  modelPrompt:bedPrompt(intel,hook,!!silencePreferred),
  warnings,
  intelligenceSummary:{hook,lane:intel.sensoryLane,feeling:clip(intel.intendedFeeling,80)}
 };
}

export function soundCapabilitiesNote(stableAudioAvailable:boolean):string{
 return stableAudioAvailable
  ?'Stable Audio Open 1.0 is available for original beds and accents (Stability AI Community License).'
  :'Stable Audio Open 1.0 / T5-base are not installed. Use silence, licensed uploads, or authorized reference audio. No automatic model download.';
}
