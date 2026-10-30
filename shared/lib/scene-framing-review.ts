import type {AdScene} from './ad-scene.ts';
export type ManualFramingReview={version:1;id:string;scope:'unmeasured-framing';decision:'accept'|'reject';at:number;decisionOrigin:'explicit-browser-action';automaticVerification:false;projectId:string;planId:string;preparedId:string;jobId:string;sourceSha256:string;originalSourceSha256:string;outputSha256:string;framingReportSha256:string;workflowSha256?:string};
/** Includes legacy saved FAIL reports whose only evidence was an unmeasurable silhouette. */
export function framingNeedsManualReview(scene?:AdScene){return !!scene?.framingQuality?.findings.some(f=>f.code==='WEAK_SEGMENTATION');}
export function manualFramingDecisionMatches(scene?:AdScene){const r=scene?.manualFramingReview;return !!scene&&!!r&&r.version===1&&r.scope==='unmeasured-framing'&&r.automaticVerification===false&&r.sourceSha256===scene.sourceSha256&&r.outputSha256===scene.sha256&&r.jobId===scene.jobId&&!!scene.inspection?.framingReportSha256&&r.framingReportSha256===scene.inspection.framingReportSha256;}
export function manualFramingAccepted(scene?:AdScene){return manualFramingDecisionMatches(scene)&&scene?.manualFramingReview?.decision==='accept';}
