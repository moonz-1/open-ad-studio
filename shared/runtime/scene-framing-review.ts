/** Free saved-pixel review/export only. Never imports a generation client or submits a job. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {HeroError} from './hero-ad.ts';
import {validateBackgroundRequest} from './klein-background.ts';
import {inspectScenePixels} from './scene-inspection.ts';
import {sceneHardBlocks,sceneQualityBlocks} from '../lib/scene-quality.ts';
import {framingNeedsManualReview} from '../lib/scene-framing-review.ts';
import type {ManualFramingReview} from '../lib/scene-framing-review.ts';
import type {AdScene} from '../lib/ad-scene.ts';
import {exportStaticAd} from './static-ad.ts';
const id=()=>randomBytes(8).toString('hex');
async function context(outputs:string,body:any){
 let checked:Awaited<ReturnType<typeof validateBackgroundRequest>>;
 try{checked=await validateBackgroundRequest(outputs,body);}catch(e){if(e instanceof HeroError)throw e;if((e as {code?:string}).code==='ENOENT')throw new HeroError(404,'The saved plan or preparation receipt is missing. Your photographs are retained.');throw new HeroError(409,'The source or saved plan no longer matches this photograph. Reopen its matching campaign; no job was submitted.');}
 const inspection=await inspectScenePixels(outputs,checked.plan,body.image,body.output);
 const receipt=JSON.parse(await readFile(checked.receipt,'utf8')),result=receipt.result;
 if(receipt.status!=='complete'||!result?.jobId||result.sha256!==inspection.inspection.outputSha256||result.sourceSha256!==inspection.inspection.sourceSha256)throw new HeroError(409,'This saved photograph does not match the completed generation receipt. No export or job was started.');
 const scene={...result,...inspection} as AdScene;
 return {checked,inspection,scene,dir:join(outputs,'creative-plans',checked.plan.id)};
}
let reviewChain:Promise<unknown>=Promise.resolve();
export function decideSavedSceneFraming(outputs:string,body:any){const run=reviewChain.then(()=>decide(outputs,body));reviewChain=run.catch(()=>{});return run;}
async function decide(outputs:string,body:any){
 if(!['accept','reject'].includes(body?.decision))throw new HeroError(400,'Choose Accept or Reject explicitly.');
 if(body.decision==='accept'&&body.confirmed!==true)throw new HeroError(400,'Compare the original and saved photograph, then confirm your framing review.');
 const {checked,inspection,scene,dir}=await context(outputs,body);
 if(!framingNeedsManualReview(scene))throw new HeroError(409,'This photograph does not have an inconclusive framing check. Its independent product checks remain in force.');
 const blockers=sceneHardBlocks(scene);if(body.decision==='accept'&&blockers.length)throw new HeroError(422,'A framing decision cannot clear independent image defects: '+blockers.join(', '));
 const review:ManualFramingReview={version:1,id:id(),scope:'unmeasured-framing',decision:body.decision,at:Date.now(),decisionOrigin:'explicit-browser-action',automaticVerification:false,projectId:checked.plan.projectId,planId:checked.plan.id,preparedId:body.preparedId,jobId:scene.jobId,sourceSha256:inspection.inspection.sourceSha256,originalSourceSha256:checked.plan.input.source.originalSha256,outputSha256:inspection.inspection.outputSha256,framingReportSha256:inspection.inspection.framingReportSha256,workflowSha256:scene.workflowSha256};
 await writeFile(join(dir,'scene-review-'+review.id+'.json'),JSON.stringify({review,inspection,independentBlockers:blockers},null,2),{flag:'wx',mode:0o600});
 await writeFile(join(dir,'scene-review-latest-'+review.outputSha256+'.json'),JSON.stringify({reviewId:review.id}),{mode:0o600});
 return {review,inspection};
}
export function exportReviewedScene(outputs:string,body:any){const run=reviewChain.then(()=>exportDecision(outputs,body));reviewChain=run.catch(()=>{});return run;}
async function exportDecision(outputs:string,body:any){
 if(!/^[a-f0-9]{16}$/.test(body?.reviewId))throw new HeroError(400,'Accept the saved photograph in manual framing review first.');
 const {checked,inspection,scene,dir}=await context(outputs,body);
 let review:ManualFramingReview;try{review=JSON.parse(await readFile(join(dir,'scene-review-'+body.reviewId+'.json'),'utf8')).review;const latest=JSON.parse(await readFile(join(dir,'scene-review-latest-'+scene.sha256+'.json'),'utf8'));if(latest.reviewId!==review.id)throw Error('A newer decision exists.');}catch{throw new HeroError(409,'This framing decision is missing or superseded. Review the saved photo again.');}
 if(review.projectId!==body.projectId||review.planId!==body.planId||review.preparedId!==body.preparedId||review.originalSourceSha256!==checked.plan.input.source.originalSha256||sceneQualityBlocks({...scene,manualFramingReview:review}).length)throw new HeroError(409,'This saved photo is not accepted for export, or an independent blocker remains. Review it again.');
 const result=await exportStaticAd({design:body.design,photo:body.output,logo:body.logo},outputs);
 await writeFile(join(dir,'scene-reviewed-export-'+id()+'.json'),JSON.stringify({reviewId:review.id,projectId:body.projectId,planId:body.planId,jobId:scene.jobId,sourceSha256:review.sourceSha256,originalSourceSha256:review.originalSourceSha256,outputSha256:review.outputSha256,automaticFramingVerdict:inspection.framingQuality.verdict,automaticVerification:false,result},null,2),{flag:'wx',mode:0o600});
 return {...result,framingReviewId:review.id};
}
