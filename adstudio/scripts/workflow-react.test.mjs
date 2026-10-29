// Actual primary React JSX/controller wiring, rendered with TEST-ONLY synchronous
// source hydration (SSR cannot run browser effects). This is NOT browser testing.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseFragment} from 'parse5';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {AdApplication} from '../src/ad-application.ts';
import {memoryDriver} from '../src/projects.ts';
import {newBrand,applyResearch} from '../../shared/lib/brand.ts';
import {researchBrand,collectBrandImage} from '../../shared/runtime/brand-research.ts';
import {websiteFixture} from './website-fixtures.mjs';
import {encode} from './creative-fixtures.mjs';
const dir='outputs/workflow-switch-fix',sources=new Map();globalThis.__adWorkflowSources=sources;
const hydrate={name:'TEST-ONLY-source-hydration',enforce:'pre',transform(code,id,options){if(!options?.ssr||!id.replaceAll('\\','/').split('?')[0].endsWith('/adstudio/src/react/app.tsx'))return;const start=code.indexOf('function useAsset('),end=code.indexOf('\nexport function SourceFigure',start);assert.ok(start>0&&end>start);return {code:code.slice(0,start)+`function useAsset(store,id,expected,refresh=0,raw=false,revision){const asset=globalThis.__adWorkflowSources.get(id);return {url:asset?.data||'',data:asset?.data||'',blob:asset?.normalized,provenance:asset?.provenance,metadataReady:true,error:''};}\n`+code.slice(end),map:null};}};
const server=await createServer({configFile:false,plugins:[hydrate],cacheDir:dir+'/ssr-hydration-cache',server:{middlewareMode:true,hmr:false,watch:null},logLevel:'error'});await mkdir(dir,{recursive:true});
const walk=n=>[n,...(n.childNodes||[]).flatMap(walk)],attribute=(n,key)=>n.attrs?.find(a=>a.name===key)?.value,text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
try{
 const {AdStudio}=await server.ssrLoadModule('/adstudio/src/react/app.tsx'),f=websiteFixture(),store=await new WorkspaceStore(memoryDriver()).initialize();
 const app=new AdApplication(store,undefined,{upload:async()=>assert.fail('SSR does not upload'),staticAd:async()=>assert.fail('No composition'),capabilities:async()=>({finish:true,qwen:{available:false}}),research:url=>researchBrand({website:url,analyze:false},{},f.read),image:body=>collectBrandImage(body,f.read)},encode);
 await app.discoverWebsite(f.base);const b=store.getSnapshot().brands[0],p=b.products[0],asset=await app.importWebsiteProduct(p.id,p.discovery.imageUrls[0],async file=>({id:crypto.randomUUID(),name:file.name,original:file,normalized:file,width:320,height:360,created:1}));
 const css=await readFile('adstudio/src/react/app.css','utf8'),snapshot=(name,html)=>writeFile(dir+'/'+name+'.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Static React wiring test</title><style>'+css+'</style><p style="padding:16px;background:#302319">STATIC SSR with test-only source hydration. No browser acceptance or actual owner approval.</p>'+html);
 const render=async()=>{const current=await store.asset(asset.id);sources.set(asset.id,{...current,data:await encode(current.normalized)});return renderToStaticMarkup(createElement(AdStudio,{app}));};
 const evaluate=html=>{const nodes=walk(parseFragment(html)),button=nodes.find(n=>n.tagName==='button'&&text(n).includes('Develop advertisement')),reason=nodes.find(n=>attribute(n,'id')==='develop-block-reason'),checks=nodes.filter(n=>n.tagName==='input'&&attribute(n,'type')==='checkbox');return {button,reason:text(reason||{}),checks,nodes};};
 let html=await render(),state=evaluate(html);assert.equal(state.checks.length,2,'Primary page must actually mount website consent, not only import it');assert.match(state.reason,/Confirm that this photograph/);assert.ok(state.button.attrs.some(a=>a.name==='disabled'));assert.equal(state.checks.filter(c=>c.attrs.some(a=>a.name==='checked')).length,0);assert.ok(html.indexOf('Website photograph permission')<html.indexOf('Develop advertisement'));assert.ok(html.includes('Upload your own photograph instead'));await snapshot('01-needs-accuracy',html);
 await app.confirmWebsiteSource(true,false);html=await render();state=evaluate(html);assert.equal(state.checks.filter(c=>c.attrs.some(a=>a.name==='checked')).length,1);assert.match(state.reason,/Confirm permission/);assert.ok(!state.reason.includes('description'));assert.ok(state.button.attrs.some(a=>a.name==='disabled'));
 await app.confirmWebsiteSource(true,true);html=await render();state=evaluate(html);assert.equal(state.checks.filter(c=>c.attrs.some(a=>a.name==='checked')).length,2);assert.equal(state.reason,'');assert.ok(!state.button.attrs.some(a=>a.name==='disabled'),'Confirmed source and minimal facts unlock the actual primary Develop button');await snapshot('02-can-develop',html);
 await app.editWebsite('https://second-business.example.com');html=await render();assert.ok(!html.includes(p.name),'No A product names/facts under B');assert.ok(!html.includes(await encode(asset.normalized)),'No A source image under B');assert.ok(!html.includes('Website photograph permission'));assert.ok(!html.includes('explicit page relationship'));assert.match(evaluate(html).reason,/Discover this website/);assert.ok(html.includes('Return to saved Field Objects'));await snapshot('03-pending-b',html);
 await app.newAdvertisement();html=await render();state=evaluate(html);const header=state.nodes.find(n=>n.tagName==='header'),button=walk(header).find(n=>n.tagName==='button'&&text(n)==='+ New');assert.ok(button,'New is in the primary header');assert.ok(!html.includes('Website photograph permission'));assert.ok(!html.includes('class="brand-tone"'));assert.ok(!html.includes('explicit page relationship'));assert.match(state.reason,/Select a product photograph/);assert.ok(!html.includes(await encode(asset.normalized)));await snapshot('04-clean-new',html);
 await writeFile(dir+'/index.html','<!doctype html><meta charset="utf-8"><title>Targeted workflow SSR evidence</title><style>'+css+'</style><main class="boot"><h1>CPU React wiring evidence</h1><p>Static SSR with test-only source hydration. Not browser acceptance; no owner data or generation.</p>'+['01-needs-accuracy','02-can-develop','03-pending-b','04-clean-new'].map(n=>'<a href="'+n+'.html">'+n+'</a>').join('')+'</main>');store.dispose();
 console.log('PASS actual primary React JSX: visible separate consent, correct one-reason disabled gate -> enabled Develop, A hidden under B, clean header +New. Test-only source hydration; no browser or inference.');
}finally{delete globalThis.__adWorkflowSources;await server.close();}
