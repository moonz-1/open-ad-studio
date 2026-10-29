/** Product-safe CX visual acceptance: Green Cedar (or Coat Check) + bakery second product. No GPU/RunPod. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,consumerCampaignCopy,fallbackConcepts,isInternalAdCopy,isWebsiteMetaCopy,isGenericAdHeadline} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {evaluateAdQuality} from '../../shared/lib/ad-quality.ts';
import {emptySetSpec} from '../../shared/lib/campaign-presentation.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'cx-visual');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={stamp,out,checks:[],pass:false};

const priorAbel=resolve('C:<home>/open-ad-studio/outputs/creative-acceptance/2026-10-28T16-32-25/blind-journey-fragrance');
const priorCookie=resolve('C:<home>/open-ad-studio/outputs/creative-acceptance/2026-10-28T16-04-52/product-locked-still');
await access(join(priorAbel,'source-website.webp'));
await access(join(priorAbel,'advertisement.png'));
await access(join(priorCookie,'source.png'));
await copyFile(join(priorAbel,'advertisement.png'),join(out,'before-abel-coat-check.png'));
const {createRequire}=await import('node:module');
const require=createRequire(resolve('C:<home>/open-ad-studio/package.json'));
const sharp=require('sharp');
const fragPng=await sharp(join(priorAbel,'source-website.webp')).png().toBuffer();
await writeFile(join(out,'source-fragrance.png'),fragPng);
await copyFile(join(priorCookie,'source.png'),join(out,'source-cookie.png'));

async function renderAd({label,brandSetup,sourcePath,facts,productType,productId,request,seed}){
 const sourceBytes=await readFile(sourcePath);
 const brand=newBrand(brandSetup.name);
 Object.assign(brand.dna,brandSetup.dna);
 brand.colors=brandSetup.colors;
 brand.overrides=['name','description','tone','visualStyle','messaging'];
 brand.assets=[{id:'photo',assetId:label+'-source',name:label+'.png',role:'product',productId}];
 brand.products=[{id:productId,name:brandSetup.productName,description:brandSetup.productDescription,sellingPoints:brandSetup.sellingPoints||'',imageIds:['photo']}];
 const input={version:1,projectId:'cx-'+label,brand,source:{id:label+'-source',name:label+'.png',kind:'original',sha256:sha(sourceBytes),originalSha256:sha(sourceBytes),width:sourceBytes.readUInt32BE(16)||800,height:sourceBytes.readUInt32BE(20)||1000},facts:{...facts,confirmed:true},productType,productId,request,intent:'campaign',format:'feed',seed,constraints:{exactCount:true,arrangement:'exactly',angle:'slight',crop:'moderate',background:'replace',fidelity:'high'}};
 const ctx=creativeContext(input);
 const plan=assembleCreativePlan(input,fallbackConcepts(input,ctx),{mode:'deterministic',reason:'cx-visual',model:'None'},seed.toString(16).padStart(16,'0'));
 const copy=consumerCampaignCopy(input,plan.concepts.find(c=>c.id===plan.selectedId),ctx);
 assert.ok(!isInternalAdCopy(copy.headline),'internal headline: '+copy.headline);
 assert.ok(!isWebsiteMetaCopy(copy.headline+copy.body),'website meta copy');
 assert.ok(!isGenericAdHeadline(copy.headline),'generic headline: '+copy.headline);
 const design={...plan.composition,headline:copy.headline,body:copy.body,cta:copy.cta||'Discover'};
 const quality=evaluateAdQuality(design);
 const plate=emptySetSpec(plan);
 const photo='data:image/png;base64,'+sourceBytes.toString('base64');
 const laid=campaignSVG(design,{photo},1080,1350);
 const adBytes=Buffer.from(new Resvg(laid.svg).render().asPng());
 await writeFile(join(out,label+'-after.png'),adBytes);
 await writeFile(join(out,label+'-report.json'),JSON.stringify({
  label,headline:copy.headline,body:copy.body,cta:copy.cta,
  archetype:design.campaign?.archetype,presentation:design.campaign?.presentation,
  background:design.background,accent:design.accent,
  conceptTitles:plan.concepts.map(c=>c.title),
  plate:{material:plate.material,top:plate.top,mid:plate.mid,deep:plate.deep},
  quality,sha256:sha(adBytes),warnings:laid.warnings
 },null,2));
 return {copy,quality,design,plate,sha256:sha(adBytes)};
}

// 1) Green Cedar — botanical / woody evidence (product name carries cedar; no Abel hardcode in engine)
const cedar=await renderAd({
 label:'green-cedar',
 brandSetup:{
  name:'Abel',
  dna:{
   description:'The Official Site of Abel Fragrance. High Performance Scents, Low Impact Packaging. 100% Natural Perfume. Shop the Range.',
   tone:'Quiet, considered, natural.',
   visualStyle:'Soft mineral light, glass, quiet luxury packaging.',
   messaging:''
  },
  colors:['#f6eada','#dbdf16','#dad9d5','#414042','#444444'],
  productName:'Green Cedar',
  productDescription:'A woody botanical fragrance with cedar warmth.',
  sellingPoints:'Earthy, quiet, refined.'
 },
 sourcePath:join(out,'source-fragrance.png'),
 facts:{description:'One frosted glass perfume bottle labeled Green Cedar, upright packshot.',count:1,arrangement:'Single upright bottle',texture:'Frosted glass',container:'Glass bottle with cream cap'},
 productType:'packaged-goods',productId:'green-cedar',request:'Restrained botanical woody fragrance campaign',seed:29
});
assert.match(cedar.copy.headline,/wood|green|cedar/i);
assert.ok(!/official site|shop the range|everyday ritual|closer look/i.test(cedar.copy.headline+' '+cedar.copy.body));
assert.equal(cedar.design.campaign.archetype,'beauty-sensory');
assert.ok(cedar.plate.material==='walnut'||cedar.design.background==='#1c241c');
report.checks.push('Green Cedar: evidence headline + rejected website meta body + beauty plate');

// 2) Bakery — second industry (not fragrance template)
const cookie=await renderAd({
 label:'no-crumbs',
 brandSetup:{
  name:'No Crumbs Bakery',
  dna:{
   description:'No Crumbs Bakery sells trays of four thick chocolate chip cookies meant for sharing at the table.',
   tone:'Warm, inviting and indulgent.',
   visualStyle:'Deep cocoa, warm cream, directional window light.',
   messaging:'Leave Nothing Behind'
  },
  colors:['#3b2117','#f3dfbc','#9a5528'],
  productName:'Four-cookie tray',
  productDescription:'Four thick chocolate chip cookies in one foil tray.',
  sellingPoints:'Made for sharing.'
 },
 sourcePath:join(out,'source-cookie.png'),
 facts:{description:'Four thick chocolate chip cookies in one rectangular foil tray, overhead.',count:4,arrangement:'Four cookies overlapping in foil tray',texture:'Golden cracked surfaces',container:'Rectangular foil tray'},
 productType:'cookies',productId:'tray',request:'Warm sharing-table bakery campaign',seed:42
});
assert.equal(cookie.copy.headline,'Leave Nothing Behind');
assert.ok(!isWebsiteMetaCopy(cookie.copy.body||''));
assert.equal(cookie.design.campaign.archetype,'food-editorial');
report.checks.push('No Crumbs: messaging headline preserved; food-editorial archetype');

report.cedar=cedar.copy;
report.cookie={headline:cookie.copy.headline,body:cookie.copy.body};
report.quality={cedar:cedar.quality,cookie:cookie.quality};
report.pass=true;
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('PASS cx-visual',out);
console.log(JSON.stringify({cedar:cedar.copy,cookie:cookie.copy,grades:{cedar:cedar.quality.grade,cookie:cookie.quality.grade}},null,2));
