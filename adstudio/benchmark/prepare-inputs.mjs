// Local-only preparation. No network, no model, no source changes.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,extname,join} from 'node:path';
import {loadEnv} from 'vite';
const sources=process.argv.slice(2);if(sources.length!==2)throw Error('Usage: node adstudio/benchmark/prepare-inputs.mjs <original-cookie-photo> <printed-label-product-photo>');
const env={...loadEnv('development',process.cwd(),''),...process.env},exec=promisify(execFile),folder=resolve('outputs/ltx25-benchmark/inputs');
await mkdir(folder,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),inputs=[];
for(let i=0;i<sources.length;i++){
 const source=resolve(sources[i]),bytes=await readFile(source),id=i?'printed-label':'cookie',original=join(folder,id+'.source'+extname(source)),guide=join(folder,id+'.png');
 await copyFile(source,original);
 await exec(env.FFMPEG_PATH||'ffmpeg',['-v','error','-y','-i',source,'-vf','scale=1088:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1088:1920:(ow-iw)/2:(oh-ih)/2:color=0x181818,setsar=1','-frames:v','1',guide],{windowsHide:true});
 if(sha(await readFile(source))!==sha(bytes))throw Error('Source changed during preparation');
 inputs.push({id,provenance:'User-supplied original; no AI enhancement',source,original,sourceSha256:sha(bytes),guide,guideSha256:sha(await readFile(guide)),width:1088,height:1920,framing:'whole-photo fit with dark padding; EXIF orientation applied by FFmpeg',label:i?'Generic Thank You sticker, not an actual brand logo; brand-specific acceptance remains unproven':undefined});
}
await writeFile(join(folder,'manifest.json'),JSON.stringify({version:1,created:new Date().toISOString(),private:true,uploaded:false,inputs},null,2));
console.log('Prepared two private local guides and source/hash manifest. Nothing uploaded.');
