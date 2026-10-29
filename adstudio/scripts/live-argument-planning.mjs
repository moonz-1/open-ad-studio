// ONE bounded live Qwen3 argument-first planning probe. No Klein/LTX.
// Writes evidence under outputs/creative-acceptance/<stamp>/live-planning/.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {comfyApi} from '../../shared/runtime/api.ts';
import {directorInput} from './creative-director-fixtures.mjs';
import {png,dataURL} from './creative-fixtures.mjs';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'live-planning');
await mkdir(out,{recursive:true});
const comfy=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxy=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
let vite;
const report={stamp,comfy,proxy,available:false,mode:null,format:null,concepts:[],elapsedMs:0,pass:false,note:''};
try{
 vite=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.vite-live-argument-plan',plugins:[comfyApi({COMFYUI_URL:comfy,COMFY_BASE_URL:proxy})],server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});
 await vite.listen();
 const base='http://127.0.0.1:'+vite.httpServer.address().port;
 const status=await(await fetch(base+'/api/creative/status')).json();
 report.available=!!status.available;report.statusReason=status.reason;report.model=status.model;
 await writeFile(join(out,'status.json'),JSON.stringify(status,null,2));
 if(!status.available){report.note='Text planning unavailable; no GPU job submitted.';await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log('SKIP live argument planning:',status.reason);process.exit(0);}
 const upload=await fetch(base+'/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataURL(png)})});
 const up=await upload.json();assert.equal(upload.status,200,JSON.stringify(up));
 const input=directorInput('bakery');
 const started=Date.now();
 const planned=await fetch(base+'/api/creative/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:up.url,input}),signal:AbortSignal.timeout(420000)});
 const body=await planned.json();
 report.elapsedMs=Date.now()-started;report.httpStatus=planned.status;
 await writeFile(join(out,'plan-response.json'),JSON.stringify(body,null,2));
 if(planned.status!==200){report.note='Plan HTTP '+planned.status+': '+(body.error||'');await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.error('FAIL',report.note);process.exit(1);}
 report.mode=body.provider?.mode;report.format=body.provider?.contribution?.format;report.reason=body.provider?.reason;
 report.concepts=(body.concepts||[]).map(c=>({id:c.id,title:c.title,idea:c.idea,tension:c.strategy?.tension,memory:c.strategy?.memory,proof:c.strategy?.proof,hasVisual:!!(c.composition&&c.environment&&c.camera)}));
 const planDir=resolve('outputs','creative-plans',body.id);
 try{await writeFile(join(out,'planning.json'),await readFile(join(planDir,'planning.json'),'utf8'));}catch{/* */}
 try{await writeFile(join(out,'model-response.txt'),await readFile(join(planDir,'model-response.txt'),'utf8'));}catch{/* */}
 const distinct=new Set(report.concepts.map(c=>c.memory).filter(Boolean)).size;
 report.pass=report.mode==='local-ai'&&report.format==='advertising-arguments-v1'&&report.concepts.length===3&&distinct===3&&report.concepts.every(c=>c.proof?.length&&c.hasVisual);
 report.note=report.pass?'Live Qwen3 returned three distinct evidence-bound arguments; app compiled visuals.':'Live planning did not meet argument-first acceptance: mode='+report.mode+' format='+report.format+' distinctMemories='+distinct+' reason='+String(report.reason||'').slice(0,240);
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(report.pass?'PASS':'FAIL',report.note,'elapsedMs='+report.elapsedMs,'out='+out);
 process.exit(report.pass?0:1);
}finally{await vite?.close();}
