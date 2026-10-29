/** Dedicated single-start-frame LTX 2B path. No dependency, model download or fallback. */
import {execFile} from 'node:child_process';
export const filmModel='ltxv-2b-0.9.8-distilled.safetensors';
export const filmSigmas='1, 0.9937, 0.9875, 0.9812, 0.975, 0.9094, 0.725, 0.4219, 0';
export type FilmReadiness={available:boolean;reason:string;model:string;inferenceVerified:false;physicalFreeMiB?:number};
export async function physicalFreeMiB():Promise<number|undefined>{
 return new Promise(ok=>execFile('nvidia-smi',['--query-gpu=memory.free','--format=csv,noheader,nounits'],{windowsHide:true,timeout:4000},(error,stdout)=>{const values=stdout.trim().split(/\r?\n/).map(Number);ok(!error&&values.length===1&&Number.isFinite(values[0])?values[0]:undefined);}));
}
export function filmReadiness(nodes:Record<string,any>,stats:any,queue:any,busy:boolean,physical?:number):FilmReadiness{
 const result=(available:boolean,reason:string):FilmReadiness=>({available,reason,model:filmModel,inferenceVerified:false,physicalFreeMiB:physical});
 const required=['CheckpointLoaderSimple','CLIPLoader','CLIPTextEncode','LoadImage','LTXVImgToVideo','LTXVConditioning','KSamplerSelect','ManualSigmas','SamplerCustom','VAEDecodeTiled','SaveWEBM'];
 if(required.some(n=>!nodes[n]))return result(false,'The local video engine is missing required workflow components.');
 if(!nodes.CheckpointLoaderSimple.input?.required?.ckpt_name?.[0]?.includes(filmModel)||!nodes.CLIPLoader.input?.required?.clip_name?.[0]?.includes('t5xxl_fp8_e4m3fn_scaled.safetensors'))return result(false,'Install the LTX-Video 2B and T5 model pack to attempt generated motion.');
 if(busy||!Array.isArray(queue?.queue_running)||!Array.isArray(queue?.queue_pending)||queue.queue_running.length||queue.queue_pending.length)return result(false,'Another local operation is using the video engine. Try again when it finishes.');
 if(physical===undefined||!Number.isFinite(physical))return result(false,'Free GPU memory could not be checked. Photograph motion remains available.');
 if(physical<6144||(stats?.devices?.[0]?.vram_free||0)<6*1024**3||(stats?.system?.ram_free||0)<4*1024**3)return result(false,'Generated motion needs 6 GB free GPU memory and 4 GB free system memory. Close unused GPU apps and check again.');
 return result(true,'Ready to attempt real LTX motion. Output quality and product identity require review; no automatic fallback.');
}
export function filmGraph(template:Record<string,any>,options:{width:number;height:number;frames:number;fps:number;seed:number;prompt:string}){
 const {width,height,frames,fps,seed,prompt}=options;
 if(![width,height].every(n=>Number.isInteger(n)&&n>=256&&n<=640&&n%32===0)||width*height>480*640||!Number.isInteger(frames)||frames<25||frames>97||(frames-1)%8||fps!==24)throw Error('Film supports one start image, 24 fps, 25-97 frames and bounded dimensions in multiples of 32.');
 const g=structuredClone(template);
 if(g['1']?.inputs.ckpt_name!==filmModel||g['13']?.inputs.sigmas!==filmSigmas||g['16']?.class_type!=='VAEDecodeTiled')throw Error('Unexpected film workflow contract.');
 Object.assign(g['8'].inputs,{width,height,length:frames});g['3'].inputs.text=prompt;g['14'].inputs.noise_seed=seed;g['11'].inputs.frame_rate=fps;g['17'].inputs.fps=fps;g['17'].inputs.filename_prefix='osh/ad-film';
 return g;
}
