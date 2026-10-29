/** Measurable product-fidelity checks. Generative restage never counts as locked. */
import type {AdScene} from './ad-scene.ts';

export type ProductFidelityReport={
 productLocked:boolean;
 mode:AdScene['fidelityMode']|'unknown';
 model:string;
 reason:string;
 hasCutout:boolean;
 sourceSha256?:string;
};

export function productFidelityReport(scene:Pick<AdScene,'model'|'fidelityMode'|'cutout'|'sourceSha256'|'warning'>| {model?:string;fidelityMode?:AdScene['fidelityMode'];cutout?:AdScene['cutout'];sourceSha256?:string;warning?:string}):ProductFidelityReport{
 const model=String(scene.model||'unknown');
 const hasCutout=!!scene.cutout?.sha256;
 const mode=scene.fidelityMode||(model==='klein-scene'?'creative-restage':model==='editorial-original'||model==='klein-integrated'||model==='klein-harmonized'?'product-fidelity':'unknown');
 if(model==='klein-scene'||model==='flux3-klein-scene'||mode==='creative-restage'){
  return {productLocked:false,mode,model,hasCutout:false,sourceSha256:scene.sourceSha256,reason:'Creative Restage redraws the product. It cannot certify count, packaging or geometry.'};
 }
 if(model==='editorial-original'){
  return {productLocked:true,mode:mode==='unknown'?'product-fidelity':mode,model,hasCutout:false,sourceSha256:scene.sourceSha256,reason:'Original photograph is used directly at its native viewpoint; no cutout restaging.'};
 }
 if(model==='klein-integrated'||model==='product-safe'||model==='klein-background'){
  return {productLocked:true,mode:mode==='unknown'?'product-fidelity':mode,model,hasCutout,sourceSha256:scene.sourceSha256,reason:hasCutout?'Original product pixels were isolated and composited into a generated set. Inspect matte edges before publishing.':'Original photograph is used directly in the advertisement layout.'};
 }
 if(model==='klein-harmonized'){
  return {productLocked:!!hasCutout,mode:'hybrid-harmonize',model,hasCutout,sourceSha256:scene.sourceSha256,reason:hasCutout?'Hybrid harmonize may soften edges after cutout compositing. Compare with the original; packaging may shift slightly.':'Harmonized output without a retained cutout cannot certify product lock.'};
 }
 return {productLocked:false,mode,model,hasCutout,sourceSha256:scene.sourceSha256,reason:scene.warning||'Product fidelity is unverified for this delivery.'};
}

/** Journey/video gates: only product-locked stills may drive motion spend. */
export function allowsProductMotion(scene:Pick<AdScene,'model'|'fidelityMode'|'cutout'|'sourceSha256'|'warning'>|undefined){
 if(!scene)return false;
 return productFidelityReport(scene).productLocked;
}
