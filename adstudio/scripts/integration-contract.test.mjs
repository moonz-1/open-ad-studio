// CPU-only client contract test: captions, Qwen and older shot calls coexist.
import assert from 'node:assert/strict';
import {OSH} from '../../shared/runtime/client.ts';
const original=globalThis.fetch,requests=[];
try{
 globalThis.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body),headers:options.headers});return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});};
 await OSH.captions('/outputs/aaaaaaaaaaaaaaaa.flac');
 await OSH.qwenHero('/outputs/aaaaaaaaaaaaaaaa.png',{},'MOCK-ORIGINAL','project-one');
 await OSH.qwenHero('/outputs/aaaaaaaaaaaaaaaa.png',{},'MOCK-LEGACY');
 await OSH.shot([],'motion',3,42,'legacy-model');
 await OSH.shot([],'motion',3,42,{model:'new-model',frames:73,fps:24,width:512,height:288,textDevice:'cpu'});
 await OSH.keyframe('image',42,{width:512,height:512,textDevice:'cpu'},'image-model');
 assert.equal(requests[0].url,'/api/captions');assert.equal(requests[0].body.audio,'/outputs/aaaaaaaaaaaaaaaa.flac');
 assert.equal(requests[1].url,'/api/hero/qwen');assert.equal(requests[1].body.projectId,'project-one');assert.ok(!('projectId' in requests[2].body),'Legacy Qwen call remains valid');
 assert.equal(requests[3].body.model,'legacy-model');assert.equal(requests[4].body.frames,73);assert.equal(requests[4].body.fps,24);assert.equal(requests[4].body.textDevice,'cpu');assert.equal(requests[5].body.textDevice,'cpu');
 for(const r of requests)assert.match(r.headers['X-OSH-Request'],/^[a-f0-9]{32}$/);
 console.log('PASS MOCK client contracts: captions/Qwen tracked together, optional project identity, legacy model-string and options/frames/FPS/text-device compatibility. NO inference or browser acceptance.');
}finally{globalThis.fetch=original;}
