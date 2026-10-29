// Real Vite/shared API/client/application; ONLY public website reads use a test
// fixture adapter registered here. It is never imported by production Vite.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createServer as httpServer} from 'node:http';
import {readFile,writeFile,rm,unlink,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {comfyApi} from '../../shared/runtime/api.ts';
import {researchBrand,collectBrandImage} from '../../shared/runtime/brand-research.ts';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication,appClient} from '../src/ad-application.ts';
import {CreativeStudioService} from '../src/creative-service.ts';
import {OSH} from '../../shared/runtime/client.ts';
import {encode} from './creative-fixtures.mjs';
import {websiteFixture} from './website-fixtures.mjs';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
const root=resolve('outputs'),owned=new Set(),f=websiteFixture(),oldFetch=globalThis.fetch;
let vite,offline,generationRequests=0,webReads=0;
try{
 const runtime=JSON.parse(await readFile(join(root,'runtime-config.json'),'utf8').catch(()=>'{}'));assert.notEqual(runtime.mode,'managed','Fixture must not start a managed Comfy runtime');
 offline=httpServer((req,res)=>{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"fixture":"Comfy unavailable"}');});await new Promise(ok=>offline.listen(0,'127.0.0.1',ok));
 const fixture={name:'TEST-ONLY-website-fixtures',configureServer(server){server.middlewares.use(async(req,res,next)=>{
  if(req.method==='POST'&&req.url==='/api/hero/qwen')generationRequests++;
  if(req.method!=='POST'||!['/api/brand/research','/api/brand/image'].includes(req.url))return next();
  try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>64*1024)throw Error('TEST existing production body cap');chunks.push(c);}const body=JSON.parse(Buffer.concat(chunks));webReads++;
   const result=req.url.endsWith('research')?await researchBrand(body,{},f.read):await collectBrandImage(body,f.read);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  }catch(error){res.writeHead(error.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });}};
 vite=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-website-http-fixture',plugins:[fixture,comfyApi({COMFYUI_URL:'http://127.0.0.1:'+offline.address().port})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});await vite.listen();const base='http://127.0.0.1:'+vite.httpServer.address().port;assert.ok(!base.endsWith(':8301'));
 globalThis.fetch=async(input,options)=>{const url=typeof input==='string'&&input.startsWith('/')?base+input:input,response=await oldFetch(url,options);
  if(options?.method==='POST'&&response.ok&&typeof url==='string'&&url.startsWith(base+'/api/')){const body=await response.clone().json();for(const media of [body.url,body.payload?.image])if(/^\/outputs\/[a-f0-9]{16}\.png$/.test(media||''))owned.add(join(root,media.slice(9)));if(url===base+'/api/creative/plan'||url===base+'/api/creative/select')owned.add(join(root,'creative-plans',body.id));}
  return response;};
 // Node has no FileReader/canvas: equivalent Blob->dataURL and image processing
 // adapters only. All application actions/client HTTP/server handlers are real.
 const db=memoryDriver(),store=await new WorkspaceStore(db).initialize(),app=new AdApplication(store,new CreativeStudioService(store.projects,OSH,encode),appClient,encode);
 const b=await app.discoverWebsite(f.base);assert.equal(b.products.length,3);const p=b.products[1],url=p.discovery.imageUrls[0];const asset=await app.importWebsiteProduct(p.id,url,async file=>({id:crypto.randomUUID(),name:file.name,original:file,normalized:new Blob([await file.arrayBuffer()],{type:'image/png'}),width:320,height:360,created:1}));
 assert.equal(asset.provenance.originalSha256,heroSha(f.assets.get(url)));await app.confirmWebsiteSource(true,true);const plan=await app.develop('basic');assert.equal(plan.provider.mode,'deterministic');await app.approve(plan.id,true);const request=await app.request();assert.equal(request.payload.settings.productId,p.id);assert.equal(request.draft.input.source.provenance.productId,p.id);assert.ok(request.draft.reviewedSnapshot);
 await assert.rejects(()=>app.generate(plan.id,'qwen'),/not ready|Qwen Image Edit|Pinned Qwen|unavailable|Missing Qwen/i);assert.equal(generationRequests,0);assert.ok(webReads>=2);const restored=await new WorkspaceStore(db).initialize();assert.equal(restored.active().hero.settings.sourceId,asset.id);
 await mkdir('outputs/website-first-readiness',{recursive:true});await writeFile('outputs/website-first-readiness/http-evidence.json',JSON.stringify({status:'PASS_REAL_VITE_API_CLIENT_APP_WITH_TEST_ONLY_WEB_READER',fixtureOnly:true,browserAcceptance:false,selectedProduct:p.name,sourceSHA256:asset.provenance.originalSha256,reviewedRequest:true,webCalls:webReads,generationRequests,port:vite.httpServer.address().port,ownerIDB:'NOT ACCESSED'},null,2));store.dispose();restored.dispose();
 console.log('PASS actual HTTP client -> fixture-only website collector -> existing Vite creative/upload/review/Qwen availability APIs -> saved project and exact request. No Generate POST, inference or owner IDB/browser.');
}finally{globalThis.fetch=oldFetch;await vite?.close();await new Promise(ok=>offline?offline.close(ok):ok());for(const path of owned){if(!path.startsWith(root+sep))throw Error('Unsafe cleanup');if(path.includes(sep+'creative-plans'+sep))await rm(path,{recursive:true,force:true});else await unlink(path).catch(()=>{});}}
