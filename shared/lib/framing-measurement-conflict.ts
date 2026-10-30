/** Disagreement is uncertainty, never a framing PASS. Confirmed defects remain blockers. */
import type {FramingQualityReport} from './framing-quality.ts';
import type {IdentityVerifyReport} from './product-identity-verify.ts';
export function reconcileFramingMeasurements(report:FramingQualityReport,identity:IdentityVerifyReport):FramingQualityReport{
 const blocks=report.findings.filter(f=>f.severity==='block'),box=identity.generated?.geometry.bbox;
 if(report.verdict!=='FAIL'||report.framingMode!=='full-product'||!report.method.startsWith('Border-flood')||!report.measured||report.measured.confidence>.6||!blocks.length||blocks.some(f=>f.code!=='INSUFFICIENT_MARGIN'))return report;
 if(identity.verdict!=='PASS_PENDING_OWNER'||identity.findings.some(f=>f.severity==='block')||!box||!identity.generated||!identity.reference||(identity.reference.geometry.confidence??0)<.75||(identity.generated.geometry.confidence??0)<.5||identity.comparisons.aspectWH.relDelta>.04||!identity.comparisons.silhouette.match)return report;
 const margins={left:box.x,right:1-box.x-box.width,top:box.y,bottom:1-box.y-box.height};
 if(Object.values(margins).some(v=>v<.06)||!blocks.every(f=>f.edge&&margins[f.edge]-report.measured!.margins[f.edge]>=.04))return report;
 const reason='Independent pixel measurements disagree about the product boundary. Matching reference geometry is not proof of safe framing; compare the complete saved image before accepting.';
 return {...report,verdict:'UNSUPPORTED',publishable:false,measurementConflict:{originalVerdict:report.verdict,originalFindings:structuredClone(report.findings),originalNotes:[...report.notes],independentBbox:{...box},reason},findings:[...report.findings.map(f=>f.code==='INSUFFICIENT_MARGIN'?{...f,severity:'warn' as const,message:f.message+' The independent extent disagrees; this margin defect is unconfirmed.'}:f),{code:'WEAK_SEGMENTATION',severity:'warn',message:reason}],notes:[...report.notes.filter(n=>!n.startsWith('Framing/composition FAIL')),reason,'Neither requested layout boxes nor a geometry match automatically verify framing. Explicit human review is required.']};
}
