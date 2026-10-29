/** Server-only FLUX GPU lifecycle. No browser input can authorize spending. */
import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRunpodHttp,loadRunpodApiKey,runpodBalance,listPods,getPod,createPod,terminatePod,gpuOffer,type RunpodHttp} from './runpod-rest.ts';
import {fluxBudgetFromEnv,gateFluxSpend,liveProvisionAuthorized,autoprovEnabled,estimateFluxJobUSD,type FluxBudgetConfig} from './runpod-flux-budget.ts';
import {sshKeyPaths,startComfyTunnel,waitLoopbackComfy,verifyRemoteFluxFiles,type TunnelHandle} from './runpod-flux-tunnel.ts';
import {flux3Availability,loadFlux3Workflow,flux3NodeIssues,flux3Resources,flux3Contract} from './flux3-klein-scene.ts';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'../..');
const pinsFile=join(ROOT,'adstudio/benchmark/flux3-runpod-pins.json');
const loadPins=async()=>JSON.parse(await readFile(pinsFile,'utf8'));
export type CustomerStage='Preparing GPU'|'Loading model'|'Generating photograph'|'Checking product'|'Designing advertisement'|'Ready'|'Releasing GPU'|'Cancelled'|'Error';
export type StageReporter=(stage:CustomerStage,detail?:string)=>void;
export type FluxSession={mode:'dry-run'|'reuse'|'provisioned';podId?:string;name?:string;comfyUrl:string;proxyUrl:string;stage:CustomerStage;budget:FluxBudgetConfig;plan:Record<string,any>;created?:boolean;tunnel?:TunnelHandle;leaseSignal?:AbortSignal;watchdog?:ChildProcess;intentPath?:string;cleanupToken?:string};
export const CUSTOMER_STAGES:CustomerStage[]=['Preparing GPU','Loading model','Generating photograph','Checking product','Designing advertisement','Ready'];
const sessionDir=(env:Record<string,string|undefined>)=>env.ADSTUDIO_FLUX3_SESSION_DIR||join(ROOT,'outputs/runpod-flux-session');
export const isFluxPodName=(name:string)=>typeof name==='string'&&name.startsWith('adstudio-flux3-');
async function saveSession(dir:string,data:Record<string,unknown>){await mkdir(dir,{recursive:true});const tmp=join(dir,'session-'+randomBytes(8).toString('hex')+'.tmp');await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,join(dir,'session.json'));}
export function workerProfile(env:Record<string,string|undefined>){
 const image=env.ADSTUDIO_FLUX3_WORKER_IMAGE||'',modelsDir=env.ADSTUDIO_FLUX3_WORKER_MODELS_DIR||'';
 let args:unknown;try{args=JSON.parse(env.ADSTUDIO_FLUX3_WORKER_ARGS_JSON||'null');}catch{}
 const valid=/^[a-zA-Z0-9][a-zA-Z0-9._/:-]*@sha256:[a-f0-9]{64}$/.test(image)&&/^\/[a-zA-Z0-9_./-]+$/.test(modelsDir)&&!modelsDir.includes('..')&&Array.isArray(args)&&args.length>0&&args.every(x=>typeof x==='string'&&x.length<8192);
 return {valid,image,modelsDir,args:args as string[],reason:valid?'Prepared worker configuration supplied; remote files/nodes/resources still require validation.':'Configure a digest-pinned FLUX-ready WORKER_IMAGE, WORKER_MODELS_DIR and WORKER_ARGS_JSON. The generic base image is not a verified model deployment. No models are downloaded automatically.'};
}
/** Runtime health alone never proves FLUX readiness. Node choices validate actual filenames. */
export async function detectHealthyFluxComfy(env:Record<string,string|undefined>=process.env,fetchImpl:typeof fetch=fetch){
 const comfyUrl=(env.COMFYUI_URL||'http://127.0.0.1:8188').replace(/\/$/,'');
 try{
  const u=new URL(comfyUrl);if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password)throw Error('FLUX backend must use private loopback transport.');
  const responses=await Promise.all(['/system_stats','/object_info','/queue'].map(p=>fetchImpl(comfyUrl+p,{redirect:'error',signal:AbortSignal.timeout(8000)})));if(responses.some(r=>!r.ok))throw Error('ComfyUI endpoints are not healthy.');
  const [stats,nodes,queue]=await Promise.all(responses.map(r=>r.json()));const {graph}=await loadFlux3Workflow('mi2i'),issues=flux3NodeIssues(graph,nodes),resources=flux3Resources(stats,queue);if(issues.length)throw Error(issues.join(' '));if(!resources.available)throw Error(resources.reason);
  const version=String(stats.system?.comfyui_version||'').split('.').map(Number);if(!version.length||!Number.isFinite(version[0])||!(version[0]>0||version[1]>=41))throw Error('Cannot verify ComfyUI >=0.41.0.');
  return {ok:true,comfyUrl,reason:'FLUX filenames, native node choices, version, idle queue, VRAM and RAM verified; actual loading remains unverified until native execution.',stats,nodes};
 }catch(e){return {ok:false,comfyUrl,reason:(e as Error).message};}
}
export async function planFluxProvision(env:Record<string,string|undefined>=process.env,httpFactory:(key:string)=>RunpodHttp=createRunpodHttp){
 const pins=await loadPins(),budget=fluxBudgetFromEnv(pins,env),live=liveProvisionAuthorized(env),key=loadRunpodApiKey(env),profile=workerProfile(env);
 let balance={clientBalance:Number(env.ADSTUDIO_RUNPOD_BALANCE_HINT||'3.56'),currentSpendPerHr:0,isAutoPayEnabled:false},balanceVerified=false,balanceError='';
 if(key){try{balance=await runpodBalance(httpFactory(key));balanceVerified=true;}catch{balanceError='RunPod account balance/spend could not be verified.';}}
 const gate=gateFluxSpend(balance.clientBalance,balance.currentSpendPerHr,balance.isAutoPayEnabled,budget);
 let reservedUSD=0;try{const ledger=JSON.parse(await readFile(join(sessionDir(env),'spend-ledger.json'),'utf8'));reservedUSD=Number(ledger.reservedUSD);if(!Number.isFinite(reservedUSD)||reservedUSD<0)throw Error('Invalid spend ledger.');}catch(e:any){if(e.code!=='ENOENT')throw e;}
 const sessionBudgetExceeded=reservedUSD+Math.min(budget.maxJobUSD,budget.maxSessionUSD)>budget.maxSessionUSD;
 const blocked=!live?'Dry-run only: live spending flags are disabled.':!autoprovEnabled(env)?'Automatic provisioning is disabled.':!key?'RUNPOD_API_KEY missing on server.':!balanceVerified?balanceError:!gate.ok?gate.reason:sessionBudgetExceeded?'Session budget is reserved/exhausted. Review the private spend ledger and actual billing before a new owner-authorized session.':!profile.valid?profile.reason:null;
 const plan={at:new Date().toISOString(),live,autoprov:autoprovEnabled(env),gpu:pins.gpu,image:profile.valid?profile.image:pins.image.ref,comfy:pins.comfy,volumeId:env.ADSTUDIO_FLUX3_NETWORK_VOLUME_ID||null,credentialsConfigured:!!key,workerConfigured:profile.valid,workerReason:profile.reason,modelStorageVerified:false,sessionReservedUSD:reservedUSD,estimatedJobUSD:estimateFluxJobUSD(budget),budget,gate,balance:{...balance,verified:balanceVerified,source:balanceVerified?'account':'unverified dry-run hint'},createBlockedReason:blocked};
 return {plan,budget,gate,live};
}
function sshEndpoint(pod:any){if(pod.status!=='RUNNING')return null;const direct=pod.ssh?.direct;if(direct&&typeof direct==='object'&&typeof direct.host==='string'&&Number.isInteger(direct.port))return {host:direct.host,port:direct.port};return null;}
export type FluxDependencies={tunnel?:typeof startComfyTunnel;verifyFiles?:typeof verifyRemoteFluxFiles;waitReady?:typeof waitLoopbackComfy;watchdog?:(env:Record<string,string|undefined>,intentPath:string)=>ChildProcess|undefined;sleep?:(ms:number,signal:AbortSignal)=>Promise<void>};
const sleep=async(ms:number,signal:AbortSignal)=>{signal.throwIfAborted();await new Promise<void>((ok,no)=>{const done=()=>{clearTimeout(t);signal.removeEventListener('abort',abort);},abort=()=>{done();no(signal.reason);},t=setTimeout(()=>{done();ok();},ms);signal.addEventListener('abort',abort,{once:true});});};
function startWatchdog(env:Record<string,string|undefined>,intentPath:string){const p=spawn(process.execPath,['--experimental-transform-types',join(ROOT,'shared/runtime/runpod-flux-watchdog.ts'),intentPath],{cwd:ROOT,env:{...process.env,...env},detached:true,windowsHide:true,stdio:'ignore'});p.unref();return p;}
/** Reconcile only an exact persisted creation identity, never arbitrary name-prefix Pods. */
export async function recoverFluxIntent(env:Record<string,string|undefined>=process.env,httpFactory:(key:string)=>RunpodHttp=createRunpodHttp,path=join(sessionDir(env),'intent.json'),expectedToken?:string){
 let intent:any;try{intent=JSON.parse(await readFile(path,'utf8'));}catch(e:any){if(e.code==='ENOENT')return {terminated:false,absent:true};throw e;}
 if(expectedToken&&intent.token!==expectedToken)throw Error('GPU intent changed; refusing cleanup from an older lease.');
 if(intent.schema!=='adstudio-owned-flux-v1'||!isFluxPodName(intent.name)||!/^[-a-f0-9]{32}$/.test(intent.token)||!intent.cleanupAuthorized)throw Error('Unrecognized GPU intent; manual review required.');
 const key=loadRunpodApiKey(env);if(!key)throw Error('Missing API key for owned GPU cleanup; intent retained.');const http=httpFactory(key);
 const matches=intent.podId?[await getPod(http,intent.podId)]: (await listPods(http)).filter(p=>p.name===intent.name);
 for(const pod of matches){if(!pod)continue;if(pod.name!==intent.name)throw Error('GPU ownership mismatch; refusing cleanup.');if(!await terminatePod(http,pod.id))throw Error('GPU teardown not confirmed; intent retained.');}
 await saveSession(dirname(path),{phase:'released',podId:intent.podId||null,name:intent.name,terminated:true,at:new Date().toISOString()});await unlink(path);return {terminated:true};
}
export async function ensureFluxGpuSession(opts:{env?:Record<string,string|undefined>;onStage?:StageReporter;httpFactory?:(key:string)=>RunpodHttp;fetchImpl?:typeof fetch;signal?:AbortSignal;dryRunOnly?:boolean;deps?:FluxDependencies}):Promise<FluxSession>{
 opts.signal?.throwIfAborted();
 const original=opts.env||process.env,env=(opts.dryRunOnly||original.ADSTUDIO_FLUX3_DRY_RUN==='1')?{...original,ADSTUDIO_RUNPOD_LIVE:'0',ADSTUDIO_FLUX3_SPEND_APPROVED:'0'}:original,onStage=opts.onStage||(()=>{}),deps=opts.deps||{},pins=await loadPins(),{plan,budget,live}=await planFluxProvision(env,opts.httpFactory),dir=sessionDir(env),profile=workerProfile(env);
 opts.signal?.throwIfAborted();await mkdir(dir,{recursive:true});onStage('Preparing GPU','Checking FLUX-specific backend readiness');const healthy=await detectHealthyFluxComfy(env,opts.fetchImpl);
 if(healthy.ok&&!opts.dryRunOnly&&original.ADSTUDIO_FLUX3_DRY_RUN!=='1'){const s:FluxSession={mode:'reuse',comfyUrl:healthy.comfyUrl,proxyUrl:env.COMFY_BASE_URL||'http://127.0.0.1:8189',stage:'Loading model',budget,plan:{...plan,detected:healthy.reason}};await saveSession(dir,{phase:'reuse',plan:s.plan});return s;}
 if(!live||plan.createBlockedReason){const session:FluxSession={mode:'dry-run',comfyUrl:`http://127.0.0.1:${pins.comfy.localForwardPort}`,proxyUrl:`http://127.0.0.1:${pins.comfy.localProxyPort}`,stage:'Preparing GPU',budget,plan:{...plan,localProbe:healthy.reason,dryRun:true}};await saveSession(dir,{phase:'dry-run',session});onStage('Preparing GPU','Dry-run only — no GPU or image created');return session;}
 const key=loadRunpodApiKey(env)!,http=(opts.httpFactory||createRunpodHttp)(key),keys=await sshKeyPaths(env),pub=(await readFile(keys.publicKey,'utf8')).trim();
 const offer=await gpuOffer(http,pins.gpu.id);if(Number(offer.price?.secure)!==pins.gpu.hourlyUSD||budget.gpuHourlyUSD<pins.gpu.hourlyUSD)throw Error('GPU quote differs from approved budget.');
 let eligible=(offer.dataCenters||[]).filter((d:any)=>['HIGH','MEDIUM','LOW'].includes(d.availability));const volumeId=env.ADSTUDIO_FLUX3_NETWORK_VOLUME_ID;
 if(volumeId){const v=await http('/network-volumes/'+encodeURIComponent(volumeId));if(v.status!==200||!v.json?.dataCenter)throw Error('Cannot verify model volume placement.');eligible=eligible.filter((d:any)=>d.id===v.json.dataCenter);}
 if(!eligible.length)throw Error('No compatible Secure GPU stock in the selected model-storage location.');
 const token=randomBytes(16).toString('hex'),name='adstudio-flux3-'+token,intentPath=join(dir,'intent.json'),deadline=Date.now()+budget.maxLeaseSeconds*1000;
 let intent:any={schema:'adstudio-owned-flux-v1',name,token,createdAt:Date.now(),deadline,cleanupAuthorized:true,image:profile.image};await writeFile(intentPath,JSON.stringify(intent,null,2),{flag:'wx',mode:0o600});
 let reserved=0;const ledgerPath=join(dir,'spend-ledger.json'),ledgerTmp=ledgerPath+'.tmp';try{let current=0;try{current=Number(JSON.parse(await readFile(ledgerPath,'utf8')).reservedUSD);}catch(e:any){if(e.code!=='ENOENT')throw e;}reserved=current+Math.min(budget.maxJobUSD,budget.maxSessionUSD);if(!Number.isFinite(reserved)||reserved>budget.maxSessionUSD)throw Error('Session budget already reserved by another request.');await writeFile(ledgerTmp,JSON.stringify({reservedUSD:reserved,maximumUSD:budget.maxSessionUSD,allocationsConservativelyReserved:true,lastIntent:token,at:new Date().toISOString()},null,2),{mode:0o600});await rename(ledgerTmp,ledgerPath);}catch(e){await unlink(intentPath);throw e;}
 const signal=AbortSignal.any([...(opts.signal?[opts.signal]:[]),AbortSignal.timeout(budget.maxLeaseSeconds*1000)]);let tunnel:TunnelHandle|undefined,watchdog:ChildProcess|undefined;
 try{
  signal.throwIfAborted();watchdog=(deps.watchdog||startWatchdog)(env,intentPath);
  onStage('Preparing GPU','Creating approved private GPU');const pod=await createPod(http,{name,cloud:'SECURE',dataCenterIds:[eligible[0].id],gpu:{id:pins.gpu.id,count:1,minCudaVersion:pins.gpu.minCudaVersion,minRamPerGpu:pins.gpu.minRamPerGpu,minVcpuCountPerGpu:pins.gpu.minVcpuCountPerGpu},image:profile.image,cmd:profile.args,disk:pins.storage.containerDiskGiB,mounts:volumeId?{network:[{volumeId,path:'/runpod-volume'}]}:{persistent:{size:pins.storage.persistentDiskGiB,path:pins.storage.persistentPath}},ports:['22/tcp'],startSsh:true,startJupyter:false,globalNetworking:false,env:{PUBLIC_KEY:pub}});
  intent={...intent,podId:pod.id};const updated=intentPath+'.tmp';await writeFile(updated,JSON.stringify(intent,null,2),{mode:0o600});await rename(updated,intentPath);await saveSession(dir,{phase:'created',...intent});
  let endpoint:null|{host:string;port:number}=null;
  for(let i=0;i<60;i++){signal.throwIfAborted();const fresh=await getPod(http,pod.id);if(!fresh)throw Error('Pod disappeared during startup.');if(!Number.isFinite(fresh.cost)||Number(fresh.cost)>budget.gpuHourlyUSD||fresh.locked)throw Error('Pod actual rate/lock violates approved lease.');endpoint=sshEndpoint(fresh);if(endpoint)break;await(deps.sleep||sleep)(5000,signal);}
  if(!endpoint)throw Error('Pod SSH startup timed out.');
  onStage('Loading model','Waiting for the prepared private worker; no automatic downloads');
  tunnel=await(deps.tunnel||startComfyTunnel)({host:endpoint.host,sshPort:endpoint.port,localPort:pins.comfy.localForwardPort,remotePort:pins.comfy.remotePort,privateKey:keys.privateKey,knownHostsFile:join(dir,'known_hosts')});signal.throwIfAborted();
  const comfyUrl=`http://127.0.0.1:${pins.comfy.localForwardPort}`;await(deps.waitReady||waitLoopbackComfy)(comfyUrl,120000,opts.fetchImpl,signal);
  await(deps.verifyFiles||verifyRemoteFluxFiles)({...endpoint,privateKey:keys.privateKey,knownHostsFile:join(dir,'known_hosts'),modelsDir:profile.modelsDir,files:(await flux3Contract()).files,remotePort:pins.comfy.remotePort,signal});signal.throwIfAborted();
  const remoteEnv={...env,COMFYUI_URL:comfyUrl,ADSTUDIO_FLUX3_REMOTE_WEIGHTS:'1'},ready=await detectHealthyFluxComfy(remoteEnv,opts.fetchImpl);if(!ready.ok)throw Error('Remote FLUX readiness failed: '+ready.reason);
  const cap=await flux3Availability(undefined,ready.stats,{queue_running:[],queue_pending:[]},false,remoteEnv,ready.nodes);if(!cap.available)throw Error(cap.reason);
  const session:FluxSession={mode:'provisioned',podId:pod.id,name,created:true,comfyUrl,proxyUrl:`http://127.0.0.1:${pins.comfy.localProxyPort}`,stage:'Loading model',budget,plan:{...plan,modelStorageVerified:true,readiness:ready.reason},tunnel,leaseSignal:signal,watchdog,intentPath,cleanupToken:token};await saveSession(dir,{phase:'ready',podId:pod.id,name,deadline,modelStorageVerified:true});return session;
 }catch(e){await tunnel?.stop().catch(()=>{});if(!intent.podId)throw Error((e as Error).message+' Creation outcome uncertain; exact intent and independent deadline guard retained. Do not retry or delete the intent.');onStage(signal.aborted?'Cancelled':'Error','Releasing owned GPU after failure');try{await recoverFluxIntent(env,opts.httpFactory,intentPath,token);watchdog?.kill();}catch{throw Error((e as Error).message+' GPU teardown is not confirmed; persisted intent/watchdog retained.');}throw e;}
}
export async function releaseFluxGpuSession(session:FluxSession,env:Record<string,string|undefined>=process.env,httpFactory:(key:string)=>RunpodHttp=createRunpodHttp){
 if(session.tunnel)await session.tunnel.stop().catch(()=>{});if(!session.created)return {terminated:false,reason:'No GPU was created by this request.'};
 if(!session.intentPath||!session.cleanupToken)throw Error('Owned GPU cleanup identity is missing.');const saved=JSON.parse(await readFile(session.intentPath,'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));if(!saved.token)return {terminated:true,reason:'Watchdog already completed cleanup.'};if(saved.token!==session.cleanupToken||saved.podId!==session.podId)throw Error('Owned GPU cleanup token mismatch.');
 const result=await recoverFluxIntent(env,httpFactory,session.intentPath,session.cleanupToken);session.watchdog?.kill();return result;
}

/** Resume the independent guard after application/OS restart; never creates a resource. */
export async function resumeFluxLeaseGuard(env:Record<string,string|undefined>=process.env){
 const path=join(sessionDir(env),'intent.json');try{const i=JSON.parse(await readFile(path,'utf8'));if(i.schema!=='adstudio-owned-flux-v1'||!i.cleanupAuthorized||!loadRunpodApiKey(env))return false;startWatchdog(env,path);return true;}catch{return false;}
}
