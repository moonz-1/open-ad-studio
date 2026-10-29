// Local CPU artifact collector. No uploads, model execution or billing calls.
import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
const exec=promisify(execFile),env={...loadEnv('development',process.cwd(),''),...process.env},ffmpeg=env.FFMPEG_PATH||'ffmpeg',ffprobe=env.FFPROBE_PATH||(process.platform==='win32'?join(dirname(ffmpeg),'ffprobe.exe'):'ffprobe');
const root=resolve(process.argv[2]||'outputs/ltx25-benchmark'),items=[];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const entry of await readdir(root,{withFileTypes:true})){
 if(!entry.isDirectory()||!/(cookie|printed-label)-seed[12]/.test(entry.name))continue;
 const folder=join(root,entry.name),record=JSON.parse(await readFile(join(folder,'render.json'),'utf8'));
 if(record.status!=='complete')continue;
 const video=join(folder,'video.mp4'),hash=createHash('sha256').update(await readFile(video)).digest('hex');if(hash!==record.videoSha256)throw Error('Video hash mismatch');
 const metadata=JSON.parse((await exec(ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',video],{windowsHide:true})).stdout);
 const stream=metadata.streams.find(s=>s.codec_type==='video');const technicalPass=stream.width===1088&&stream.height===1920&&stream.nb_read_frames==='73'&&stream.avg_frame_rate==='24/1';
 await writeFile(join(folder,'probe.json'),JSON.stringify(metadata,null,2));
 await copyFile(record.input.guide,join(folder,'guide.png'));
 await exec(ffmpeg,['-v','error','-y','-i',video,'-vf',"select='eq(n,0)+eq(n,12)+eq(n,24)+eq(n,36)+eq(n,48)+eq(n,60)+eq(n,72)',scale=-2:384,tile=7x1",'-frames:v','1',join(folder,'frames.png')],{windowsHide:true});
 const review={technicalPass,motion:'NOT REVIEWED',direction:'NOT REVIEWED',identity:'NOT REVIEWED',textures:'NOT REVIEWED',lettering:'NOT REVIEWED',composition:'NOT REVIEWED',flicker:'NOT REVIEWED',normalSpeedPlayback:'NOT REVIEWED',commercialAcceptance:'NOT ACCEPTED',limitations:record.input.label||'',seconds:record.seconds};
 // Repeated collection must not overwrite a human's visual evaluation.
 try{await writeFile(join(folder,'review.json'),JSON.stringify(review,null,2),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 items.push(`<article><h2>${esc(entry.name)}</h2><p>Technical metadata ${technicalPass?'PASS':'FAIL'} · ${esc(record.seconds)} s occupied render time · visual acceptance unreviewed</p><div class="pair"><img src="${entry.name}/guide.png" alt="Original prepared guide"><video controls playsinline preload="metadata" src="${entry.name}/video.mp4"></video></div><img class="frames" src="${entry.name}/frames.png" alt="Frames 0, 12, 24, 36, 48, 60, 72"><p>${esc(record.input.label||'Original cookie tray baseline')}</p><details><summary>Exact prompt and provenance</summary><pre>${esc(record.prompt)}</pre><a href="${entry.name}/render.json">Execution record</a> · <a href="${entry.name}/review.json">Visual review</a></details></article>`);
}
await writeFile(join(root,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>Private LTX-2.5 benchmark</title><style>body{background:#141519;color:#eee;font:15px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:32px}.pair{display:flex;gap:12px}.pair>*{width:48%;height:480px;object-fit:contain;background:black}.frames{width:100%;margin-top:12px}pre{white-space:pre-wrap}a{color:#a5b5ff}</style><h1>Private benchmark evidence</h1><p>Model outputs are candidates. Metadata success is not commercial acceptance. Play full clips at normal speed and compare all frames against original details.</p><main>${items.join('')}</main>`);
console.log('Collected',items.length,'candidate(s). No automatic visual PASS. Private gallery:',join(root,'gallery.html'));
