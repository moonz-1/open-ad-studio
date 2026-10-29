import {discoveryMethods,type ProductDiscovery} from './brand.ts';
// External origin is distinct from original input bytes and from reuse rights.
// These are user attestations, not a copyright or visual-recognition certificate.
export type WebsiteSource={kind:'website';requestedUrl:string;url:string;pageUrl:string;pageSha256:string;researchPageSha256:string;discoveryKey:string;association:ProductDiscovery['method'];brandId:string;productId:string;originalSha256:string;normalizedSha256:string;contentType:string;downloadedAt:number;accuracyConfirmed:boolean;permissionConfirmed:boolean;confirmedAt?:number};
const url=(v:unknown)=>{try{const u=new URL(String(v));return typeof v==='string'&&v.length<=2048&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
export function validateWebsiteSource(p:WebsiteSource,expected:{originalSha256:string;sha256:string;brandId?:string;productId?:string},requireUse=false){
 if(!p||p.kind!=='website'||!discoveryMethods.includes(p.association)||![p.url,p.requestedUrl,p.pageUrl].every(url)||![p.pageSha256,p.researchPageSha256,p.originalSha256,p.normalizedSha256].every(s=>/^[a-f0-9]{64}$/.test(s))||![p.discoveryKey,p.brandId,p.productId].every(s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(s))||!['image/png','image/jpeg','image/webp'].includes(p.contentType)||!Number.isFinite(p.downloadedAt)||typeof p.accuracyConfirmed!=='boolean'||typeof p.permissionConfirmed!=='boolean'||p.confirmedAt!==undefined&&!Number.isFinite(p.confirmedAt))throw Error('Invalid website photograph provenance. Keep the original and import again.');
 if(p.originalSha256!==expected.originalSha256||p.normalizedSha256!==expected.sha256||expected.brandId&&p.brandId!==expected.brandId||expected.productId&&p.productId!==expected.productId)throw Error('Website photograph belongs to a different source, brand or product. Select its matching product.');
 if(p.accuracyConfirmed&&p.permissionConfirmed&&(!Number.isFinite(p.confirmedAt)||p.confirmedAt!<=0))throw Error('Website photograph confirmation has no valid saved timestamp. Confirm it again.');
 if(requireUse&&(!p.accuracyConfirmed||!p.permissionConfirmed))throw Error('Confirm the pictured product and your permission to use this website photograph before review, generation or export.');
 return p;
}
