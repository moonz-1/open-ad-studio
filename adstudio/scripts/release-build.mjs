// Bind the compiled public assets to the source revision. No model/runtime provisioning.
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,access} from 'node:fs/promises';
import {resolve,relative,join,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
export const releaseRoot=resolve(import.meta.dirname,'../..');
const digest=b=>createHash('sha256').update(b).digest('hex');
export const releaseGit=(...args)=>execFileSync('git',['-c','safe.directory='+releaseRoot,...args],{cwd:releaseRoot,encoding:'utf8',windowsHide:true}).trim();
export async function releaseState(){
 let git=false;try{await access(join(releaseRoot,'.git'));git=true;}catch{}
 if(git){try{return {sourceKind:'git',commit:releaseGit('rev-parse','HEAD'),branch:releaseGit('branch','--show-current'),sourceDirty:!!releaseGit('status','--porcelain')};}catch{throw Error('This Git checkout requires Git on PATH. Install Git, or use the repository ZIP download.');}}
 let commit=null;try{const meta=JSON.parse(await readFile(join(releaseRoot,'release-source.json'),'utf8'));if(/^[a-f0-9]{40}$/.test(meta.commit))commit=meta.commit;}catch{}
 return {sourceKind:'archive',commit,branch:'source-download',sourceDirty:null};
}
async function archiveSources(){
 const files=[];async function walk(dir){let entries;try{entries=await readdir(join(releaseRoot,dir),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const item of entries){if(item.name.startsWith('.')||['node_modules','outputs','dist','__pycache__'].includes(item.name))continue;const path=dir+'/'+item.name;if(item.isDirectory())await walk(path);else if(item.isFile()&&!/\.(safetensors|ckpt|pt|bin|log)$/.test(item.name))files.push(path);}}
 for(const dir of ['adstudio','shared','public'])await walk(dir);
 for(const file of ['package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html'])try{await access(join(releaseRoot,file));files.push(file);}catch{}
 return files.sort();
}
export async function sourceDigest(){
 const files=(await releaseState()).sourceKind==='archive'?await archiveSources():releaseGit('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(p=>p&&(/^(adstudio|shared|public)\//.test(p)||/^(package(-lock)?\.json|vite\.config\.ts|tsconfig\.json|index\.html)$/.test(p))).sort();
 const h=createHash('sha256');for(const path of files){h.update(path+'\0');h.update(await readFile(join(releaseRoot,path)));h.update('\0');}return h.digest('hex');
}
async function listFiles(dir){const files=[];for(const f of await readdir(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())files.push(...await listFiles(path));else if(f.isFile()&&f.name!=='release-manifest.json')files.push(path);}return files;}
export async function stampRelease(){
 const dist=join(releaseRoot,'dist'),assets=[];for(const path of (await listFiles(dist)).sort()){const bytes=await readFile(path);assets.push({path:relative(dist,path).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)});}
 const manifest={schema:'open-ad-studio-build-v1',mode:'production',...await releaseState(),sourceSha256:await sourceDigest(),builtAt:new Date().toISOString(),assets};
 await writeFile(join(dist,'release-manifest.json'),JSON.stringify(manifest,null,2));console.log('Stamped production build '+manifest.commit+' / '+manifest.sourceSha256);return manifest;
}
export async function verifiedRelease(){
 const raw=await readFile(join(releaseRoot,'dist','release-manifest.json')),m=JSON.parse(raw);
 if(m.schema!=='open-ad-studio-build-v1'||m.mode!=='production'||m.commit!==(await releaseState()).commit||m.sourceDirty||(await releaseState()).sourceDirty||m.sourceKind!==(await releaseState()).sourceKind||m.sourceSha256!==await sourceDigest())throw Error('Production build differs from the clean checkout. Commit intended changes and run npm run build, or use npm run dev for editing.');
 for(const a of m.assets){const path=resolve(releaseRoot,'dist',a.path);if(!path.startsWith(resolve(releaseRoot,'dist')+sep))throw Error('Invalid build asset path.');const bytes=await readFile(path);if(bytes.length!==a.bytes||digest(bytes)!==a.sha256)throw Error('Production asset differs from its build manifest: '+a.path);}
 return {...m,manifestSha256:digest(raw)};
}
if(process.argv.includes('--stamp'))await stampRelease();
