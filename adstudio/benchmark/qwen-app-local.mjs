// Local-only relay launcher. No provider calls, SSH, uploads, downloads or jobs.
import {readFile,realpath} from 'node:fs/promises';
import {resolve,join,relative,sep,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const repoRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const below=(base,path)=>path.startsWith(base+sep);
export async function localSession(value){
 const session=resolve(repoRoot,value),outputs=join(repoRoot,'outputs');
 // Deliberately retain the API's lexical restriction; never remap an outer path.
 if(!below(outputs,session)||basename(session)!=='session')throw Error('Use this API worktree outputs/.../session path; outer repository aliases are forbidden.');
 const [physicalOutputs,physicalSession]=await Promise.all([realpath(outputs),realpath(session)]);
 if(!below(physicalOutputs,physicalSession))throw Error('Session junction escapes this worktree outputs.');
 const load=async name=>JSON.parse(await readFile(join(session,name),'utf8'));
 const identity=await load('local-session.json');
 if(identity.version!==1||identity.repoRoot!==repoRoot||identity.sessionDir!==session||identity.realSessionDir!==physicalSession||identity.relativeSession!==relative(repoRoot,session).split(sep).join('/'))throw Error('Prepared session worktree identity mismatch; prepare a fresh local session.');
 const [plan,packageInfo,archive]=await Promise.all([load('acceptance.json'),load('public-package.json'),readFile(join(session,'public-app.tar'))]);
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim();
 if(plan.codeCommit!==commit||packageInfo.commit!==commit||packageInfo.sha256!==sha(archive))throw Error('Prepared public bundle/approval differs from current code commit or archive hash. Rebuild/rebind before launch.');
 if(plan.purpose!=='qwen-app-acceptance'||plan.maxJobs!==1||plan.maxSpendUSD!==2||plan.reserveUSD!==4||plan.seed!==42||plan.remoteOrigin!=='http://127.0.0.1:28301')throw Error('One-job source/budget session configuration is invalid.');
 if(process.env.QWEN_SESSION_DIR&&resolve(repoRoot,process.env.QWEN_SESSION_DIR)!==session||process.env.QWEN_APP_SESSION_DIR&&resolve(repoRoot,process.env.QWEN_APP_SESSION_DIR)!==session)throw Error('Inherited watchdog/API session differs from the prepared session.');
 return {repoRoot,sessionDir:session,realSessionDir:physicalSession,codeCommit:commit,
  paidApproved:plan.paidApproved===true,privateUploadApproved:plan.privateUploadApproved===true,
  environment:{QWEN_SESSION_DIR:session,QWEN_APP_SESSION_DIR:session,QWEN_APP_RELAY_URL:plan.remoteOrigin}};
}
async function main(){
 const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
 if(!args.includes('--session')||(!args.includes('--check')&&!args.includes('--serve'))){console.log('DRY RUN: --session outputs/.../session --check, or --serve [--port 8301]. No cloud actions.');return;}
 const binding=await localSession(value('--session'));
 if(args.includes('--check')){console.log(JSON.stringify(binding,null,2));return;}
 const port=Number(args.includes('--port')?value('--port'):8301);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use an explicit unprivileged local port.');
 Object.assign(process.env,binding.environment);
 // Load the SAME application config, source-derived API root and routes. Keep
 // this launcher's optimizer/HMR independent of any other running Vite server.
 const {createServer}=await import('vite');
 const server=await createServer({root:repoRoot,configFile:join(repoRoot,'vite.config.ts'),
  cacheDir:join(repoRoot,'node_modules','.vite-qwen-relay-'+port),
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false}});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
 try{await server.listen();console.log('QWEN_LOCAL_RELAY_LISTENING '+JSON.stringify({...binding,origin:'http://127.0.0.1:'+port}));}
 catch(error){await server.close();throw error;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
