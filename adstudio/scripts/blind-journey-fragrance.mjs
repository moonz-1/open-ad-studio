// Unfamiliar-business website-first blind Journey (API path — Playwright not packaged here).
// Business: Abel Fragrance (packaged fragrance), not bakery. Genuine public website reads.
// Export is product-safe layout of the original website photograph — not claimed as AI photography.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {comfyApi} from '../../shared/runtime/api.ts';
import {researchBrand,collectBrandImage} from '../../shared/runtime/brand-research.ts';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication,appClient} from '../src/ad-application.ts';
import {CreativeStudioService} from '../src/creative-service.ts';
import {OSH} from '../../shared/runtime/client.ts';
import {encode} from './creative-fixtures.mjs';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {needsPhysicalCutout,emptySetSpec,preferDeterministicEmpty} from '../../shared/lib/campaign-presentation.ts';
import {deterministicEmptySet,integrateProduct,productMatte} from '../../shared/runtime/product-campaign.ts';
import {campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {productFidelityReport} from '../../shared/lib/product-fidelity.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'blind-journey-fragrance');
await mkdir(out,{recursive:true});
const outputsRoot=resolve('outputs');
const report={stamp,out,business:'Abel Fragrance',category:'fragrance / packaged-goods',website:'https://abelfragrance.com',checks:[],pass:false};
const sha=b=>createHash('sha256').update(b).digest('hex');
const oldFetch=globalThis.fetch;
let vite;

try{
 // Live public website research — no bakery fixture, no hidden cookie shortcut.
 const research=await researchBrand({website:'https://abelfragrance.com',analyze:false,deferAnalysis:true},{});
 assert.ok(research.products?.length>0,'Discovered products from Abel Fragrance');
 // Prefer raster formats Resvg can re-encode to PNG (JPEG/PNG). Skip WebP for Node normalize.
 const rasterOk=u=>/\.(jpe?g|png)(\?|$)/i.test(u)||!/\.webp(\?|$)/i.test(u);
 const product=research.products.find(p=>(p.discovery?.imageUrls||[]).some(rasterOk))||research.products.find(p=>(p.discovery?.imageUrls||[]).length)||research.products[0];
 assert.ok(product,'Product with discovery metadata');
 const imageUrl=(product.discovery?.imageUrls||[]).find(rasterOk)||(product.discovery?.imageUrls||[])[0]||research.images?.find(i=>i.role==='product'&&rasterOk(i.url))?.url;
 assert.ok(imageUrl,'Product image URL from website evidence');
 report.evidence={brandName:research.identity?.name||research.website,productName:product.name,productDescription:(product.description||'').slice(0,240),imageUrl,sourcePages:(research.sources||[]).slice(0,3).map(s=>({url:s.url,title:s.title})),colors:(research.colors||[]).slice(0,5),warnings:research.warnings||[]};
 report.checks.push('Live website research returned fragrance products and evidence URLs');

 const collected=await collectBrandImage({url:imageUrl,productKey:product.discovery?.key,research});
 assert.match(collected.image||'',/^data:image\/(png|jpeg|webp);base64,/);
 const sourceBytes=Buffer.from(collected.image.split(',')[1],'base64');
 const sourceExt=collected.contentType==='image/jpeg'?'jpg':collected.contentType==='image/webp'?'webp':'png';
 await writeFile(join(out,'source-website.'+sourceExt),sourceBytes);
 report.sourceSha256=sha(sourceBytes);
 report.sourceFile='source-website.'+sourceExt;
 report.checks.push('Downloaded genuine website product photograph');

 // In-process Journey-equivalent: Vite API + AdApplication (same path as Journey product-safe).
 vite=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-blind-fragrance',plugins:[comfyApi({})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});
 await vite.listen();
 const base='http://127.0.0.1:'+vite.httpServer.address().port;
 globalThis.fetch=async(input,options)=>{const url=typeof input==='string'&&input.startsWith('/')?base+input:input;return oldFetch(url,options);};

 const db=memoryDriver(),store=await new WorkspaceStore(db).initialize();
 const app=new AdApplication(store,new CreativeStudioService(store.projects,OSH,encode),appClient,encode);
 // Seed brand from live research (same shape Journey would save after discoverWebsite).
 await app.editWebsite('https://abelfragrance.com');
 const brand=store.getSnapshot().brands.find(b=>b.website.includes('abelfragrance'))||store.active()&&null;
 // discoverWebsite hits /api/brand/research — use live research applied through app when possible.
 let liveBrand;
 try{liveBrand=await app.discoverWebsite('https://abelfragrance.com');}
 catch(e){
  // Fallback: manually apply researched profile if discover path is restricted mid-run.
  report.discoverFallback=String(e.message||e);
  liveBrand=await app.createBrand(research.identity?.name||'Abel Fragrance');
  const b=structuredClone(store.getSnapshot().brands.find(x=>x.id===liveBrand.id));
  b.website='https://abelfragrance.com';b.dna.name=research.identity?.name||b.dna.name;
  b.dna.description=research.observations?.find(o=>o.field==='description')?.value||product.description||b.dna.description;
  b.dna.tone=research.observations?.find(o=>o.field==='tone')?.value||'Refined, intimate fragrance storytelling.';
  b.dna.visualStyle=research.observations?.find(o=>o.field==='visualStyle')?.value||'Soft mineral light, glass, quiet luxury packaging.';
  b.colors=(research.colors||[]).slice(0,5);b.research=research;b.products=[{id:crypto.randomUUID(),name:product.name,description:product.description||'',sellingPoints:'',imageIds:[]}];
  b.overrides=[...new Set([...(b.overrides||[]),'name','description','tone','visualStyle','colors'])];
  await app.saveBrand(b);liveBrand=b;
 }
 report.brand={id:liveBrand.id,name:liveBrand.dna.name,description:(liveBrand.dna.description||'').slice(0,220),colors:liveBrand.colors?.slice(0,5)};
 const matched=liveBrand.products.find(p=>p.name===product.name)||liveBrand.products[0];
 const url=(matched?.discovery?.imageUrls||[])[0]||imageUrl;
 const asset=await app.importWebsiteProduct(matched?.id||liveBrand.products[0]?.id||'manual',url,async file=>{
  const raw=Buffer.from(await file.arrayBuffer());
  // Preserve exact downloaded bytes as original. Shopify often serves WebP behind .png URLs —
  // re-encode normalized PNG with sharp (blind-harness only; not a runtime dependency).
  const magic=raw.subarray(0,4).toString('ascii');
  const isPng=raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(isPng){
   return {id:crypto.randomUUID(),name:file.name||'product.png',original:file,normalized:file,width:raw.readUInt32BE(16),height:raw.readUInt32BE(20),created:Date.now()};
  }
  const sharp=(await import('sharp')).default;
  const png=await sharp(raw).png().toBuffer();
  const meta=await sharp(png).metadata();
  return {id:crypto.randomUUID(),name:file.name||'product.bin',original:file,normalized:new Blob([png],{type:'image/png'}),width:meta.width||0,height:meta.height||0,created:Date.now()};
 });
 await app.confirmWebsiteSource(true,true);
 await app.editDraft({productType:'packaged-goods',facts:{description:`Website photograph of ${matched?.name||product.name}: fragrance packaging and bottle silhouette as shown.`,arrangement:'Single product hero as on the brand site',texture:'Glass, label print and packaging materials visible in the source',container:'Fragrance bottle / packaging as pictured',confirmed:true},request:'Intimate fragrance campaign that keeps the exact website product photograph recognizable.'});
 report.checks.push('Journey-equivalent: website source imported, permission confirmed, packaged-goods facts saved');

 const plan=await app.develop();
 const selected=plan.concepts.find(c=>c.id===plan.selectedId);
 report.planning={mode:plan.provider.mode,model:plan.provider.model,reason:plan.provider.reason,selectedTitle:selected?.title,idea:selected?.idea,strategy:selected?.strategy,environment:selected?.environment};
 assert.ok(selected,'Selected creative concept');
 assert.equal(needsPhysicalCutout(plan.input),true,'Fragrance packaged-goods still uses physical cutout path when Klein is chosen');
 assert.equal(preferDeterministicEmpty(plan),true);
 const plateSpec=emptySetSpec(plan);
 report.plate={material:plateSpec.material,archetype:plateSpec.archetype,prompt:plateSpec.prompt.slice(0,240)};
 assert.ok(plateSpec.material!=='walnut'||/food|bakery|cookie/i.test(plan.input.productType),'Fragrance plate should not default to bakery walnut unless food archetype');
 // Beauty/mineral fragrance should prefer stone/studio over walnut.
 report.checks.push(`Brand-directed empty-set material=${plateSpec.material}, archetype=${plateSpec.archetype}`);

 await app.approve(plan.id,true);
 const take=await app.generate(plan.id,'product-safe');
 assert.equal(take.model,'product-safe');
 const fidelity=productFidelityReport({model:take.model,fidelityMode:'product-fidelity',sourceSha256:take.sourceSha256});
 assert.equal(fidelity.productLocked,true);
 report.take={model:take.model,method:take.method,sha256:take.sha256,fidelity};
 report.checks.push('Product-safe advertisement generated — original website pixels in deterministic lettering layout');

 // Persist export bytes from take asset.
 const exportRec=store.active().staticAds?.exports?.slice().reverse().find(e=>e.assetId===take.assetId);
 assert.ok(exportRec,'Static export record');
 const adBlob=await store.asset(exportRec.assetId);
 const adBytes=Buffer.from(await adBlob.normalized.arrayBuffer());
 await writeFile(join(out,'advertisement.png'),adBytes);
 await writeFile(join(out,'advertisement.json'),JSON.stringify({design:exportRec.design,sha256:sha(adBytes),warnings:['Product-safe layout uses the original website photograph. This is not AI-generated product photography.']},null,2));

 // Optional CPU product-locked variant for visual quality comparison (no GPU): soft matte from luminance threshold is unavailable without BiRefNet.
 // Instead write brand-directed empty set + note that cutout requires Comfy BiRefNet.
 const empty=deterministicEmptySet(plan);
 await writeFile(join(out,'brand-directed-empty-set.png'),empty.bytes);
 report.outputs={source:join(out,'source-website.png'),advertisement:join(out,'advertisement.png'),empty:join(out,'brand-directed-empty-set.png')};
 report.provenance={
  website:'https://abelfragrance.com',
  generation:'product-safe',
  composition:'Deterministic campaign typography over original website photograph',
  emptySet:empty.prompt,
  notClaimedAs:'AI-generated photography of the product'
 };
 report.friction=[];
 if(plan.provider.mode!=='local-ai')report.friction.push('Planning fell back to deterministic mode (local Qwen3 arguments unavailable).');
 if(report.discoverFallback)report.friction.push('discoverWebsite fallback used: '+report.discoverFallback);
 report.humanReview=['Compare advertisement.png to source-website.png for label/geometry fidelity.','Confirm copy cites only website/owner evidence.','Do not describe this export as AI product photography.'];
 report.pass=true;
 console.log('PASS blind Journey fragrance',out);
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 store.dispose();
}catch(e){
 report.pass=false;report.error=String(e&&e.stack||e);
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 console.error(e);process.exitCode=1;
}finally{
 globalThis.fetch=oldFetch;
 await vite?.close().catch(()=>{});
}
