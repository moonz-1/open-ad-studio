// SDK/browser-client compatibility only; HTTP fixture, no inference.
import assert from 'node:assert/strict';
import {OSH} from '../../shared/runtime/client.ts';
const original=globalThis.fetch,calls=[];
try{globalThis.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});return new Response(JSON.stringify({url:'/outputs/1111111111111111.png',seconds:1,frames:73,fps:24}),{headers:{'content-type':'application/json'}});};
await OSH.keyframe('supporting scene',7,{width:768,height:1024},'z_image_turbo_bf16.safetensors');assert.equal(calls.at(-1).body.model,'z_image_turbo_bf16.safetensors');assert.equal(calls.at(-1).body.width,768);
await OSH.shot([],'legacy Director',3,1,'ltx-model');assert.equal(calls.at(-1).body.model,'ltx-model');
await OSH.shot([],'Ad Studio sizes',3,1,{width:288,height:512,model:'ltx',frames:73,fps:24});assert.equal(calls.at(-1).body.frames,73);assert.equal(calls.at(-1).body.fps,24);assert.equal(calls.at(-1).body.width,288);
await OSH.audio('local sound',3,1);assert.equal(calls.at(-1).url,'/api/audio');for(const c of calls)assert.match(c.headers['X-OSH-Request'],/^[a-f0-9]{32}$/);
await OSH.productVideo({image:'/outputs/1111111111111111.png',mode:'camera',ratio:'9:16',duration:3});assert.equal(calls.at(-1).url,'/api/product-video');assert.equal(calls.at(-1).headers['X-OSH-Request'],undefined);
console.log('PASS shared client: tracked Director keyframe/audio/model-string calls, Ad Studio options+frames/FPS and product-video compatibility; no GPU jobs.');
}finally{globalThis.fetch=original;}
