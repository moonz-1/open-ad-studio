// REAL application/Vite HTTP startup on isolated ports. Backend is a strict
// loopback fixture, NOT SSH, ComfyUI or inference. No private assets or API keys.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,realpath,rm,stat,symlink,unlink} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer as httpServer} from 'node:http';
import {createServer as tcpServer} from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {repoRoot,localSession} from '../benchmark/qwen-app-local.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const outputs=join(repoRoot,'outputs'),fixture=await mkdtemp(join(outputs,'qwen-startup-rehearsal-'));
const session=join(fixture,'session'),evidence=join(fixture,'evidence');await mkdir(evidence);
const python=process.env.QWEN_TEST_PYTHON||'python',children=[],calls=[];
let backend,available=true,exitCode,escapeTarget,escapeLink;
const env={...process.env};for(const k of ['QWEN_SESSION_DIR','QWEN_APP_SESSION_DIR','QWEN_APP_RELAY_URL','QWEN_APP_REMOTE_SESSION','RUNPOD_API_KEY','QWEN_TERMINATION_KEY','HF_TOKEN','OSH_TOKEN'])delete env[k];
const run=(args,extraEnv={})=>execFileSync(process.execPath,args,{cwd:repoRoot,env:{...env,...extraEnv},stdio:'pipe',encoding:'utf8',timeout:30000});
const json=async(p,v)=>writeFile(p,JSON.stringify(v,null,2));
const freePort=async()=>{const s=tcpServer();await new Promise((ok,no)=>{s.once('error',no);s.listen(0,'127.0.0.1',ok);});const p=s.address().port;await new Promise(ok=>s.close(ok));assert.notEqual(p,8301);return p;};
const launcher=join(repoRoot,'adstudio/benchmark/qwen-app-local.mjs');
let before8301;
try{
 try{before8301=JSON.parse(await readFile(join(outputs,'hero-serve-audit/server.json'),'utf8'));}catch{}
 // Invoke the actual preparation script, no patched path implementation. Its
 // metadata and public Git archive are non-sensitive local-only fixtures.
 execFileSync(python,['adstudio/benchmark/qwen-app-prepare.py','--bundle','--out',session],{cwd:repoRoot,env,timeout:30000});
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim(),port=await freePort(),origin='http://127.0.0.1:'+port;
 const now=Date.now()/1000,lease={version:1,podId:'CPU-ONLY-NOT-A-REAL-POD',name:'adstudio-qwen2511-LOCAL-MOCK',created:now-10,deadline:now+7000,cap:2,gpuRate:.59,storageHourly:.02,image:'runpod/comfyui@sha256:7ed65713a24c7c836cea8e5ba338ee140b0257b0a086cc3835784e0473efe2f2'};
 const plan={version:1,purpose:'qwen-app-acceptance',projectId:'CPU-fixture',brandId:'CPU-brand',sourceId:'CPU-source',productId:'',paidApproved:true,privateUploadApproved:true,podId:lease.podId,maxJobs:1,maxSpendUSD:2,reserveUSD:4,seed:42,browserOrigin:origin,remoteOrigin:'http://127.0.0.1:28301',codeCommit:commit,originalSha256:'a'.repeat(64),referenceSha256:'b'.repeat(64),promptSha256:'c'.repeat(64)};
 const fresh=()=>json(join(session,'pod-watchdog-ready.json'),{podId:lease.podId,state:'armed',checked:Date.now()/1000,deadline:lease.deadline});
 await json(join(session,'acceptance.json'),plan);await json(join(session,'lease.json'),lease);await fresh();
 const checked=JSON.parse(run([launcher,'--session',session,'--check']));
 assert.equal(checked.sessionDir,session);assert.equal(checked.environment.QWEN_SESSION_DIR,checked.environment.QWEN_APP_SESSION_DIR);
 const otherCwd=JSON.parse(execFileSync(process.execPath,[launcher,'--session',relative(repoRoot,session),'--check'],{cwd:tmpdir(),env,encoding:'utf8',timeout:30000}));
 assert.equal(otherCwd.sessionDir,session,'Relative session anchored to source worktree, not caller cwd');
 const physical=await realpath(session),physicalOutputs=await realpath(outputs),junction=physical!==session;
 assert.equal(checked.realSessionDir,physical);
 // Exercise the real Python watchdog import with the launcher's exact env;
 // this reads fixture files only and must not call the provider/load a key.
 const py="import importlib.util,json,pathlib; s=importlib.util.spec_from_file_location('g','adstudio/benchmark/qwen-guard.py'); g=importlib.util.module_from_spec(s);s.loader.exec_module(g);print(json.dumps({'path':str(g.OUT),'real':str(g.OUT.resolve()),'identity':json.loads((g.OUT/'local-session.json').read_text())}))";
 const guard=JSON.parse(execFileSync(python,['-c',py],{cwd:repoRoot,env:{...env,...checked.environment},encoding:'utf8',timeout:10000}));
 assert.equal(guard.path,session);assert.equal(guard.real,physical);assert.equal(guard.identity.sessionDir,session);
 // Actual filesystem junction/symlink escape, not path-function mocks.
 escapeTarget=await mkdtemp(join(tmpdir(),'qwen-relay-escape-'));await mkdir(join(escapeTarget,'session'));
 escapeLink=join(fixture,'escape');await symlink(escapeTarget,escapeLink,process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>localSession(join(escapeLink,'session')),/junction escapes/);
 assert.throws(()=>execFileSync(python,['adstudio/benchmark/qwen-app-prepare.py','--bundle','--out',join(escapeLink,'session')],{cwd:repoRoot,env,stdio:'pipe',timeout:10000}),/Command failed/);
 await assert.rejects(()=>localSession(resolve(repoRoot,'../outside/session')),/outer repository/);
 if(junction){
  // Reproduce the exact canonical outer-path failure on the real Windows
  // outputs junction, then require the unchanged API to reject it as well.
  await assert.rejects(()=>localSession(physical),/outer repository/);
  assert.throws(()=>execFileSync(python,['adstudio/benchmark/qwen-app-prepare.py','--bundle','--out',physical],{cwd:repoRoot,env,stdio:'pipe',timeout:10000}),/Command failed/);
 }
 assert.throws(()=>run([launcher,'--session',session,'--check'],{QWEN_SESSION_DIR:join(outputs,'wrong/session')}),/session differs/);
 const manifest=JSON.parse(await readFile(join(session,'local-session.json'),'utf8'));
 await json(join(session,'local-session.json'),{...manifest,repoRoot:'wrong-worktree'});assert.throws(()=>run([launcher,'--session',session,'--check']),/identity mismatch/);await json(join(session,'local-session.json'),manifest);
 const pack=JSON.parse(await readFile(join(session,'public-package.json'),'utf8'));await json(join(session,'public-package.json'),{...pack,commit:'0'.repeat(40)});assert.throws(()=>run([launcher,'--session',session,'--check']),/code commit/);await json(join(session,'public-package.json'),pack);
 backend=httpServer((req,res)=>{calls.push({method:req.method,path:req.url});res.setHeader('Content-Type','application/json');
  if(req.method!=='GET'){res.statusCode=500;res.end('{"error":"TEST FORBIDS UPLOADS AND GENERATION"}');return;}
  if(req.url==='/api/hero/capabilities')return res.end(JSON.stringify({qwen:{available,id:'qwen-fp8',reason:'LOCAL MOCK ONLY - NO MODEL',fixture:true}}));
  if(req.url==='/object_info')return res.end('{}');if(req.url==='/models')return res.end('[]');
  res.statusCode=503;res.end('{"error":"LOCAL MOCK ONLY"}');});
 await new Promise((ok,no)=>{backend.once('error',no);backend.listen(28301,'127.0.0.1',ok);});
 // Refuse a rehearsal that could auto-start an unrelated managed runtime.
 let runtime;try{runtime=JSON.parse(await readFile(join(outputs,'runtime-config.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 assert.notEqual(runtime?.mode,'managed','Do not auto-start managed ComfyUI in a local relay rehearsal');
 // A separate child loads the production vite.config.ts, not an API unit
 // fixture config, with the checked session env and its own optimizer cache.
 const app=spawn(process.execPath,[launcher,'--session',session,'--serve','--port',String(port)],{cwd:repoRoot,env:{...env,COMFYUI_URL:'http://127.0.0.1:28301',COMFY_BASE_URL:'http://127.0.0.1:28301'},stdio:['ignore','pipe','pipe']});children.push(app);
 let logs='';app.stdout.on('data',b=>{logs+=b;});app.stderr.on('data',b=>{logs+=b;});app.on('exit',code=>{exitCode=code;});
 for(let i=0;i<150&&!logs.includes('QWEN_LOCAL_RELAY_LISTENING');i++){if(exitCode!==undefined)throw Error('Actual Vite launcher exited: '+logs);await new Promise(ok=>setTimeout(ok,200));}
 assert.match(logs,/QWEN_LOCAL_RELAY_LISTENING/);
 const get=async path=>{const r=await fetch(origin+path);return {status:r.status,body:await r.json()};};
 const cap=async()=>{await fresh();return (await get('/api/hero/capabilities')).body.qwen;};
 let caps=await cap();assert.equal(caps.available,true);assert.equal(caps.acceptance,true);assert.equal(caps.podId,lease.podId);assert.equal(caps.fixture,true);
 assert.equal((await fetch(origin+'/adstudio/')).status,200,'Real Ad Studio HTML served');
 assert.equal((await get('/api/activity/'+'d'.repeat(32))).status,404,'Activity remains local');
 assert.equal((await get('/api/hero/qwen/provenance/'+'e'.repeat(16))).status,404,'Provenance remains local');
 assert.equal(calls.filter(c=>c.path.startsWith('/api/activity/')||c.path.includes('/provenance/')).length,0);
 const post=async()=>{const r=await fetch(origin+'/api/hero/qwen',{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':randomBytes(16).toString('hex')},body:'{}'});return {status:r.status,body:await r.json()};};
 const failures=[];
 for(const [label,change]of [['paid approval',{paidApproved:false}],['private upload approval',{privateUploadApproved:false}],['job limit',{maxJobs:2}],['budget cap',{maxSpendUSD:3}],['browser origin',{browserOrigin:'http://localhost:'+port}]]){
  await json(join(session,'acceptance.json'),{...plan,...change});caps=await cap();assert.equal(caps.available,false,label);const response=await post();assert.equal(response.status,503,label);failures.push(label);
 }
 await json(join(session,'acceptance.json'),plan);await fresh();
 await json(join(session,'pod-watchdog-ready.json'),{podId:lease.podId,state:'armed',checked:now-120,deadline:lease.deadline});assert.equal((await get('/api/hero/capabilities')).body.qwen.available,false);assert.equal((await post()).status,503);failures.push('stale watchdog');await fresh();
 available=false;assert.equal((await cap()).available,false);available=true;
 // Malformed input with valid approval is rejected locally, no remote POST.
 assert.equal((await post()).status,400);await assert.rejects(()=>stat(join(session,'one-job.json')),/ENOENT/);
 await json(join(session,'one-job.json'),{state:'claimed',testFixture:true});assert.equal((await cap()).available,false);failures.push('used one-job receipt');await rm(join(session,'one-job.json'));
 // Directly start the REAL application with an invalid session, bypassing
 // only our launcher to prove API.ts retains its own lexical restriction.
 const badPath=junction?physical:resolve(outputs,'../external/session'),badCache=join(fixture,'invalid-vite-cache');
 const code="import {createServer} from 'vite'; try { const s=await createServer({configFile:"+JSON.stringify(join(repoRoot,'vite.config.ts'))+",cacheDir:"+JSON.stringify(badCache)+",server:{host:'127.0.0.1',port:0,hmr:false}});await s.close();process.exit(9)} catch(e){console.error(e.message);process.exit(7)}";
 let bad;try{run(['--input-type=module','-e',code],{QWEN_APP_RELAY_URL:'http://127.0.0.1:28301',QWEN_APP_SESSION_DIR:badPath,COMFYUI_URL:'http://127.0.0.1:28301'});}catch(e){bad=e;}assert.equal(bad?.status,7);assert.match(bad.stderr.toString(),/outputs\/\.\.\.\/session folder/);
 assert.equal(calls.filter(c=>c.method!=='GET').length,0,'No private upload/inference endpoint called');
 if(before8301)assert.deepEqual(JSON.parse(await readFile(join(outputs,'hero-serve-audit/server.json'),'utf8')),before8301,'8301 server untouched');
 const result={passed:true,codeCommit:commit,platform:process.platform,repoRoot,session,physicalSession:physical,physicalOutputs,actualJunctionTested:junction,junctionEscapeRejected:true,watchdogSameLexicalAndPhysicalSession:true,actualProductionViteConfig:true,isolatedPort:port,remote:'MOCK LOOPBACK ONLY',remotePostCount:0,generationCount:0,privateAssets:false,browserAcceptance:'NOT RUN',invalidAPIPathRejected:true,failedClosed:failures,live8301ServerUnchanged:true};
 await json(join(evidence,'result.json'),result);await json(join(evidence,'mock-http-calls.json'),calls);await writeFile(join(evidence,'vite.log'),logs);
 console.log('PASS real local relay startup rehearsal: '+JSON.stringify(result));
}finally{
 for(const child of children){if(child.exitCode===null){child.kill();await Promise.race([new Promise(ok=>child.once('exit',ok)),new Promise(ok=>setTimeout(ok,5000))]);}}
 if(backend)await new Promise(ok=>backend.close(ok));
 if(escapeLink)await unlink(escapeLink); // unlink the junction, never recurse through it
 if(escapeTarget){if(!escapeTarget.startsWith(join(tmpdir(),'qwen-relay-escape-')))throw Error('Unsafe temporary fixture cleanup');await rm(escapeTarget,{recursive:true,force:true});}
 // Retain only safe diagnostics. Delete fixture approvals/bundle after rehearsal.
 if(!session.startsWith(outputs+sep))throw Error('Unsafe session cleanup');await rm(session,{recursive:true,force:true});
}
