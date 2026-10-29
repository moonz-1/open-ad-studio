import {resolve} from 'node:path';
import {defineConfig,loadEnv} from 'vite';
import {comfyApi} from './shared/runtime/api.ts';
import {cleanAdStudioUrls} from './adstudio/clean-urls.ts';

/** Standalone Open Ad Studio — Vite + Comfy generation API. No Cinema Studio / Director. */
export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env} as Record<string,string|undefined>;
 const allowedHosts=(env.OSH_ALLOWED_HOSTS||'').split(',').map(h=>h.trim()).filter(Boolean);
 const port=Number(env.OSH_PORT||8310);
 const outputFiles=resolve(process.cwd(),'outputs').replace(/\\/g,'/')+'/**';
 const deny=['**/outputs/**','.env','.env.*','*.{crt,pem,key}','**/.git/**','**/.venv/**','**/.runtime/**','**/node_modules/.vite*/**'];
 return {
  cacheDir:'node_modules/.vite-app',
  appType:'mpa',
  plugins:[cleanAdStudioUrls(),comfyApi(env),{
   name:'adstudio-controller-reload',
   handleHotUpdate({file,server}){
    if(/[/\\]adstudio[/\\]src[/\\].*\.(ts|tsx)$/.test(file)){
     server.ws.send({type:'full-reload'});
     return [];
    }
   },
  }],
  server:{watch:{ignored:['**/.runtime/**','**/.venv/**',outputFiles]},port,strictPort:true,host:env.OSH_HOST||'127.0.0.1',allowedHosts,fs:{strict:true,deny}},
  preview:{port,strictPort:true,host:env.OSH_HOST||'127.0.0.1',allowedHosts},
  build:{
   outDir:'dist',
   rollupOptions:{
    input:{
     home:'index.html',
     adstudio:'adstudio/index.html',
     adstudioWorkspace:'adstudio/workspace.html',
     adstudioTools:'adstudio/tools.html',
     adstudioJourney:'adstudio/journey.html',
    },
   },
  },
 };
});
