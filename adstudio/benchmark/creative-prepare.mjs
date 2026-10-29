// Local preparation only. Never connects to ComfyUI/Runpod or submits inference.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brandContext} from '../../shared/lib/brand.ts';
import {cinnamonConcepts} from './creative-concepts.mjs';
import {campaignGraph,compileQwenBrief,validateCampaign} from './creative-brief.mjs';
const out='outputs/creative-quality-sprint',sha=b=>createHash('sha256').update(b).digest('hex');
const sources=JSON.parse(await readFile(out+'/sources.json','utf8'));
const {brand}=JSON.parse(await readFile('outputs/benchmark-ad-v1/demo.json','utf8'));
// The nine-roll tray has not been verified as a specific two/four-roll SKU.
const context=brandContext(brand,['__reference-not-sku-mapped__']);
if(context.identity.name!=='No Crumbs Bakery')throw Error('Review changed brand identity');
const website=brand.research.sources.find(s=>new URL(s.url).hostname==='www.nocrumbsbakery.store');
if(!website || !website.text.includes('Leave nothing behind.'))throw Error('Authentic brand source/slogan missing');
const briefs=cinnamonConcepts({originalSha256:sources.source.sha256,websiteSha256:website.sha256,website:website.url});
const cases=[];
for(const brief of briefs){
  const reference=sources.references[brief.id==='intimate'?'intimate':'full'];
  if(sha(await readFile(reference.path))!==reference.sha256)throw Error('Prepared reference changed');
  const graph=await campaignGraph(brief),prompt=compileQwenBrief(brief);
  cases.push({id:brief.id,seed:42,brief,prompt,reference,graphSha256:sha(JSON.stringify(graph))});
  await mkdir(out+'/'+brief.id,{recursive:true});
  await writeFile(out+'/'+brief.id+'/brief.json',JSON.stringify(brief,null,2));
  await writeFile(out+'/'+brief.id+'/prompt.txt',prompt);
  await writeFile(out+'/'+brief.id+'/workflow.json',JSON.stringify(graph,null,2));
}
const plan=validateCampaign({version:1,model:'Qwen-Image-Edit-2511-FP8',status:'PREPARED_AWAITING_EXPLICIT_PAID_APPROVAL',
  aiVisionAnalysisRun:false,ownerApproved:false,cases,brandContext:context,
  exclusions:['No verified SKU mapping: do not call nine rolls Signature Duo or invent a pack size/price.','Website colors are candidates, not approved creative rules.','No independent vision model was run. Manual photo observations and saved website evidence only.'],
  copy:{brandName:context.identity.name,headline:'Leave nothing behind.',productName:'Cinnamon rolls',website:'nocrumbsbakery.store',sloganEvidenceId:website.id},
  logo:sources.logo,workflowPins:'adstudio/benchmark/qwen-hero-pins.json',oneSeedPerConcept:true});
await writeFile(out+'/campaign.json',JSON.stringify(plan,null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
await writeFile(out+'/brief-review.html','<!doctype html><meta charset="utf-8"><title>No Crumbs creative briefs — NOT GENERATED</title><style>body{background:#19130f;color:#f4ebdd;font:16px Arial;margin:32px;max-width:1200px}section{display:grid;grid-template-columns:240px 1fr;gap:24px;margin:48px 0}img{width:100%}pre{white-space:pre-wrap;line-height:1.6}small{display:block;margin:12px 0}</style><h1>Three creative briefs — awaiting paid-run approval</h1><p>Images below are original references/crops, NOT generated previews. Manual verified observations; no independent AI vision analysis. All inference and the final ad are pending.</p><a href="logo-treatment-review.jpg">Genuine circular logo treatment</a>'+cases.map(c=>'<section><div><img src="'+(c.id==='intimate'?'intimate-original-crop.png':'full-original-guide.png')+'"><small>Original reference only · '+c.id+'</small></div><div><h2>'+c.id+'</h2><pre>'+esc(c.prompt)+'</pre><p>Uncertainties: '+esc(c.brief.uncertainties.join(' ')||'No new viewpoint requested; fidelity remains unproven.')+'</p></div></section>').join(''));
console.log('PREPARED ONLY: 3 compiled briefs, unchanged official sampler, authentic original/crop and logo. NO Pod, weight download, inference or ad.');
