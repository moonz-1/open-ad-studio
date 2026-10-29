// CPU HTTP transport only; fixed loopback endpoint, no provider/model/asset.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {qwenInferenceJSON,QWEN_INFERENCE_MAX_MS} from '../../shared/runtime/qwen-inference-http.ts';
let mode='ok',requests=0;
const server=createServer((req,res)=>{requests++;assert.equal(req.url,'/api/hero/qwen');assert.equal(req.method,'POST');req.resume();
 if(mode==='disconnect')return req.socket.destroy();
 if(mode==='hang')return;
 if(mode==='partial'){res.writeHead(200);res.write('{');return setTimeout(()=>res.destroy(),15);}
 if(mode==='slow-body'){res.writeHead(200);res.write('{');return;}
 if(mode==='large')return res.end(' '.repeat(512*1024+1));
 if(mode==='malformed')return res.end('this is not JSON');
 if(mode==='redirect'){res.writeHead(302,{Location:'https://example.invalid/never-follow'});return res.end();}
 if(mode==='error'){res.writeHead(503);return res.end('{"error":"MOCK unavailable"}');}
 res.end('{"fixture":true}');});
await new Promise((ok,no)=>{server.once('error',no);server.listen(28301,'127.0.0.1',ok);});
try{
 const call=(ms=1000)=>qwenInferenceJSON('{}','a'.repeat(32),Date.now()+ms);
 assert.equal(QWEN_INFERENCE_MAX_MS,1800000);
 assert.deepEqual(await call(),{fixture:true});
 for(const [kind,match]of [['malformed',/Malformed/],['disconnect',/connection failed/],['partial',/interrupted|connection failed/],['large',/too large/],['redirect',/redirect rejected/],['error',/MOCK unavailable/],['hang',/overall deadline/],['slow-body',/overall deadline/]]){
  mode=kind;const before=requests;await assert.rejects(()=>call(kind==='hang'||kind==='slow-body'?80:1000),match);assert.equal(requests,before+1,'No retry: '+kind);
 }
 const before=requests;await assert.rejects(()=>qwenInferenceJSON('{}','b'.repeat(32),Date.now()-1),/expired/);await assert.rejects(()=>qwenInferenceJSON('{}','invalid',Date.now()+1000),/Invalid bounded/);assert.equal(requests,before,'Expired/invalid requests never sent');
 console.log('PASS bounded Qwen HTTP: complete JSON, expired/active deadlines, stalled body, connection loss before/after headers, malformed/oversized/error/redirect responses, no retries. No inference.');
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));}
