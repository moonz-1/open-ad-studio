import {useEffect,useState,type FormEvent} from 'react';
import {BrandUnderstanding} from './brand-understanding.tsx';
import {savedBrand,websiteKey,type AdApplication} from '../ad-application.ts';
import {productImageChoices,type BrandProfile,type BrandProduct} from '../../../shared/lib/brand.ts';
import type {WebsiteSource} from '../../../shared/lib/source-provenance.ts';
export function WebsiteOnboarding({app,brand,projectId,address,disabled}:{app:AdApplication;brand?:BrandProfile;projectId:string;address:string;disabled:boolean}){
 const project=app.store.getSnapshot().projects.find(p=>p.id===projectId),previous=project?savedBrand(project,app.store.getSnapshot().brands):undefined,request=app.websiteDiscovery(projectId),discovering=request?.state==='loading'&&websiteKey(request.url)===websiteKey(address);
 const [limit,setLimit]=useState(6);useEffect(()=>setLimit(6),[brand?.id]);
 const act=(work:()=>Promise<unknown>)=>void work().catch(e=>app.store.report(e));
 function submit(e:FormEvent){e.preventDefault();act(()=>app.discoverWebsite(address));}
 return <section className="website-onboarding" aria-label="Discover your business from its website">
  {app.store.getSnapshot().brands.some(b=>b.website)&&<label>Saved websites<select aria-label="Saved websites" disabled={disabled||discovering} value={brand?.id||''} onChange={e=>{if(e.target.value)act(()=>app.openWebsite(e.target.value));}}><option value="">Choose a saved website</option>{app.store.getSnapshot().brands.filter(b=>b.website).map(b=><option key={b.id} value={b.id}>{b.dna.name||b.website} - {b.website}</option>)}</select></label>}
  <form onSubmit={submit}><label>Business website<input type="text" inputMode="url" autoCapitalize="off" value={address} maxLength={2048} disabled={disabled} placeholder="https://your-business.com" onChange={e=>act(()=>app.editWebsite(e.target.value))}/></label><button className="primary" type="submit" disabled={disabled||!address.trim()||discovering}>Discover brand & products <span>↗</span></button></form>
  <p className="quiet-note">Public website only. Existing work opens separately when you research another business. Or enter your brand and upload a photograph below.</p>
  {discovering&&<p role="status" className="quiet-note">Collecting website and product evidence. Previous website results are kept separately.</p>}
  {!brand&&address&&<p className="quiet-note">Discover this website to select its products. No previous brand or photograph will be used.</p>}
  {!brand&&previous&&<button className="text-button" disabled={disabled} onClick={()=>act(()=>app.useBrand(previous.id))}>Return to saved {previous.dna.name||'brand'}</button>}
  {!brand&&!previous&&address&&<button className="text-button" disabled={disabled} onClick={()=>act(()=>app.editWebsite(''))}>Start manually without a website</button>}
  {brand?.research&&<>
   <div className="section-label"><h2>{brand.dna.name||'Discovered website'}</h2><span>{brand.products.length} products</span></div>
   {brand.research.catalog&&<p className="quiet-note" role="status">{brand.research.catalog.found} products found; {brand.research.catalog.withImages} with uniquely associated photographs. {brand.research.catalog.partial?'More may be available.':'Public records only; inventory completeness is not confirmed.'}</p>}
   {brand.products.length===0&&<div className="empty-products" role="status"><p><strong>No sellable products found on this website.</strong> Access may be restricted, or the site does not expose public product records we can defend.</p><p>Continue with an authorized product photograph below: add the product name, optional description and source URL, then use Generate ad with Product-safe design.</p>{brand.research.warnings.slice(0,3).map((w,i)=><p key={i} className="quiet-note">{w}</p>)}</div>}
   <p className="quiet-note">{brand.research.aiCompleted?'AI hypotheses are labeled in Brand profile.':'Website evidence collected · no AI brand analysis claimed.'}</p>
   <BrandUnderstanding key={brand.id} app={app} brand={brand} disabled={disabled||!!discovering}/>
   {brand.products.length>0&&<div className="website-products" aria-label="Discovered products">{brand.products.slice(0,limit).map(product=><WebsiteProduct key={brand.id+product.id} app={app} brand={brand} product={product} disabled={disabled} projectId={projectId}/>)}</div>}
   {brand.products.length>limit&&<button className="text-button" disabled={disabled} onClick={()=>setLimit(n=>n+6)}>Show more products</button>}
   <details className="inspection"><summary>Website evidence & limitations</summary><p>Descriptions and positioning are website statements. AI tone/style suggestions are labeled as hypotheses, not verified visual understanding. CSS colors are candidates, not confirmed brand preferences. Text planning does not see your photograph.</p>{brand.research.catalog&&<p>Discovery: {brand.research.catalog.pages} pages, {(brand.research.catalog.durationMs/1000).toFixed(1)} s. Methods: {Object.entries(brand.research.catalog.methods).map(([k,v])=>k+': '+v).join(', ')}. Limits: {brand.research.catalog.reasons.join('; ')||'none reached'}. Rejected candidates: {brand.research.catalog.rejected}.</p>}{brand.research.warnings.map((w,i)=><p key={i}>{w}</p>)}{brand.research.sources.map(s=><p key={s.id}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.title||s.url} ↗</a></p>)}{brand.research.images.filter(i=>i.role==='logo').map(i=><p key={i.url}><a href={i.url} target="_blank" rel="noreferrer noopener">Website logo reference · review rights before use ↗</a></p>)}</details>
  </>}
 </section>;
}
function WebsiteProduct({app,brand,product,disabled,projectId}:{app:AdApplication;brand:BrandProfile;product:BrandProduct;disabled:boolean;projectId:string}){
 const choices=productImageChoices(brand,product.id),[selected,setSelected]=useState(''),url=choices.includes(selected)?selected:choices[0],key=JSON.stringify([projectId,brand.id,brand.research?.created,product.id,url]);
 const [preview,setPreview]=useState({key:'',image:'',error:''});
 useEffect(()=>{let stale=false;if(url)void app.websiteImage(product.id,url).then(r=>{if(!stale)setPreview({key,image:r.image,error:''});}).catch(e=>{if(!stale)setPreview({key,image:'',error:e.message});});return()=>{stale=true;};},[app,key,url,product.id]);
 return <article className="website-product"><div className="website-thumb">{preview.key===key&&preview.image?<img src={preview.image} alt={'Website photograph for '+product.name} onError={()=>setPreview({key,image:'',error:'The website photograph could not be decoded. No image imported.'})}/>:<span>{url?(preview.key===key&&preview.error?'Photo unavailable':'Checking source photograph...'):'No linked photograph'}</span>}</div><h3>{product.name}</h3><p>{product.description.slice(0,160)||'No description supplied.'}</p><small>{product.overrides?.length?'Customer-edited details - ':''}{product.discovery?product.discovery.method+' · explicit page relationship':'No verified image relationship'}</small>{choices.length>1&&<label>Photograph<select disabled={disabled} value={url} onChange={e=>setSelected(e.target.value)}>{choices.map((src,i)=><option key={src} value={src}>Photo {i+1}</option>)}</select></label>}
  {preview.key===key&&preview.error&&<small className="error-text">{preview.error} Upload the correct photograph below.</small>}
  <button type="button" disabled={disabled||!url||preview.key!==key||!preview.image} onClick={()=>void app.importWebsiteProduct(product.id,url).catch(e=>app.store.report(e))}>Use this product</button>
  {product.sourceUrl&&<a className="text-button" href={product.sourceUrl} target="_blank" rel="noreferrer noopener">{product.discovery?.linked===false?'Evidence page':'Product source'} ↗</a>}
 </article>;
}
export function WebsiteSourceConsent({app,projectId,sourceId,value,loading=false,disabled,changed}:{app:AdApplication;projectId:string;sourceId:string;value?:WebsiteSource;loading?:boolean;disabled:boolean;changed:()=>void}){
 if(loading&&sourceId)return <p className="quiet-note" role="status">Checking photograph permissions...</p>;
 if(!value)return null;
 const confirm=(accuracy:boolean,permission:boolean)=>void app.confirmWebsiteSource(accuracy,permission,{projectId,sourceId}).then(changed).catch(e=>app.store.report(e));
 return <WebsiteSourcePermission value={value} disabled={disabled} confirm={confirm}/>;
}
export function WebsiteSourcePermission({value:p,disabled,confirm}:{value:WebsiteSource;disabled:boolean;confirm:(accuracy:boolean,permission:boolean)=>void}){
 return <section className="fact-confirm" aria-label="Website photograph permission"><p>Website-sourced input · original bytes retained. Public access does not grant commercial-use rights.</p><a href={p.pageUrl} target="_blank" rel="noreferrer noopener">Review source page ↗</a><label className="check-label"><input type="checkbox" checked={p.accuracyConfirmed} disabled={disabled} onChange={e=>confirm(e.target.checked,p.permissionConfirmed)}/>I checked the photograph: it shows the selected product. I will correct any visible facts below.</label><label className="check-label"><input type="checkbox" checked={p.permissionConfirmed} disabled={disabled} onChange={e=>confirm(p.accuracyConfirmed,e.target.checked)}/>I have permission to use this photograph in an advertisement.</label><small>Neither checkbox confirms unseen ingredients, image quality, or all photo observations. Review the final direction separately.</small></section>;
}
