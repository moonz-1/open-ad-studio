// Live CPU-only media coexistence checks. No model generation or downloads.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname,join,resolve} from 'node:path';
import {loadEnv} from 'vite';
const exec=promisify(execFile),env={...loadEnv('development',process.cwd(),''),...process.env};
const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8294',ffmpeg=env.FFMPEG_PATH||'ffmpeg',ffprobe=join(dirname(ffmpeg),'ffprobe.exe');
const sha=b=>createHash('sha256').update(b).digest('hex');
const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
const probe=async url=>JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',resolve('.'+url)],{windowsHide:true})).stdout);
const original=[];
for(const audio of [false,true]) {
 const url='/outputs/'+randomBytes(8).toString('hex')+'.webm';
 const args=['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=3'];
 if(audio)args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3');
 args.push('-map','0:v:0',...(audio?['-map','1:a:0','-c:a','libopus']:['-an']),'-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6',resolve('.'+url));
 await exec(ffmpeg,args,{windowsHide:true});
 const hash=sha(await readFile('.'+url));original.push({url,hash});
 for(const [speed,reverse,keepAudio]of [[1,false,true],[2,true,true],[.5,false,false]]) {
  const edit=await post('edit-video',{video:url,start:.5,end:2.5,speed,reverse,keepAudio,width:192,height:108});assert.equal(edit.status,200,JSON.stringify(edit));
  const p=await probe(edit.data.url);assert.equal(p.streams[0].width,192);assert.equal(p.streams[0].height,108);
  assert.ok(Math.abs(Number(p.format.duration)-2/speed)<.15);
  assert.equal(p.streams.some(s=>s.codec_type==='audio'),audio&&keepAudio);
  const exported=await post('export',{video:edit.data.url});assert.equal(exported.status,200);
  const mp=await probe(exported.data.url);assert.equal(mp.streams.some(s=>s.codec_type==='audio'),audio&&keepAudio);
  assert.equal(mp.streams.find(s=>s.codec_type==='video').codec_name,'h264');
  if(audio&&keepAudio)assert.equal(mp.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
 }
 // Corrupt/invalid edits must not leave subsequent export blocked.
 assert.equal((await post('edit-video',{video:url,start:2,end:1})).status,400);
 assert.equal((await post('edit-video',{video:url,keepAudio:'yes'})).status,400);
 assert.equal((await post('export',{video:url})).status,200);
 assert.equal(sha(await readFile('.'+url)),hash,'original video changed');
}
const input=(await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=c=orange:size=96x128','-frames:v','1','-f','image2pipe','-c:v','png','-'],{windowsHide:true,encoding:'buffer'})).stdout;
const upload=await post('upload',{image:'data:image/png;base64,'+input.toString('base64')});assert.equal(upload.status,200);
for(const mode of ['locked','camera'])for(const ratio of ['16:9','9:16','1:1'])for(const motion of mode==='camera'?['push','pan-left','pan-right']:['push']) {
 const r=await post('product-video',{mode,ratio,image:upload.data.url,background:original[0].url,duration:2,motion});assert.equal(r.status,200,JSON.stringify(r));
 const p=await probe(r.data.url);assert.equal(p.streams[0].nb_read_frames,'49');assert.equal((await post('export',{video:r.data.url})).status,200);
}
assert.equal(sha(await readFile('.'+upload.data.url)),sha(input));
for(const src of original)assert.equal(sha(await readFile('.'+src.url)),src.hash);
const modelResponse=await fetch(base+'/api/models'),models=await modelResponse.json();
if(modelResponse.ok)assert.equal(typeof models.audio.available,'boolean');
else {
 assert.equal(modelResponse.status,503,'offline model discovery must fail explicitly');
 assert.equal(typeof models.error,'string');
 const caps=await(await fetch(base+'/api/capabilities')).json();assert.equal(caps.ffmpeg.available,true);
 console.log('PASS offline Comfy: model discovery explicitly unavailable; local FFmpeg product/edit/export tests succeeded.');
}
const flac='/outputs/'+randomBytes(8).toString('hex')+'.flac';
await exec(ffmpeg,['-v','error','-i',resolve('.'+original[1].url),'-vn','-c:a','flac',resolve('.'+flac)],{windowsHide:true});
const response=await fetch(base+flac);assert.equal(response.headers.get('content-type'),'audio/flac');assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(await readFile('.'+flac)));
await writeFile('outputs/integration-tests.json',JSON.stringify({at:new Date().toISOString(),original,passed:true,tests:'silent/audio trim/speed/reverse/resize/export, product modes/ratios, invalid recovery, source hashes'},null,2));
console.log('PASS integration: silent/audio edits/exports, all product formats, recovery and original hashes; no GPU jobs.');
