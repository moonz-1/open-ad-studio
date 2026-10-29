// Actual GPU acceptance runner; does not replace browser acceptance testing.
// Usage: node adstudio/scripts/acceptance.mjs <manifest.json>
// Manifest: {image: <normalized PNG>, original?: <source>, prompt, seed, duration, ratios?}
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadEnv } from 'vite';
const exec = promisify(execFile);
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8288';
const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.ok(manifest.image && typeof manifest.prompt === 'string' && manifest.prompt.trim());
assert.ok(Number.isInteger(manifest.seed) && manifest.seed >= 0 && manifest.seed <= 4294967295);
assert.ok(manifest.duration >= 2 && manifest.duration <= 5);
const formats = {'16:9':{width:512,height:288},'9:16':{width:288,height:512},'1:1':{width:384,height:384}};
const ratios = manifest.ratios || Object.keys(formats);
assert.ok(ratios.length && ratios.every(r => formats[r]));
const env = {...loadEnv('development',process.cwd(),''),...process.env};
const ffmpeg = env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = env.FFPROBE_PATH || (env.FFMPEG_PATH ? join(dirname(ffmpeg),process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe') : 'ffprobe');
const folder = resolve('outputs',`acceptance-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomBytes(3).toString('hex')}`);
await mkdir(folder,{recursive:true});
const sha = data => createHash('sha256').update(data).digest('hex');
const input = await readFile(manifest.image);
assert.equal(input.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Provide a normalized PNG');
const report = {
  startedAt:new Date().toISOString(), manifest, inputSha256:sha(input),
  originalSha256:manifest.original ? sha(await readFile(manifest.original)) : null,
  workflowSha256:sha(await readFile('shared/workflows/shot_ltxv.json')),
  sourceCommit:(await exec('git',['rev-parse','HEAD'])).stdout.trim(),
  sourceDirty:!!(await exec('git',['status','--porcelain'])).stdout.trim(),
  health:await (await fetch(base+'/api/health')).json(),
  browserAcceptance:'NOT TESTED by this script', runs:[],
};
const save = () => writeFile(join(folder,'report.json'),JSON.stringify(report,null,2));
await save();
assert.ok(report.health.comfyui && report.health.proxy,'Services offline');
const post = async (route,body) => {
 const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json(); assert.ok(r.ok,`${route}: HTTP ${r.status}: ${JSON.stringify(data)}`); return data;
};
const upload=await post('upload',{image:'data:image/png;base64,'+input.toString('base64')});
report.upload=upload;
for(const ratio of ratios) {
 const name=ratio.replace(':','x');
 const referenceFile=manifest.references?.[ratio] || manifest.image;
 const referenceBytes=await readFile(referenceFile);
 const reference=manifest.references?.[ratio] ? await post('upload',{image:'data:image/png;base64,'+referenceBytes.toString('base64')}) : upload;
 const request={keys:[{image:reference.url,t:0}],prompt:manifest.prompt,seed:manifest.seed,duration:manifest.duration,...formats[ratio]};
 const run={ratio,referenceFile,referenceSha256:sha(referenceBytes),request,startedAt:new Date().toISOString(),technical:'RUNNING',quality:'PENDING visual review'};
 report.runs.push(run); await save();
 try {
  console.log('Generating',ratio,'seed',manifest.seed);
  run.result=await post('shot',request);
  const response=await fetch(base+run.result.url);
  assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'video/webm');
  const bytes=Buffer.from(await response.arrayBuffer());
  const video=join(folder,name+'.webm'); await writeFile(video,bytes);
  run.videoSha256=sha(bytes); run.bytes=bytes.length;
  const probe=await exec(ffprobe,['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames','-show_entries','format=duration,size','-of','json',video],{timeout:30000,windowsHide:true});
  run.probe=JSON.parse(probe.stdout);
  const stream=run.probe.streams[0];
  assert.equal(stream.width,formats[ratio].width); assert.equal(stream.height,formats[ratio].height);
  assert.equal(stream.r_frame_rate,'24/1'); assert.equal(Number(stream.nb_read_frames),run.result.frames);
  run.sampleFrames=[0,Math.floor((run.result.frames-1)/2),run.result.frames-1];
  const select='select='+run.sampleFrames.map(n=>`eq(n\\,${n})`).join('+')+',tile=3x1';
  await exec(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-i',video,'-vf',select,'-frames:v','1',join(folder,name+'-contact.png')],{timeout:30000,windowsHide:true});
  run.technical='PASS'; console.log(ratio,run.result);
 } catch(error) {run.technical='FAIL';run.error=String(error);console.error(ratio,run.error);}
 run.finishedAt=new Date().toISOString(); await save();
}
console.log('Evidence:',folder);
if(report.runs.some(r=>r.technical==='FAIL'))process.exitCode=1;
