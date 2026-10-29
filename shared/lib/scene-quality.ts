import type {AdScene} from './ad-scene.ts';
export function sceneQualityBlocks(scene?:AdScene){
 const out:string[]=[];if(!scene)return out;
 if(scene.inspectionError)out.push('IMAGE_CHECK_UNAVAILABLE');
 if(scene.identityVerify){for(const f of scene.identityVerify.findings)if(f.severity==='block')out.push(f.category);if(scene.identityVerify.verdict==='FAIL'&&!out.length)out.push('IDENTITY_FAILED');}
 if(scene.framingQuality){for(const f of scene.framingQuality.findings)if(f.severity==='block')out.push(f.code);if(scene.framingQuality.verdict==='FAIL'&&!out.length)out.push('FRAMING_FAILED');}
 return [...new Set(out)];
}
export function assertSceneExportable(scene?:AdScene){const blocks=sceneQualityBlocks(scene);if(blocks.length)throw Error('Image needs correction before export: '+blocks.join(', ')+'. The raw result is saved. Use the original-photo design or revise the direction; typography and unrelated scores cannot clear this failure.');}
