// Already-built LOCAL image only. No build, Pod, models, GPU flags or private inputs.
// DOCKER_BINARY may point to Docker Desktop's installed docker.exe.
import {randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {benchmarkGraph,validateGraph} from './graph.mjs';
if(process.argv.join(' ').includes('--approved'))throw Error('This CPU harness never approves paid operations');
if(!process.argv.includes('--run-local')){console.log('DRY RUN: --run-local tests an already-built CPU image with ephemeral local authentication; no weights/cloud.');process.exit();}
const exec=promisify(execFile),docker=process.env.DOCKER_BINARY||'docker';
const folder=resolve('outputs/cpu-preflight-20261022/run-'+Date.now());await mkdir(folder,{recursive:true});
const name='adstudio-ltx25-cpu-'+Date.now(),token=randomBytes(32).toString('hex');
const env={...process.env,BENCHMARK_PROXY_TOKEN:token,COMFY_BASE_URL:'http://127.0.0.1:28189',BENCHMARK_COMFY_URL:'http://127.0.0.1:28188'};
const command=async(args)=> (await exec(docker,args,{env,windowsHide:true,timeout:120000,maxBuffer:8*1024*1024})).stdout;
const get=async(path,port=28188)=>{
 const r=await fetch(`http://127.0.0.1:${port}${path}`,{headers:port===28189?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(3000)});
 if(!r.ok)throw Error(`CPU endpoint ${port}${path}: HTTP${r.status}`);return r.json();
};
let id,passed=false;
try {
 // Refuse an occupied port before Docker startup; never reuse another service.
 for(const port of [28188,28189]){
  let occupied=false;try{await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1000)});occupied=true;}catch{}
  assert.equal(occupied,false,`Port ${port} already occupied`);
 }
 const image=JSON.parse(await command(['image','inspect','adstudio-ltx25-cpu-check','--format','{{json .Id}}']));
 await writeFile(folder+'/image.json',JSON.stringify({image,pinsSha256:createHash('sha256').update(await readFile('adstudio/benchmark/pins.json')).digest('hex')},null,2));
 id=(await command(['run','--pull','never','-d','--name',name,'--cpus','8','--memory','10g','--memory-swap','10g',
  '-e','BENCHMARK_PROXY_TOKEN','-e','HF_HUB_OFFLINE=1','-e','TRANSFORMERS_OFFLINE=1','-e','HF_HUB_DISABLE_TELEMETRY=1',
  '-p','127.0.0.1:28188:28188','-p','127.0.0.1:28189:28189','adstudio-ltx25-cpu-check'])).trim();
 assert.match(id,/^[a-f0-9]{64}$/);
 let ready=false,lastError;
 for(let i=0;i<90;i++){
  try{await get('/system_stats');await get('/api/v2/health',28189);ready=true;break;}catch(e){lastError=e;}
  const state=JSON.parse(await command(['inspect',id,'--format','{{json .State}}']));
  if(!state.Running)throw Error('CPU container exited: '+JSON.stringify(state));
  await new Promise(r=>setTimeout(r,1000));
 }
 if(!ready)throw lastError||Error('CPU service startup deadline');
 const stats=await get('/system_stats');assert.ok(stats.devices.every(d=>d.type==='cpu'),'GPU must not be exposed');
 await writeFile(folder+'/system-stats.json',JSON.stringify(stats,null,2));
 const nodes=await get('/object_info');validateGraph(benchmarkGraph({prompt:'CPU schema check'}),nodes,{weights:false});
 await writeFile(folder+'/object-info.json',JSON.stringify(nodes));
 console.log('PASS pinned CPU graph schema, all 34 node instances; missing-weight choices excluded, no LTX graph queued.');
 const software=await command(['exec',id,'/opt/benchmark-venv/bin/python','-m','pip','check']);
 await writeFile(folder+'/pip-check.txt',software);console.log(software.trim());
 const test=await exec(process.execPath,['adstudio/benchmark/transport-smoke.mjs','--run-local'],{env,windowsHide:true,timeout:120000,maxBuffer:1024*1024});
 await writeFile(folder+'/transport.log',test.stdout+test.stderr);console.log(test.stdout.trim());
 passed=true;
} catch(e){const message=String(e.message).replaceAll(token,'[redacted]');await writeFile(folder+'/failure.txt',message);throw Error(message);}
finally {
 if(id&&/^[a-f0-9]{64}$/.test(id)){
  try{
   const logs=await exec(docker,['logs',id],{env,windowsHide:true,maxBuffer:8*1024*1024});
   await writeFile(folder+'/runtime.log',(logs.stdout+logs.stderr).replaceAll(token,'[redacted]'));
   await writeFile(folder+'/container.json',await command(['inspect',id,'--format','{"name":{{json .Name}},"state":{{json .State}},"gpuRequests":{{json .HostConfig.DeviceRequests}},"ports":{{json .HostConfig.PortBindings}}}']));
  } finally {
   await command(['stop','--timeout','15',id]);
   const stopped=JSON.parse(await command(['inspect',id,'--format','{{json .State}}']));
   await writeFile(folder+'/stopped.json',JSON.stringify(stopped,null,2));
   assert.equal(stopped.Running,false,'CPU container must stop');
   // Drop Docker's stored copy of the disposable token after preserving logs.
   await command(['rm',id]);
  }
 }
 await writeFile(folder+'/result.json',JSON.stringify({passed,at:new Date().toISOString(),cpuOnly:true,weightsLoaded:false,privateAssetsUsed:false,modelsQueued:[],containerId:id},null,2));
 console.log('Private CPU evidence:',folder);
}
