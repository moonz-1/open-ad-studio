// Isolated API projection of the pinned official two-stage graph with local text
// encoding, prompt enhancement off, I2V on. Never imported by production apps.
export function benchmarkGraph({prompt,seed=1,width=1088,height=1920,frames=73,fps=24}) {
 if(!prompt?.trim()||!Number.isInteger(seed)||seed<0||frames!==73||fps!==24||width!==1088||height!==1920)throw Error('Benchmark is fixed at 1088x1920, 73 frames/24 FPS; use a nonempty prompt and integer seed.');
 const graph={},put=(id,class_type,inputs)=>{graph[id]={class_type,inputs};},ref=id=>[String(id),0];
 put(2004,'LoadImage',{image:'GUIDE.png'});
 put(5570,'VAELoader',{vae_name:'ltx-2.5-audio-vae-bf16.safetensors'});
 put(5571,'VAELoader',{vae_name:'ltx-2.5-video-vae-bf16.safetensors'});
 put(5569,'UNETLoader',{unet_name:'ltx-2.5-22b-distilled-transformer-bf16.safetensors',weight_dtype:'default'});
 put(5577,'LatentUpscaleModelLoader',{model_name:'ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors'});
 put(5574,'CLIPLoader',{clip_name:'gemma4-12b-with-proj-ltx-2.5-bf16.safetensors',type:'ltxv',device:'default'});
 put(4990,'ResizeImageMaskNode',{input:ref(2004),resize_type:'scale longer dimension','resize_type.longer_size':1536,scale_method:'lanczos'});
 put(2483,'CLIPTextEncode',{clip:ref(5574),text:prompt});
 put(2612,'CLIPTextEncode',{clip:ref(5574),text:''});
 put(1241,'LTXVConditioning',{positive:ref(2483),negative:ref(2612),frame_rate:fps});
 put(3336,'LTXVPreprocess',{image:ref(4990),img_compression:18});
 put(3059,'EmptyLTXVLatentVideo',{width:width/2,height:height/2,length:frames,batch_size:1});
 put(3980,'LTXVEmptyLatentAudio',{audio_vae:ref(5570),frames_number:frames,frame_rate:fps,batch_size:1});
 put(3159,'LTXVImgToVideoInplace',{vae:ref(5571),image:ref(3336),latent:ref(3059),strength:.7,bypass:false});
 put(4528,'LTXVConcatAVLatent',{video_latent:ref(3159),audio_latent:ref(3980)});
 put(4832,'RandomNoise',{noise_seed:seed});
 put(4828,'CFGGuider',{model:ref(5569),positive:ref(1241),negative:['1241',1],cfg:1});
 put(4831,'KSamplerSelect',{sampler_name:'euler_ancestral'});
 put(4984,'ManualSigmas',{sigmas:'1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0'});
 put(4829,'SamplerCustomAdvanced',{noise:ref(4832),guider:ref(4828),sampler:ref(4831),sigmas:ref(4984),latent_image:ref(4528)});
 put(4845,'LTXVSeparateAVLatent',{av_latent:ref(4829)});
 put(4975,'LTXVLatentUpsampler',{samples:ref(4845),upscale_model:ref(5577),vae:ref(5571)});
 put(4970,'LTXVImgToVideoInplace',{vae:ref(5571),image:ref(4990),latent:ref(4975),strength:1,bypass:false});
 put(4969,'LTXVConcatAVLatent',{video_latent:ref(4970),audio_latent:['4845',1]});
 put(4967,'RandomNoise',{noise_seed:seed});
 put(4964,'CFGGuider',{model:ref(5569),positive:ref(1241),negative:['1241',1],cfg:1});
 // Top-level official stage-2 widget overrides its nested sampler default.
 put(4976,'KSamplerSelect',{sampler_name:'euler'});
 put(4985,'ManualSigmas',{sigmas:'0.909375, 0.725, 0.421875, 0.0'});
 put(4971,'SamplerCustomAdvanced',{noise:ref(4967),guider:ref(4964),sampler:ref(4976),sigmas:ref(4985),latent_image:ref(4969)});
 put(4973,'LTXVSeparateAVLatent',{av_latent:ref(4971)});
 put(5538,'VAEDecodeTiled',{samples:ref(4973),vae:ref(5571),tile_size:512,overlap:64,temporal_size:128,temporal_overlap:32});
 put(4848,'LTXVAudioVAEDecode',{samples:['4973',1],audio_vae:ref(5570)});
 put(4849,'CreateVideo',{images:ref(5538),audio:ref(4848),fps,bit_depth:8});
 put(4852,'SaveVideo',{video:ref(4849),filename_prefix:'adstudio-benchmark',format:'mp4','format.codec':'h264'});
 return graph;
}

export function validateGraph(graph,nodes,{weights=true}={}) {
 const errors=[];
 for(const [id,node]of Object.entries(graph)){
  const schema=nodes[node.class_type];if(!schema){errors.push(`${id}: missing node ${node.class_type}`);continue;}
  const specs={...schema.input?.required,...schema.input?.optional};
  function expand(name,spec){
   if(spec[0]==='COMFY_DYNAMICCOMBO_V3'){
    const option=spec[1].options.find(o=>o.key===node.inputs[name]);if(!option){errors.push(`${id}.${name}: invalid dynamic selection`);return;}
    for(const [child,info]of Object.entries(option.inputs?.required||{})){const key=name+'.'+child;specs[key]=info;expand(key,info);if(!(key in node.inputs))errors.push(`${id}.${key}: required`);}
   }
  }
  for(const [name,spec]of Object.entries(schema.input?.required||{})){if(!(name in node.inputs))errors.push(`${id}.${name}: required`);else expand(name,spec);}
  for(const [name,value]of Object.entries(node.inputs)){
   const spec=specs[name];if(!spec){errors.push(`${id}.${name}: unknown input`);continue;}
   if(Array.isArray(value)){const source=graph[value[0]],out=source&&nodes[source.class_type]?.output;if(!source||!Number.isInteger(value[1])||!out||value[1]>=out.length)errors.push(`${id}.${name}: dangling output`);continue;}
   if(weights&&Array.isArray(spec[0])&&!spec[0].includes(value))errors.push(`${id}.${name}: unavailable value/weight ${value}`);
   if(spec[0]==='COMBO'&&spec[1]?.options&&!spec[1].options.includes(value)&&(weights||!['model_name','clip_name','unet_name','vae_name'].includes(name)))errors.push(`${id}.${name}: invalid option`);
   if(typeof value==='number'&&((spec[1]?.min!==undefined&&value<spec[1].min)||(spec[1]?.max!==undefined&&value>spec[1].max)))errors.push(`${id}.${name}: outside range`);
  }
 }
 const visited=new Set(),visiting=new Set();function visit(id){if(visiting.has(id))throw Error('Workflow cycle');if(visited.has(id))return;visiting.add(id);for(const v of Object.values(graph[id].inputs))if(Array.isArray(v)&&graph[v[0]])visit(v[0]);visiting.delete(id);visited.add(id);}for(const id of Object.keys(graph))visit(id);
 if(errors.length)throw Error(errors.join('\n'));
 return true;
}
