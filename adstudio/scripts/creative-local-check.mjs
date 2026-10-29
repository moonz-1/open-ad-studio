// Read-only by default. --run permits ONE local text job on public synthetic
// data through the REAL app/SDK/proxy; never image inference or model downloads.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import {createHash} from 'node:crypto';
import {inputFixture} from './creative-fixtures.mjs';
const url=new URL(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:8301');
if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use a local application origin only.');
const run=process.argv.includes('--run'),outIndex=process.argv.indexOf('--out'),dir=outIndex>=0?process.argv[outIndex+1]:'outputs/creative-local-check',rel=relative(resolve('outputs'),resolve(dir||''));if(!dir||!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Use a private directory under outputs/.');await mkdir(dir,{recursive:true});
const get=async path=>{const r=await fetch(url.origin+path,{signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('Local API '+r.status);return r.json();};
let status;try{status=await get('/api/creative/status');}catch(e){status={available:false,reason:'Application unavailable: '+e.message};}
const result={origin:url.origin,status,requestedTextRun:run,textInferenceAttempted:false,textInferenceRun:false,validatedAIPlanning:false,imageInferenceRun:false,at:new Date().toISOString()};
if(run&&status.available){
 const post=async(path,body)=>{const r=await fetch(url.origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(210000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Local API '+r.status);return data;};
 const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320"><rect width="256" height="320" fill="white"/><rect x="85" y="55" width="86" height="30" fill="#303030"/><rect x="64" y="85" width="128" height="200" rx="15" fill="#305b85"/><rect x="78" y="160" width="100" height="50" fill="white"/><text x="90" y="192" font-size="24">FIELD</text></svg>').render().asPng();
 const sha=createHash('sha256').update(png).digest('hex'),input=inputFixture('bottle');input.source={...input.source,name:'Owned synthetic FIELD bottle fixture.png',sha256:sha,originalSha256:sha};input.facts={description:'One blue bottle shape with a dark cap and a white FIELD label.',texture:'Flat matte blue body and white label.',arrangement:'One upright bottle centered.',container:'Bottle is the product.',count:1,confirmed:false};
 // Planning is not source confirmation. No reviewed request is prepared.
 const image=await post('/api/upload',{image:'data:image/png;base64,'+png.toString('base64')});
 const plan=await post('/api/creative/plan',{image:image.url,input});result.planId=plan.id;result.provider=plan.provider;result.validatedAIPlanning=plan.provider.mode==='local-ai';result.textInferenceRun=result.validatedAIPlanning;result.reviewRequired=plan.reviewRequired;await writeFile(dir+'/plan.json',JSON.stringify(plan,null,2));
 if(!/^[a-f0-9]{16}$/.test(plan.id))throw Error('Invalid local plan identity.');
 const audit=JSON.parse(await readFile(new URL('../../outputs/creative-plans/'+plan.id+'/planning.json',import.meta.url),'utf8'));result.textInferenceAttempted=audit.attempted===true;result.textInferenceRun=audit.rawTextReturned===true||result.validatedAIPlanning;result.elapsedMs=audit.elapsedMs;result.validationIssues=audit.validationIssues||[];result.normalizations=audit.normalizations||[];await writeFile(dir+'/planning.json',JSON.stringify(audit,null,2));if(audit.rawTextReturned||result.validatedAIPlanning)await writeFile(dir+'/model-response.txt',await readFile(new URL('../../outputs/creative-plans/'+plan.id+'/model-response.txt',import.meta.url)));
}
await writeFile(dir+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(run&&!result.validatedAIPlanning)process.exitCode=2;
