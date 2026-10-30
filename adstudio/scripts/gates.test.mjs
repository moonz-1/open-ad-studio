import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cardStateLabel,directionGate,discoverGate,editionsGate,introduceGate,sourceReady,sourceReviewLabel} from '../src/journey/gates.ts';
test('introduce gate asks for website or photo+name',()=>{
 assert.match(introduceGate('','',0),/website|photograph/i);
 assert.match(introduceGate('','Brand',0),/website|photograph/i);
 assert.match(introduceGate('','',1),/brand name/i);
 assert.equal(introduceGate('https://example.com','',0),'');
 assert.equal(introduceGate('','Brand',1),'');
});
test('discover gate needs no typed description; one image-use acknowledgment covers every product',()=>{
 const unnamed={permission:false,draft:{facts:{description:''}}},website={...unnamed,productName:'Green Cedar'};
 assert.match(discoverGate('Brand',[unnamed],true),/Name your uploaded product/i,'Unknown upload still needs a name');
 assert.match(discoverGate('Brand',[website,{...website,productName:'Rose'}]),/image use once/i);
 assert.equal(discoverGate('Brand',[website,{...website,productName:'Rose'}],true),'','A single acknowledgment unlocks all products');
 assert.equal(discoverGate('Brand',[{permission:true,draft:{facts:{description:'cookies'}}}]),'','Legacy confirmed sources stay ready');
 assert.equal(sourceReady(website,true),true);
 assert.equal(sourceReady(website,false),false);
 assert.match(sourceReviewLabel(unnamed),/name/i);
});
test('direction and editions gates stay actionable without checkbox overload',()=>{
 assert.match(directionGate(false),/Choose one creative direction/i);
 assert.equal(directionGate(true),'');
 assert.equal(editionsGate({caps:true,resolved:{label:'Product-safe',reason:''},queue:1}),'');
 assert.match(editionsGate({caps:true,resolved:null,queue:1}),/not ready|engine/i);
 assert.equal(cardStateLabel('waiting'),'Waiting in queue');
 assert.equal(cardStateLabel('generating'),'Creating now');
});
