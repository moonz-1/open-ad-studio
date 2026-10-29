export const trainingBase='z_image_turbo_bf16.safetensors';
export const videoTrainingBase='ltxv-2b-0.9.8-distilled.safetensors';
export const geometryTrainingBase='hunyuan3d-dit-v2-mini.safetensors';
export const trainingKind=(model:string)=>model===videoTrainingBase?'video':model===geometryTrainingBase?'geometry':'image';
export type TrainingInput={projectId:string;name:string;model:string;images:{url:string;caption:string;mesh?:string}[];steps:number;rank:number;learningRate:number;size:number;seed:number;frames?:number;fps?:number};
export type TrainingRun=TrainingInput&{id:string;createdAt:number;status:'running'|'complete'|'error';error?:string;loraFile?:string;download?:string;loss?:{step:number;loss:number}[]};
export function trainingInput(value:unknown):TrainingInput{
 const b=value as TrainingInput;
 if(!b||typeof b.projectId!=='string'||!b.projectId||b.projectId.length>128||typeof b.name!=='string'||!b.name.trim()||b.name.length>64||![trainingBase,videoTrainingBase,geometryTrainingBase].includes(b.model))throw Error('Choose a name, project and compatible training base.');
 if(!Array.isArray(b.images)||!b.images.length||b.images.length>24)throw Error('Choose between 1 and 24 training files.');
 const video=trainingKind(b.model)==='video',geometry=trainingKind(b.model)==='geometry';
 const seen=new Set<string>();const images=b.images.map(image=>{if(!image||typeof image.url!=='string'||!(video?/^\/outputs\/[a-f0-9]{16}\.(mp4|webm)$/:/^\/outputs\/[a-f0-9]{16}\.png$/).test(image.url)||seen.has(image.url)||typeof image.caption!=='string'||(!geometry&&!image.caption.trim())||image.caption.length>1000)throw Error('Each unique training file needs a caption under 1000 characters.');if(geometry&&(typeof image.mesh!=='string'||!/^\/outputs\/[a-f0-9]{16}\.obj$/.test(image.mesh)))throw Error('Each geometry example needs a reference image and target OBJ mesh.');seen.add(image.url);return {url:image.url,caption:image.caption.trim(),...(geometry?{mesh:image.mesh}:{})}});
 for(const [key,min,max]of [['steps',1,500],['rank',1,16],['size',256,768],['seed',0,2147483647]] as const)if(!Number.isInteger(b[key])||b[key]<min||b[key]>max)throw Error('Invalid '+key+'.');
 if(b.size%16||!Number.isFinite(b.learningRate)||b.learningRate<.000001||b.learningRate>.001)throw Error('Choose a supported training size and learning rate.');
 if(video&&(!Number.isInteger(b.frames)||b.frames!<9||b.frames!>49||(b.frames!-1)%8||!Number.isInteger(b.fps)||b.fps!<1||b.fps!>60||b.size%32||b.size>512))throw Error('Video training needs 9–49 frames (8n+1), 1–60 FPS and a 256–512 pixel size in steps of 32.');
 return {projectId:b.projectId,name:b.name.trim(),model:b.model,images,steps:b.steps,rank:b.rank,size:b.size,seed:b.seed,learningRate:b.learningRate,...(video?{frames:b.frames,fps:b.fps}:{})};
}
export function trainingGraph(input:TrainingInput,id:string){
 if(!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid training ID.');
 const graph:Record<string,{class_type:string;inputs:Record<string,unknown>}>={
  '1':{class_type:'UNETLoader',inputs:{unet_name:input.model,weight_dtype:'fp8_e4m3fn'}},
  '2':{class_type:'CLIPLoader',inputs:{clip_name:'qwen_3_4b_fp8_mixed.safetensors',type:'lumina2',device:'cpu'}},
  '3':{class_type:'VAELoader',inputs:{vae_name:'ae.safetensors'}},
  '4':{class_type:'ModelSamplingAuraFlow',inputs:{model:['1',0],shift:3}},
  '5':{class_type:'OSHTrainingPairs',inputs:{images:[],captions:JSON.stringify(input.images.map(image=>image.caption))}},
  '6':{class_type:'MakeTrainingDataset',inputs:{images:['5',0],texts:['5',1],clip:['2',0],vae:['3',0]}},
  '7':{class_type:'TrainLoraNode',inputs:{model:['4',0],latents:['6',0],positive:['6',1],steps:input.steps,rank:input.rank,learning_rate:input.learningRate,seed:input.seed,batch_size:1,grad_accumulation_steps:1,optimizer:'AdamW',loss_function:'MSE',training_dtype:'none',lora_dtype:'bf16',quantized_backward:false,algorithm:'LoRA',gradient_checkpointing:true,checkpoint_depth:2,offloading:false,existing_lora:'[None]',bucket_mode:false,bypass_mode:true}},
  '8':{class_type:'OSHSaveTraining',inputs:{lora:['7',0],loss:['7',1],steps:['7',2],run_id:id,name:input.name,base:input.model}},
 };
 if(trainingKind(input.model)==='geometry'){
  graph['1']={class_type:'ImageOnlyCheckpointLoader',inputs:{ckpt_name:input.model}};
  delete graph['2'];delete graph['3'];delete graph['4'];delete graph['5'];delete graph['6'];
  Object.assign(graph['7'].inputs,{model:['1',0],training_dtype:'bf16'});
  let previous='';input.images.forEach((image,index)=>{const load=String(100+index*3),encode=String(101+index*3),batch=String(102+index*3);
   graph[load]={class_type:'LoadImage',inputs:{image:image.url}};
   graph[encode]={class_type:'OSH3DTrainingDataset',inputs:{image:[load,0],clip_vision:['1',1],mesh_obj:'',seed:input.seed}};
   if(index){graph[batch]={class_type:'OSHTrainingConcat',inputs:{latents_a:[previous,0],positive_a:[previous,1],latents_b:[encode,0],positive_b:[encode,1]}};previous=batch}else previous=encode;
  });graph['7'].inputs.latents=[previous,0];graph['7'].inputs.positive=[previous,1];return graph;
 }
 if(trainingKind(input.model)==='video'){
  graph['1']={class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:input.model}};
  graph['2']={class_type:'CLIPLoader',inputs:{clip_name:'t5xxl_fp8_e4m3fn_scaled.safetensors',type:'ltxv',device:'cpu'}};
  delete graph['3'];delete graph['4'];delete graph['5'];delete graph['6'];
  Object.assign(graph['7'].inputs,{model:['1',0],training_dtype:'bf16'});
  let previous='';
  input.images.forEach((clip,index)=>{
   const load=String(100+index*3),encode=String(101+index*3),batch=String(102+index*3);
   graph[load]={class_type:'LoadVideo',inputs:{file:clip.url}};
   graph[encode]={class_type:'OSHVideoTrainingDataset',inputs:{video:[load,0],vae:['1',2],clip:['2',0],caption:clip.caption,size:input.size,frames:input.frames,fps:input.fps}};
   if(index){graph[batch]={class_type:'OSHTrainingConcat',inputs:{latents_a:[previous,0],positive_a:[previous,1],latents_b:[encode,0],positive_b:[encode,1]}};previous=batch}else previous=encode;
  });
  graph['7'].inputs.latents=[previous,0];graph['7'].inputs.positive=[previous,1];return graph;
 }
 let previous:unknown;
 input.images.forEach((image,index)=>{const load=String(100+index*3),scale=String(101+index*3),batch=String(102+index*3);graph[load]={class_type:'LoadImage',inputs:{image:image.url}};graph[scale]={class_type:'ImageScale',inputs:{image:[load,0],upscale_method:'area',width:input.size,height:input.size,crop:'center'}};if(index){graph[batch]={class_type:'ImageBatch',inputs:{image1:previous,image2:[scale,0]}};previous=[batch,0]}else previous=[scale,0]});
 graph['5'].inputs.images=previous;return graph;
}
