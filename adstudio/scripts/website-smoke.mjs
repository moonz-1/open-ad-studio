// Explicit opt-in public, bounded read. Never imports into browser storage or
// publishes/downloads product images. Not the future owner's blind test.
import {researchBrand,collectBrandImage} from '../../shared/runtime/brand-research.ts';
import {newBrand,applyResearch,productImageChoices} from '../../shared/lib/brand.ts';
import {mkdir,writeFile} from 'node:fs/promises';
const i=process.argv.indexOf('--website');if(i<0)throw Error('Use --website <public URL> for a bounded read-only discovery smoke test.');
const started=Date.now(),out='outputs/website-first-readiness';await mkdir(out,{recursive:true});
try{const r=await researchBrand({website:process.argv[i+1],analyze:false},{}),b=applyResearch(newBrand(),r),products=b.products.map(p=>({name:p.name,sourceUrl:p.sourceUrl,method:p.discovery?.method,images:productImageChoices(b,p.id),sourceId:p.discovery?.sourceId}));
 const first=products.find(p=>p.images.length),verified=process.argv.includes('--verify-image')&&first?await collectBrandImage({url:first.images[0],productKey:b.products.find(p=>p.name===first.name&&p.sourceUrl===first.sourceUrl).discovery.key,research:r}):undefined;
 const result={status:products.filter(p=>p.images.length).length>=3?'PASS_DISTINCT_PUBLIC_PRODUCT_ASSOCIATIONS':'PARTIAL_DISCOVERY',website:r.website,pages:r.sources.map(s=>({url:s.url,sha256:s.sha256})),brand:b.dna.name,products,elapsedMs:Date.now()-started,warnings:r.warnings,imageBytesDownloaded:Boolean(verified),imageSavedOrPublished:false,imageCheck:verified?{sha256:verified.sha256,type:verified.contentType,sourceUrl:verified.sourceUrl,association:verified.association}:undefined,aiInference:false,blindTest:false};
 await writeFile(out+'/public-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await writeFile(out+'/public-smoke.json',JSON.stringify({status:'FAIL_PUBLIC_SITE_READ',website:process.argv[i+1],error:error.message,elapsedMs:Date.now()-started,imageBytesDownloaded:false,blindTest:false},null,2));throw error;}
