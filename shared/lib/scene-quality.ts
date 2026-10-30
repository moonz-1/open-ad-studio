import type {AdScene} from './ad-scene.ts';
export function sceneQualityBlocks(scene?:AdScene){
 const out:string[]=[];if(!scene)return out;
 if(scene.inspectionError)out.push('IMAGE_CHECK_UNAVAILABLE');
 if(scene.identityVerify){for(const f of scene.identityVerify.findings)if(f.severity==='block')out.push(f.category);if(scene.identityVerify.verdict==='FAIL'&&!out.length)out.push('IDENTITY_FAILED');}
 if(scene.framingQuality){for(const f of scene.framingQuality.findings)if(f.severity==='block')out.push(f.code);if(scene.framingQuality.verdict==='FAIL'&&!out.length)out.push('FRAMING_FAILED');}
 if((scene as any).letteringScan){const ls=(scene as any).letteringScan,before=out.length;for(const f of ls.findings||[])if(f.severity==='block')out.push(f.code);if(ls.verdict==='FAIL'&&out.length===before)out.push('SCENE_LETTERING_FAILED');}
 return [...new Set(out)];
}
const plain:Record<string,string>={
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
export function assertSceneExportable(scene?:AdScene){const blocks=sceneQualityBlocks(scene);if(blocks.length)throw Error('This photo is not ready for an ad: '+sceneQualityExplanation(blocks).replace(/^./,c=>c.toLowerCase())+' The photo is saved. Make a new take, or choose the original-photo design.');}
