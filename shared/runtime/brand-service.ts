// Source-first discovery + server-issued, bounded, single-attempt text receipts.
import {createHash,randomBytes} from 'node:crypto';
import {researchBrand,analysisStatus,analyzeEvidence} from './brand-research.ts';
import {brandAnalysisRequest,brandBackendStatus,analyzeBrand} from './brand-analysis.ts';
import {readPublic,BrandError} from './brand-web.ts';
import {validateResearch,type BrandResearch} from '../lib/brand.ts';
import {textDeadlineError,creativeTextDeadlineSeconds,type CreativeBackend} from './creative-engine.ts';
export function createBrandService(env:Record<string,string|undefined>,backend:CreativeBackend,read=readPublic,now=Date.now){
 type Receipt={research:BrandResearch;fingerprint:string;until:number;cacheUntil?:number;promise?:Promise<BrandResearch>;result?:BrandResearch};
 const receipts=new Map<string,Receipt>(),cache=new Map<string,Receipt>();let active=false;
 // A receipt never retries. A later explicit discovery may recover after a
 // short failure cooldown; successful evidence can still be reused for 30min.
 const reusable=(r:Receipt|undefined)=>r&&(r.cacheUntil??r.until)>now()&&r.result?.analysisState!=='unavailable';
 const fingerprint=(r:BrandResearch)=>createHash('sha256').update(JSON.stringify({website:r.website,provider:env.ADSTUDIO_BRAND_MODEL||'qwen3-native',...brandAnalysisRequest(r)})).digest('hex');
 function attach(r:BrandResearch,done:BrandResearch){r.observations.push(...done.observations.filter(o=>o.kind==='inference'));r.provider=done.provider;r.aiCompleted=done.aiCompleted;r.analysisState=done.analysisState;r.analysisRaw=done.analysisRaw;r.analysisMs=done.analysisMs;for(const w of done.warnings.filter(w=>/AI|analysis|Qwen/i.test(w)))if(!r.warnings.includes(w))r.warnings.push(w);return validateResearch(r);}
 return {
  async discover(input:any){
   if(!input?.deferAnalysis)return researchBrand(input,env,read,env.ADSTUDIO_BRAND_MODEL?undefined:backend);
   const r=await researchBrand({...input,analyze:false},env,read),fp=fingerprint(r),key=createHash('sha256').update(randomBytes(16)).update(fp).digest('hex'),old=cache.get(fp);
   r.analysisKey=key;r.analysisFingerprint=fp;r.analysisState='pending';r.provider={provider:'none',available:false,reason:'Website evidence is ready. Optional local text interpretation has not started.'};r.warnings=r.warnings.filter(w=>!w.startsWith('Source collection only.'));
   const receipt:Receipt={research:structuredClone(r),fingerprint:fp,until:now()+1800000};receipts.set(key,receipt);if(receipts.size>16)receipts.delete(receipts.keys().next().value!);
   if(old?.result&&reusable(old)){attach(r,old.result);receipt.result=structuredClone(r);}
   return r;
  },
  async analyze(input:any){
   const key=input?.key;if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw new BrandError(400,'A server-issued website analysis receipt is required.');
   const receipt=receipts.get(key);if(!receipt||receipt.until<now())throw new BrandError(409,'Website analysis receipt expired. Collect the website again.');if(receipt.result)return structuredClone(receipt.result);if(receipt.promise)return receipt.promise.then(structuredClone);
   const found=cache.get(receipt.fingerprint),prior=reusable(found)?found:undefined;
   const work=async()=>{
    if(prior?.promise||prior?.result){const done=prior.result||await prior.promise!;receipt.result=attach(structuredClone(receipt.research),done);return receipt.result;}
    const r=structuredClone(receipt.research),began=now();
    if(active){r.analysisState='unavailable';r.provider={provider:env.ADSTUDIO_BRAND_MODEL?'ollama':'comfy-qwen3',available:false,reason:'Another local brand analysis is busy. Website products and non-AI planning remain usable; no queued text attempt or automatic retry.'};r.warnings.push(r.provider.reason);receipt.result=validateResearch(r);return receipt.result;}
    active=true;try{
     r.provider=env.ADSTUDIO_BRAND_MODEL?await analysisStatus(env):await brandBackendStatus(backend);
     if(r.provider.available){try{if(env.ADSTUDIO_BRAND_MODEL){r.observations.push(...await analyzeEvidence(r.sources,r.colors,r.provider));r.aiCompleted=true;r.analysisState='completed';}else await analyzeBrand(r,backend);}catch(error){r.aiCompleted=false;r.analysisState='failed';const detail=(error instanceof Error?error.message:'Unknown text failure').replace(/[\r\n]/g,' ').slice(0,700);r.warnings.push((textDeadlineError(error)?`Local AI analysis exceeded its ${creativeTextDeadlineSeconds}-second deadline.`:'Local AI analysis failed validation or execution.')+' '+detail+' Website products remain available; no automatic retry.');}}
     else{r.analysisState='unavailable';r.warnings.push(r.provider.reason);}r.analysisMs=now()-began;receipt.result=validateResearch(r);receipt.cacheUntil=now()+(r.analysisState==='completed'?1800000:60000);return receipt.result;
    }finally{active=false;}
   };
   receipt.promise=work();
   if(!prior){cache.set(receipt.fingerprint,receipt);if(cache.size>16)cache.delete(cache.keys().next().value!);}
   return receipt.promise.then(structuredClone);
  }
 };
}
