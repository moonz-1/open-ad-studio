// Only the one long-running Qwen POST over the authenticated SSH loopback.
// node:http has no hidden Undici header deadline. A firm lease-bounded timer
// covers connect, upload, headers AND body; no redirects, pooling or retries.
import {request} from 'node:http';
import {HeroError} from './hero-ad.ts';
export const QWEN_INFERENCE_MAX_MS=30*60*1000;
export function qwenInferenceJSON(payload:string,requestId:string,deadlineAt:number):Promise<any>{
 const remaining=Math.min(QWEN_INFERENCE_MAX_MS,deadlineAt-Date.now());
 if(!Number.isFinite(remaining)||remaining<=0)return Promise.reject(new HeroError(504,'Qwen inference deadline expired. No retry.'));
 if(!/^[a-f0-9]{32}$/.test(requestId)||Buffer.byteLength(payload)>20*1024*1024)return Promise.reject(new HeroError(400,'Invalid bounded Qwen inference request.'));
 return new Promise((resolve,reject)=>{
  let settled=false,length=0;const chunks:Buffer[]=[];
  const finish=(error?:Error,value?:any)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){req.destroy();reject(error);}else resolve(value);};
  const req=request({hostname:'127.0.0.1',port:28301,path:'/api/hero/qwen',method:'POST',agent:false,
   headers:{'Content-Type':'application/json','Accept':'application/json','Content-Length':Buffer.byteLength(payload),'X-OSH-Request':requestId,'Connection':'close'}},res=>{
   res.on('error',error=>finish(Object.assign(new HeroError(502,'Private Qwen response connection failed. No retry.'),{cause:error})));
   res.on('aborted',()=>finish(new HeroError(502,'Private Qwen response was interrupted. No retry.')));
   res.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>512*1024){finish(new HeroError(502,'Remote metadata is too large.'));return;}chunks.push(chunk);});
   res.on('end',()=>{
    if(settled)return;const status=res.statusCode||502;
    if(status>=300&&status<400){finish(new HeroError(502,'Private Qwen inference redirect rejected. No retry.'));return;}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}
    catch{finish(new HeroError(502,'Malformed private Qwen inference response. No retry.'));return;}
    if(status<200||status>=300){finish(new HeroError(status>=400&&status<600?status:502,typeof data.error==='string'?data.error:'Private Qwen inference failed. No retry.'));return;}
    finish(undefined,data);
   });
  });
  const timer=setTimeout(()=>finish(new HeroError(504,'Qwen inference exceeded its overall deadline. No retry.')),remaining);
  req.once('error',error=>finish(Object.assign(new HeroError(502,'Private Qwen inference connection failed. No retry.'),{cause:error})));
  req.end(payload);
 });
}
