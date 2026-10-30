import type {AdScene} from './ad-scene.ts';
import {framingNeedsManualReview,manualFramingAccepted,manualFramingDecisionMatches} from './scene-framing-review.ts';
/** Independent defects remain non-overridable by a framing decision. */
export function sceneHardBlocks(scene?:AdScene){
 const out:string[]=[];if(!scene)return out;
 if(scene.inspectionError)out.push('IMAGE_CHECK_UNAVAILABLE');
 if(scene.identityVerify){const f=scene.identityVerify.findings.filter(f=>f.severity==='block');out.push(...f.map(f=>f.category));if(scene.identityVerify.verdict==='FAIL'&&!f.length)out.push('IDENTITY_FAILED');}
 if(scene.framingQuality){const f=scene.framingQuality.findings.filter(f=>f.severity==='block'&&f.code!=='WEAK_SEGMENTATION');out.push(...f.map(f=>f.code));if(scene.framingQuality.verdict==='FAIL'&&!f.length&&!framingNeedsManualReview(scene))out.push('FRAMING_FAILED');}
 if(scene.letteringScan){const f=scene.letteringScan.findings.filter(f=>f.severity==='block');out.push(...f.map(f=>f.code));if(scene.letteringScan.verdict==='FAIL'&&!f.length)out.push('SCENE_LETTERING_FAILED');}
 return [...new Set(out)];
}
export function sceneQualityBlocks(scene?:AdScene){
 const out=sceneHardBlocks(scene);
 if(manualFramingDecisionMatches(scene)&&scene?.manualFramingReview?.decision==='reject')out.push('PHOTO_REJECTED');
 else if(framingNeedsManualReview(scene)&&!manualFramingAccepted(scene))out.push('FRAMING_REVIEW_REQUIRED');
 return [...new Set(out)];
}
const plain:Record<string,string>={
 FRAMING_REVIEW_REQUIRED:'framing could not be measured; compare the saved photo with the original and choose Accept or Reject',
 PHOTO_REJECTED:'you rejected this saved photograph',
 IMAGE_CHECK_UNAVAILABLE:'the automatic product check could not run',
 GEOMETRY_MISMATCH:'the product shape differs from your photo',
 MATERIAL_MISMATCH:'the product colour or material differs from your photo',
 MISSING_IDENTITY_EVIDENCE:'the product could not be compared with your photo',
 IDENTITY_FAILED:'the product does not match your photo closely enough',
 PRODUCT_CLIPPED:'part of the product is cut off at the edge',
 INSUFFICIENT_MARGIN:'the product sits too close to the edge',
 PRODUCT_TOO_SMALL:'the product is too small in the frame',
 EXTREME_PLACEMENT:'the product is pushed into a corner',
 DISCONNECTED_SUPPORT:'the product does not appear to rest on a real surface',
 WEAK_SEGMENTATION:'the product cannot be told apart from the background',
 FRAMING_MODE_MISMATCH:'the framing does not match the chosen shot',
 UNSAFE_ALT_CROP:'other ad sizes would crop the product',
 FRAMING_FAILED:'the product is not framed well enough for an ad',
 OPEN_FIELD_LETTERING_SUSPECT:'the photo seems to contain invented lettering where your headline goes',
 SCENE_LETTERING_SUSPECT:'the photo seems to contain invented lettering',
 SCENE_LETTERING_FAILED:'the photo seems to contain invented lettering',
};
/** Customer wording for blocking checks; codes stay available via sceneQualityBlocks for diagnostics. */
export function sceneQualityExplanation(blocks:string[]){const reasons=[...new Set(blocks.map(b=>plain[b]||'an automatic product check did not pass'))];return reasons.length?reasons[0][0].toUpperCase()+reasons.join('; ').slice(1)+'.':'';}
export function assertSceneExportable(scene?:AdScene){const blocks=sceneQualityBlocks(scene);if(blocks.length===1&&blocks[0]==='FRAMING_REVIEW_REQUIRED')throw Error('Framing could not be verified automatically. The photograph is saved. Review it beside the original and accept or reject it; no new generation is needed.');if(blocks.length)throw Error('This photo is not ready for an ad: '+sceneQualityExplanation(blocks).replace(/^./,c=>c.toLowerCase())+' The photo is saved. Make a new take, or choose the original-photo design.');}
