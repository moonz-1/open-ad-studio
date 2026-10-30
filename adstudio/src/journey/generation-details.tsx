import {useState} from 'react';
import type {JourneyService} from '../journey-service.ts';
import type {HeroTake} from '../../../shared/lib/hero-ad.ts';
import {previewBlob} from '../ad-application.ts';
import {browserDownload} from '../download.ts';
export function generationProvider(take:HeroTake){
 if(take.scene?.executionKind==='artifact-replay')return 'Saved photograph replay — no new inference';
 if(take.scene?.transport==='comfy-cloud')return 'Comfy Cloud / FLUX 3 Klein';
 if(take.model==='flux3-klein-scene')return 'FLUX 3 Klein — provider not recorded';
 if(take.model==='product-safe')return 'Product-safe — original photograph + typography';
 if(take.model?.startsWith('klein'))return take.background?'Local Klein — generated background + original product':'Local Klein — generated campaign photograph';
 if(take.model==='qwen-fp8')return 'Local Qwen Image Edit';
 return take.model||'Provider not recorded';
}
export function GenerationDetails({service,take}:{service:JourneyService;take:HeroTake}){
 const [error,setError]=useState('');const scene=take.scene,cloud=scene?.transport==='comfy-cloud';
 const notes=scene?.framingQuality?.findings.filter(f=>f.code==='SUPPORT_REVIEW_REQUIRED')||[];
 return <details className="generation-details"><summary>Generation details</summary><dl>
 <div><dt>Engine</dt><dd>{generationProvider(take)}</dd></div>
 <div><dt>Created</dt><dd>{new Date(take.created).toLocaleString()}</dd></div>
 {take.jobId&&<div><dt>Native job</dt><dd className="receipt-value">{take.jobId}</dd></div>}
 <div><dt>Time</dt><dd>{take.seconds.toFixed(1)} seconds including preparation</dd></div>
 <div><dt>Cloud credits</dt><dd>{cloud?'Per-job charge not reported by the provider. Check your Comfy account.':take.model==='flux3-klein-scene'?'Unknown: historical provider was not recorded.':'No Comfy Cloud job for this result.'}</dd></div>
 {scene?.identityVerify&&<div><dt>Product check</dt><dd>{scene.identityVerify.verdict==='PASS_PENDING_OWNER'?'Measured geometry matched; compare count, packaging and details with your original.':scene.identityVerify.verdict}</dd></div>}
 {scene?.framingQuality&&<div><dt>Framing</dt><dd>{scene.framingQuality.verdict==='CONDITIONAL'?'Needs visual review':scene.framingQuality.verdict}{scene.framingQuality.findings.length>0&&<ul>{scene.framingQuality.findings.map((f,i)=><li key={i}>{f.message}</li>)}</ul>}</dd></div>}
 {scene?.letteringScan&&<div><dt>Photo lettering</dt><dd>{scene.letteringScan.verdict} — automatic check, not a guarantee</dd></div>}
 <div><dt>Output hash</dt><dd className="receipt-value">{take.sha256}</dd></div>
 </dl>{notes.length>0&&<p role="status">Review how the product meets its surface before publishing. The check has not established a floating-product defect.</p>}
 {scene&&<button className="quiet" onClick={()=>void previewBlob(service.app.store,take.assetId,take.sha256,true).then(b=>browserDownload(b,'raw-campaign-photograph.png')).catch(e=>setError(e.message))}>Download raw photograph ↓</button>}
 {error&&<p role="alert">{error}</p>}</details>;
}
