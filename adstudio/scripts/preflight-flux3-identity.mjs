/** CPU preflight: exact FLUX inputs for identity-corrected Green Cedar — no inference. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition,consumerCampaignCopy} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {dynamicsToFlux3Spatial,flux3CaptionViolatesConstraints,flux3RuntimePrompt} from '../../shared/lib/flux3-spatial.ts';
import {buildProductIdentityProfile} from '../../shared/lib/product-identity-profile.ts';

const out=resolve('outputs/creative-acceptance/preflight-flux3-identity');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const pack=await readFile('outputs/fixtures/abel/green-cedar.png');
const meta=JSON.parse(await readFile('outputs/fixtures/abel/green-cedar-meta.json','utf8'));
const identity=buildProductIdentityProfile(pack,{kind:'packshot',sha256:sha(pack),categoryHint:'fragrance-bottle'});
assert.ok(identity.geometry.confidence>=0.4);
assert.ok(identity.geometry.silhouetteClass==='squat-wide'||(identity.geometry.bodyAspectWH??0)>1.1);

const brand=newBrand('Abel');
brand.dna.description='Abel creates high-performance natural eau de parfum. Green Cedar: a vibrant aromatic wood.';
brand.dna.tone='Quiet, considered, natural luxury.';
brand.dna.visualStyle='Soft mineral and cedar light, frosted glass, architectural stillness.';
brand.dna.messaging='A quieter green.';
brand.colors=meta.colors||['#f6eada','#1c241c'];
brand.overrides=['name','description','tone','visualStyle','messaging'];
brand.assets=[{id:'photo',assetId:'gc',name:'green-cedar.png',role:'product',productId:'green-cedar'}];
brand.products=[{id:'green-cedar',name:'Green Cedar',description:'Aromatic wood.',sellingPoints:'Complex, singular, grounding.',imageIds:['photo']}];

const input={
 version:1,projectId:'preflight-gc',brand,
 source:{id:'gc',name:'green-cedar.png',kind:'original',sha256:sha(pack),originalSha256:sha(pack),width:1080,height:1080},
 facts:{description:'SHORT BROAD frosted trapezoidal Green Cedar bottle — wider than tall.',count:1,arrangement:'Single squat bottle',texture:'Frosted glass',container:'Bottle',confirmed:true},
 productType:'packaged-goods',productId:'green-cedar',request:'Luxury woody editorial',intent:'campaign',format:'feed',seed:42,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};
const quote=brand.dna.description;
const flat={arguments:[
 {title:'Cedar light',idea:'Argue for a premium woody atmosphere: sunlight, grain and stone make the bottle feel held in nature without inventing notes or performance claims.',objective:'consideration',audienceHypothesis:'People seeking quiet natural luxury may respond to architectural stillness around a recognizable frosted bottle.',tension:'Generic fragrance ads float bottles on colour fields; Green Cedar needs damp-earth calm and cedar architecture.',businessFit:quote,feeling:'Grounded, quiet resolve.',memory:'Frosted bottle on stone with soft cedar depth.',focus:'One frosted Green Cedar bottle — exact silhouette, cream cap, printed label.',opening:'Establish quiet architectural negative space, then land the bottle.',payoff:'Hold the authentic bottle with calm lettering room.',proofId:'brand-description',proofQuote:quote},
 {title:'Moss vignette',idea:'Argue for intimacy: bring the observed bottle close in a moss-mineral vignette so the viewer leans in — product identity stays exact.',objective:'consideration',audienceHypothesis:'Fragrance buyers lean into tactile materials when the bottle remains exact.',tension:'Wide lifestyle sets steal focus from the bottle; keep the vignette intimate.',businessFit:quote,feeling:'Quiet curiosity.',memory:'Close frosted glass against moss-mineral calm.',focus:'Frosted glass, cream cap, GREEN CEDAR label.',opening:'Graze light across frosted edges.',payoff:'Resolve on label-readable bottle.',proofId:'brand-description',proofQuote:quote},
 {title:'Walnut quiet',idea:'Argue for editorial calm: walnut and soft green depth create space for a restrained headline; silhouette remains the only subject.',objective:'consideration',audienceHypothesis:'Editorial shoppers want quiet luxury space around the object.',tension:'Busy sets erase the architectural bottle; keep walnut calm and empty.',businessFit:quote,feeling:'Editorial calm.',memory:'Bottle alone on walnut with soft green depth.',focus:'Exact trapezoidal bottle silhouette.',opening:'Broad soft key, then product.',payoff:'Open field for brand lettering.',proofId:'brand-description',proofQuote:quote}
]};
const ctx=creativeContext(input);
let plan=assembleCreativePlan(input,conceptsFromArguments(flat,input,ctx),{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'preflight',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea'],appFields:['dynamics']}},'a'.repeat(16));
plan=refinePlanComposition(plan,'Leave more negative space for copy. Make it feel more like this brand. Bring the hero product closer.','b'.repeat(16));
plan={...plan,dynamics:{...plan.dynamics,mode:'static',product:{...plan.dynamics.product,count:1,packagingPolicy:'preserve',arrangement:'Single SHORT BROAD frosted bottle slightly off-centre on a stone ledge; cream cap fully visible; front label readable; no second bottle; preserve measured squat proportions.',identityAnchors:['SHORT BROAD squat trapezoidal bottle — wider than tall overall (measured identity)','wider base, soft taper, flat shoulder — do not elongate into a tall flacon','frosted / matte glass body with soft edge light','matte cream cylindrical cap, flush and centered','front printed GREEN CEDAR label + embossed Abel mark','pale greenish liquid fill']},frame:{...plan.dynamics.frame,energy:'restrained',heroPlacement:'Asymmetric mid-right to lower-mid hero with quiet left/upper field for lettering — product stays squat, not stretched tall.',negativeSpace:'Expand calm negative space for typography; reduce competing mid-ground detail.'},light:{...plan.dynamics.light,atmosphere:'Quiet woody-mineral luxury; damp-earth calm without inventing props theatre.'}}};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
const selected=plan.concepts.find(c=>c.id===plan.selectedId);
const spatial=dynamicsToFlux3Spatial(plan.dynamics,{environment:selected.environment,identity});
assert.equal(spatial.silhouette,'squat-bottle');
assert.equal(spatial.identityProfileUsed,true);
assert.ok(!/"tall-bottle"/.test(JSON.stringify(spatial)));
const hero=spatial.elements.find(e=>e.id==='product_1').bbox;
assert.ok((hero[3]-hero[1])>=(hero[2]-hero[0])*0.85,'hero must not be tall portrait');
assert.ok(!flux3CaptionViolatesConstraints(spatial.directorPrompt,plan.dynamics).length);
const skipPup=true;
const runtime=flux3RuntimePrompt(spatial,skipPup);
assert.match(runtime,/SHORT and BROAD|short and broad|squat|aspect/i);
assert.ok(!/\btall-bottle\b/.test(runtime));
const copy=consumerCampaignCopy(input,selected,ctx);
const report={
 ok:true,identity:{silhouette:identity.geometry.silhouetteClass,aspectWH:identity.geometry.aspectWH,bodyAspectWH:identity.geometry.bodyAspectWH,confidence:identity.geometry.confidence},
 spatial:{silhouette:spatial.silhouette,hero,identityProfileUsed:spatial.identityProfileUsed},
 prompts:{runtimeChars:runtime.length,hasTallBottleToken:/\btall-bottle\b/.test(runtime),hasSquatConstraint:/SHORT and BROAD|squat|aspect width\/height/i.test(runtime)},
 copy,planning:{mode:'authored-validated-argument',qwenClaimed:false},
 flags:{ADSTUDIO_FLUX3_INFERENCE:1,ADSTUDIO_FLUX3_SKIP_PUP:1,COMFYUI_URL:'http://127.0.0.1:18188'},
 note:'Ready for ONE Secure A40 mi2i run via live-flux3-green-cedar.mjs'
};
await writeFile(join(out,'preflight.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'runtime-prompt.txt'),runtime);
await writeFile(join(out,'director-prompt.txt'),spatial.directorPrompt);
await writeFile(join(out,'identity-profile.json'),JSON.stringify(identity,null,2));
await writeFile(join(out,'spatial.json'),JSON.stringify(spatial,null,2));
console.log(JSON.stringify(report,null,2));
