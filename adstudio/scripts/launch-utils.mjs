import {readFile,mkdir,writeFile,access,realpath} from 'node:fs/promises';
import {dirname,join,resolve,delimiter} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';

export function requireNode(version=process.versions.node){
 const [major,minor]=version.split('.').map(Number);
 if(major<22||(major===22&&minor<18))throw Error(`Node.js ${version} is too old. Install Node.js 22.18 or newer from https://nodejs.org, then reopen this launcher.`);
}
export async function installationId(root){
 const dir=join(root,'outputs'),file=join(dir,'installation.json');await mkdir(dir,{recursive:true});
 const id=randomUUID();try{await writeFile(file,JSON.stringify({id})+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 const saved=JSON.parse(await readFile(file,'utf8'));
 if(!/^[a-f0-9-]{36}$/.test(saved.id||''))throw Error('Installation metadata is invalid. Rename outputs/installation.json and launch again; saved projects are kept in your browser.');
 return saved.id;
}
export async function npmCli(){
 const candidates=[process.env.npm_execpath,join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')];
 for(const dir of (process.env.PATH||'').split(delimiter))for(const name of ['npm','npm.cmd']){
  try{const file=await realpath(join(dir,name));candidates.push(file.endsWith('npm-cli.js')?file:join(dirname(file),'node_modules/npm/bin/npm-cli.js'));}catch{}
 }
 for(const path of candidates.filter(Boolean))try{await access(path);return path;}catch{}
 throw Error('npm was not found. Reinstall the Node.js LTS installer with npm included, then reopen this launcher.');
}
export async function jsonAt(url){try{const response=await fetch(url,{signal:AbortSignal.timeout(1200)});if(response.ok)return await response.json();}catch{}return null;}
export async function availablePort(port){return await new Promise(ok=>{const server=createServer();server.once('error',()=>ok(false));server.listen(port,'127.0.0.1',()=>server.close(()=>ok(true)));});}
export async function choosePort(preferred=8341){
 if(!Number.isInteger(preferred)||preferred<1024||preferred>65515)throw Error('Application port must be an integer from 1024 to 65515.');
 for(let port=preferred;port<preferred+20;port++)if(await availablePort(port))return port;
 throw Error('No free application port was found. Close your previous Open Ad Studio window or set OSH_RC_PORT to a free port. No process was stopped.');
}
export function browserCommand(url,platform=process.platform){
 if(!/^http:\/\/127\.0\.0\.1:\d+\/adstudio\/journey\.html$/.test(url))throw Error('Refusing to open a non-local application URL.');
 return platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:platform==='darwin'?['open',[url]]:['xdg-open',[url]];
}
export function openBrowser(url){
 if(process.env.OSH_NO_OPEN==='1')return;
 const [command,args]=browserCommand(url);const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true});
 child.on('error',()=>console.log('Open this address in your browser: '+url));child.unref();
}
