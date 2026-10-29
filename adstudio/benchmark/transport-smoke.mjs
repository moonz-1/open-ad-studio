// CPU-only synthetic SaveVideo test through the real SDK/proxy. No model nodes.
// Default dry run. Uses already running LOCAL services; never starts a Pod/server.
import {Comfy} from '@comfyorg/sdk';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,dirname,join} from 'node:path';
import {loadEnv} from 'vite';
import assert from 'node:assert/strict';
if(!process.argv.includes('--run-local')){console.log('DRY RUN: synthetic CPU SDK/SaveVideo test; --run-local required.');process.exit(0);}
const comfy=process.env.BENCHMARK_COMFY_URL||'http://127.0.0.1:8188',proxy=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
for(const url of [comfy,proxy])if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))throw Error('Loopback services/tunnel only');
const queue=await(await fetch(comfy+'/queue',{signal:AbortSignal.timeout(5000)})).json();
if(queue.queue_running?.length||queue.queue_pending?.length)throw Error('Existing Comfy queue is busy. Do not disturb it; retry smoke later.');
const env={...loadEnv('development',process.cwd(),''),...process.env},exec=promisify(execFile),ffmpeg=env.FFMPEG_PATH||'ffmpeg',ffprobe=env.FFPROBE_PATH||(process.platform==='win32'?join(dirname(ffmpeg),'ffprobe.exe'):'ffprobe');
const folder=resolve('outputs/benchmark-preflight-20261022/transport-'+Date.now());await mkdir(folder,{recursive:true});
const input=join(folder,'synthetic.png'),output=join(folder,'synthetic.mp4');
await exec(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=96x128','-frames:v','1',input],{windowsHide:true});
const graph={
 '1':{class_type:'LoadImage',inputs:{image:'synthetic.png'}},
 '2':{class_type:'RepeatImageBatch',inputs:{image:['1',0],amount:73}},
 '3':{class_type:'CreateVideo',inputs:{images:['2',0],fps:24,bit_depth:8}},
 '4':{class_type:'SaveVideo',inputs:{video:['3',0],filename_prefix:'adstudio-synthetic-preflight',format:'mp4','format.codec':'h264'}}
};
// setInput replaces a filename with a live SDK asset object. Never serialize
// transports/authentication state into evidence; retain the original JSON graph.
const graphSnapshot=structuredClone(graph);
process.env.COMFY_BASE_URL=proxy;
if(process.env.BENCHMARK_PROXY_TOKEN)process.env.COMFY_API_KEY=process.env.BENCHMARK_PROXY_TOKEN;
else delete process.env.COMFY_API_KEY;
const client=new Comfy(),workflow=client.workflows.fromJson(graph);workflow.setInput('1','image',client.assets.fromFile(input));
const begin=Date.now(),job=await client.run(workflow,{timeoutMs:60000});
const asset=job.getOutputs('4')[0];assert.ok(asset,'Proxy omitted SaveVideo output');await asset.toFile(output);
const bytes=await readFile(output);assert.equal(bytes.subarray(4,8).toString(),'ftyp');
const metadata=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_streams','-of','json',output],{windowsHide:true})).stdout),video=metadata.streams.find(s=>s.codec_type==='video');
assert.equal(video.codec_name,'h264');assert.equal(video.width,96);assert.equal(video.height,128);assert.equal(video.avg_frame_rate,'24/1');assert.equal(video.nb_read_frames,'73');
await writeFile(join(folder,'result.json'),JSON.stringify({passed:true,synthetic:true,modelsUsed:[],jobId:job.id,seconds:(Date.now()-begin)/1000,graph:graphSnapshot,metadata},null,2));
console.log('PASS CPU SDK → proxy → Comfy CreateVideo/SaveVideo → downloaded H.264 MP4, 73frames/24FPS. Synthetic only:',folder);
