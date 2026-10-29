// Run against an isolated API configured with unreachable Comfy/proxy URLs. No GPU work.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
import {templates,templateSettings} from '../src/templates.ts';
import {defaults} from '../src/projects.ts';
const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8296',env={...loadEnv('development',process.cwd(),''),...process.env},exec=promisify(execFile);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const post=async(name,body)=>{const r=await fetch(base+'/api/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
const health=await(await fetch(base+'/api/health')).json();assert.equal(health.comfyui,false);assert.equal(health.proxy,false);
const capabilities=await(await fetch(base+'/api/capabilities')).json();assert.equal(capabilities.ffmpeg.available,true);assert.equal(capabilities.productVideo,true);
assert.equal((await fetch(base+'/api/models')).status,503);
const png=(await exec(env.FFMPEG_PATH||'ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=96x128','-frames:v','1','-f','image2pipe','-c:v','png','-'],{windowsHide:true,encoding:'buffer'})).stdout;
const image=await post('upload',{image:'data:image/png;base64,'+png.toString('base64')});
for(const template of templates){
 const s=templateSettings(template.id,defaults());
 const take=await post('product-video',{image:image.url,mode:s.mode,ratio:s.ratios[0],duration:s.duration,motion:s.motion});
 assert.equal(take.frames,73);assert.equal(take.fps||24,24);assert.equal(take.motion,s.motion);
 const edit=await post('edit-video',{video:take.url,start:.5,end:2.5,speed:2,reverse:true,width:take.width,height:take.height,keepAudio:true});
 const mp4=await post('export',{video:edit.url});assert.equal((await fetch(base+mp4.url)).status,200);
 console.log('PASS offline template + adjusted MP4:',template.id);
}
assert.equal(hash(await readFile('.'+image.url)),hash(png));
console.log('PASS: Camera/Adjust/export available with Comfy and proxy unreachable; source unchanged.');
