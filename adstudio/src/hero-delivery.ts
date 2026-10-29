import type {HeroResult} from '../../shared/runtime/client.ts';
import type {HeroSettings,HeroTake} from '../../shared/lib/hero-ad.ts';
import type {ProductAsset} from './projects.ts';
// Verify fetched raw bytes before admitting them into project history.
export async function heroTakeFromDelivery(result:HeroResult,asset:ProductAsset,settings:HeroSettings):Promise<HeroTake>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await asset.original.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(!/^\/outputs\/[a-f0-9]{16}\.png$/.test(result.url)||hash!==result.sha256||asset.width!==result.width||asset.height!==result.height)throw Error('Hero delivery failed byte/dimension verification. Original and history are unchanged.');
 if(settings.method==='reimagine'&&settings.imageModel==='qwen-fp8'&&(!result.jobId||!result.provenanceId||result.model!=='qwen-fp8'||result.sourceSha256!==settings.briefDraft?.input.source.sha256||result.originalSha256!==settings.briefDraft?.input.source.originalSha256))throw Error('Qwen provenance does not match the selected reviewed reference.');
 return {...result,id:crypto.randomUUID(),assetId:asset.id,created:Date.now(),settings:structuredClone(settings)};
}
