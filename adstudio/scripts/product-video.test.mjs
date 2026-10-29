import assert from 'node:assert/strict';
import { productPlan, productFormats } from '../../shared/runtime/product-video.ts';

for (const ratio of Object.keys(productFormats)) for (const duration of [2, 3, 5]) {
  for (const [sw, sh] of [[1086,1448],[2000,300],[122,101]]) for (const motion of ['push','pan-left','pan-right']) {
    const plan = productPlan('camera', ratio, duration, motion, sw, sh);
    const r = plan.rect;
    assert.ok(r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0);
    const centers = [];
    for (let f = 0; f < plan.frames; f++) {
      const t = f / (plan.frames - 1), p=t*t*(3-2*t), z = motion === 'push' ? 1 + .04*p : 1.04;
      const pan = motion === 'push' ? 0 : (motion === 'pan-right' ? 1 : -1)*(p-.5)*plan.width*.024;
      const x = (r.x - (plan.width/2-plan.width/z/2+pan))*z;
      const y = (r.y - (plan.height/2-plan.height/z/2))*z;
      assert.ok(x >= -1e-9 && y >= -1e-9 && x+r.width*z <= plan.width+1e-9 && y+r.height*z <= plan.height+1e-9, 'source must remain in frame');
      centers.push(x+r.width*z/2);
    }
    if (motion === 'pan-right') assert.ok(centers.at(-1) < centers[0]);
    if (motion === 'pan-left') assert.ok(centers.at(-1) > centers[0]);
    assert.deepEqual(productPlan('camera',ratio,duration,motion,sw,sh),plan);
  }
  const locked = productPlan('locked',ratio,duration,'push',1086,1448);
  assert.equal(locked.motion,'static-protected-photo');
  assert.ok(locked.filter.includes('overlay='));
}
console.log('PASS: deterministic recipes, source bounds across every frame, pan directions, all formats/durations/source shapes.');
