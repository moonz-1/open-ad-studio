#!/usr/bin/env node
/** Prove Journey Generate path: POST /api/hero/scene?engine=flux3 through Vite. */
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition,consumerCampaignCopy} from '../../shared/lib/creative-engine.ts';
import {flux3ScenePrompt,campaignDesign,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {reviewDraft} from '../../shared/lib/product-brief.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {identityPrepPython} from '../../shared/lib/identity-reference.ts';
import {reviewGeneratedCampaign} from '../../shared/lib/creative-visual-review.ts';

const base=process.env.ADSTUDIO_ORIGIN||'http://127.0.0.1:8312';
assert.equal(process.env.ADSTUDIO_FLUX3_INFERENCE,'1');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'journey-api-flux3');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const id16=()=>randomBytes(8).toString('hex');

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const sam3Rgba=resolve('outputs/creative-acceptance/2026-10-28T21-56-37/sam3-cookie-proof/cookie-cutout-rgba.png');
await access(sourceFull);await access(sam3Rgba);
const sourceBytes=await readFile(sourceFull);
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(sam3Rgba,join(out,'sam3-cookie-rgba.png'));

const py=resolve(process.env.COMFY_PYTHON||'C:<home>/AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe');
const refPath=join(out,'product-identity-reference.png');
const prep=spawnSync(py,['-c',identityPrepPython(sam3Rgba,refPath)],{encoding:'utf8'});
if(prep.status!==0)throw Error(prep.stderr||prep.stdout);
const refBytes=await readFile(refPath);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, sculptural studio light, tactile walnut and appetizing editorial photography.';
brand.dna.messaging='Leave Nothing Behind';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'journey-api-src',name:'cookie-source.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable bakery cookie',imageIds:['photo']}];
const quote=brand.dna.description;
const projectId='journeyapi'+id16().slice(0,8);
const input={
 version:1,projectId,brand,
 source:{id:'journey-api-src',name:'cookie-source.png',kind:'original',sha256:sha(refBytes),originalSha256:sha(sourceBytes),width:0,height:0},
 facts:{description:'Thick irregular mounded chocolate chip cookie with deep cracked golden crust, uneven edges and large dark chocolate chunks.',count:1,arrangement:'One hero cookie as the entire advertising subject.',texture:'Golden cracked crust, porous crumb, mounded bakery height, uneven chocolate chunks.',container:'None — packaging omitted; product only.',confirmed:true},
 productType:'cookies',productId:'cookie',
 request:'Campaign: Leave Nothing Behind — one authentic No Crumbs cookie; warm editorial; no foil tray.',
 intent:'campaign',format:'feed',seed:77,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};
const flat={arguments:[
 {title:'Leave Nothing Behind',idea:'Make finishing the last bite inevitable — one recognizable cookie, sculptural and alone, so desire comes from presence not kitchen lifestyle.',objective:'consideration',audienceHypothesis:'People who linger over dessert may respond to an honest bakery object that still looks unfinished and shareable.',tension:'Generic cookie ads look complete and forgettable; an unfinished authentic cookie holds attention.',businessFit:quote,feeling:'Warm resolve to finish what is in front of you.',memory:'One thick irregular cookie against calm sculptural studio depth.',focus:'One thick irregular chocolate chip cookie — cracks, chunks, bakery height — no foil.',opening:'Establish quiet negative space, then land the cookie as the only unfinished subject.',payoff:'Hold the authentic cookie with calm lettering room for Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote},
 {title:'Thickness on display',idea:'Use bakery height and deep crust cracks as the reason to lean in — one cookie, no packaging theatre.',objective:'consideration',audienceHypothesis:'Hosts may want cookies that look substantial enough to share.',tension:'Flat stock cookies erase thick irregular character.',businessFit:quote,feeling:'Warm appetite from bakery height.',memory:'Deep cracks and uneven chunks on a thick cookie.',focus:'One thick chocolate chip cookie.',opening:'Graze light across mound.',payoff:'Hold cookie at recognition scale.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers trust irregular bakery texture.',tension:'Smooth studio cookies hide cracked surfaces.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Cracked crust and uneven chunks.',focus:'Golden cracked crust and chunks.',opening:'Graze light across cracks.',payoff:'Resolve with Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Journey API FLUX3 live'},id16());
const leave=plan.concepts.find(c=>/leave nothing behind/i.test(c.title));
if(leave)plan={...plan,selectedId:leave.id};
plan=refinePlanComposition(plan,'Leave more negative space for copy. Bring the hero product closer.',id16());
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const draft=reviewDraft(structuredClone(plan.draft));
plan={...plan,draft};

const planDir=resolve('outputs','creative-plans',plan.id);
await mkdir(planDir,{recursive:true});
await writeFile(join(planDir,'plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
const preparedId=id16();
const prepared={version:1,planId:plan.id,preparedId,projectId,draft,composition:plan.composition,payload:{image:'',original:'',settings:{sourceId:input.source.id,brandId:brand.id,productId:'cookie',seed:77},projectId},status:'REVIEWED_REQUEST_NOT_A_RUN',generationRun:false,paidApproved:false,privateUploadApproved:false};
await writeFile(join(planDir,'prepared-'+preparedId+'.json'),JSON.stringify(prepared,null,2),{flag:'wx'});

const up=await fetch(base+'/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,'+refBytes.toString('base64')})});
const uploaded=await up.json();
if(!up.ok||!/^\/outputs\/[a-f0-9]{16}\.png$/.test(uploaded.url))throw Error('upload failed '+JSON.stringify(uploaded));
const imageUrl=uploaded.url;
console.log('UPLOADED',imageUrl);
// Align plan hashes to the exact API-owned bytes
const owned=await readFile(resolve('outputs',imageUrl.slice(9)));
input.source.sha256=sha(owned);
plan.input.source.sha256=sha(owned);
draft.input.source.sha256=sha(owned);
reviewDraft(draft);
plan={...plan,draft};
await writeFile(join(planDir,'plan.json'),JSON.stringify(plan,null,2));
prepared.draft=draft;
await writeFile(join(planDir,'prepared-'+preparedId+'.json'),JSON.stringify(prepared,null,2));

const prompt=flux3ScenePrompt(plan);
const requestId=randomBytes(16).toString('hex');
const body={requestId,projectId,planId:plan.id,preparedId,image:imageUrl,engine:'flux3',promptSha256:heroSha(prompt),current:input};
await writeFile(join(out,'request.json'),JSON.stringify({body,prompt},null,2));
console.log('POST',base+'/api/hero/scene');
const started=Date.now();
const res=await fetch(base+'/api/hero/scene',{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':requestId},body:JSON.stringify(body),signal:AbortSignal.timeout(900000)});
const text=await res.text();
let scene;try{scene=JSON.parse(text);}catch{throw Error('bad json '+res.status+' '+text.slice(0,600));}
await writeFile(join(out,'response.json'),JSON.stringify(scene,null,2));
if(!res.ok)throw Error('scene '+res.status+' '+JSON.stringify(scene).slice(0,900));
assert.equal(scene.model,'flux3-klein-scene');
const rawUrl=scene.url.startsWith('http')?scene.url:base+scene.url;
const raw=Buffer.from(await (await fetch(rawUrl)).arrayBuffer());
await writeFile(join(out,'flux3-mi2i-raw.png'),raw);
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const copy=consumerCampaignCopy(input,selected,ctx);
const design=campaignDesign({...plan.composition,headline:copy.headline||'Leave Nothing Behind',body:copy.body,cta:copy.cta||'Taste the real thing',brandName:'No Crumbs Bakery',website:'',size:'feed',background:'#14110f',textColor:'#fffaf0'},sceneDirection(plan).archetype,'scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350);
assert.ok(!/Basic draft|mounded cracked cookie in warm window|open space for/i.test(laid.svg));
await writeFile(join(out,'advertisement.png'),Buffer.from(new Resvg(laid.svg).render().asPng()));
const review=reviewGeneratedCampaign({design:laid.design||design,dynamics:plan.dynamics,ownerRejectedPrior:true});
await writeFile(join(out,'visual-review.json'),JSON.stringify(review,null,2));
const report={stamp,elapsedMs:Date.now()-started,path:'POST /api/hero/scene',engine:'flux3',model:scene.model,jobId:scene.jobId,sha256:sha(raw),skipPup:process.env.ADSTUDIO_FLUX3_SKIP_PUP==='1',copy,review,NOT_APPROVED_PENDING_OWNER:true};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('OK',report);
