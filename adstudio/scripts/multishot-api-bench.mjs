// API-level 2-beat commercial: source still + hero still → LTX → assemble. No browser.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const out=resolve('outputs/multishot-api-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const post=async(path,body)=>{
 const id=randomBytes(16).toString('hex');
 const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':id},body:JSON.stringify(body),signal:AbortSignal.timeout(600000)});
 const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;
};
const putFile=async(file,name)=>{
 const dest=resolve('outputs',name);await copyFile(file,dest);return '/outputs/'+name;
};

const hero=resolve('outputs/creative-restage-2026-10-27T17-09-09/bakery-v2-notray/advertisement.png');
const source=resolve(process.env.OSH_FIXTURES_ROOT||'outputs/fixtures','outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const heroUrl=await putFile(hero,randomBytes(8).toString('hex')+'.png');
// jpeg may need png for workflows — upload via raw copy with png only for hero; convert source via ffmpeg
const srcPng=join(out,'source-288.png');
await new Promise((ok,fail)=>{const p=spawn(ffmpeg,['-y','-i',source,'-vf','scale=288:512:force_original_aspect_ratio=decrease,pad=288:512:(ow-iw)/2:(oh-ih)/2','-frames:v','1',srcPng],{stdio:'ignore'});p.on('close',c=>c===0?ok():fail(Error('ffmpeg source')));});
const sourceUrl=await putFile(srcPng,randomBytes(8).toString('hex')+'.png');
const heroFit=await putFile(hero,randomBytes(8).toString('hex')+'.png');

const beats=[
 {purpose:'anticipation',image:sourceUrl,prompt:'Short original product commercial shot (anticipation). Opening bakery beat, product present but not final hero scale. Slow gentle light. Keep four cookies recognizable. No new text/logos/hands.'},
 {purpose:'payoff',image:heroFit,prompt:'Short original product commercial shot (payoff). Settle on clear product hero hold. Warm bakery light. Keep four cookies recognizable. No new text/logos/hands.'}
];
const clips=[];
for(const[i,b] of beats.entries()){
 console.log('SHOT',i+1,b.purpose);
 const shot=await post('/api/shot',{keys:[{image:b.image,t:0}],prompt:b.prompt,duration:1.8,seed:61+i*17,width:288,height:512,model:'ltxv-2b-0.9.8-distilled.safetensors'});
 assert.ok(shot.url);clips.push(shot);
 const bytes=Buffer.from(await (await fetch(base+shot.url)).arrayBuffer());
 await writeFile(join(out,`shot-${i}-${b.purpose}.webm`),bytes);
 await new Promise(r=>setTimeout(r,2000));
}
const assembled=await post('/api/reference/assemble',{shots:clips.map(c=>({source:c.url})),transition:'dissolve',width:720,ctaSeconds:0});
assert.ok(assembled.url.endsWith('.mp4'));
const mp4=Buffer.from(await (await fetch(base+assembled.url)).arrayBuffer());
await writeFile(join(out,'assembled-commercial.mp4'),mp4);
await new Promise((ok)=>{const p=spawn(ffmpeg,['-y','-i',join(out,'assembled-commercial.mp4'),'-ss','0.05','-vframes','1',join(out,'first.jpg'),'-ss','1.2','-vframes','1',join(out,'mid.jpg'),'-sseof','-0.1','-vframes','1',join(out,'final.jpg')],{stdio:'ignore'});p.on('close',()=>ok());});
const report={base,out,clips:clips.map(c=>c.url),assembled:assembled.url,bytes:mp4.length,sha256:sha(mp4),note:assembled.note,pass:true};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('MULTISHOT API BENCH PASS',out,assembled.url,mp4.length);
