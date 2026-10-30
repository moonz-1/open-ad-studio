import {heroSource} from './hero-ad.ts';
import type {CreativePlan} from '../lib/creative-engine.ts';
import {buildCompositionPlan} from '../lib/composition-dynamics.ts';
import {buildProductIdentityProfile} from '../lib/product-identity-profile.ts';
import {verifyProductIdentity,searchFromFluxBBox} from '../lib/product-identity-verify.ts';
import {evaluateFramingQuality} from '../lib/framing-quality.ts';
import {dynamicsToFlux3Spatial} from '../lib/flux3-spatial.ts';
import {sceneDirection} from '../lib/ad-scene.ts';
import {scanPhotographLettering} from '../lib/photograph-lettering.ts';
export async function inspectScenePixels(outputs:string,plan:CreativePlan,image:string,output:string){
 const source=await heroSource(outputs,image),raw=await heroSource(outputs,output);if(source.sha256!==plan.input.source.sha256)throw Error('Inspection source differs from the reviewed product.');
 const dynamics=plan.dynamics||buildCompositionPlan(plan),foodIrregular=['cookies','cinnamon-rolls','bakery'].includes(plan.input.productType),identityProfile=buildProductIdentityProfile(source.bytes,{kind:'packshot',sha256:source.sha256,categoryHint:plan.input.productType,foodIrregular}),spatial=dynamicsToFlux3Spatial(dynamics,{environment:sceneDirection(plan).concept.environment,identity:identityProfile}),hero=spatial.elements.find(e=>e.id==='product_1')?.bbox;
 const identityVerify=verifyProductIdentity({referenceBytes:source.bytes,generatedBytes:raw.bytes,generatedSearch:searchFromFluxBBox(hero),categoryHint:plan.input.productType,foodIrregular});
 const framingQuality=evaluateFramingQuality(raw.bytes,{productScale:dynamics.layout?.productScale,framingMode:dynamics.layout?.framingMode||'full-product',productSafe:dynamics.layout?.productSafe,placementBias:dynamics.layout?.placementBias,categoryHint:plan.input.productType,intentionalCropRequested:dynamics.layout?.framingMode==='intentional-closeup'});
 const openField=dynamics.layout?.copySafe||{x:0.54,y:0.05,width:0.4,height:0.28};
 const letteringScan=await scanPhotographLettering(raw.bytes,{openField,productSafe:dynamics.layout?.productSafe});
 return {identityProfile,identityVerify,framingQuality,letteringScan,inspection:{method:'CPU pixel heuristics; not owner approval or inference proof',sourceSha256:source.sha256,outputSha256:raw.sha256},spatial};
}
