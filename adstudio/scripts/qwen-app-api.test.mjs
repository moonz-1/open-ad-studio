// Actual local application HTTP with a closed approval gate. ZERO inference.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {createServer} from 'vite';
const outputs=resolve('outputs'),folder=await mkdtemp(join(outputs,'qwen-app-api-fixture-')),session=join(folder,'session');await mkdir(session);
process.env.QWEN_APP_RELAY_URL='http://127.0.0.1:28301';process.env.QWEN_APP_SESSION_DIR=session;
const config=(await import('../benchmark/vite.app-api.config.ts')).default;
const server=await createServer({...config,configFile:false,server:{...config.server,port:0}});
const provenanceId=randomBytes(8).toString('hex'),recordFolder=join(outputs,'hero-qwen',provenanceId);
try{
 await server.listen();const address=server.httpServer.address(),base='http://127.0.0.1:'+address.port;
 const response=await fetch(base+'/api/hero/capabilities'),caps=await response.json();assert.equal(response.status,200);assert.equal(caps.finish,true);assert.equal(caps.qwen.available,false);assert.match(caps.qwen.reason,/approval/);
 const blocked=await fetch(base+'/api/hero/qwen',{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':randomBytes(16).toString('hex')},body:'{}'});assert.equal(blocked.status,503);assert.match((await blocked.json()).error,/approval/);
 assert.equal((await fetch(base+'/api/hero/qwen/provenance/'+provenanceId)).status,404);
 await mkdir(recordFolder,{recursive:true});await writeFile(join(recordFolder,'provenance.json'),JSON.stringify({testFixture:true,status:'MOCK-NOT-GENERATED'}));assert.equal((await(await fetch(base+'/api/hero/qwen/provenance/'+provenanceId)).json()).status,'MOCK-NOT-GENERATED');
 const old=(await readdir(outputs)).find(p=>/^[a-f0-9]{16}\.png$/.test(p));assert.ok(old,'Existing local opaque output for preservation check');assert.deepEqual(Buffer.from(await(await fetch(base+'/outputs/'+old)).arrayBuffer()),await readFile(join(outputs,old)));
 const denied=await new Promise((ok,no)=>{const r=request(base+'/api/hero/qwen/provenance/'+provenanceId,{headers:{Host:'untrusted.example'}},res=>{res.resume();ok(res.statusCode);});r.on('error',no);r.end();});assert.ok([401,403].includes(denied),String(denied));
 console.log('PASS actual local API HTTP: private API-only config starts, unapproved relay unavailable/503, provenance404/200 and access gate, older output stays local. NO browser acceptance or inference; Linux/GPU startup remains unverified.');
}finally{await server.close();for(const path of [folder,recordFolder]){if(!path.startsWith(outputs+(process.platform==='win32'?'\\':'/')))throw Error('Unsafe cleanup');await rm(path,{recursive:true,force:true});}}
