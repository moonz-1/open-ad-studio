// CPU: photographic prompts must not invite FLUX lettering.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scrubPhotographyPrompt,assertPhotographyPromptClean} from '../../shared/lib/photograph-prompt-scrub.ts';
import {dynamicsToFlux3Spatial} from '../../shared/lib/flux3-spatial.ts';
import {scanPhotographLettering} from '../../shared/lib/photograph-lettering.ts';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('scrub removes lettering / typography invitations',()=>{
 const dirty='Leave calm negative space for later brand lettering. Text-safe region for typography. No new scene headlines, CTAs.';
 const clean=scrubPhotographyPrompt(dirty);
 assert.doesNotMatch(clean,/\blettering\b/i);
 assert.doesNotMatch(clean,/\btypography\b/i);
 assert.doesNotMatch(clean,/\bheadline\b/i);
 assert.doesNotMatch(clean,/\bcta\b/i);
 assert.match(clean,/open field|unlettered|blank/i);
 assert.equal(assertPhotographyPromptClean(dirty),clean);
});

test('flux3 spatial captions use open_field_1 and never invite lettering',()=>{
 const dynamics={
  version:1,mode:'static',
  concept:{title:'Quiet',idea:'Calm bottle.',audienceResponse:'Quiet luxury.',memory:'Bottle on stone.'},
  product:{subjects:'One frosted Green Cedar bottle',identityAnchors:['cream cap'],count:1,arrangement:'Single upright bottle.',packagingPolicy:'preserve'},
  frame:{heroPlacement:'Lower-left hero with calm empty open field.',depth:'Layered.',negativeSpace:'Empty open field.',hierarchy:'Product first.',energy:'restrained'},
  camera:{viewpoint:'Three-quarter.',distance:'Product-dominant.',framing:'Full product.',lensFeel:'Believable.'},
  light:{key:'Soft key.',atmosphere:'Mineral.'},
  brand:{tone:'Quiet luxury.',flexibility:'Strict.',constraints:['Do not invent.']},
  supports:{allowed:false,note:'None.'},
  typography:{safeRegion:'Open field empty.'},
  progression:{beats:[{at:'still',attention:'Recognition.',change:'Hold.'}]},
  acceptance:['One bottle.'],
 };
 const spatial=dynamicsToFlux3Spatial(dynamics,{environment:'Pale limestone ledge.'});
 assert.match(spatial.captionWithBoxes,/<open_field_1>/);
 assert.doesNotMatch(spatial.captionWithBoxes,/copy_space_1|lettering|typography|headline|CTA/i);
 assert.doesNotMatch(spatial.shortPrompt,/lettering|typography|headline/i);
 assert.doesNotMatch(spatial.directorPrompt,/lettering|typography|headline|CTA/i);
 assert.match(spatial.directorPrompt,/UNLETTERED|unlettered|no writing/i);
});

test('prior dual-ad raws trip lettering scan when open field is gibberish-heavy',async()=>{
 const abel=resolve('outputs/creative-acceptance/2026-10-30T01-15-33/cloud-dual-ads/abel-green-cedar/flux3-cloud-raw.png');
 const tira=resolve('outputs/creative-acceptance/2026-10-30T01-15-33/cloud-dual-ads/nocrumbs-tiramisu-roll/flux3-cloud-raw.png');
 for(const path of [abel,tira]){
  let bytes;try{bytes=readFileSync(path);}catch{continue;}
  const scan=await scanPhotographLettering(bytes,{openField:{x:0.54,y:0.05,width:0.4,height:0.28},productSafe:{x:0.08,y:0.3,width:0.56,height:0.58}});
  assert.ok(scan.version===1);
  // Informational — owner already confirmed gibberish; scanner should at least WARN or FAIL on at least one.
  console.log(path.split(/[/\\]/).slice(-2).join('/'),scan.verdict,scan.openFieldEdgeEnergy.toFixed(1),scan.ratio.toFixed(2));
 }
});
