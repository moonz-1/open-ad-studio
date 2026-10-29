// Actual local FFmpeg regression harness, isolated API port/offline Comfy.
// No private photos, browser, model inference or cloud connection.
import assert from 'node:assert/strict';
import {createServer,loadEnv} from 'vite';
import {createServer as httpServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,dirname,join} from 'node:path';
import {comfyApi} from '../../shared/runtime/api.ts';
const out='outputs/react-adstudio-review';await mkdir(out,{recursive:true});
const local=loadEnv('development',process.cwd(),''),outer=loadEnv('development',resolve('../..'),''),ffmpeg=process.env.FFMPEG_PATH||local.FFMPEG_PATH||outer.FFMPEG_PATH||'ffmpeg';
const config=JSON.parse(await readFile('outputs/runtime-config.json','utf8').catch(()=>'{}'));assert.notEqual(config.mode,'managed','Do not start managed Comfy for CPU tests');
let api,backend;try{
 backend=httpServer((req,res)=>{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"CPU fixture: Comfy offline"}');});await new Promise(ok=>backend.listen(0,'127.0.0.1',ok));const offline='http://127.0.0.1:'+backend.address().port;
 api=await createServer({configFile:false,cacheDir:out+'/media-vite-cache',plugins:[comfyApi({FFMPEG_PATH:ffmpeg,COMFYUI_URL:offline,COMFY_BASE_URL:offline})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});await api.listen();const base='http://127.0.0.1:'+api.httpServer.address().port;assert.ok(!base.endsWith(':8301'));
 const exec=promisify(execFile),results=[];
 for(const script of ['product-video.test.mjs','camera-frames.test.mjs','camera-offline.test.mjs','compose-http.test.mjs','integration.test.mjs']){const at=Date.now(),r=await exec(process.execPath,['--experimental-transform-types','adstudio/scripts/'+script],{env:{...process.env,OSH_TEST_URL:base,FFMPEG_PATH:ffmpeg,FFPROBE_PATH:join(dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe')},windowsHide:true,maxBuffer:8*1024*1024});await writeFile(out+'/'+script+'.log',r.stdout+r.stderr);results.push({script,seconds:(Date.now()-at)/1000,pass:true});console.log('PASS CPU',script);}
 await writeFile(out+'/media-regressions.json',JSON.stringify({api:base,privateSources:false,gpu:false,results},null,2));
}finally{await api?.close();await new Promise(ok=>backend?backend.close(ok):ok());}
