import type {ProductIdentityProfile} from './product-identity-profile.ts';
export type {ProductIdentityProfile} from './product-identity-profile.ts';
export function identityConstraintLines(profile:ProductIdentityProfile):string[]{
 const g=profile.geometry;
 if(g.confidence<0.25||g.silhouetteClass==='unknown'){
  return [
   'Identity evidence is weak — do not invent product geometry. Prefer fidelity-constrained editing or exact source-pixel preservation over free restage.',
   'MISSING_IDENTITY_EVIDENCE: measured silhouette unavailable.'
  ];
 }
 const lines:string[]=[
  `Preserve the authentic product silhouette class (${g.silhouetteClass}) measured from the identity reference (aspect width/height ≈ ${g.aspectWH.toFixed(2)}, height/width ≈ ${g.aspectHW.toFixed(2)} at the reference viewpoint).`,
  'Changing camera framing or set is allowed; changing the physical product proportions is not.',
  'Do not stretch, elongate, compress or redesign the merchandise to fit a layout box.',
 ];
 if(g.silhouetteClass==='squat-wide'){
  lines.push('The reference product is SHORT and BROAD (wider than tall overall). Do not redesign it as a tall silhouette.');
  lines.push('Match the measured width-to-height relationship at the source viewpoint; do not infer hidden structure from a bounding box.');
 }
 if(g.silhouetteClass==='tall-narrow'){
  lines.push('The reference product is tall and relatively narrow. Preserve that upright proportion; do not squat or widen it arbitrarily.');
 }
 if(g.silhouetteClass==='compact-irregular'){
  lines.push('Preserve the observed compact irregular outline and surface; do not elongate or smooth it into generic stock geometry.');
 }
 if(profile.components.capHeightFraction!==undefined&&profile.components.confidence>=0.35){
  lines.push(`Preserve approximate cap-to-body height relationship (cap ≈ ${(profile.components.capHeightFraction*100).toFixed(0)}% of total product height in the reference view).`);
 }
 if(profile.materials.transparencyHint==='frosted-translucent'){
  lines.push('Maintain the visible reference surface character; do not substitute a different opacity or finish.');
 }
 lines.push('Identity-critical features: '+profile.identityCritical.join('; ')+'.');
 lines.push('Viewpoint limitation: '+profile.unknown.filter(u=>/Unseen|Perspective|viewpoint/i.test(u)||true).slice(0,2).join('; '));
 return lines;
}

/** Map measured silhouette into Flux spatial box family — never force tall boxes on squat products. */
export function silhouetteForSpatial(profile:ProductIdentityProfile|null|undefined):'general'|'tall-bottle'|'squat-bottle'|'compact-irregular'{
 if(!profile||profile.geometry.confidence<0.25)return 'general';
 const c=profile.geometry.silhouetteClass;
 if(c==='squat-wide')return 'squat-bottle';
 if(c==='tall-narrow')return 'tall-bottle';
 if(c==='compact-irregular')return 'compact-irregular';
 // Near-square overall but body wider than tall → still use squat boxes (cap-inflated height).
 if(c==='near-square'&&(profile.geometry.bodyAspectWH??profile.geometry.aspectWH)>=1.05)return 'squat-bottle';
 if(c==='near-square'&&profile.geometry.aspectWH>=0.95&&profile.geometry.aspectWH<1.05)return 'squat-bottle';
 return 'general';
}

export type HeroPlacementBias='lower-right'|'lower-left'|'lower-center'|'mid-left'|'center';

/** Build a hero bbox on the 0–1000 grid that respects measured aspect ratio.
 * Always insets enough margin that a full-product hero cannot sit on the canvas edge. */
export function identityAwareHeroBox(
 profile:ProductIdentityProfile,
 energy:'restrained'|'dynamic'|'balanced'='restrained',
 placement:HeroPlacementBias='lower-center'
):[number,number,number,number]{
 const aspectWH=Math.max(0.35,Math.min(2.8,profile.geometry.aspectWH));
 // Slightly smaller area + hard inset so FLUX guidance cannot hug the frame edge.
 const area=energy==='dynamic'?0.22:0.18;
 const hNorm=Math.sqrt(area/aspectWH);
 const wNorm=aspectWH*hNorm;
 let h=Math.round(hNorm*1000),w=Math.round(wNorm*1000);
 const inset=110; // ≥11% margin on each side of the guidance box
 const maxW=1000-2*inset,maxH=1000-inset-140;
 if(w>maxW){const s=maxW/w;w=maxW;h=Math.round(h*s);}
 if(h>maxH){const s=maxH/h;h=maxH;w=Math.round(w*s);}
 let left=
  placement==='lower-left'||placement==='mid-left'?inset+20:
  placement==='center'||placement==='lower-center'?Math.round((1000-w)/2):
  1000-w-inset;
 let top=
  placement==='mid-left'?Math.round((1000-h)*0.42):
  1000-h-(energy==='dynamic'?inset:inset+20);
 left=Math.max(inset,Math.min(left,1000-w-inset));
 top=Math.max(140,Math.min(top,1000-h-inset));
 // Comfy bbox [top,left,bottom,right]
 return [top,left,top+h,left+w];
}
