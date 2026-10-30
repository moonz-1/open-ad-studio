// Brand Intelligence V1: portable data only; no UI, inference or storage side effects.
export const dnaFields=['name','description','story','positioning','tone','visualStyle','audience','differentiators','guidelines'] as const;
export type DNAField=typeof dnaFields[number];
export const brandFields=[...dnaFields,'messaging','creativePreferences'] as const;
export type BrandField=typeof brandFields[number];
export type BrandDNA=Record<DNAField,string>&Partial<Record<'messaging'|'creativePreferences',string>>;
export const discoveryMethods=['json-ld','microdata','product-link','product-metadata','product-card','item-list','storefront-data'] as const;
export type ProductDiscovery={key:string;sourceId:string;linked?:boolean;method:typeof discoveryMethods[number];imageUrls:string[]};
export type ProductEvidence={scope?:'detail'|'catalog';warning?:string;version:1;productKey:string;url:string;title:string;text:string;sha256:string;fetchedAt:number};
export type BrandProduct={evidence?:ProductEvidence;id:string;name:string;description:string;sellingPoints:string;sourceUrl?:string;imageIds:string[];discovery?:ProductDiscovery;overrides?:('name'|'description'|'sellingPoints')[]};
export type BrandAsset={id:string;name:string;role:'logo'|'product'|'reference';productId?:string;assetId:string;sourceUrl?:string};
export type BrandSource={id:string;url:string;title:string;text:string;sha256:string;fetchedAt:number};
export type BrandObservation={field:string;value:string;kind:'source'|'inference';sourceIds:string[];quote?:string};
export type BrandImage={url:string;alt:string;role:'logo'|'product'|'reference';sourceId:string;productKeys?:string[]};
export type AnalysisProvider={provider:'ollama'|'comfy-qwen3'|'none';available:boolean;model?:string;digest?:string;reason:string};
export type WebsiteColor={hex:string;count:number;contexts:string[];neutral:boolean};
export type ImagePalette={kind:'overall-image';method:'local-rgb-histogram-v1';colors:string[];sampledPixels:number};
export type BrandPalette={approved:string[];preferred:string[]};
export type CatalogCoverage={found:number;linked:number;withImages:number;rejected:number;duplicates:number;pages:number;bytes:number;partial:boolean;reasons:string[];methods:Record<string,number>;durationMs:number;advertisedCount?:number};
export type BrandResearch={version:1;identity?:{name:string;url:string};catalogSources?:BrandSource[];catalog?:CatalogCoverage;analysisKey?:string;analysisFingerprint?:string;analysisMs?:number;website:string;aliases?:string[];created:number;sources:BrandSource[];observations:BrandObservation[];images:BrandImage[];colors:string[];websiteColors?:WebsiteColor[];products:Omit<BrandProduct,'id'|'imageIds'>[];provider:AnalysisProvider;warnings:string[];aiCompleted:boolean;analysisRaw?:string;analysisState?:'pending'|'completed'|'unavailable'|'failed'};
export type BrandProfile={version:1;id:string;created:number;updated:number;website:string;aliases?:string[];dna:BrandDNA;colors:string[];palette?:BrandPalette;approvedFields?:string[];products:BrandProduct[];assets:BrandAsset[];overrides:string[];research?:BrandResearch;reviewedAt?:number};
export const emptyDNA=():BrandDNA=>Object.fromEntries(dnaFields.map(k=>[k,''])) as BrandDNA;
export function brandFieldStatus(brand:BrandProfile,field:BrandField){if(!brand.dna[field]?.trim())return 'missing';if(brand.overrides.includes(field))return brand.reviewedAt?'reviewed':'user';const observation=brand.research?.observations.find(o=>o.field===field&&o.value===brand.dna[field]);if(observation?.kind==='inference')return 'inferred';if(observation?.kind==='source')return brand.reviewedAt?'reviewed':'source';return 'user';}
export function newBrand(name=''):BrandProfile{const now=Date.now();return {version:1,id:crypto.randomUUID(),created:now,updated:now,website:'',dna:{...emptyDNA(),name},colors:[],products:[],assets:[],overrides:[]};}
export function publicLink(value:unknown){if(typeof value!=='string'||value.length>2048)return false;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export function validateResearch(value:unknown):BrandResearch{
 const r=value as BrandResearch,fail=()=>{throw Error('Invalid brand research. Previous evidence was kept.');};
 if(!r||r.version!==1||!publicLink(r.website)||!Array.isArray(r.sources)||!r.sources.length||r.sources.length>4||!Array.isArray(r.observations)||r.observations.length>30||!Array.isArray(r.images)||r.images.length>40||!Array.isArray(r.products)||r.products.length>40||!Array.isArray(r.colors)||r.colors.some(c=>!/^#[a-f0-9]{6}$/i.test(c))||typeof r.aiCompleted!=='boolean'||!r.provider||!['none','ollama','comfy-qwen3'].includes(r.provider.provider)||typeof r.provider.reason!=='string'||!Array.isArray(r.warnings)||r.warnings.some(w=>typeof w!=='string'))return fail();
 if(r.analysisKey&&!/^[a-f0-9]{64}$/.test(r.analysisKey)||r.analysisFingerprint&&!/^[a-f0-9]{64}$/.test(r.analysisFingerprint)||r.analysisMs!==undefined&&(!Number.isFinite(r.analysisMs)||r.analysisMs<0))return fail();
 if(r.identity&&(!publicLink(r.identity.url)||typeof r.identity.name!=='string'||r.identity.name.length>200))return fail();
 if(r.catalogSources&&(!Array.isArray(r.catalogSources)||r.catalogSources.length>4||r.catalogSources.some(s=>s.text!=='')))return fail();
 if(r.catalog&&(['found','linked','withImages','rejected','duplicates','pages','bytes','durationMs'].some(k=>!Number.isFinite((r.catalog as any)[k])||(r.catalog as any)[k]<0)||typeof r.catalog.partial!=='boolean'||!Array.isArray(r.catalog.reasons)||r.catalog.reasons.some(x=>typeof x!=='string')||!r.catalog.methods||Object.entries(r.catalog.methods).some(([k,v])=>!discoveryMethods.includes(k as any)||!Number.isInteger(v)||v<0||v>40)))return fail();
 if(r.aliases&&(!Array.isArray(r.aliases)||r.aliases.length>12||r.aliases.some(u=>!publicLink(u))))return fail();
 if(r.analysisRaw!==undefined&&(typeof r.analysisRaw!=='string'||r.analysisRaw.length>10000))return fail();
 if(r.analysisState&&!['pending','completed','unavailable','failed'].includes(r.analysisState))return fail();
 if(r.websiteColors&&(!Array.isArray(r.websiteColors)||r.websiteColors.length>12||r.websiteColors.some(c=>!/^#[a-f0-9]{6}$/i.test(c.hex)||!Number.isInteger(c.count)||c.count<1||!Array.isArray(c.contexts)||c.contexts.some(s=>typeof s!=='string'||s.length>80)||typeof c.neutral!=='boolean')))return fail();
 const ids=new Set<string>();for(const s of researchSources(r)){if(!s||typeof s.id!=='string'||ids.has(s.id)||!publicLink(s.url)||typeof s.title!=='string'||typeof s.text!=='string'||s.text.length>20000||! /^[a-f0-9]{64}$/i.test(s.sha256))return fail();ids.add(s.id);}
 if(r.observations.some(o=>!o||typeof o.field!=='string'||typeof o.value!=='string'||o.value.length>5000||!['source','inference'].includes(o.kind)||!Array.isArray(o.sourceIds)||!o.sourceIds.length||o.sourceIds.some(id=>!ids.has(id))))return fail();
 if(r.images.some(i=>!i||!publicLink(i.url)||typeof i.alt!=='string'||!['logo','product','reference'].includes(i.role)||!ids.has(i.sourceId)))return fail();
 if(r.products.some(p=>p.discovery&&(!validDiscovery(p.discovery)||!ids.has(p.discovery.sourceId)||p.discovery.imageUrls.some(url=>!r.images.some(i=>i.url===url&&i.role==='product'&&i.productKeys?.includes(p.discovery!.key))))))return fail();
 if(r.images.some(i=>i.productKeys&&(!Array.isArray(i.productKeys)||i.productKeys.some(key=>!r.products.some(p=>p.discovery?.key===key&&p.discovery.imageUrls.includes(i.url))))))return fail();
 if(r.products.some(p=>!p||typeof p.name!=='string'||p.name.length>200||typeof p.description!=='string'||p.description.length>5000||typeof p.sellingPoints!=='string'||p.sellingPoints.length>5000||(p.sourceUrl&&!publicLink(p.sourceUrl))))return fail();
 return r;
}
export function validProductEvidence(e:ProductEvidence){return !!e&&(!e.scope||['detail','catalog'].includes(e.scope))&&(!e.warning||typeof e.warning==='string'&&e.warning.length<=400)&&e.version===1&&typeof e.productKey==='string'&&/^[a-f0-9]{16}$/.test(e.productKey)&&publicLink(e.url)&&typeof e.title==='string'&&e.title.length<=300&&typeof e.text==='string'&&e.text.length>=12&&e.text.length<=4000&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isFinite(e.fetchedAt);}
export function validateBrand(value:unknown):BrandProfile{
 const b=value as BrandProfile,fail=()=>{throw Error('Invalid brand profile. Existing data was not overwritten.');};
 if(!b||b.version!==1||typeof b.id!=='string'||!b.id||!b.dna||typeof b.website!=='string'||(b.website&&!publicLink(b.website)))return fail();
 for(const field of dnaFields)if(typeof b.dna[field]!=='string'||b.dna[field].length>(field==='name'?120:5000))return fail();
 for(const f of ['messaging','creativePreferences'] as const)if(b.dna[f]!==undefined&&(typeof b.dna[f]!=='string'||b.dna[f]!.length>5000))return fail();
 if(b.aliases&&(!Array.isArray(b.aliases)||b.aliases.length>12||b.aliases.some(u=>!publicLink(u))))return fail();
 if(b.approvedFields&&(!Array.isArray(b.approvedFields)||b.approvedFields.some(f=>!brandFields.includes(f as BrandField))))return fail();
 if(b.palette&&(!validColors(b.palette.approved)||!validColors(b.palette.preferred)||b.palette.preferred.some(c=>!b.palette!.approved.includes(c))))return fail();
 if(!Array.isArray(b.colors)||b.colors.length>12||b.colors.some(c=>!/^#[a-f0-9]{6}$/i.test(c))||!Array.isArray(b.products)||b.products.length>100||!Array.isArray(b.assets)||b.assets.length>150||!Array.isArray(b.overrides)||b.overrides.some(s=>typeof s!=='string'))return fail();
 const ids=new Set<string>();for(const p of b.products){if(p.evidence&&!validProductEvidence(p.evidence)||p.discovery&&!validDiscovery(p.discovery)||p.overrides&&(!Array.isArray(p.overrides)||p.overrides.some(k=>!['name','description','sellingPoints'].includes(k))))return fail();if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||p.name.length>200||typeof p.description!=='string'||p.description.length>5000||typeof p.sellingPoints!=='string'||p.sellingPoints.length>5000||!Array.isArray(p.imageIds)||p.imageIds.some(id=>typeof id!=='string')||(p.sourceUrl&&!publicLink(p.sourceUrl)))return fail();ids.add(p.id);}
 const assets=new Set<string>();for(const a of b.assets){if(!a||typeof a.id!=='string'||assets.has(a.id)||typeof a.assetId!=='string'||!a.assetId||typeof a.name!=='string'||!['logo','product','reference'].includes(a.role)||(a.productId&&!ids.has(a.productId))||(a.sourceUrl&&!publicLink(a.sourceUrl)))return fail();assets.add(a.id);}
 if(b.products.some(p=>p.imageIds.some(id=>!assets.has(id))))return fail();
 if(b.research)validateResearch(b.research);
 return b;
}
// Re-research never silently erases customer corrections or their product/photo records.
export function applyResearch(brand:BrandProfile,research:BrandResearch){
 validateResearch(research);const previousResearch=brand.research;
 brand.website=research.website;brand.aliases=[...new Set([...(brand.aliases||[]),...(research.aliases||[]),research.website])].slice(-12);brand.research=research;delete brand.reviewedAt;
 for(const field of brandFields){if(brand.overrides.includes(field)||brand.approvedFields?.includes(field))continue;const found=research.observations.find(o=>o.field===field);if(dnaFields.includes(field as DNAField)||found||brand.dna[field]!==undefined)brand.dna[field]=found?.value||'';}
 if(!brand.overrides.includes('colors'))brand.colors=[...research.colors];
 for(const p of research.products){const existing=brand.products.find(x=>p.discovery&&x.discovery?.key===p.discovery.key||x.sourceUrl&&x.sourceUrl===p.sourceUrl&&/\/products?\//.test(x.sourceUrl)||x.name.toLowerCase()===p.name.toLowerCase()&&(!x.sourceUrl||x.sourceUrl===p.sourceUrl));if(existing){if(p.discovery)existing.discovery=structuredClone(p.discovery);for(const k of ['name','description','sellingPoints'] as const){if(existing.overrides?.includes(k))continue;const previous=previousResearch?.products.find(x=>x.sourceUrl===existing.sourceUrl||x.discovery?.key===existing.discovery?.key);if(previous&&existing[k]===previous[k])existing[k]=p[k];else if(existing[k]!==p[k])existing.overrides=[...new Set([...(existing.overrides||[]),k])];}}else if(brand.products.length<100)brand.products.push({...structuredClone(p),id:crypto.randomUUID(),imageIds:[]});}
 return validateBrand(brand);
}
// Explicit reviewed snapshot for Composer/future generation. Hypotheses stay labeled.
export function brandContext(brand:BrandProfile,productIds:string[]=[]){validateBrand(brand);return {version:1 as const,brandId:brand.id,revision:brand.updated,reviewed:Boolean(brand.reviewedAt),identity:{...brand.dna},colors:advertisingColors(brand),products:brand.products.filter(p=>!productIds.length||productIds.includes(p.id)).map(p=>({...p,images:brand.assets.filter(a=>p.imageIds.includes(a.id)).map(a=>({assetId:a.assetId,sourceUrl:a.sourceUrl}))})),logoAssetIds:brand.assets.filter(a=>a.role==='logo').map(a=>a.assetId),inferredFields:brand.research?.observations.filter(o=>o.kind==='inference'&&!brand.overrides.includes(o.field)).map(o=>o.field)||[]};}

const validColors=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=12&&v.every(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c))&&new Set(v).size===v.length;
// Legacy profiles retain their rendering; new approval preferences are explicit.
export function advertisingColors(b:BrandProfile){return [...(b.palette?(b.palette.preferred.length?b.palette.preferred:b.palette.approved):b.colors)];}
export function editBrandField(b:BrandProfile,f:BrandField,value:string){b.dna[f]=value;b.overrides=[...new Set([...b.overrides,f])];b.approvedFields=b.approvedFields?.filter(k=>k!==f);delete b.reviewedAt;}
export function detectedValue(b:BrandProfile,f:BrandField){return b.research?.observations.find(o=>o.field===f)?.value;}
export function restoreBrandField(b:BrandProfile,f:BrandField){const value=detectedValue(b,f);if(value===undefined)return;b.dna[f]=value;b.overrides=b.overrides.filter(k=>k!==f);b.approvedFields=b.approvedFields?.filter(k=>k!==f);delete b.reviewedAt;}
export function approveBrandField(b:BrandProfile,f:BrandField){b.approvedFields=[...new Set([...(b.approvedFields||[]),f])];}
export function websiteIdentity(value:string){try{const u=new URL(value.includes('://')?value:'https://'+value);u.hash='';return u.href.replace(/\/$/,'');}catch{return value.trim();}}
export function canonicalAliasAllowed(from:string,to:string){
 const a=new URL(from),b=new URL(to);if(a.origin!==b.origin)return false;
 const route=(u:URL)=>{const p=u.pathname.replace(/\/$/,'');return ['','/index.html','/index.php','/home'].includes(p)?'/':p;};
 const query=(u:URL)=>{const params=new URLSearchParams(u.search);for(const k of [...params.keys()])if(/^utm_|^(?:gclid|fbclid|msclkid)$/i.test(k))params.delete(k);params.sort();return params.toString();};
 return route(a)===route(b)&&query(a)===query(b);
}
// Tenant/query boundaries are not folded merely because the host is shared.
function businessScope(value:string){const u=new URL(value),m=u.pathname.match(/^\/(?:stores|shops|brands|vendors|businesses)\/[^/]+/i),q=new URLSearchParams(u.search);for(const k of [...q.keys()])if(/^utm_|^(?:page|gclid|fbclid)$/i.test(k))q.delete(k);q.sort();return u.origin+(m?.[0]||'')+'?'+q;}
export function matchesWebsite(b:BrandProfile,r:BrandResearch){
 const source=(research:BrandResearch|undefined,f:string)=>research?.observations.find(o=>o.field===f&&o.kind==='source')?.value.trim().toLowerCase().replace(/\s+/g,' '),oldName=source(b.research,'name'),name=source(r,'name');
 if(oldName&&name&&oldName!==name)return false; // Changed business, not a customer name correction.
 if(websiteIdentity(b.website)===websiteIdentity(r.website))return true;
 if(!b.website)return false;
 const sameOrigin=new URL(b.website).origin===new URL(r.website).origin,oldIdentity=b.research?.identity,newIdentity=r.identity,sameScope=businessScope(b.website)===businessScope(r.website);
 if(sameOrigin&&sameScope&&oldName&&oldName===name&&newIdentity&&new URL(newIdentity.url).origin===new URL(r.website).origin){if(oldIdentity&&websiteIdentity(oldIdentity.url)===websiteIdentity(newIdentity.url))return true;if(!oldIdentity&&source(b.research,'description')&&source(b.research,'description')===source(r,'description'))return true;
  // Legacy profiles predate Organization URL storage. Only a matching distinctive
  // sourced site name + a newly proven business root + catalog/root relationship
  // can bridge their page-specific descriptions. Never fold arbitrary host paths.
  if(!oldIdentity&&!/^(?:shop|store|home|website|brand)(?: us| uk)?$/i.test(oldName)&&businessScope(newIdentity.url)===businessScope(r.website)){
   const business=new URL(newIdentity.url),prefix=business.pathname.replace(/\/$/,''),within=(value:string)=>{const u=new URL(value);if(!u.pathname.startsWith(prefix+'/')&&u.pathname!==prefix)return false;const relative=u.pathname.slice(prefix.length)||'/';return relative==='/'||/^\/(?:collections|products?|catalog|shop)(?:\/|$)/i.test(relative);};
   if(within(b.website)&&within(r.website)&&(websiteIdentity(b.website)===websiteIdentity(newIdentity.url)||websiteIdentity(r.website)===websiteIdentity(newIdentity.url)))return true;
  }}
 if(sameOrigin&&!sameScope)return false;
 if(sameOrigin&&oldIdentity&&newIdentity&&websiteIdentity(oldIdentity.url)!==websiteIdentity(newIdentity.url))return false;
 const overlap=[b.website,...(b.aliases||[])].some(u=>[r.website,...(r.aliases||[])].some(v=>websiteIdentity(u)===websiteIdentity(v)));
 // A redirect/canonical hint alone must not relabel another saved business.
 return overlap&&!!oldName&&!/^(?:shop|store|home|website|brand)(?: us| uk)?$/i.test(oldName)&&oldName===name&&!!source(b.research,'description')&&source(b.research,'description')===source(r,'description');
}
// Apply only explicitly changed draft fields to the newest stored profile.
// A photo import/rediscovery during editing must not remove new evidence/assets.
export function mergeBrandDraft(base:BrandProfile,draft:BrandProfile,current:BrandProfile){
 if(base.id!==draft.id||current.id!==draft.id)throw Error('Brand changed. Open its saved profile again.');const next=structuredClone(current);
 for(const f of brandFields)if(base.dna[f]!==draft.dna[f]||base.overrides.includes(f)!==draft.overrides.includes(f)||Boolean(base.approvedFields?.includes(f))!==Boolean(draft.approvedFields?.includes(f))){next.dna[f]=draft.dna[f]||'';next.overrides=next.overrides.filter(k=>k!==f);if(draft.overrides.includes(f))next.overrides.push(f);next.approvedFields=next.approvedFields?.filter(k=>k!==f)||[];if(draft.approvedFields?.includes(f))next.approvedFields.push(f);}
 if(JSON.stringify(base.palette)!==JSON.stringify(draft.palette))next.palette=structuredClone(draft.palette);
 for(const p of draft.products){const before=base.products.find(x=>x.id===p.id),target=next.products.find(x=>x.id===p.id);if(!before||!target)continue;for(const f of ['name','description','sellingPoints'] as const)if(before[f]!==p[f]||Boolean(before.overrides?.includes(f))!==Boolean(p.overrides?.includes(f))){target[f]=p[f];target.overrides=target.overrides?.filter(k=>k!==f)||[];if(p.overrides?.includes(f))target.overrides.push(f);}}
 return validateBrand(next);
}

function validDiscovery(d:ProductDiscovery){return d&&(d.linked===undefined||typeof d.linked==='boolean')&&typeof d.key==='string'&&/^[a-f0-9]{16}$/.test(d.key)&&typeof d.sourceId==='string'&&discoveryMethods.includes(d.method)&&Array.isArray(d.imageUrls)&&d.imageUrls.length<=3&&d.imageUrls.every(publicLink);}
// Only explicit, uniquely associated raster candidates are automatic imports.
export function productImageChoices(b:BrandProfile,productId:string){const p=b.products.find(p=>p.id===productId),d=p?.discovery,r=b.research;if(!d||!r)return [];return d.imageUrls.filter(url=>r.images.some(i=>i.url===url&&i.role==='product'&&i.sourceId===d.sourceId&&i.productKeys?.length===1&&i.productKeys[0]===d.key)&&r.products.some(p=>p.discovery?.key===d.key&&p.discovery.imageUrls.includes(url)));}

// Send only the selected relationship, not every collected page/body. The server
// independently checks the current public DOM and never trusts this as proof.
export function researchSources(r:BrandResearch){return [...r.sources,...(r.catalogSources||[])];}
export function productImageProof(b:BrandProfile,productId:string,url:string):BrandResearch{
 if(!productImageChoices(b,productId).includes(url))throw Error('No unique product/image relationship.');
 const r=b.research!,d=b.products.find(p=>p.id===productId)!.discovery!,product=r.products.find(p=>p.discovery?.key===d.key)!,source=researchSources(r).find(s=>s.id===d.sourceId)!,image=r.images.find(i=>i.url===url)!;
 return {version:1,website:r.website,created:r.created,sources:[{...source,text:''}],observations:[],products:[{...product,discovery:{...product.discovery!,imageUrls:[url]}}],images:[image],colors:[],warnings:[],provider:{provider:'none',available:false,reason:'Image relationship proof only; no inference requested.'},aiCompleted:false};
}
