// Actual React components rendered by Vite/React SSR. Not browser acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseFragment} from 'parse5';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication} from '../src/ad-application.ts';
import {researchBrand} from '../../shared/runtime/brand-research.ts';
import {newBrand,applyResearch} from '../../shared/lib/brand.ts';
import {websiteFixture} from './website-fixtures.mjs';
const dir='outputs/website-first-readiness',server=await createServer({configFile:false,cacheDir:dir+'/ssr-cache',server:{middlewareMode:true,hmr:false,watch:null},logLevel:'error'});
await mkdir(dir,{recursive:true});
try{
 const {AdStudio}=await server.ssrLoadModule('/adstudio/src/react/app.tsx'),{WebsiteSourcePermission}=await server.ssrLoadModule('/adstudio/src/react/website-onboarding.tsx');
 const store=await new WorkspaceStore(memoryDriver()).initialize(),app=new AdApplication(store),blank=renderToStaticMarkup(createElement(AdStudio,{app}));
 assert.ok(blank.indexOf('Business website')<blank.indexOf('Optional product &amp; brand settings'),'Website is primary, not hidden in advanced');assert.match(blank,/Discover brand &amp; products/);assert.match(blank,/upload a photograph/);assert.match(blank,/Brand name/);
 const f=websiteFixture(),b=applyResearch(newBrand(),await researchBrand({website:f.base,analyze:false},{},f.read));await store.projects.saveBrand(b);const p=store.active();p.brandId=b.id;await store.projects.save(p);
 const products=renderToStaticMarkup(createElement(AdStudio,{app}));for(const name of ['Blue desktop speaker','Canvas shoulder bag','Oak reading chair'])assert.ok(products.includes(name));assert.equal((products.match(/Use this product/g)||[]).length,3);assert.match(products,/explicit page relationship/);assert.match(products,/no AI brand analysis claimed/);assert.ok(!products.includes('https://fixture-shop.example.com/img/0.png" src='),'No unprotected external image fetch');assert.ok(!products.includes('cinematic'));
 const permission={kind:'website',pageUrl:f.base+'/',accuracyConfirmed:false,permissionConfirmed:false},consent=renderToStaticMarkup(createElement(WebsiteSourcePermission,{value:permission,disabled:false,confirm:()=>assert.fail('SSR cannot confirm')}));
 const walk=n=>[n,...(n.childNodes||[]).flatMap(walk)],checks=walk(parseFragment(consent)).filter(n=>n.tagName==='input');assert.equal(checks.length,2);assert.ok(checks.every(n=>!n.attrs.some(a=>a.name==='checked')));assert.match(consent,/permission to use/);assert.match(consent,/does not grant commercial-use rights/);
 const accepted=renderToStaticMarkup(createElement(WebsiteSourcePermission,{value:{...permission,accuracyConfirmed:true,permissionConfirmed:true},disabled:false,confirm:()=>{}}));assert.equal((accepted.match(/checked=""/g)||[]).length,2);
 const css=await readFile('adstudio/src/react/app.css','utf8');await writeFile(dir+'/ui-review.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website-first SSR review, NOT browser acceptance</title><style>'+css+'</style><p style="padding:20px;background:#302319">STATIC SSR fixture only. No browser interaction, rights approval or generation. Thumbnail effects intentionally do not run in SSR; the real UI fetches protected previews.</p>'+products+'<main class="boot">'+consent+'</main>');store.dispose();
 console.log('PASS React SSR: prominent website/manual paths, three selectable non-food records, honest evidence/provider labels, guarded preview semantics and separate unchecked accuracy/permission controls. Live DOM/canvas/IndexedDB acceptance NOT VERIFIED.');
}finally{await server.close();}
