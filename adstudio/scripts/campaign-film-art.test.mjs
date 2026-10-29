import assert from 'node:assert/strict';
import {test} from 'node:test';
import {campaignFilmEndCard} from '../src/campaign-film-art.ts';

function render(copy,width=720,height=1280){
 const previous=globalThis.document,drawn=[];
 const ctx={font:'',createLinearGradient:()=>({addColorStop(){}}),fillRect(){},measureText(text){return {width:Array.from(text).length*Number(this.font.match(/(\d+)px/)[1])*.72};},fillText(text,x,y){drawn.push({text,x,y,width:this.measureText(text).width,size:Number(this.font.match(/(\d+)px/)[1])});}};
 globalThis.document={createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,fixture'})};
 try{campaignFilmEndCard(copy,width,height);return drawn;}finally{globalThis.document=previous;}
}
const compact=s=>s.replace(/\s+/g,'');
test('end card contains only requested customer copy, irrespective of soundtrack metadata',()=>{
 for(const silent of [true,false,undefined]){
  const lines=render({brand:'Acme',headline:'A moment worth keeping.',cta:'Explore the collection',silent});
  assert.equal(lines.map(x=>x.text).join(' '),'ACME A moment worth keeping. Explore the collection');
  assert.ok(!lines.some(x=>/silent|soundtrack|export|diagnostic|workflow|seed/i.test(x.text)));
 }
});
test('long brand, headline and CTA wrap inside separate safe areas without dropping copy',()=>{
 const copy={brand:'An exceptionally long independent creative business name',headline:'A memorable campaign deserves a headline that wraps cleanly across the brand card.',cta:'Explore everything in our considered collection'};
 for(const width of [360,720]){
  const height=width*16/9,lines=render(copy,width,height);
  for(const line of lines){assert.ok(line.x>=width*.09);assert.ok(line.x+line.width<=width*.91);assert.ok(line.y+line.size*1.25<=height*.85);}
  for(const [text,from,to]of [[copy.brand.toUpperCase(),.26,.38],[copy.headline,.42,.66],[copy.cta,.72,.84]]){
   const group=lines.filter(l=>l.y>=Math.round(height*from)&&l.y<height*to);
   assert.equal(compact(group.map(l=>l.text).join('')),compact(text));
  }
 }
});
test('unbroken words and CJK copy stay within the width instead of clipping',()=>{
 const copy={brand:'A'.repeat(60),headline:'B'.repeat(80),cta:'\u4f53'.repeat(48)},lines=render(copy);
 assert.equal(compact(lines.map(x=>x.text).join('')),copy.brand+copy.headline+copy.cta);
 assert.ok(lines.every(l=>l.x+l.width<=648));
});
