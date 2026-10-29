// Prove Sound Director A–D on 8304 without regenerating LTX video.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {planCampaignSound} from '../../shared/lib/sound-director.ts';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const ffprobe=process.env.FFPROBE_PATH||(ffmpeg.includes('ffmpeg')?ffmpeg.replace(/ffmpeg(\.exe)?$/i,'ffprobe$1'):'ffprobe');
const out=resolve('outputs/sound-proof-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={base,out,pass:false,cases:{}};
const run=(exe,args)=>new Promise((ok,fail)=>{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('close',c=>c===0?ok({stdout,stderr}):fail(Error(exe+' '+args.join(' ')+'\n'+stderr.slice(-800))));});
const probeAudio=async path=>{const {stdout}=await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]);const data=JSON.parse(stdout);const a=data.streams?.find(s=>s.codec_type==='audio');return {hasAudio:!!a,duration:Number(data.format?.duration||a?.duration||0),codec:a?.codec_name,channels:a?.channels};};

// Reuse existing silent commercial from prior E2E when present.
const silentSrc=resolve('outputs/f23c8046ca8957fe.mp4');
await copyFile(silentSrc,join(out,'A-silent-master.mp4'));
const silentProbe=await probeAudio(join(out,'A-silent-master.mp4'));
assert.equal(silentProbe.hasAudio,false,'A master must be silent');
report.silentMaster={file:'A-silent-master.mp4',...silentProbe};

// Upload silent master into API outputs namespace if needed (already in /outputs).
const silentUrl='/outputs/f23c8046ca8957fe.mp4';

// Licensed musical bed (user-supplied fixture — not Stable Audio; model is not installed).
const bed=join(out,'licensed-bed.wav');
await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=5','-f','lavfi','-i','sine=frequency=330:sample_rate=48000:duration=5','-filter_complex','[0][1]amix=inputs=2:duration=first,afade=t=in:st=0:d=0.4,afade=t=out:st=4.3:d=0.6,volume=0.35','-ac','2',bed]);
const bedUp=await fetch(base+'/api/sound/upload',{method:'POST',headers:{'Content-Type':'audio/wav','x-osh-audio-rights':'user-owned-or-licensed'},body:await readFile(bed)});
const bedInfo=await bedUp.json();assert.equal(bedUp.status,200,bedInfo.error||'bed upload');
report.licensedBed=bedInfo;

// Authorized reference video WITH audible soundtrack.
const refVid=join(out,'licensed-reference-with-audio.mp4');
await run(ffmpeg,['-y','-f','lavfi','-i','color=c=0x1a3328:s=720x1280:d=3:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',refVid]);
const refProbe=await probeAudio(refVid);assert.equal(refProbe.hasAudio,true);
// Import via sound upload (video container with audio) as licensed audio source.
const refUp=await fetch(base+'/api/sound/upload',{method:'POST',headers:{'Content-Type':'video/mp4','x-osh-audio-rights':'user-owned-or-licensed'},body:await readFile(refVid)});
const refInfo=await refUp.json();assert.equal(refUp.status,200,refInfo.error||'ref upload');
report.authorizedReference=refInfo;

// Caps
const caps=await(await fetch(base+'/api/sound/capabilities')).json();
report.capabilities=caps;
assert.equal(caps.ffmpeg?.available,true);
report.stableAudioAvailable=!!caps.stableAudio?.available;

// Adaptive plan (CPU) — food sensory-reveal may include texture cue; silence path also valid.
const intel={version:1,brandDistinctiveness:'warm bakery',category:'cookies',sensoryLane:'indulgent-food',marketingGoal:'desire',productAttributes:['baked','chocolate'],intendedFeeling:'warm invitation',consumerMotivation:'treat',creativeHook:'sensory-reveal',visualReaction:'lean in',photographicApproach:'soft window light',videoConcept:'texture then hero hold',copyDirection:'warm',factualConstraints:['four cookies'],fidelity:'exact-packaging',archetype:'food-editorial',rationale:'fixture'};
const fakeCreative={input:{productType:'cookies',request:'warm bakery film',facts:{description:'Four chocolate chip cookies in a foil tray',arrangement:'overlapping',texture:'cracked baked',container:'foil tray',confirmed:true},brand:{dna:{name:'No Crumbs',tone:'warm',visualStyle:'editorial'},id:'b1',updated:1},seed:61},concepts:[{id:'c1',title:'Warm hold',idea:'Invite closer',environment:'soft kitchen light',lighting:'window',composition:'overhead'}],selectedId:'c1',draft:{modelPrompt:'test'},composition:{headline:'Warm hold',body:'',cta:''},projectId:'p1'};
const fakeShots={version:1,id:'sp1',created:Date.now(),projectId:'p1',brandName:'No Crumbs',productSummary:'cookies',concept:'warm',intendedOutcome:'desire',creativeHook:'sensory-reveal',rights:'inspiration-only',shots:[{index:0,purpose:'anticipation',duration:2,sceneBrief:'open',startKeyframeStrategy:'source-still',endKeyframeStrategy:'hold',cameraMovement:'slow',motionConstraints:[],fidelity:'exact'},{index:1,purpose:'payoff',duration:2.5,sceneBrief:'hero',startKeyframeStrategy:'hero-still',endKeyframeStrategy:'hold',cameraMovement:'hold',motionConstraints:[],fidelity:'exact'}],editing:{transition:'dissolve',brandOverlay:true,endingCta:true},fidelityRequirements:[],intelligence:intel,note:'fixture'};
const plan=planCampaignSound({takeId:'v1',creative:fakeCreative,shotPlan:fakeShots,videoDuration:silentProbe.duration||4.8,audioRights:'none'});
assert.ok(plan.modelPrompt||plan.silencePreferred);
assert.ok(!plan.cues.some(c=>/footstep|pouring|chewing/i.test(c.prompt||'')));
report.plan={atmosphere:plan.atmosphere,cues:plan.cues.map(c=>({kind:c.kind,at:c.at,purpose:c.purpose})),warnings:plan.warnings};

// A: silent → licensed replace mix → audible MP4
{
 const mix=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:silentProbe.duration||4.8,layers:[{id:'1',kind:'music',url:bedInfo.url,at:0,duration:silentProbe.duration||4.8,gainDb:-8,fadeIn:0.3,fadeOut:0.5,rights:'user-owned-or-licensed',provenance:'proof-fixture'}]})});
 const body=await mix.json();assert.equal(mix.status,200,body.error||'A mix');
 const bytes=Buffer.from(await(await fetch(base+body.url)).arrayBuffer());
 await writeFile(join(out,'A-mixed-audible.mp4'),bytes);
 const a=await probeAudio(join(out,'A-mixed-audible.mp4'));
 assert.equal(a.hasAudio,true);assert.ok(a.duration>3);assert.match(a.codec||'',/aac|mp4a/);
 // Silent master unchanged on disk
 const masterStill=await probeAudio(silentSrc);assert.equal(masterStill.hasAudio,false);
 report.cases.A={pass:true,url:body.url,probe:a,bytes:bytes.length,sha256:sha(bytes),note:'Licensed bed mixed; Stable Audio not required when unavailable'};
 console.log('PASS A audible mix',a);
}

// B: authorized reference soundtrack reuse → new commercial mix
{
 const ex=await fetch(base+'/api/sound/extract-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:refInfo.originalUrl||refInfo.url,audioRights:'user-owned-or-licensed'})});
 const extracted=await ex.json();assert.equal(ex.status,200,extracted.error||'extract');
 const mix=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:silentProbe.duration||4.8,layers:[{id:'r',kind:'reference',url:extracted.url,at:0,duration:Math.min(3,silentProbe.duration||4.8),gainDb:-6,fadeIn:0.15,fadeOut:0.4,rights:'user-owned-or-licensed',provenance:'authorized-reference-extract'}]})});
 const body=await mix.json();assert.equal(mix.status,200,body.error||'B mix');
 const bytes=Buffer.from(await(await fetch(base+body.url)).arrayBuffer());
 await writeFile(join(out,'B-authorized-reference-audio.mp4'),bytes);
 const a=await probeAudio(join(out,'B-authorized-reference-audio.mp4'));
 assert.equal(a.hasAudio,true);
 report.cases.B={pass:true,url:body.url,probe:a,bytes:bytes.length,sha256:sha(bytes)};
 console.log('PASS B authorized reference audio',a);
}

// C: inspiration-only — extract must be refused; plan may use timing only
{
 const denied=await fetch(base+'/api/sound/extract-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:refInfo.url,audioRights:'inspiration-only'})});
 assert.equal(denied.status,403);
 const analysis=await(await fetch(base+'/api/sound/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:refInfo.url})})).json();
 const inspiredPlan=planCampaignSound({takeId:'v1',creative:fakeCreative,shotPlan:{...fakeShots,rights:'inspiration-only'},referenceAudio:analysis,audioRights:'inspiration-only',videoDuration:4.8});
 assert.ok(inspiredPlan.warnings.some(w=>/inspiration-only|not be copied|waveform/i.test(w)));
 // Original replacement soundtrack (licensed bed) — never the reference waveform as inspiration-only
 const mix=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:4.8,layers:[{id:'o',kind:'music',url:bedInfo.url,at:0,duration:4.8,gainDb:-8,fadeIn:0.3,fadeOut:0.5,rights:'user-owned-or-licensed',provenance:'original-replacement'}]})});
 const body=await mix.json();assert.equal(mix.status,200,body.error||'C mix');
 assert.notEqual(body.url,refInfo.url);
 const bytes=Buffer.from(await(await fetch(base+body.url)).arrayBuffer());
 await writeFile(join(out,'C-inspiration-original-bed.mp4'),bytes);
 report.cases.C={pass:true,extractDenied:403,url:body.url,sha256:sha(bytes),planWarnings:inspiredPlan.warnings};
 console.log('PASS C inspiration-only (no copy)');
}

// D: mute / audio unavailable → silent MP4 still downloadable
{
 const mix=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:4.8,layers:[]})});
 const body=await mix.json();assert.equal(mix.status,200,body.error||'D mute');
 const bytes=Buffer.from(await(await fetch(base+body.url)).arrayBuffer());
 await writeFile(join(out,'D-muted-silent.mp4'),bytes);
 const a=await probeAudio(join(out,'D-muted-silent.mp4'));
 assert.equal(a.hasAudio,false);
 // Auto generate path honestly unavailable
 if(!caps.stableAudio?.available){
  const gen=await fetch(base+'/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'warm soft pad',duration:4,seed:1})});
  assert.equal(gen.status,400);
 }
 report.cases.D={pass:true,url:body.url,probe:a,stableAudioUnavailable:!caps.stableAudio?.available,silentMasterPreserved:true};
 console.log('PASS D silent downloadable');
}

report.pass=true;report.license={stableAudio:'Stability AI Community License (weights not installed on this machine)',t5:'Apache-2.0',ffmpegMix:'local processing',fixtures:'synthetic licensed test tones generated for proof only'};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('PASS sound director proof',out);
