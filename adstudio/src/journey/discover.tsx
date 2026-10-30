import {useRef,useState,type ReactNode} from 'react';
import type {JourneyService,JourneyState} from '../journey-service.ts';
import {photographSummary} from '../journey-service.ts';
import type {CreativeDraft} from '../creative-service.ts';
import {brandFieldStatus,type BrandField,type BrandProfile,type BrandProduct} from '../../../shared/lib/brand.ts';
import {Photo,WebsiteCard} from './components.tsx';
import {sourceIdentified} from './gates.ts';
import {advancedFactsFrom} from './advanced-facts.ts';

export type BrandEditable='name'|'description'|'tone'|'visualStyle';
type Props={
 service:JourneyService;j:JourneyState;brand?:BrandProfile;draft:CreativeDraft;fallbackName:string;busy:boolean;notice?:string;gate:string;
 run:(label:string,fn:()=>Promise<unknown>)=>void;edit:(label:string,fn:()=>Promise<unknown>)=>void;
 addFiles:(files:File[])=>Promise<void>;associateSources:()=>Promise<void>;saveBrandField:(key:BrandEditable,value:string)=>Promise<void>;develop:()=>void;
};
const provenance=(brand:BrandProfile,field:BrandField)=>({missing:'Not found',inferred:'AI suggestion',user:'Your edit',reviewed:'Your edit',source:'From your website'} as Record<string,string>)[brandFieldStatus(brand,field)]||'From your website';

/** One brief line: value at rest, a small Edit control, explicit Save. */
function BriefRow({label,value,badge,placeholder,multiline,disabled,save,children}:{label:string;value:string;badge?:string;placeholder?:string;multiline?:boolean;disabled:boolean;save?:(value:string)=>void;children?:ReactNode}){
 const [draft,setDraft]=useState<string|null>(null),editing=draft!==null;
 const commit=()=>{if(draft!==null&&draft.trim()!==value.trim())save?.(draft.trim());setDraft(null);};
 return <div className={'brief-row'+(editing?' is-editing':'')}>
  <dt>{label}{badge&&<span className={'brief-badge'+(badge==='AI suggestion'?' is-ai':badge==='Your edit'?' is-owner':'')}>{badge}</span>}</dt>
  <dd>{editing
   ?<div className="brief-edit">{multiline
     ?<textarea aria-label={label} value={draft} placeholder={placeholder} autoFocus onChange={e=>setDraft(e.target.value)}/>
     :<input aria-label={label} value={draft} placeholder={placeholder} autoFocus onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape')setDraft(null);}}/>}
     <div><button type="button" className="brief-save" onClick={commit}>Save</button><button type="button" className="quiet" onClick={()=>setDraft(null)}>Cancel</button></div></div>
   :<>{children??(value?<p>{value}</p>:<p className="brief-empty">{placeholder}</p>)}{save&&<button type="button" className="brief-edit-button" aria-label={'Edit '+label.toLowerCase()} title={'Edit '+label.toLowerCase()} disabled={disabled} onClick={()=>setDraft(value)}>✎</button>}</>}
  </dd>
 </div>;
}

export function Discover({service,j,brand,draft,fallbackName,busy,notice,gate,run,edit,addFiles,associateSources,saveBrandField,develop}:Props){
 const app=service.app,current=j.sources.find(x=>x.id===draft.sourceId),productOf=(id?:string):BrandProduct|undefined=>id?brand?.products.find(x=>x.id===id):undefined;
 const product=productOf(draft.productId),website=!!product?.discovery,productName=product?.name.trim()||'';
 const acknowledged=!!j.imageUse,analysing=brand?.research?.analysisState==='pending';
 const sourceChanged=()=>service.sourceChanged(current?.permission||false);
 const advanced=useRef<HTMLDetailsElement>(null);
 const persistAdvanced=()=>{
  const next=advancedFactsFrom(advanced.current),patch:Partial<typeof draft.facts>={};
  if(next.count!==draft.facts.count)patch.count=next.count;
  if((next.arrangement||'')!==(draft.facts.arrangement||''))patch.arrangement=next.arrangement||'';
  if((next.texture||'')!==(draft.facts.texture||''))patch.texture=next.texture||'';
  if((next.container||'')!==(draft.facts.container||''))patch.container=next.container||'';
  if(!Object.keys(patch).length)return;
  edit('Saving facts',async()=>{await app.patchFacts(patch);await sourceChanged();});
 };
 const facts=[product?.evidence?.text||product?.description,product?.sellingPoints].map(x=>x?.trim().replace(/^[—–-]\s*/,'')).filter((x):x is string=>!!x);
 const summary=draft.facts.description.trim();
 const candidates=brand?.products.filter(x=>x.discovery&&!j.sources.some(s=>s.draft.productId===x.id))||[],[showAll,setShowAll]=useState(false),shown=showAll?candidates:candidates.slice(0,8);
 return <section className="discovery discover-two" data-testid="journey-discover">
  <div className="eyebrow">02 / Meet your brand</div>
  <h1 className="discover-title">{brand?.dna.name||fallbackName||'Your brand'} <em>at a glance.</em></h1>
  {notice?<p className="discovery-notice" role="status">{notice}</p>:null}
  <div className="discover-grid">
   <div className="discover-products" aria-label="Products">
    <header className="panel-head"><h2>Products</h2><span>{j.sources.length} of 3 selected</span></header>
    <div className="discover-cards">
     {j.sources.map(x=>{const name=productOf(x.draft.productId)?.name||'Your photograph',named=sourceIdentified({...x,productName:productOf(x.draft.productId)?.name});return <article key={x.id} className={'source-card'+(draft.sourceId===x.id?' selected':'')}>
      <button className="image-select" disabled={busy} aria-pressed={draft.sourceId===x.id} aria-label={'Show brief for '+name} onClick={()=>run('Opening product',()=>service.focus(x.id))}><Photo service={service} id={x.id} alt={name}/><span className="selection-mark">✓</span></button>
      <div className="card-meta"><strong>{name}</strong>{!named&&<small className="needs-mark">Needs a name</small>}<button className="card-remove" disabled={busy} aria-label={'Remove '+name+' from campaign'} title="Remove from campaign" onClick={()=>run('Removing product',()=>service.save(j=>{j.sources=j.sources.filter(s=>s.id!==x.id);j.quantity=Math.max(1,j.sources.length);}))}>×</button></div>
     </article>;})}
     {brand&&shown.map(x=><WebsiteCard key={x.id} service={service} brand={brand} product={x} disabled={busy||j.sources.length>=3} select={url=>run('Adding '+x.name,async()=>{await app.importWebsiteProduct(x.id,url);await service.rememberSource();})}/>)}
     <label className="add-product">＋<span>Upload a product</span><small>For products not on your website</small><input type="file" className="file-hidden" accept="image/png,image/jpeg,image/webp" disabled={busy||j.sources.length>=3} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';run('Saving your photograph',async()=>{await addFiles(files);await associateSources();});}}/></label>
    </div>
    {candidates.length>8&&<button type="button" className="quiet show-all" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer products':'Show all '+candidates.length+' website products'}</button>}
   </div>
   <aside className="discover-brief" aria-label="AI brand and creative brief">
    <header className="panel-head"><h2>Brand &amp; creative brief</h2><span>{brand?.research?.aiCompleted?'Website evidence + local AI suggestions':brand?.research?'Website evidence':'Your inputs'}</span></header>
    {analysing&&<p className="brief-progress" role="status"><span className="activity-dot"/>Local Qwen is reading your website. Tone and style suggestions appear here when it finishes.</p>}
    {brand?.research?.analysisState==='failed'&&<p className="brief-progress is-quiet" role="status">Local Qwen could not finish the brand analysis, so no tone or style is suggested. Add them below if you like; planning still uses your website evidence.</p>}
    <dl className="brief-list">
     <BriefRow label="Brand" value={brand?.dna.name||fallbackName} badge={brand?provenance(brand,'name'):undefined} placeholder="Add your brand name" disabled={busy} save={v=>edit('Saving brand name',()=>saveBrandField('name',v))}/>
     <BriefRow label="Brand identity" value={brand?.dna.description||''} badge={brand?provenance(brand,'description'):undefined} placeholder="No brand description found yet." multiline disabled={busy||!brand} save={v=>edit('Saving brand identity',()=>saveBrandField('description',v))}/>
     {current&&(website
      ?<BriefRow label="Selected product" value={productName} badge="From your website" disabled={busy}/>
      :<BriefRow label="Selected product" value={productName} badge={productName?'Your edit':'Required'} placeholder="Name this product, for example: seasonal tiramisu rolls" disabled={busy} save={v=>edit('Saving product name',async()=>{await app.nameOwnProduct(v);await sourceChanged();})}/>)}
     {current&&<BriefRow label="Product facts" value={product?.description||''} badge={website?'From your website':product?.description?'Your edit':undefined} multiline disabled={busy} save={!website&&product?v=>edit('Saving product facts',async()=>{await app.editSelectedProduct({description:v});await sourceChanged();}):undefined}>{facts.length
      ?<ul className="brief-facts">{facts.map(f=><li key={f}>{f}</li>)}</ul>
      :<p className="brief-empty">{website?'The website listing has no product description.':'Only the details you add are used. Nothing is invented.'}</p>}</BriefRow>}
     {current&&<BriefRow label="Photograph summary" value={summary||(productName?photographSummary(productName):'')} badge={summary?undefined:'Automatic'} placeholder="Named automatically from the product" multiline disabled={busy} save={v=>edit('Saving photograph summary',async()=>{await app.patchFacts({description:v});await sourceChanged();})}>
      <p>{summary||(productName?photographSummary(productName):'Named automatically once the product has a name.')}</p><small>Planning is text-only and does not inspect photo pixels.</small></BriefRow>}
     <BriefRow label="Brand tone" value={brand?.dna.tone||''} badge={brand?.dna.tone?provenance(brand,'tone'):undefined} placeholder={analysing?'Waiting for brand analysis…':'Not set'} disabled={busy||!brand} save={v=>edit('Saving tone',()=>saveBrandField('tone',v))}/>
     <BriefRow label="Visual palette" value={(brand?.palette?.approved||brand?.colors||[]).join(', ')} badge={brand?.colors.length?(brand.overrides.includes('colors')?'Your edit':'From your website'):undefined} placeholder="#102b23, #f2f3e9" disabled={busy||!brand} save={v=>edit('Saving palette',async()=>{const colors=v.split(',').map(x=>x.trim()).filter(Boolean);if(colors.some(x=>!/^#[a-f0-9]{6}$/i.test(x)))throw Error('Use hex colors such as #102b23.');const b=structuredClone(brand!);b.colors=colors;b.palette={approved:colors,preferred:colors};b.overrides=[...new Set([...b.overrides,'colors'])];await app.saveBrand(b);await service.save(j=>{for(const src of j.sources)delete src.review;});})}>
      {brand?.colors.length?<div className="swatches">{brand.colors.slice(0,6).map(c=><span key={c} style={{background:c}} title={c}/>)}</div>:<p className="brief-empty">No colors found yet.</p>}</BriefRow>
     <BriefRow label="Photographic direction" value={brand?.dna.visualStyle||''} badge={brand?.dna.visualStyle?provenance(brand,'visualStyle'):undefined} placeholder={analysing?'Waiting for brand analysis…':brand?.research?.analysisState==='failed'?'Not set':'Suggested from your brand once available'} multiline disabled={busy||!brand} save={v=>edit('Saving photographic direction',()=>saveBrandField('visualStyle',v))}/>
     {current&&<BriefRow label="Campaign angle" value={draft.request||''} badge={draft.request?'Your edit':'Optional'} placeholder="Optional, for example: a gift for the holidays" multiline disabled={busy} save={v=>edit('Saving campaign angle',async()=>{await app.editDraft({request:v});await sourceChanged();})}/>}
    </dl>
    {current&&<details ref={advanced} className="brief-advanced"><summary>Advanced · product details &amp; planning</summary>
     <label>Product category<select value={draft.productType} disabled={busy} onChange={e=>{const value=e.target.value as typeof draft.productType;run('Saving category',async()=>{await app.editDraft({productType:value});await sourceChanged();});}}>{['other','packaged-goods','digital','service','cookies','cinnamon-rolls'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
     <label>Photograph approach<select aria-label="Photograph approach" disabled={busy} value={draft.constraints?.fidelity==='medium'||draft.constraints?.fidelity==='low'?'restage':'preserve'} onChange={e=>{persistAdvanced();const restage=e.currentTarget.value==='restage';run('Saving photograph approach',async()=>{await app.editDraft({constraints:{...draft.constraints,fidelity:restage?'medium':'high',exactCount:restage?false:draft.facts.count!==undefined,arrangement:restage?'roughly':'exactly',angle:'slight',crop:'moderate',creativity:restage?'high':'medium'}});await sourceChanged();});}}><option value="preserve">Preserve product geometry</option><option value="restage">Creative Restage - compare with original</option></select></label>
     <label>Visible count<input data-fact="count" type="number" min="1" max="100" defaultValue={draft.facts.count||''} key={draft.sourceId+'count'} onChange={persistAdvanced} onBlur={persistAdvanced}/></label>
     {(['arrangement','texture','container'] as const).map(k=><label key={k+draft.sourceId}>{k[0].toUpperCase()+k.slice(1)}<input data-fact={k} defaultValue={draft.facts[k]} onChange={persistAdvanced} onBlur={persistAdvanced}/></label>)}
     <label>Planning mode<select aria-label="Planning mode" value={j.planningMode||'ai'} disabled={busy} onChange={e=>{const mode=e.currentTarget.value as 'ai'|'basic';edit('Saving planning mode',()=>service.save(j=>{j.planningMode=mode;}));}}><option value="ai">AI Creative Director - local Qwen</option><option value="basic">Basic draft - no AI planning</option></select></label>
     {product?.sourceUrl?<small><a href={product.sourceUrl} target="_blank" rel="noreferrer">Product page ↗</a></small>:null}
    </details>}
    {acknowledged
     ?<p className="image-use is-ack" data-testid="image-use-ack"><span>✓</span> You confirmed permission to use this campaign’s photographs. Each source keeps its original file and hash.</p>
     :<div className="image-use" data-testid="image-use"><p>Use photographs you own or have permission to use in advertising. Images found on a website are not automatically licensed.</p><button disabled={busy} onClick={()=>run('Saving image use',()=>service.acknowledgeImageUse())}>I have permission for this campaign’s photos</button></div>}
    <div className="brief-action"><span>{(j.planningMode||'ai')==='basic'?'Basic draft: non-AI visual studies only.':'Local Qwen develops three directions for each product. If it is busy, your directions start as soon as it is free.'}</span>{!!gate&&!busy&&<p className="gate-reason" id="discover-gate" role="status">{gate}</p>}<button className="primary" data-testid="journey-develop" disabled={busy||!!gate} aria-describedby={gate?'discover-gate':undefined} onClick={()=>{persistAdvanced();develop();}}>Develop creative directions <b>→</b></button></div>
   </aside>
  </div>
 </section>;
}
