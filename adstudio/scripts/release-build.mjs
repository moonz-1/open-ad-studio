// Bind the compiled public assets to the source revision. No model/runtime provisioning.
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
export const releaseRoot=resolve(import.meta.dirname,'../..');
const digest=b=>createHash('sha256').update(b).digest('hex');
export const releaseGit=(...args)=>execFileSync('git',['-c','safe.directory='+releaseRoot,...args],{cwd:releaseRoot,encoding:'utf8',windowsHide:true}).trim();
export async function sourceDigest(){
 const files=releaseGit('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(p=>p&&(/^(adstudio|shared|public)\//.test(p)||/^(package(-lock)?\.json|vite\.config\.ts|tsconfig\.json|index\.html)$/.test(p))).sort();
 const h=createHash('sha256');for(const path of files){h.update(path+'\0');h.update(await readFile(join(releaseRoot,path)));h.update('\0');}return h.digest('hex');
}
async function listFiles(dir){const files=[];for(const f of await readdir(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())files.push(...await listFiles(path));else if(f.isFile()&&f.name!=='release-manifest.json')files.push(path);}return files;}
export async function stampRelease(){
 const dist=join(releaseRoot,'dist'),assets=[];for(const path of (await listFiles(dist)).sort()){const bytes=await readFile(path);assets.push({path:relative(dist,path).replaceAll('\\','/'),bytes:bytes.length,sha256:digest(bytes)});}
 const manifest={schema:'open-ad-studio-build-v1',mode:'production',commit:releaseGit('rev-parse','HEAD'),branch:releaseGit('branch','--show-current'),sourceDirty:!!releaseGit('status','--porcelain'),sourceSha256:await sourceDigest(),builtAt:new Date().toISOString(),assets};
 await writeFile(join(dist,'release-manifest.json'),JSON.stringify(manifest,null,2));console.log('Stamped production build '+manifest.commit+' / '+manifest.sourceSha256);return manifest;
}
export async function verifiedRelease(){
 const raw=await readFile(join(releaseRoot,'dist','release-manifest.json')),m=JSON.parse(raw);
 if(m.schema!=='open-ad-studio-build-v1'||m.mode!=='production'||m.commit!==releaseGit('rev-parse','HEAD')||m.sourceDirty||releaseGit('status','--porcelain')||m.sourceSha256!==await sourceDigest())throw Error('Production build differs from the clean checkout. Commit intended changes and run npm run build, or use npm run dev for editing.');
 for(const a of m.assets){const path=resolve(releaseRoot,'dist',a.path);if(!path.startsWith(resolve(releaseRoot,'dist')+sep))throw Error('Invalid build asset path.');const bytes=await readFile(path);if(bytes.length!==a.bytes||digest(bytes)!==a.sha256)throw Error('Production asset differs from its build manifest: '+a.path);}
 return {...m,manifestSha256:digest(raw)};
}
if(process.argv.includes('--stamp'))await stampRelease();
