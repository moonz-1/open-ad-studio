// Real React SSR / semantic coverage. NOT Chrome or IndexedDB acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {WorkspaceStore} from '../src/workspace-store.ts';
import {memoryDriver} from '../src/projects.ts';
import {AdApplication} from '../src/ad-application.ts';
import {researchBrand} from '../../shared/runtime/brand-research.ts';
import {newBrand,applyResearch} from '../../shared/lib/brand.ts';
import {catalogFixture} from './catalog-fixtures.mjs';
const dir='outputs/catalog-v2';await mkdir(dir,{recursive:true});const vite=await createServer({configFile:false,cacheDir:dir+'/ssr-cache',server:{middlewareMode:true,hmr:false,watch:null},logLevel:'error'}),store=await new WorkspaceStore(memoryDriver()).initialize(),app=new AdApplication(store);
try{
 const {AdStudio}=await vite.ssrLoadModule('/adstudio/src/react/app.tsx'),f=catalogFixture(),r=await researchBrand({website:f.base+'/collections/perfumes',analyze:false},{},f.read);r.analysisState='pending';r.analysisKey='a'.repeat(64);const b=applyResearch(newBrand(),r);await app.saveBrand(b);
 const html=renderToStaticMarkup(createElement(AdStudio,{app}));assert.match(html,/12 products found/);assert.match(html,/12 with uniquely associated photographs/);assert.match(html,/Show more products/);assert.equal((html.match(/class="website-product"/g)||[]).length,6);assert.ok(!/disabled=""[^>]*>Show more products/.test(html));assert.match(html,/Optional local text interpretation is requested/);assert.match(html,/you can select a photograph now/);assert.match(html,/Saved websites/);assert.match(html,/Brand understanding/);assert.match(html,/Develop advertisement/);assert.ok(!html.match(/class="inspection brand-understanding"[^>]*open=/));
 b.research.catalog.partial=true;b.research.catalog.reasons=['8-page limit'];await store.projects.saveBrand(b);const partial=renderToStaticMarkup(createElement(AdStudio,{app}));assert.match(partial,/More may be available/);assert.match(partial,/8-page limit/);assert.match(partial,/Rejected candidates: 0/);
 const css=await readFile('adstudio/src/react/app.css','utf8');await writeFile(dir+'/ssr-review.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalog V2 synthetic SSR</title><style>'+css+'</style><p style="padding:20px;background:#302319">SYNTHETIC React SSR only. Browser effects, raster loading, Show more clicks and IndexedDB are NOT verified. No model inference or owner project accessed.</p>'+partial);
 console.log('PASS React SSR: 12-record count, six initial cards/Show more, honest pending analysis with products usable, partial coverage/limits, optional brand editor and saved navigation. Browser/canvas/IndexedDB NOT VERIFIED.');
}finally{store.dispose();await vite.close();}
