import assert from 'node:assert/strict';
import {templates,templateSettings,resizeDimensions} from '../src/templates.ts';
import {defaults} from '../src/projects.ts';
import {canGenerate,renderEstimate} from '../src/availability.ts';
const api={upload:true,shot:true,keyframe:true,audio:true,editVideo:true,productVideo:true,exportVideo:true,ffmpeg:{available:true}};
const catalog={video:[{id:'model'}],timing:{hardware:{id:'gpu',name:'measured GPU'},samples:[{hardware:'gpu',model:'model',seconds:10,width:512,height:288,frames:73,cold:false}]}};
assert.equal(templates.length,3);
for(const t of templates){const s=templateSettings(t.id,defaults());assert.equal(s.mode,'camera');assert.equal(s.motion,t.motion);assert.deepEqual(s.ratios,[t.ratio]);assert.equal(s.duration,3);assert.deepEqual(s,templateSettings(t.id,s));}
assert.equal(canGenerate('camera',api,false,null),true);assert.equal(canGenerate('locked',api,false,catalog),false);assert.equal(canGenerate('creative',api,true,catalog),true);assert.equal(canGenerate('creative',api,true,{video:[]}),false);assert.equal(canGenerate('camera',{...api,ffmpeg:{available:false}},true,catalog),false);assert.equal(canGenerate('camera',null,true,catalog),false);
for(const [w,h]of [[512,288],[288,512],[384,384]])for(const requested of [160,320,640,1024]){const out=resizeDimensions(w,h,requested);assert.equal(out.width*h,out.height*w);assert.equal(out.width%2,0);assert.equal(out.height%2,0);}
assert.throws(()=>resizeDimensions(512,288,Infinity));assert.throws(()=>resizeDimensions(288,512,4096));
assert.match(renderEstimate(catalog,'model',512,288,3),/7–15s/);assert.match(renderEstimate(null,'model',512,288,3),/needs/);
console.log('PASS: three reproducible templates, GPU-independent Camera availability, capability/weight gates, exact-aspect even resizing, measured estimates.');
