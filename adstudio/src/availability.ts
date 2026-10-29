import type {LocalModels} from '../../shared/runtime/client';
export type ApiCapabilities={upload:boolean;shot:boolean;keyframe:boolean;audio:boolean;productVideo:boolean;editVideo:boolean;exportVideo:boolean;ffmpeg:{available:boolean}};
export function canGenerate(mode:string,api:ApiCapabilities|null,online:boolean,catalog:LocalModels|null){
 if(!api?.upload)return false;
 if(mode==='camera')return api.productVideo&&api.ffmpeg.available;
 if(!online||!api.shot||!catalog?.video.length)return false;
 return mode==='creative'||(mode==='locked'&&api.productVideo&&api.ffmpeg.available);
}
export function renderEstimate(catalog:LocalModels|null,model:string|undefined,width:number,height:number,duration:number):string {
 if(!catalog?.timing.hardware)return 'Generation estimate needs a connected GPU measurement.';
 const frames=Math.round(duration*24/8)*8+1;
 const samples=catalog.timing.samples.filter(s=>s.hardware===catalog.timing.hardware?.id&&s.model===model&&!s.cold&&s.seconds>0);
 if(!samples.length)return 'No measured estimate for this model on the connected GPU. Queue time is additional.';
 const rates=samples.map(s=>s.seconds/(s.width*s.height*s.frames)).sort((a,b)=>a-b),seconds=rates[Math.floor(rates.length/2)]*width*height*frames;
 return `Estimated model processing ${Math.max(1,Math.floor(seconds*.7))}–${Math.ceil(seconds*1.5)}s per format · ${samples.length} warm measurements on ${catalog.timing.hardware.name}. Queue, compositing and export are additional.`;
}
