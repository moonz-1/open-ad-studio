// Explicit unpaid local acceptance, isolated Chrome. Product-safe by default.
// --klein performs ONE real local pipeline only after a free queue/readiness check.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://127.0.0.1:8302',out=resolve('outputs/journey/browser-'+new Date().toISOString().replace(/[:.]/g,'-')),live=process.argv.includes('--klein');
await mkdir(out,{recursive:true});const report={out,live,ownerApproved:false,responses:[],errors:[],downloads:[]};
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',async r=>{if(/\/api\/(creative\/(plan|select|prepare)|hero\/campaign|static-ad)/.test(r.url())&&r.request().method()==='POST')try{report.responses.push({url:r.url(),status:r.status(),body:await r.json()});}catch{}});
const click=async locator=>{await locator.click({timeout:240000});await page.waitForTimeout(150);};
const snap=async name=>{await page.screenshot({path:join(out,name+'.png'),fullPage:true});if(/^0[1-6]-/.test(name)){await page.setViewportSize({width:390,height:844});await page.locator('main').evaluate(e=>e.scrollTo(0,0));await page.screenshot({path:join(out,name+'-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:1050});}};
const saved=()=>page.locator('.journey-footer').getByText('Saved on this browser').waitFor({timeout:240000});
async function blurFill(label,value){await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Tab');await saved();}
async function idb(){return page.evaluate(async()=>{const db=await new Promise((ok,no)=>{const r=indexedDB.open('osh-adstudio-projects');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});const all=s=>new Promise(ok=>{const r=db.transaction(s).objectStore(s).getAll();r.onsuccess=()=>ok(r.result);});const projects=await all('projects'),assets=await all('assets'),brands=await all('brands');return {projects,brands,assets:await Promise.all(assets.map(async a=>({id:a.id,originalSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await a.original.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('')})))};});}
try{
 if(live){const caps=await(await fetch(base+'/api/hero/capabilities')).json(),q=await(await fetch('http://127.0.0.1:8188/queue')).json();assert.equal(caps.klein?.available,true,'Klein must report available');assert.equal(q.queue_running.length+q.queue_pending.length,0,'Never compete with 8301');}
 await page.goto(base+'/adstudio/journey.html');await page.getByText(/Unforgettable|first impressions|Your campaign/i).first().waitFor();await snap('01-welcome');await click(page.getByRole('button',{name:/Make an advertisement|Static advertisement/i}));
 const source=resolve('outputs/fixtures/ltx25-benchmark/inputs/cookie.source.jpeg');report.sourceSha256=createHash('sha256').update(await readFile(source)).digest('hex');
 await page.getByLabel('Upload original photographs').setInputFiles(source);await saved();await page.getByPlaceholder('What should we call your brand?').fill('No Crumbs Bakery');await snap('02-introduce');await click(page.getByRole('button',{name:/Let.s begin/}));await page.getByText('The stars of your campaign.').waitFor();
 await blurFill('What can you actually see?','Four chocolate chip cookies closely overlapping in a rectangular foil tray. Preserve all four cookies, their baked surfaces, visible chips and original arrangement.');
 await click(page.getByRole('checkbox',{name:/correct product/}));await saved();assert.equal(await page.getByRole('checkbox',{name:/correct product/}).isChecked(),true);await click(page.getByText('Product details & source',{exact:true}));await page.getByRole('combobox',{name:/^Product category/}).selectOption('cookies');await saved();await blurFill('Visible count','4');await blurFill('arrangement','Four overlapping cookies in one column along their rectangular tray.');await blurFill('texture','Golden cracked baked surfaces with visible chocolate chips.');await blurFill('container','One ridged foil tray.');await click(page.getByText('Product details & source',{exact:true}));await snap('03-discover');
 await click(page.getByRole('button',{name:/Find the creative direction/}));await page.locator('.concept-card').first().waitFor({timeout:240000});await saved();await snap('04-vision');
 const dismiss=page.getByRole('button',{name:/Dismiss/i});if(await dismiss.count())await click(dismiss.first());
 // Prefer a card that is not preflight-blocked; fall back to first choosable direction.
 const choose=page.getByRole('button',{name:/Choose this direction/i});
 if(await choose.count())await click(choose.first());
 await page.getByRole('checkbox',{name:/checked these visible facts against my original/i}).check();
 const continueBtn=page.getByRole('button',{name:/Looks good/});
 await continueBtn.waitFor({state:'visible'});
 for(let i=0;i<20&&await continueBtn.isDisabled();i++)await page.waitForTimeout(250);
 assert.equal(await continueBtn.isDisabled(),false,'Looks good stayed disabled — direction preflight or facts gate');
 await click(continueBtn);
 await page.getByText(/Room for possibility|One idea/i).first().waitFor({timeout:120000});
 await page.locator('.quantity-control').waitFor({timeout:60000});await saved();
 if(!live){const more=page.getByRole('button',{name:/More advertisements/});if(await more.count()){await click(more.first());await saved();}}
 const advanced=page.getByText(/Advanced.*generation engine/i);
 if(await advanced.count()){await click(advanced.first());await page.getByRole('combobox',{name:/^Engine/}).selectOption(live?'klein':'product-safe');await saved();await click(advanced.first());}
 await page.getByRole('checkbox',{name:/approve the specific directions/}).check();await snap('05-multiply');
 await click(page.getByRole('button',{name:/Create \d+ advertisement/}));
 await page.locator('.campaign-card.ready').first().waitFor({timeout:650000});await saved();await snap('06-reveal');
 report.before=await idb();const project=report.before.projects.find(p=>p.creative?.journey?.cards?.length);assert.ok(project);const cards=project.creative.journey.cards;assert.ok(cards.length>=1);assert.ok(cards.every(c=>c.state==='ready'));assert.equal(new Set(cards.map(c=>c.takeId)).size,cards.length);assert.equal(new Set(project.hero.takes.map(t=>t.sha256)).size,cards.length,'Distinct outputs, not copies');assert.equal(report.before.assets.find(a=>a.id===project.creative.journey.sources[0].id).originalSha256,report.sourceSha256);
 for(let i=0;i<cards.length;i++){const waiting=page.waitForEvent('download');await click(page.getByRole('button',{name:'Download PNG ↓',exact:true}).nth(i));const download=await waiting,file=join(out,'advertisement-'+(i+1)+'.png');await download.saveAs(file);const bytes=await readFile(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');report.downloads.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await click(page.getByRole('button',{name:'Edit copy',exact:true}).first());await page.getByLabel('Headline',{exact:true}).fill('Give in to the moment.');await snap('07-edit');await page.getByRole('checkbox',{name:/compared the product/}).check();const edited=page.waitForEvent('download');await click(page.getByRole('button',{name:'Save & download PNG ↓',exact:true}));await(await edited).saveAs(join(out,'advertisement-edited.png'));await click(page.getByRole('button',{name:'Close preview'}));
 await page.reload();await page.locator('.campaign-card.ready').nth(live?0:1).waitFor();report.after=await idb();assert.equal(report.after.projects[0].hero.takes.length,cards.length);assert.equal(report.after.projects[0].staticAds.exports.length,project.staticAds.exports.length+1);await snap('08-restored');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await snap('09-mobile-gallery');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);report.pass=true;console.log('PASS Journey actual browser',out);
}catch(e){report.pass=false;report.error=String(e);await snap('failure').catch(()=>{});console.error(e);process.exitCode=1;}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}
