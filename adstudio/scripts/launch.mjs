// Dependency-free first launch. No model downloads, backend installation or cloud jobs.
import {readFile,writeFile,access} from 'node:fs/promises';
import {dirname,join,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {requireNode,installationId,npmCli,jsonAt,choosePort,openBrowser} from './launch-utils.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
async function main(){
 requireNode();console.log('\nOpen Ad Studio\nChecking your installation...');
 const id=await installationId(root);let previous;try{previous=JSON.parse(await readFile(join(root,'outputs/release-server.json'),'utf8'));}catch{}
 const {sourceDigest,releaseState}=await import('./release-build.mjs');const state=await releaseState();
 if(state.sourceDirty)throw Error('This Git checkout has uncommitted source changes. Use npm run dev while editing, or commit intended changes before launching the production app.');
 const source=await sourceDigest();
 if(previous){
  let url;try{const parsed=new URL(previous.url);if(parsed.hostname==='127.0.0.1'&&parsed.protocol==='http:')url=parsed.origin;}catch{}
  const active=url?await jsonAt(url+'/api/release'):null;
  if(active?.application==='Open Ad Studio'&&active.installationId===id){
   if(active.sourceSha256!==source)throw Error('An older version from this folder is still running. Close its launcher window, then launch again. Your saved projects stay in this browser.');
   console.log('Open Ad Studio is already running: '+active.url);openBrowser(active.url);return;
  }
 }
 const npm=await npmCli();
 const environment={...process.env,PATH:dirname(process.execPath)+delimiter+(process.env.PATH||'')};
 async function run(args,env=environment){const child=spawn(process.execPath,[npm,...args],{cwd:root,env,stdio:'inherit',windowsHide:true});await new Promise((ok,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?ok():reject(Error('Startup stopped. Check the message above, your internet connection and Node.js installation, then launch again.')));});}
 const lock=await readFile(join(root,'package-lock.json'));const pkg=await readFile(join(root,'package.json'));
 const fingerprint=createHash('sha256').update(lock).update(pkg).update(process.platform+process.arch+process.versions.node.split('.')[0]).digest('hex');
 let installed;try{installed=JSON.parse(await readFile(join(root,'node_modules/.open-ad-studio-install.json'),'utf8'));await access(join(root,'node_modules/vite/package.json'));await access(join(root,'node_modules/@comfyorg/sdk/package.json'));}catch{installed=null;}
 if(installed?.fingerprint!==fingerprint){console.log('First launch or updated dependencies: installing application packages. AI models are not downloaded.');await run(['ci','--no-audit','--no-fund']);await writeFile(join(root,'node_modules/.open-ad-studio-install.json'),JSON.stringify({fingerprint})+'\n');}
 else console.log('Application packages are ready.');
 // Read only the port setting through Vite; secrets are never printed or sent to the browser.
 const {loadEnv}=await import('vite');const env=loadEnv('production',root,'');
 let preferred=Number(process.env.OSH_RC_PORT||env.OSH_RC_PORT||8341);
 try{const last=JSON.parse(await readFile(join(root,'outputs/last-launch.json'),'utf8'));if(!process.env.OSH_RC_PORT&&last.installationId===id)preferred=last.port;}catch{}
 const port=await choosePort(preferred);
 if(port!==preferred)console.log(`Port ${preferred} is in use. Using ${port}; no existing server was stopped.`);
 const url='http://127.0.0.1:'+port+'/adstudio/journey.html';
 await writeFile(join(root,'outputs/last-launch.json'),JSON.stringify({installationId:id,port})+'\n');
 console.log('Opening '+url+'\nKeep this launcher window open. Close it or press Ctrl+C to stop your app.\n');
 await run(['start'],{...environment,OSH_RC_PORT:String(port),OSH_OPEN_BROWSER:'1'});
}
main().catch(error=>{console.error('\nOpen Ad Studio could not start.\n'+error.message);process.exitCode=1;});
