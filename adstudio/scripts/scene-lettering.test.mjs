import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Resvg} from '@resvg/resvg-js';
import {scanPhotographLettering,sceneTextSignature} from '../../shared/lib/photograph-lettering.ts';
import {sceneQualityBlocks,assertSceneExportable} from '../../shared/lib/scene-quality.ts';
import {decodePngRgba} from '../../shared/lib/png-luma.ts';

const png=svg=>Buffer.from(new Resvg(svg).render().asPng());
// Rows of small dark glyph-like marks (stems + bars) on a pale wall, the signature of invented lettering.
function glyphRows(x0,y0,rows,cols){let s='';for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=x0+c*12,y=y0+r*22,k=(r*7+c*3)%4;s+=`<rect x="${x}" y="${y}" width="3" height="14" fill="#2b2520"/>`+(k?`<rect x="${x}" y="${y+(k*4)%12}" width="9" height="3" fill="#2b2520"/>`:'')+(k===2?`<rect x="${x+7}" y="${y}" width="3" height="14" fill="#2b2520"/>`:'');}return s;}
const scene=marks=>png(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640">
 <rect width="512" height="400" fill="#e4d9c6"/><rect y="400" width="512" height="240" fill="#8a6a4c"/>
 <rect x="150" y="300" width="210" height="160" rx="12" fill="#5a3a22"/>
 ${marks?glyphRows(24,30,5,38)+glyphRows(24,150,3,38):''}
</svg>`);
const product={x:150/512,y:300/640,width:210/512,height:160/640},openField={x:0.54,y:0.05,width:0.4,height:0.28};

test('rows of glyph-like marks outside the product block as invented lettering',async()=>{
 const sig=sceneTextSignature(decodePngRgba(scene(true)),product);
 assert.ok(sig.runFraction>0.03,JSON.stringify(sig));
 const scan=await scanPhotographLettering(scene(true),{openField,measuredProduct:product});
 assert.equal(scan.verdict,'FAIL');
});
test('the same clean set does not trip the lettering check',async()=>{
 const sig=sceneTextSignature(decodePngRgba(scene(false)),product);
 assert.ok(sig.runFraction<0.01,JSON.stringify(sig));
 const scan=await scanPhotographLettering(scene(false),{openField,measuredProduct:product});
 assert.notEqual(scan.verdict,'FAIL');
});
test('blocked photos explain themselves in plain language; codes stay available as diagnostics',()=>{
 const s={framingQuality:{verdict:'FAIL',findings:[{code:'PRODUCT_CLIPPED',severity:'block'},{code:'DISCONNECTED_SUPPORT',severity:'block'}]},letteringScan:{verdict:'FAIL',findings:[{code:'SCENE_LETTERING_SUSPECT',severity:'block'}]}};
 assert.deepEqual(sceneQualityBlocks(s),['PRODUCT_CLIPPED','DISCONNECTED_SUPPORT','SCENE_LETTERING_SUSPECT']);
 assert.throws(()=>assertSceneExportable(s),e=>!/[A-Z]{3,}_[A-Z]/.test(e.message)&&/cut off/.test(e.message)&&/real surface/.test(e.message)&&/invented lettering/.test(e.message));
});

