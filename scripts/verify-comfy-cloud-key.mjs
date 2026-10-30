// Explicit, nonbillable authentication check. Never writes or copies .env files.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {COMFY_CLOUD_BASE_URL} from '@comfyorg/sdk';
export async function checkCloudAuth(apiKey,fetcher=fetch){
 if(!apiKey?.trim())return {authenticated:false,reason:'No API key configured. Add COMFY_API_KEY to .env in this application folder; keep spending disabled.'};
 const url=COMFY_CLOUD_BASE_URL+'/api/v2/jobs/00000000-0000-4000-8000-000000000000';
 try{
  const response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+apiKey.trim()},signal:AbortSignal.timeout(15000)});
  let code;try{code=(await response.json())?.error?.code;}catch{}
  const control=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer comfyui-'+'0'.repeat(48)},signal:AbortSignal.timeout(15000)});
  const authenticated=response.status===404&&code==='job_not_found'&&control.status===401;
  return {authenticated,status:response.status,reason:authenticated?'Authentication confirmed. Model compatibility, subscription entitlement and credit balance still require separate verification. No workflow submitted.':'Authentication was not confirmed. Check your API key and eligible paid subscription at platform.comfy.org. No workflow submitted.'};
 }catch{return {authenticated:false,reason:'Could not reach Comfy Cloud. Check your connection and try this authentication check again. No workflow was submitted.'};}
}
async function main(){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const {loadEnv}=await import('vite');const env={...loadEnv('production',root,''),...process.env};
 const result=await checkCloudAuth(env.COMFY_API_KEY||env.ADSTUDIO_COMFY_CLOUD_API_KEY);
 console.log(JSON.stringify(result,null,2));if(!result.authenticated)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
