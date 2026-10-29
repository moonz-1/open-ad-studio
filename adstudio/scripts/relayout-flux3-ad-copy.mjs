// CPU-only: rewrite the successful FLUX.3 advertisement layout with consumer marketing copy.
// Does not re-run inference. Preserves flux3-mi2i-raw.png evidence.
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {consumerCampaignCopy,creativeContext,isInternalAdCopy} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';

const out=resolve('outputs/creative-acceptance/2026-10-29T01-00-45/flux3-mi2i-leave-nothing');
const raw=await readFile(join(out,'flux3-mi2i-raw.png'));
await copyFile(join(out,'advertisement.png'),join(out,'advertisement.prompt-body-archive.png'));
const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.assets=[{id:'photo',assetId:'s',name:'p.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable bakery cookie',imageIds:['photo']}];
const input={
 version:1,projectId:'flux3-copy-fix',brand,
 source:{id:'s',name:'p.png',kind:'original',sha256:'a'.repeat(64),originalSha256:'b'.repeat(64),width:1,height:1},
 facts:{description:'Thick irregular chocolate chip cookie',count:1,arrangement:'one',texture:'cracked',container:'none',confirmed:true},
 productType:'cookies',productId:'cookie',request:'Leave Nothing Behind',intent:'campaign',format:'feed',seed:77,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};
const concept={
 id:'c1',title:'Leave Nothing Behind',idea:'Make the unfinished last bite the campaign.',
 copyId:'identity',layout:'editorial',composition:'x',camera:'x',environment:'x',lighting:'x',hierarchy:'x',rationale:'x',
 evidenceIds:['brand-description'],
 strategy:{
  objective:'consideration',audienceHypothesis:'a',tension:'a',businessFit:brand.dna.description,
  feeling:'Warm resolve to finish what is in front of you.',
  memory:'One mounded cracked cookie in warm window light with open space for Leave Nothing Behind.',
  focus:'cookie',opening:'a',payoff:'a',proof:[{id:'brand-description',quote:brand.dna.description}]
 }
};
const copy=consumerCampaignCopy(input,concept,creativeContext(input));
if(isInternalAdCopy(copy.body||''))throw Error('body still internal: '+copy.body);
if(isInternalAdCopy(copy.headline))throw Error('headline still internal: '+copy.headline);
const design=campaignDesign({
 brandName:brand.dna.name,website:'',headline:copy.headline,body:copy.body,
 cta:copy.cta||'Taste the real thing',size:'feed',background:'#14110f',textColor:'#fffaf0',
 photoId:'scene',photoConfirmed:true
},'food-editorial','scene','composite');
const laid=campaignSVG(design,{photo:'data:image/png;base64,'+raw.toString('base64')},1080,1350);
const ad=Buffer.from(new Resvg(laid.svg).render().asPng());
await writeFile(join(out,'advertisement.png'),ad);
const report=JSON.parse(await readFile(join(out,'report.json'),'utf8'));
report.adSha256=createHash('sha256').update(ad).digest('hex');
report.copy={headline:copy.headline,body:copy.body,cta:design.cta};
report.copyNote='Layout regenerated with consumerCampaignCopy (marketing idea). strategy.memory geometry archived as advertisement.prompt-body-archive.png. Raw FLUX bytes unchanged.';
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('PASS copy',JSON.stringify(copy),'adSha',report.adSha256);
