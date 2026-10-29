export const geometryBase='hunyuan3d-dit-v2-mini.safetensors';
/** A bounded geometry-only OBJ subset. External materials/resources are ignored. */
export function trainingObj(value:unknown):string{
 if(typeof value!=='string'||!value.length||value.length>5*1024*1024)throw Error('Choose an OBJ mesh under 5 MB.');
 const lines:string[]=[];let vertices=0,faces=0;
 for(const line of value.split(/\r?\n/)){const parts=line.trim().split(/\s+/);if(parts[0]==='v'){if(parts.length<4||!parts.slice(1,4).every(n=>Number.isFinite(Number(n))))throw Error('OBJ vertices must contain finite coordinates.');lines.push('v '+parts.slice(1,4).join(' '));vertices++}
  else if(parts[0]==='f'){const indices=parts.slice(1).map(p=>p.split('/')[0]);if(indices.length<3||indices.length>64||indices.some(n=>!/^[-]?\d+$/.test(n)||!Number.isSafeInteger(Number(n))||!Number(n)))throw Error('OBJ faces must use valid vertex indices.');lines.push('f '+indices.join(' '));faces+=indices.length-2}
  if(vertices>100000||faces>200000)throw Error('Simplify a copy of this mesh before training.');
 }
 if(!vertices||!faces)throw Error('The OBJ needs vertices and faces.');return lines.join('\n');
}
export function geometryGraph(model=geometryBase,lora?:string,seed=7,steps=20,resolution=128){
 const graph:Record<string,{class_type:string;inputs:Record<string,unknown>}>= {
  '1':{class_type:'ImageOnlyCheckpointLoader',inputs:{ckpt_name:model}},
  '2':{class_type:'LoadImage',inputs:{image:''}},
  '3':{class_type:'CLIPVisionEncode',inputs:{clip_vision:['1',1],image:['2',0],crop:'center'}},
  '4':{class_type:'Hunyuan3Dv2Conditioning',inputs:{clip_vision_output:['3',0]}},
  '5':{class_type:'EmptyLatentHunyuan3Dv2',inputs:{resolution:512,batch_size:1}},
  '6':{class_type:'KSampler',inputs:{model:['1',0],positive:['4',0],negative:['4',1],latent_image:['5',0],seed,steps,cfg:5.5,sampler_name:'euler',scheduler:'simple',denoise:1}},
  '7':{class_type:'VAEDecodeHunyuan3D',inputs:{samples:['6',0],vae:['1',2],num_chunks:8000,octree_resolution:resolution}},
  '8':{class_type:'VoxelToMesh',inputs:{voxel:['7',0],algorithm:'surface net',threshold:0.6}},
  '9':{class_type:'OSHSaveGeometry',inputs:{mesh:['8',0],filename_prefix:'osh/shape'}},
 };
 if(lora){graph['90']={class_type:'LoraLoaderModelOnly',inputs:{model:['1',0],lora_name:lora,strength_model:1}};graph['6'].inputs.model=['90',0]}return graph;
}
