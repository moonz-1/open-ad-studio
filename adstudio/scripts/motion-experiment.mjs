// Bounded, opt-in local investigation. No dataset discovery or automatic sweeps.
// node adstudio/scripts/motion-experiment.mjs <private-manifest.json>
// Manifest: {folder, runs:[{name,image,width,height,strength?:number,schedule?:'distilled',camera?:true}], prompt,seed}
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Comfy } from '@comfyorg/sdk';
import { loadEnv } from 'vite';
const exec = promisify(execFile), sha = b => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.ok(manifest.runs.length > 0 && manifest.runs.length <= 5);
assert.ok(Number.isInteger(manifest.seed) && manifest.seed >= 0 && manifest.seed <= 4294967295);
assert.ok(typeof manifest.prompt === 'string' && manifest.prompt.trim());
// Refuse to overwrite earlier evidence, including on accidental reruns.
const folder = resolve(manifest.folder); await mkdir(folder);
const base = process.env.OSH_TEST_URL || 'http://127.0.0.1:8294';
const env = {...loadEnv('development',process.cwd(),''),...process.env};
const ffmpeg = env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = env.FFPROBE_PATH || join(dirname(ffmpeg),'ffprobe.exe');
const template = await readFile('shared/workflows/shot_ltxv.json');
const report = {started:new Date().toISOString(),base,manifest,workflowSha256:sha(template),
  commit:(await exec('git',['rev-parse','HEAD'])).stdout.trim(),dirty:!!(await exec('git',['status','--porcelain'])).stdout.trim(),
  health:await(await fetch(base+'/api/health')).json(),runs:[]};
report.servedClientSha256=sha(Buffer.from(await(await fetch(base+'/adstudio/src/main.ts')).arrayBuffer()));
report.versionNote='Git commit describes the local checkout; it does not prove the historical server revision.';
assert.ok(report.health.comfyui && report.health.proxy);
const save = () => writeFile(join(folder,'report.json'),JSON.stringify(report,null,2));
const post = async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data};
for (const spec of manifest.runs) {
  assert.match(spec.name,/^[a-zA-Z0-9-]+$/); assert.ok(!spec.schedule || spec.schedule==='distilled');
  const strength=spec.strength ?? 1;
  assert.ok(typeof strength==='number' && Number.isFinite(strength) && strength>=0 && strength<=1,'Guide strength must be a number in [0,1]');
  const bytes=await readFile(spec.image),upload=await post('upload',{image:'data:image/png;base64,'+bytes.toString('base64')});
  const run={...spec,inputSha256:sha(bytes),upload,started:new Date().toISOString()};report.runs.push(run);await save();
  try {
    const queue=await(await fetch((env.COMFYUI_URL || 'http://127.0.0.1:8188')+'/queue')).json();
    assert.ok(!queue.queue_running?.length && !queue.queue_pending?.length,'Another local GPU job is active; do not overlap experiments');
    const historyBase=(env.COMFYUI_URL || 'http://127.0.0.1:8188')+'/history';
    const before=new Set(Object.keys(await(await fetch(historyBase)).json()));
    const start=Date.now();
    if(spec.camera) {
      run.request={image:upload.url,mode:'camera',ratio:'16:9',motion:'push',duration:3};
      run.result=await post('product-video',run.request);
    } else {
      const graph=JSON.parse(template);graph['3'].inputs.text=manifest.prompt;
      graph['6'].inputs.width=graph['7'].inputs.width=spec.width;
      graph['6'].inputs.height=graph['7'].inputs.height=spec.height;
      graph['7'].inputs.length=73;graph['14'].inputs.noise_seed=manifest.seed;
      graph['8'].inputs.strength=strength;
      graph['5'].inputs.image=upload.url;
      run.request={keys:[{image:upload.url,t:0,strength}],prompt:manifest.prompt,seed:manifest.seed,duration:3,width:spec.width,height:spec.height};
      if(spec.schedule) {
        // One-variable hypothesis, NOT the complete upstream multi-scale pipeline.
        graph['13']={class_type:'ManualSigmas',inputs:{sigmas:'1.0, 0.9937, 0.9875, 0.9812, 0.9750, 0.9094, 0.7250, 0.4219, 0.0'}};
        process.env.COMFY_BASE_URL=env.COMFY_BASE_URL || 'http://127.0.0.1:8189';
        const c=new Comfy(),wf=c.workflows.fromJson(graph);
        wf.setInput('5','image',c.assets.fromFile(resolve('.'+upload.url)));
        const job=await c.run(wf);run.jobId=job.id;run.metrics=job.metrics;
        const name=randomBytes(8).toString('hex')+'.webm';await job.getOutputs('17')[0].toFile(resolve('outputs',name));
        run.result={url:'/outputs/'+name,frames:73,seconds:(Date.now()-start)/1000};
      } else run.result=await post('shot',run.request);
      await writeFile(join(folder,spec.name+'-graph.json'),JSON.stringify(graph,null,2));
    }
    run.wallSeconds=(Date.now()-start)/1000;
    const after=await(await fetch(historyBase)).json();
    run.history=Object.entries(after).filter(([id])=>!before.has(id)).map(([id,job])=>({id,prompt:job.prompt,status:job.status}));
    run.samplerCached=run.history.some(j=>j.status?.messages?.some(([event,data])=>event==='execution_cached' && data.nodes?.includes('14')));
    if(run.samplerCached) run.timingNote='Cached replay; not a fresh model render';
    const video=Buffer.from(await(await fetch(base+run.result.url)).arrayBuffer());
    run.videoSha256=sha(video);await writeFile(join(folder,spec.name+'.webm'),video);
    run.export=await post('export',{video:run.result.url});
    const mp4=Buffer.from(await(await fetch(base+run.export.url)).arrayBuffer());
    run.mp4Sha256=sha(mp4);await writeFile(join(folder,spec.name+'.mp4'),mp4);
    run.probe=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',join(folder,spec.name+'.mp4')],{windowsHide:true})).stdout);
    assert.equal(+run.probe.streams[0].nb_read_frames,73);assert.equal(run.probe.streams[0].width,spec.width);assert.equal(run.probe.streams[0].height,spec.height);
    await exec(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-i',join(folder,spec.name+'.mp4'),'-vf','select=eq(n\\,0)+eq(n\\,36)+eq(n\\,72),tile=3x1','-frames:v','1',join(folder,spec.name+'-contact.png')],{windowsHide:true});
    run.technical='PASS';
  } catch(e) {run.technical='FAIL';run.error=String(e);process.exitCode=1;}
  run.finished=new Date().toISOString();await save();console.log(spec.name,run.technical,run.result,run.error||'');
}
console.log(folder);
