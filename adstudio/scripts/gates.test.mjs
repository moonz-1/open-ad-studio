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
test('discover gate names missing description and permission',()=>{
 const src={permission:false,draft:{facts:{description:''}}};
 assert.match(discoverGate('Brand',[src]),/description/i);
 assert.match(discoverGate('Brand',[{...src,draft:{facts:{description:'a tray of cookies'}}}]),/permission/i);
 assert.equal(discoverGate('Brand',[{permission:true,draft:{facts:{description:'cookies'}}}]),'');
 assert.equal(sourceReady({permission:true,draft:{facts:{description:'ok'}}}),true);
 assert.match(sourceReviewLabel(src),/description/i);
});
test('direction and editions gates stay actionable without checkbox overload',()=>{
 assert.match(directionGate(false),/Choose one creative direction/i);
 assert.equal(directionGate(true),'');
 assert.equal(editionsGate({caps:true,resolved:{label:'Product-safe',reason:''},queue:1}),'');
 assert.match(editionsGate({caps:true,resolved:null,queue:1}),/not ready|engine/i);
 assert.equal(cardStateLabel('waiting'),'Waiting in queue');
 assert.equal(cardStateLabel('generating'),'Creating now');
});
