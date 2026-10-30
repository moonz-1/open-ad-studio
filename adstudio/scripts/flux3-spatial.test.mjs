// CPU: Dynamics → FLUX 3 Comfy bbox caption mapping. No inference.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dynamicsToFlux3Spatial,flux3CaptionViolatesConstraints,defaultHeroCopyBoxes,flux3RuntimePrompt} from '../../shared/lib/flux3-spatial.ts';

const dynamics={
 version:1,mode:'static',
 concept:{title:'Leave Nothing Behind',idea:'One unfinished cookie.',audienceResponse:'Warm resolve.',memory:'One cookie against calm studio depth.'},
 product:{subjects:'One thick irregular chocolate chip cookie.',identityAnchors:['irregular roundish / lumpy planform — not a loaf, baguette, or elongated bread roll','deep irregular cracked crust (handmade topography)','uneven embedded chocolate chunks — not oversized flat melting disks'],count:1,arrangement:'Single hero; compact roundish planform; no multi-cookie inventing.',packagingPolicy:'omit-if-not-product'},
 frame:{heroPlacement:'Compact hero slightly below centre with open upper field.',depth:'Near product.',negativeSpace:'Expand calm negative space.',hierarchy:'Product first.',energy:'restrained'},
 camera:{viewpoint:'Three-quarter tabletop.',distance:'Closer.',framing:'Empty open field.',lensFeel:'Shallow depth.'},
 light:{key:'Single warm studio key.',atmosphere:'Sculptural dark food mood.'},
 brand:{tone:'Warm, inviting and indulgent.',flexibility:'Creative reconstruction.',constraints:['Do not invent ingredients.']},
 supports:{allowed:true,note:'Minimal supports.'},
 typography:{safeRegion:'Leave quiet area empty.'},
 progression:{beats:[{at:'still',attention:'Recognition.',change:'Hold.'}]},
 acceptance:['One cookie.']
};

test('restrained layout uses near-square hero boxes',()=>{
 const boxes=defaultHeroCopyBoxes('restrained');
 assert.deepEqual(boxes.hero,[420,260,900,740]);
 assert.deepEqual(boxes.copy,[40,80,360,920]);
 const spatial=dynamicsToFlux3Spatial(dynamics,{environment:'Sculptural dark food studio.'});
 assert.equal(spatial.grid,1000);
 assert.equal(spatial.elements.find(e=>e.id==='product_1').bbox.join(','),'420,260,900,740');
 assert.match(spatial.captionWithBoxes,/<product_1>/);
 assert.match(spatial.captionWithBoxes,/"bbox":\[420,260,900,740\]/);
 assert.match(spatial.shortPrompt,/Exactly one product unit/i);
 assert.match(spatial.directorPrompt,/roundish|not.*loaf|chunks/i);
 assert.ok(spatial.directorPrompt.length>spatial.shortPrompt.length);
 assert.equal(flux3RuntimePrompt(spatial,false),spatial.shortPrompt);
 assert.match(flux3RuntimePrompt(spatial,true),/Setting materials only|Photograph only/);
 assert.ok(!/<cookie_1>/.test(spatial.captionWithBoxes),'Element ids stay product-agnostic');
});

test('caption gate catches multi-cookie, foil, and bread morphology',()=>{
 assert.equal(flux3CaptionViolatesConstraints('one thick cookie on wood',dynamics).length,0);
 assert.ok(flux3CaptionViolatesConstraints('a plate of cookies beside coffee',dynamics).some(v=>/multiple|plate/i.test(v)));
 assert.ok(flux3CaptionViolatesConstraints('cookie in a foil baking tray',dynamics).some(v=>/packaging/i.test(v)));
 assert.ok(flux3CaptionViolatesConstraints('an elongated bread roll with chocolate',dynamics).some(v=>/bread|loaf/i.test(v)));
});


test('customer-specific guidance does not invent cookie morphology or override reviewed counts',()=>{
 const other=structuredClone(dynamics);other.product={...other.product,subjects:'Three frosted cinnamon rolls',count:3,identityAnchors:['white frosting','spiral shape'],packagingPolicy:'preserve'};
 const s=dynamicsToFlux3Spatial(other,{environment:'Original bakery set'});
 assert.match(s.directorPrompt,/About 3 recognizable product units/);assert.match(s.directorPrompt,/Keep original packaging/);
 assert.doesNotMatch(s.directorPrompt,/chocolate inclusions|bread-roll silhouette|no foil tray|no invented second product/i);
});
