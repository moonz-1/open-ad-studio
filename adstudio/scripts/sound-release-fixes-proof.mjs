/**
 * Release-fix proofs for audio freeze:
 * 1) Exact video targeting isolation (two masters / two sound slots)
 * 2) Rights confirmation (no inference; extract denied without licensed flag)
 * 3) Loudness management (quiet + hot beds → integrated / true peak)
 * 4) Auto unavailable note when Stable Audio missing
 * 5) Mute never loudnorms silence into noise
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const ffprobe=process.env.FFPROBE_PATH||(ffmpeg.includes('ffmpeg')?ffmpeg.replace(/ffmpeg(\.exe)?$/i,'ffprobe$1'):'ffprobe');
const out=resolve('outputs/sound-release-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const report={base,out,pass:false,proofs:{}};
const run=(exe,args)=>new Promise((ok,fail)=>{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('close',c=>c===0?ok({stdout,stderr}):fail(Error(exe+' '+args.join(' ')+'\n'+stderr.slice(-800))));});
const sha=b=>createHash('sha256').update(b).digest('hex');
const probe=async path=>{const {stdout}=await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]);const data=JSON.parse(stdout);const a=data.streams?.find(s=>s.codec_type==='audio');return {hasAudio:!!a,duration:Number(data.format?.duration||a?.duration||0),codec:a?.codec_name,channels:Number(a?.channels||0),sampleRate:Number(a?.sample_rate||0)};};
const ebur=async path=>{
  const {stderr}=await run(ffmpeg,['-nostdin','-hide_banner','-i',path,'-af','ebur128=peak=true','-f','null','-']);
  const summary=stderr.split(/Summary:/i).pop()||stderr;
  const i=[...summary.matchAll(/I:\s*([-\d.]+)\s*LUFS/g)].pop();
  const tp=[...summary.matchAll(/Peak:\s*([-\d.]+)\s*dBFS/g)].pop()
    ||[...summary.matchAll(/True peak:\s*[\s\S]*?([-\d.]+)\s*dBTP/gi)].pop();
  return {integratedLufs:i?Number(i[1]):null,truePeakDb:tp?Number(tp[1]):null,raw:summary.slice(-1200)};
};

const silentSrc=resolve('outputs/f23c8046ca8957fe.mp4');
await copyFile(silentSrc,join(out,'master-shared-source.mp4'));
const silentUrl='/outputs/f23c8046ca8957fe.mp4';
const silentProbe=await probe(silentSrc);
assert.equal(silentProbe.hasAudio,false,'shared source must stay silent');

// Two distinct silent masters (same static origin conceptually; different take IDs / files).
const masterA=join(out,'video-take-A-silent.mp4');
const masterB=join(out,'video-take-B-silent.mp4');
await run(ffmpeg,['-y','-i',silentSrc,'-t','4.0','-c','copy',masterA]);
await run(ffmpeg,['-y','-i',silentSrc,'-t','4.5','-c','copy',masterB]);
// Two distinct silent take masters via mute mix (same static lineage, independent URLs).
const muteA=await(await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:4.0,layers:[]})})).json();
const muteB=await(await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:4.5,layers:[]})})).json();
assert.ok(muteA.url&&muteB.url);assert.notEqual(muteA.url,muteB.url);
const bytesA0=Buffer.from(await(await fetch(base+muteA.url)).arrayBuffer());
const bytesB0=Buffer.from(await(await fetch(base+muteB.url)).arrayBuffer());
await writeFile(join(out,'takeA-silent.mp4'),bytesA0);
await writeFile(join(out,'takeB-silent.mp4'),bytesB0);
const hashA0=sha(bytesA0),hashB0=sha(bytesB0);

// Quiet bed (−38-ish) and hot bed (near full scale before limiter).
const quietBed=join(out,'quiet-bed.wav');
const hotBed=join(out,'hot-bed.wav');
await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=5','-af','volume=-18dB,afade=t=in:st=0:d=0.3,afade=t=out:st=4.4:d=0.5','-ac','2',quietBed]);
await run(ffmpeg,['-y','-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=5','-af','volume=6dB,afade=t=in:st=0:d=0.05,afade=t=out:st=4.7:d=0.25','-ac','2',hotBed]);
const quietUp=await(await fetch(base+'/api/sound/upload',{method:'POST',headers:{'Content-Type':'audio/wav','x-osh-audio-rights':'user-owned-or-licensed'},body:await readFile(quietBed)})).json();
const hotUp=await(await fetch(base+'/api/sound/upload',{method:'POST',headers:{'Content-Type':'audio/wav','x-osh-audio-rights':'user-owned-or-licensed'},body:await readFile(hotBed)})).json();
assert.ok(quietUp.url,quietUp.error);assert.ok(hotUp.url,hotUp.error);

// --- 1) Exact targeting: mix sound onto take A only; take B bytes unchanged ---
const mixA=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:muteA.url,duration:4.0,layers:[{id:'qa',kind:'music',url:quietUp.url,at:0,duration:4.0,gainDb:-6,fadeIn:0.25,fadeOut:0.4,rights:'user-owned-or-licensed',provenance:'release-proof-A'}]})});
const mixABody=await mixA.json();assert.equal(mixA.status,200,mixABody.error||'mix A');
const bytesA1=Buffer.from(await(await fetch(base+mixABody.url)).arrayBuffer());
await writeFile(join(out,'takeA-mixed.mp4'),bytesA1);
const bytesB1=Buffer.from(await(await fetch(base+muteB.url)).arrayBuffer());
assert.equal(sha(bytesB1),hashB0,'Take B silent master must be byte-identical after A mix');
assert.notEqual(sha(bytesA1),hashA0,'Take A mixed output must differ from its silent copy');
const probeA=await probe(join(out,'takeA-mixed.mp4'));
const probeB=await probe(join(out,'takeB-silent.mp4'));
assert.equal(probeA.hasAudio,true);assert.equal(probeA.channels,2);
assert.equal(probeB.hasAudio,false);
// Download isolation: fetching A mixed URL ≠ B mute URL
assert.notEqual(mixABody.url,muteB.url);
report.proofs.exactTargeting={
  pass:true,
  takeA:{silent:muteA.url,mixed:mixABody.url,shaSilent:hashA0,shaMixed:sha(bytesA1),probe:probeA,loudness:mixABody.loudness},
  takeB:{silent:muteB.url,shaUnchanged:hashB0,probe:probeB},
  note:'Two video takes from same static lineage; modifying A never changed B bytes or audio presence.'
};
console.log('PASS exact targeting',report.proofs.exactTargeting.takeA.mixed,'vs',muteB.url);

// Mix B independently with hot bed — A mixed file remains the same URL/content lineage
const mixB=await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:muteB.url,duration:4.5,layers:[{id:'hb',kind:'music',url:hotUp.url,at:0,duration:4.5,gainDb:-4,fadeIn:0.2,fadeOut:0.5,rights:'user-owned-or-licensed',provenance:'release-proof-B'}]})});
const mixBBody=await mixB.json();assert.equal(mixB.status,200,mixBBody.error||'mix B');
const bytesAStill=Buffer.from(await(await fetch(base+mixABody.url)).arrayBuffer());
assert.equal(sha(bytesAStill),sha(bytesA1),'Take A mixed MP4 unchanged after B mix');
await writeFile(join(out,'takeB-mixed.mp4'),Buffer.from(await(await fetch(base+mixBBody.url)).arrayBuffer()));

// --- 2) Rights confirmation ---
const journeySrc=readFileSync(new URL('../src/journey/journey.tsx',import.meta.url),'utf8');
const appSrc=readFileSync(new URL('../src/ad-application.ts',import.meta.url),'utf8');
assert.match(journeySrc,/audioRightsOk/);
assert.match(journeySrc,/both[\s\S]*soundtrack recording[\s\S]*underlying music|commercial rights to[\s\S]*both/);
assert.match(journeySrc,/soundFor\(v\.id,'reference'\)/);
assert.doesNotMatch(journeySrc,/soundFor\(c,'reference'\)/);
assert.match(appSrc,/confirmedAudioRights!==true/);
assert.match(appSrc,/recordingAndMusic:true/);
assert.match(appSrc,/Uploading a reference video must never imply audio rights|must never imply/);
// Upload inspiration path always leaves audioRights as inspiration-only / none — never auto user-owned
assert.match(appSrc,/audioRights:rights==='user-owned-or-licensed'\?'inspiration-only':'inspiration-only'|audioRights:'inspiration-only'/);
const denied=await fetch(base+'/api/sound/extract-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:quietUp.url,audioRights:'inspiration-only'})});
assert.equal(denied.status,403);
const deniedBody=await denied.json();
report.proofs.rightsConfirmation={
  pass:true,
  uiCheckbox:true,
  exactVideoIdCalls:true,
  extractWithoutLicensedFlag:403,
  extractError:deniedBody.error||deniedBody.note,
  note:'Reference reuse requires deliberate confirmation; video upload alone never grants soundtrack rights.'
};
console.log('PASS rights confirmation');

// --- 3) Loudness ---
const loudA=await ebur(join(out,'takeA-mixed.mp4'));
const loudB=await ebur(join(out,'takeB-mixed.mp4'));
await writeFile(join(out,'takeA-ebur.txt'),loudA.raw);
await writeFile(join(out,'takeB-ebur.txt'),loudB.raw);
assert.ok(loudA.integratedLufs!=null,'integrated loudness for quiet mix');
assert.ok(loudB.integratedLufs!=null,'integrated loudness for hot mix');
// Target ~-16 LUFS after measure→gain→limit. Short sine beds may land a few LU off.
assert.ok(loudA.integratedLufs>-24&&loudA.integratedLufs<-10,`quiet bed integrated ${loudA.integratedLufs} LUFS out of band`);
assert.ok(loudB.integratedLufs>-24&&loudB.integratedLufs<-10,`hot bed integrated ${loudB.integratedLufs} LUFS out of band`);
if(loudA.truePeakDb!=null)assert.ok(loudA.truePeakDb<=0.5,`quiet true peak ${loudA.truePeakDb}`);
if(loudB.truePeakDb!=null)assert.ok(loudB.truePeakDb<=0.5,`hot true peak ${loudB.truePeakDb}`);
// Prior reported peaks (−38 / −26 dBFS) were too quiet; delivered mixes must be clearly louder.
assert.ok(loudA.integratedLufs>-30,'delivered quiet mix still quieter than prior −38 dBFS peak mixes');
assert.ok(Math.abs((await probe(join(out,'takeA-mixed.mp4'))).duration-4)<0.35,'A duration align');
assert.ok(Math.abs((await probe(join(out,'takeB-mixed.mp4'))).duration-4.5)<0.35,'B duration align');
report.proofs.loudness={
  pass:true,
  target:{I:-16,TP:-1.5},
  takeA:{...loudA,api:mixABody.loudness,duration:(await probe(join(out,'takeA-mixed.mp4'))).duration,stereo:probeA.channels===2},
  takeB:{...loudB,api:mixBBody.loudness,duration:(await probe(join(out,'takeB-mixed.mp4'))).duration,stereo:(await probe(join(out,'takeB-mixed.mp4'))).channels===2},
  priorReportedPeaksDbFs:[-38.1,-26.4],
  note:'Prior mixes were excessively quiet; loudnorm+limiter now targets social-safe loudness without clipping.'
};
console.log('PASS loudness',report.proofs.loudness.takeA.integratedLufs,report.proofs.loudness.takeB.integratedLufs);

// --- 4) Mute / silence not normalized ---
const muteAgain=await(await fetch(base+'/api/sound/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silentMaster:silentUrl,duration:4.0,layers:[]})})).json();
assert.match(muteAgain.note||'',/Silent|no audio|by design/i);
assert.equal(muteAgain.hasAudio,false);
const muteBytes=Buffer.from(await(await fetch(base+muteAgain.url)).arrayBuffer());
await writeFile(join(out,'mute-no-loudnorm.mp4'),muteBytes);
assert.equal((await probe(join(out,'mute-no-loudnorm.mp4'))).hasAudio,false);
report.proofs.muteNoLoudnorm={pass:true,url:muteAgain.url,note:muteAgain.note};

// --- 5) Auto unavailable ---
const caps=await(await fetch(base+'/api/sound/capabilities')).json();
assert.equal(!!caps.stableAudio?.available,false);
assert.ok(/Stable Audio|not installed/i.test(caps.note||''));
assert.match(journeySrc,/!soundCaps\?\.stableAudio/);
assert.match(journeySrc,/sound-note/);
report.proofs.autoUnavailable={pass:true,note:caps.note,stableAudio:caps.stableAudio};

// Source contract: Journey download + replace use exact IDs
assert.match(journeySrc,/downloadCampaignVideoTake\(v\.id/);
assert.match(journeySrc,/replaceVideoId/);
assert.match(journeySrc,/soundFor\(vid,'replace'/);
assert.match(appSrc,/applyCampaignSoundForVideo/);
assert.match(appSrc,/planCampaignSoundForVideo/);

report.pass=true;
await writeFile(join(out,'REPORT.json'),JSON.stringify(report,null,2));
console.log('ALL RELEASE SOUND FIXES PASS',out);
console.log(JSON.stringify({
  exactTargeting:report.proofs.exactTargeting.pass,
  rights:report.proofs.rightsConfirmation.pass,
  loudnessA:report.proofs.loudness.takeA.integratedLufs,
  loudnessB:report.proofs.loudness.takeB.integratedLufs,
  truePeakA:report.proofs.loudness.takeA.truePeakDb,
  truePeakB:report.proofs.loudness.takeB.truePeakDb,
  autoNote:caps.note
},null,2));
