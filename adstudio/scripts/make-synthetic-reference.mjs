// Synthetic surprise-reveal reference (no third-party brands) for local analysis tests.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const outDir=resolve('outputs/synthetic-reference');
await mkdir(outDir,{recursive:true});
const mp4=join(outDir,'surprise-reveal.mp4');

function run(args){return new Promise((ok,fail)=>{const p=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',b=>err=(err+b).slice(-6000));p.on('error',fail);p.on('close',c=>c===0?ok():fail(Error(err||'ffmpeg fail')));});}

// anticipation (cool grey) → obscuring wipe (black) → warm product payoff
await run([
 '-y',
 '-f','lavfi','-i','color=c=0x3a3a42:s=720x1280:d=2.4:r=24',
 '-f','lavfi','-i','color=c=0x050505:s=720x1280:d=0.7:r=24',
 '-f','lavfi','-i','color=c=0xd4b48c:s=720x1280:d=3.0:r=24',
 '-filter_complex','[0:v][1:v][2:v]concat=n=3:v=1:a=0[out]',
 '-map','[out]','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4
]);

await writeFile(join(outDir,'README.txt'),[
 'Synthetic surprise-reveal reference for Open Ad Studio.',
 'Structure only: anticipation → obscuring transition → product payoff.',
 'No third-party brand footage. Inspiration-only — never export as ad source.',
 ''].join('\n'));
console.log('SYNTHETIC_REF',mp4);
