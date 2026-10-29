import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=join(import.meta.dirname,'../..');
let build='unknown';try{build=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const stamp=`adstudio-campaign-quality@${build}`;
const {loadEnv,createServer}=await import(pathToFileURL(join(root,'node_modules/vite/dist/node/index.js')).href);
const local=loadEnv('development',root,'');
for(const k of ['COMFYUI_URL','COMFY_BASE_URL','COMFYUI_MODELS_DIR','ADSTUDIO_KLEIN_MODELS_DIR','COMFY_API_PROXY_PATH','FFMPEG_PATH','OSH_TOKEN'])if(local[k]&&!process.env[k])process.env[k]=local[k];
if(!process.env.FFMPEG_PATH)process.env.FFMPEG_PATH='ffmpeg';
for(const k of ['QWEN_APP_RELAY_URL','QWEN_APP_SESSION_DIR','QWEN_SESSION_DIR','QWEN_APP_REMOTE_SESSION'])delete process.env[k];
const server=await createServer({root,configFile:join(root,'vite.config.ts'),cacheDir:join(root,'node_modules/.vite-adstudio-8303-quality'),server:{host:'127.0.0.1',port:8303,strictPort:true,hmr:false},define:{__ADSTUDIO_BUILD__:JSON.stringify(stamp)}});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0)});
await server.listen();console.log('ADSTUDIO_QUALITY_READY http://127.0.0.1:8303/adstudio/; build='+stamp+'; 8301/8302 untouched');
