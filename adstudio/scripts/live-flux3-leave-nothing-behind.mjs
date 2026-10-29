// FLUX 3 Image Klein evaluation preflight — fail-closed (no download, no rent, no inference).
// Reuses Leave Nothing Behind Dynamics + SAM3 identity evidence from c563550 alignment.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {prepareFlux3Spatial,flux3Availability,flux3Contract,flux3InferenceAuthorized,loadFlux3Workflow,bindFlux3Mi2iInputs,renderFlux3KleinScene} from '../../shared/runtime/flux3-klein-scene.ts';
import {flux3CaptionViolatesConstraints} from '../../shared/lib/flux3-spatial.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'flux3-leave-nothing-behind');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const heroSha=sha;

const alignment=resolve('outputs/creative-acceptance/2026-10-28T22-25-10/creative-engine-alignment');
const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const sam3Rgba=resolve('outputs/creative-acceptance/2026-10-28T21-56-37/sam3-cookie-proof/cookie-cutout-rgba.png');
await access(sourceFull);await access(sam3Rgba);
await access(join(alignment,'preflight.json')).catch(()=>{throw Error('Missing c563550 alignment preflight at '+alignment);});
const sourceBytes=await readFile(sourceFull),rgbaBytes=await readFile(sam3Rgba);
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
assert.equal(sha(rgbaBytes),'1ee0debb7bc50a5427273e9f577a737a6c56d05b90bdcce61ac0cf06ab2734f7');
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(sam3Rgba,join(out,'sam3-cookie-rgba.png'));
await copyFile(join(alignment,'preflight.json'),join(out,'alignment-preflight-c563550.json'));
await copyFile(join(alignment,'creative-restage.png'),join(out,'flux2-klein-restage-baseline.png')).catch(()=>{});

const py=resolve(process.env.COMFY_PYTHON||'C:<home>/AppData/Local/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/.venv/Scripts/python.exe');
const refPath=join(out,'product-identity-reference.png');
const prep=spawnSync(py,['-c',`
from PIL import Image
import hashlib
rgba=Image.open(r'''${sam3Rgba.replace(/\\/g,'/')}''').convert('RGBA')
a=rgba.split()[-1];bbox=a.getbbox();assert bbox
crop=rgba.crop(bbox);pad=24;w,h=crop.size;side=max(w,h)+pad*2
canvas=Image.new('RGBA',(side,side),(42,28,22,255))
canvas.paste(crop,((side-w)//2,(side-h)//2),crop)
rgb=canvas.convert('RGB');rgb.save(r'''${refPath.replace(/\\/g,'/')}''')
print(rgb.size[0],rgb.size[1],hashlib.sha256(open(r'''${refPath.replace(/\\/g,'/')}''','rb').read()).hexdigest())
`],{encoding:'utf8'});
if(prep.status!==0){console.error(prep.stderr||prep.stdout);throw Error('Identity reference prep failed');}
const [rw,rh,refSha]=prep.stdout.trim().split(/\s+/);
const refBytes=await readFile(refPath);
assert.equal(sha(refBytes),refSha);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'sam3-identity',name:'product-identity-reference.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable bakery cookie',imageIds:['photo']}];

const input={
 version:1,projectId:'flux3-leave-nothing-behind',brand,
 source:{id:'sam3-identity',name:'product-identity-reference.png',kind:'original',sha256:heroSha(refBytes),originalSha256:heroSha(sourceBytes),width:+rw,height:+rh},
 facts:{
  description:'Thick irregular mounded chocolate chip cookie with deep cracked golden crust, uneven edges and large dark chocolate chunks — not a flat round stock cookie. Foil tray is packaging and must not appear.',
  count:1,arrangement:'One hero cookie as the entire advertising subject.',
  texture:'Golden cracked crust, porous crumb, mounded bakery height, uneven chocolate chunks.',
  container:'None — packaging omitted; product only.',confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Campaign: Leave Nothing Behind — one authentic No Crumbs cookie; warm editorial; intentional composition; no foil tray.',
 intent:'campaign',format:'feed',seed:77,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const quote=brand.dna.description;
const flat={arguments:[
 {title:'Leave Nothing Behind',idea:'Make the unfinished last bite the campaign — one thick cracked cookie so present that finishing it feels inevitable.',objective:'consideration',audienceHypothesis:'People who linger over dessert may respond to an honest bakery object that still looks unfinished and shareable.',tension:'Generic cookie ads look complete and forgettable; an unfinished authentic cookie holds attention.',businessFit:quote,feeling:'Warm resolve to finish what is in front of you.',memory:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',focus:'One thick irregular chocolate chip cookie — cracks, chunks, bakery height — no foil.',opening:'Establish quiet negative space, then land the cookie as the only unfinished subject.',payoff:'Hold the authentic cookie with calm lettering room for Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote},
 {title:'Thickness on display',idea:'Use bakery height and deep crust cracks as the reason to lean in — one cookie, no packaging theatre.',objective:'consideration',audienceHypothesis:'Hosts may want cookies that look substantial enough to share as a real bakery object.',tension:'Flat stock cookies erase the thick irregular character that makes these cookies recognizable.',businessFit:quote,feeling:'Warm appetite from reading real bakery height and cracks.',memory:'Deep cracks and uneven chunks on a thick cookie against calm walnut.',focus:'One thick chocolate chip cookie with cracked golden crust and uneven chunks.',opening:'Graze light across mound and cracks before the set settles.',payoff:'Hold the cookie at recognition scale with open brand lettering.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate so the cookie feels handmade-thick without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers may trust irregular bakery texture more than a polished generic cookie.',tension:'Smooth studio cookies hide the cracked surfaces that identify this product.',businessFit:quote,feeling:'Quiet curiosity about the tactile surface.',memory:'Cracked crust and uneven chunks remain the recognition cue.',focus:'Golden cracked crust and large dark chocolate chunks on one thick cookie.',opening:'Graze light across crust cracks before revealing the full cookie.',payoff:'Resolve on the cookie at recognition scale with Leave Nothing Behind.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'FLUX3 evaluation preflight from c563550 Leave Nothing Behind.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
const leave=plan.concepts.find(c=>/leave nothing behind/i.test(c.title));
if(leave)plan={...plan,selectedId:leave.id,selectionReason:'Owner-aligned Leave Nothing Behind concept for FLUX 3 evaluation.'};
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand. Bring the hero product closer.',randomBytes(8).toString('hex').slice(0,16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,arrangement:'Single hero cookie; restrained placement with readable silhouette; no multi-cookie inventing; no foil packaging.',packagingPolicy:'omit-if-not-product'},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Lower-centre to mid-frame hero with open upper field for Leave Nothing Behind.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'}}};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const spatial=prepareFlux3Spatial(plan.dynamics,selected.environment);
assert.equal(spatial.elements.length,3);
assert.equal(spatial.elements.find(e=>e.id==='product_1').bbox.join(','),'420,260,900,740');
assert.ok(!flux3CaptionViolatesConstraints(spatial.shortPrompt,plan.dynamics).length);

const contract=await flux3Contract();
const loaded=await loadFlux3Workflow('mi2i');
const bound=bindFlux3Mi2iInputs(loaded.graph,{
 prompt:spatial.captionWithBoxes,
 seed:77,
 sourceImage:'no-crumbs-source.png',
 identityImage:'sam3-identity-reference.png',
 filenamePrefix:'adstudio/flux3-mi2i-leave-nothing'
});
await writeFile(join(out,'bound-workflow.api.json'),JSON.stringify(bound,null,2));
await writeFile(join(out,'short-prompt.txt'),spatial.shortPrompt);
await writeFile(join(out,'caption-with-boxes.txt'),spatial.captionWithBoxes);

const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||null;
let availability={status:'offline',reason:'ComfyUI not probed (preflight-only).',authorized:flux3InferenceAuthorized(),workflowReady:true,missingFiles:contract.files.map(f=>f.file)};
try{
 const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
 const stats=await (await fetch(comfyUrl+'/system_stats',{signal:AbortSignal.timeout(3000)})).json();
 const queue=await (await fetch(comfyUrl+'/queue',{signal:AbortSignal.timeout(3000)})).json();
 availability=await flux3Availability(modelsDir||undefined,stats,queue,false);
}catch{/* offline is expected before RunPod */}

const preflight={
 stamp,
 phase:'preflight-only',
 inferenceAuthorized:flux3InferenceAuthorized(),
 model:{id:'flux3_klein',mode:'mi2i',workflow:loaded.file,contractStatus:contract.status,graphSha256:contract.graphSha256,officialWorkflowOid:contract.officialWorkflowOid,defaults:contract.defaults,license:contract.license,requiredNodes:contract.requiredNodes},
 brandEvidence:[
  {id:'brand-name',kind:'owner',text:'No Crumbs Bakery'},
  {id:'tagline',kind:'owner',text:'Leave Nothing Behind'},
  {id:'product-visible',kind:'source',text:'SAM3-isolated cookie: thick irregular mound, deep cracked golden crust, uneven chocolate chunks; foil excluded.'}
 ],
 productIdentityReferences:{
  sourceFullSha256:sha(sourceBytes),
  sam3RgbaSha256:sha(rgbaBytes),
  identityReference:refPath,
  identityReferenceSha256:sha(refBytes),
  referencePrep:'SAM3 RGBA tight-cropped onto deep cocoa RGB matte (identity guide for FLUX 3 i2i — not paste).',
  identityLimits:'Visible top surface only; generative reconstruction cannot certify exact identity.'
 },
 selectedConcept:{id:selected.id,title:selected.title,idea:selected.idea,strategy:selected.strategy},
 dynamics:plan.dynamics,
 flux3Spatial:spatial,
 baselineFlux2:{alignmentStamp:'2026-10-28T22-25-10',commit:'c563550',verdict:'NOT APPROVED'},
 availability,
 remotePlan:{gpu:'RunPod L40S 48GB Secure Cloud (~$1.09/hr)',connect:'SSH local-forward 8188 → local comfy-api-proxy 8189 → Vite/SDK',noPartnerNodes:true},
 expectedVisual:'ONE recognizable thick irregular cracked No Crumbs-like cookie in a restrained advertising scene; no second cookie; no plate of cookies; no foil; open upper copy space.',
 gate:'Do not download weights, rent GPU, or set ADSTUDIO_FLUX3_INFERENCE=1 until owner authorizes.'
};
await writeFile(join(out,'preflight.json'),JSON.stringify(preflight,null,2));
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:selected.title,dynamics:plan.dynamics,spatial},null,2));
await writeFile(join(out,'READY.md'),`# FLUX 3 Leave Nothing Behind — preflight

**Inference: BLOCKED** (by design).

- Concept: ${selected.title}
- Dynamics count: ${plan.dynamics.product.count}
- Hero bbox: [${spatial.elements.find(e=>e.id==='product_1').bbox.join(', ')}]
- Contract: ${contract.status}
- ADSTUDIO_FLUX3_INFERENCE: ${flux3InferenceAuthorized()?'1':'unset'}
- Availability: ${availability.status} — ${availability.reason||availability.reason}

Owner must accept HF Kommunity License, authorize RunPod L40S + ~30GB download, vendor/pin workflow, then re-run with ADSTUDIO_FLUX3_INFERENCE=1.
`);

console.log('PREFLIGHT',out);
console.log('INFERENCE_AUTHORIZED',flux3InferenceAuthorized());
console.log('AVAILABILITY',availability.status,availability.reason||'');

// Explicit fail-closed: never start generation from this script until fully ready.
let blocked='ok-preflight';
try{await renderFlux3KleinScene();}
catch(e){blocked=e.message;console.log('RENDER_BLOCKED',blocked);}
assert.match(blocked,/authorization|not ready|not enabled|workflow/i);
process.exit(0);
