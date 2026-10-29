// Real Vite transform-cache + filesystem-watcher regression. No browser/API/model.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,realpath,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createServer,loadConfigFromFile} from 'vite';
const project=process.cwd(),base=resolve('outputs/hero-serve-audit');await mkdir(base,{recursive:true});
const root=await realpath(await mkdtemp(join(base,'watch-fixture-')));

let server;
try{
 // Exercise the actual config with a project below an ancestor named outputs.
 process.chdir(root);
 const loaded=await loadConfigFromFile({command:'serve',mode:'development'},join(project,'vite.config.ts'));
 const watch=loaded.config.server.watch;
 assert.ok(!watch.ignored.includes('**/outputs/**'));
 assert.ok(watch.ignored.includes(root.replaceAll('\\','/')+'/outputs/**'));
 await writeFile(join(root,'entry.ts'),'export const version = "before";\n');
 await mkdir(join(root,'outputs'));await writeFile(join(root,'outputs','media.txt'),'test media');
 server=await createServer({configFile:false,root,plugins:[],cacheDir:join(root,'node_modules/.vite'),server:{middlewareMode:true,watch},logLevel:'silent'});
 const initial=await server.transformRequest('/entry.ts');assert.match(initial.code,/before/);
 // Ready event ensures the initially-warmed module is being watched.
 if(!server.watcher._readyEmitted)await new Promise(ok=>server.watcher.once('ready',ok));
 const changed=new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Vite did not see the source edit under outputs/')),6000);server.watcher.on('change',path=>{if(path.replaceAll('\\','/')===join(root,'entry.ts').replaceAll('\\','/')){clearTimeout(timer);ok();}});});
 await writeFile(join(root,'entry.ts'),'export const version = "after";\n');await changed;
 // Watch change invalidates Vite's cache asynchronously; retry boundedly.
 let updated;
 for(let i=0;i<30;i++){updated=await server.transformRequest('/entry.ts');if(updated.code.includes('"after"'))break;await new Promise(ok=>setTimeout(ok,50));}
 assert.match(updated.code,/after/);assert.notEqual(updated.etag,initial.etag);
 await writeFile(join(base,'watch-result.json'),JSON.stringify({passed:true,root,watchedSourceInvalidated:true,etagChanged:true,browser:'NOT RUN',models:'NOT RUN'},null,2));
 console.log('PASS real Vite source-change/cache invalidation below ancestor outputs/; only project media ignored. No browser or inference.');
}finally{process.chdir(project);await server?.close();}
