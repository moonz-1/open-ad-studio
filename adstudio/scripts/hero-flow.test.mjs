// CPU interaction fixture, not browser acceptance or real IndexedDB evidence.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseFragment} from 'parse5';
import {mountBrief} from '../src/brief-ui.ts';
import {heroRequestManifest,heroReviewReady,heroModelMessage,syncSimpleDraft,canDevelopHero} from '../src/hero-flow.ts';
import {newProject,Projects,memoryDriver,migrateProject} from '../src/projects.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {draftReviewed} from '../../shared/lib/product-brief.ts';

// Markup contract: advanced controls start closed and every controller ID exists.
const html=await readFile('adstudio/tools.html','utf8'),markup=parseFragment(html),ids=new Set();
const walk=node=>{for(const a of node.attrs||[])if(a.name==='id'){assert.equal(ids.has(a.value),false,'duplicate id '+a.value);ids.add(a.value);}for(const child of node.childNodes||[])walk(child);};walk(markup);
for(const id of ['hero-selection','hero-use-original','hero-readiness','hero-request-actions','hero-sourceKind','hero-imageModel','hero-develop','hero-seed'])assert.ok(ids.has(id),id);
assert.match(html,/<option value="finish">Local photographic finish \(no AI\)<\/option>/);
assert.ok(html.indexOf('id="hero-imageModel"')<html.indexOf('id="hero-brief-panel"'),'choose method before review so default finishing drafts do not lead into an incompatible Z-Image review');
const elements=new Map(),downloads=[],blobs=new Map();
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.disabled=false;this.checked=false;this.value='';this.textContent='';this.open=false;}
 set id(v){this._id=v;elements.set(v,this);}get id(){return this._id;}
 set innerHTML(html){this.children=[];const add=(node,parent)=>{if(!node.tagName)return;const e=new Element(node.tagName);for(const a of node.attrs||[]){if(a.name==='id')e.id=a.value;else if(a.name==='value')e.value=a.value;else e[a.name]=true;}parent.append(e);for(const child of node.childNodes||[])add(child,e);};for(const n of parseFragment(html).childNodes)add(n,this);}
 append(...items){for(const e of items){if(e.parent)e.parent.children=e.parent.children.filter(c=>c!==e);e.parent=this;this.children.push(e);}}
 querySelectorAll(selector){const tags=selector.split(','),out=[];const visit=e=>{if(tags.includes(e.tagName))out.push(e);for(const c of e.children)visit(c);};for(const e of this.children)visit(e);return out;}
 removeAttribute(name){delete this[name];}focus(){this.focused=true;}click(){if(this.tagName==='a')downloads.push(this);else return this.onclick?.();}get valueAsNumber(){return Number(this.value);}
}
globalThis.document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)};
for(const id of ['hero-brief','hero-request-actions']){const e=new Element();e.id=id;}
const createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
URL.createObjectURL=blob=>{const id='blob:TEST-'+blobs.size;blobs.set(id,blob);return id;};URL.revokeObjectURL=()=>{};
const repo=new Projects(memoryDriver()),brand=newBrand('TEST Bakery'),asset={id:'source-test',name:'TEST original fixture',original:new Blob(['TEST ORIGINAL BYTES']),normalized:new Blob(['TEST NORMALIZED BYTES']),width:10,height:10,created:1};
const project=newProject('TEST existing project'),other=newProject('TEST isolation');let active=project,saved=true,lastMessage='';
Object.assign(project.hero.settings,{sourceId:asset.id,brandId:brand.id,productId:'test-product',productName:'Test cookies',imageModel:'qwen-fp8',method:'reimagine',seed:42});
project.hero.takes.push({id:'TEST older take',assetId:'TEST older asset',url:'/outputs/'+ 'c'.repeat(16)+'.png',created:1,settings:structuredClone(project.hero.settings),sourceSha256:'a'.repeat(64),sha256:'b'.repeat(64),method:'TEST fixture',seconds:1});project.hero.exports.push({id:'TEST export',assetId:'TEST ad asset',url:'/outputs/'+ 'd'.repeat(16)+'.png',created:1,takeId:'TEST older take',sha256:'e'.repeat(64),headline:'TEST',productName:'TEST',website:''});
const beforeHistory=structuredClone({takes:project.hero.takes,exports:project.hero.exports,composition:project.composition});
await repo.save(project,asset);await repo.save(other);
const ui=mountBrief({project:()=>active,settings:()=>active.hero.settings,brand:()=>brand,asset:id=>repo.asset(id),save:async()=>{if(saved)await repo.save(active);},storage:()=>({saved,message:saved?'Saved on this browser.':'Not saved - TEST failure'}),changed:()=>{},busy:()=>false,tell:m=>lastMessage=m});
const el=id=>elements.get('brief-'+id),input=(id,value)=>{el(id).value=value;el(id).oninput();};
await ui.refresh();assert.equal(project.hero.settings.briefDraft.input.facts.confirmed,false);assert.equal(el('download').disabled,true);assert.equal(el('advanced').open,false);assert.equal(el('facts').open,false);assert.equal(el('download').parent.id,'hero-request-actions');
el('review').click();assert.match(lastMessage,/Inspect|count|arrangement/);assert.equal(ui.reviewed(),false);assert.equal(el('advanced').open,true);
input('description','TEST two cookies with rough edges');input('count','2');input('arrangement-fact','TEST side by side');el('confirmed').checked=true;el('confirmed').oninput();
assert.equal(ui.reviewed(),false,'form entry never auto-confirms review');el('review').click();assert.equal(ui.reviewed(),true);assert.equal(el('download').disabled,false);assert.equal(el('model-prompt').value,ui.generationPrompt());
await el('download').click();assert.equal(downloads.length,1);assert.equal(downloads[0].download,'generation-brief.json');
const exported=JSON.parse(await blobs.get(downloads[0].href).text()),s=project.hero.settings;
assert.equal(exported.project.id,project.id);assert.equal(exported.project.name,project.name);assert.equal(exported.payload.settings.brandId,brand.id);assert.equal(exported.payload.settings.productId,'test-product');assert.equal(exported.draft.input.source.id,asset.id);assert.match(exported.draft.input.source.sha256,/^[a-f0-9]{64}$/);assert.equal(exported.draft.input.source.sha256,createHash('sha256').update(await asset.normalized.bytes()).digest('hex'));assert.equal(exported.draft.input.source.originalSha256,createHash('sha256').update(await asset.original.bytes()).digest('hex'));assert.notEqual(exported.draft.input.source.sha256,exported.draft.input.source.originalSha256);assert.equal(exported.payload.settings.seed,42);assert.equal(exported.payload.settings.prompt,ui.generationPrompt());assert.equal(exported.payload.endpoint,'/api/hero/qwen');assert.equal(exported.ownerApproved,false);assert.equal(exported.generationRun,false);
assert.equal(canDevelopHero(false,s,false,true,1),false);assert.equal(canDevelopHero(false,s,true,false,1),false);assert.equal(canDevelopHero(false,s,true,true,1),true);assert.equal(canDevelopHero(true,s,true,true,1),false);assert.equal(canDevelopHero(false,s,true,true,80),false);
assert.match(heroModelMessage('reimagine','qwen-fp8',false),/not ready.*export.*No image/);assert.match(heroModelMessage('finish',undefined,false),/does not generate an AI/);
// Save failures block download even if a handler is invoked directly.
saved=false;ui.updateActions();assert.equal(el('download').disabled,true);await el('download').click();assert.equal(downloads.length,1);assert.match(lastMessage,/not saved/);saved=true;ui.updateActions();
// Normal direction and seed edits invalidate review without extra compile buttons.
input('direction','TEST softer light, retain the exact product');assert.equal(ui.reviewed(),false);assert.match(el('model-prompt').value,/TEST softer/);el('review').click();assert.equal(ui.reviewed(),true);
s.seed=43;assert.equal(heroReviewReady(s,true,brand),false);await ui.refresh();assert.equal(ui.reviewed(),false);el('review').click();assert.equal(ui.reviewed(),true);
// Exact owner-authored prompts survive edits/restores, never silently rebuilt.
input('model-prompt','TEST owner-authored exact prompt.');el('review').click();assert.equal(ui.generationPrompt(),'TEST owner-authored exact prompt.');
const custom=structuredClone(s.briefDraft),edited=structuredClone(custom);edited.decisions.direction='TEST a new direction';const kept=syncSimpleDraft(edited,custom);assert.equal(kept.modelPrompt,custom.modelPrompt);assert.equal(draftReviewed(kept),false);
await repo.save(project);active=other;await ui.refresh();assert.equal(ui.reviewed(),false);assert.equal(el('download').disabled,true);active=(await repo.list()).find(p=>p.id===project.id);await ui.refresh();assert.equal(ui.reviewed(),true);assert.equal(ui.generationPrompt(),'TEST owner-authored exact prompt.');assert.equal(active.hero.settings.sourceId,asset.id);
assert.deepEqual({takes:active.hero.takes,exports:active.hero.exports,composition:active.composition},beforeHistory);assert.equal(await(await repo.asset(asset.id)).original.text(),'TEST ORIGINAL BYTES');assert.equal(migrateProject(active).hero.settings.briefDraft.modelPrompt,'TEST owner-authored exact prompt.');
const originalSource=active.hero.settings.sourceId;active.hero.settings.sourceId='TEST missing';await ui.refresh();assert.equal(ui.reviewed(),false);assert.throws(()=>heroRequestManifest(active,active.hero.settings,false,brand));active.hero.settings.sourceId=originalSource;await ui.refresh();assert.equal(ui.reviewed(),true);
// Brand revision, source identity/classification and seed cannot use an old review.
for(const change of [x=>x.seed++,x=>x.sourceId='TEST other',x=>x.sourceKind='supplied-ai']){const copy=structuredClone(active.hero.settings);change(copy);assert.throws(()=>heroRequestManifest(active,copy,true,brand));}
const changedBrand=structuredClone(brand);changedBrand.dna.tone='TEST changed';assert.throws(()=>heroRequestManifest(active,active.hero.settings,true,changedBrand),/Brand changed/);
const second={...asset,id:'TEST second',original:new Blob(['TEST SECOND']),normalized:new Blob(['TEST SECOND NORMALIZED'])};await repo.save(active,second);active.hero.settings.sourceId=second.id;await ui.refresh();assert.equal(active.hero.settings.briefDraft.input.facts.confirmed,false);assert.equal(active.hero.settings.briefDraft.input.facts.description,'');assert.equal(ui.reviewed(),false);
URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;
console.log('PASS CPU Hero interaction fixture: one review, normal auto-compilation, explicit facts, advanced disclosure, exact request identities/hashes/prompt, stale seed/source/brand/direction, unavailable messaging, save failure, restore/isolation, original preservation. NOT browser/IndexedDB acceptance.');
