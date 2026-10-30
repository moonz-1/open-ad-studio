// Bounded evidence relationships; parses data, never executes storefront code.
import {createHash} from 'node:crypto';
import {parseFragment} from 'parse5';
import type {BrandProduct,ProductDiscovery} from '../lib/brand.ts';
export type WebNode={nodeName:string;tagName?:string;value?:string;attrs?:{name:string;value:string}[];childNodes?:WebNode[]};
type Product=Omit<BrandProduct,'id'|'imageIds'> & {discovery:ProductDiscovery};
const attr=(n:WebNode,k:string)=>n.attrs?.find(a=>a.name===k)?.value||'';
function nodes(root:WebNode){const found:WebNode[]=[],stack=[root];while(stack.length&&found.length<60000){const n=stack.pop()!;found.push(n);const children=n.childNodes||[];for(let i=children.length-1;i>=0;i--)stack.push(children[i]);}return found;}
export function canonicalProductURL(value:string){const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(?:variant|selling_plan|utm_.+|gclid|fbclid)$/i.test(k))u.searchParams.delete(k);u.pathname=u.pathname.replace(/\/collections\/[^/]+\/products\//i,'/products/').replace(/\/$/,'')||'/';u.searchParams.sort();return u.href;}
export function productPermalink(value:string,base:string){if(!value.trim())return false;try{
 const u=new URL(value,base);if(u.origin!==new URL(base).origin)return false;
 const path=(u.pathname.replace(/\/$/,'')||'/');
 if(/(?:^|\/)(?:cdn|images|assets|files|media)\//i.test(path)||/\.(?:png|jpe?g|webp|svg|gif|pdf|zip)$/i.test(path))return false;
 if(/\/products?\/[^/]+$/i.test(path))return true;
 // Brand marketing detail pages (not bare category hubs): /model-name or /shop/buy-family/model.
 if(/^\/shop\/buy-[a-z0-9-]+\/[a-z0-9-]+$/i.test(path))return true;
 if(/^\/[a-z0-9][a-z0-9-]{2,60}$/i.test(path)){
  const seg=path.slice(1);
  if(/^(?:shop|store|support|search|account|bag|cart|buy|newsroom|education|business|retail|today|legal|privacy|sitemap|jobs|contact|about|mac|ipad|iphone|watch|tv|tv-home|entertainment|accessories|airpods|airtag|vision|vision-pro|homepod|icloud|apple-card|apple-pay|apple-one|environment|healthcare|gaming|services)$/i.test(seg))return false;
  return /\d/.test(seg)||seg.includes('-');
 }
 return false;
}catch{return false;}}
export function discoverProducts(all:WebNode[],structured:any[],text:(n:WebNode)=>string,resolve:(s:string)=>string,url:string){
 const parent=new Map<WebNode,WebNode>();for(const n of all)for(const c of n.childNodes||[])parent.set(c,n);
 const excluded=(n:WebNode)=>{for(let p:WebNode|undefined=n;p;p=parent.get(p))if(['nav','header','footer'].includes(p.tagName||'')||['navigation','menu'].includes(attr(p,'role'))||/(?:^|[ -_])(?:testimonial|comparison)(?:$|[ -_])/i.test(attr(p,'class')))return true;return false;};
 const productAnchors=all.filter(n=>n.tagName==='a'&&!excluded(n)&&productPermalink(resolve(attr(n,'href')),url)),linkedProducts=new Set(productAnchors.map(n=>canonicalProductURL(resolve(attr(n,'href')))));
 const products:Product[]=[],links:string[]=[],stats={rejected:0,duplicates:0,limit:false};
 const clean=(v:unknown,max=3000)=>typeof v==='string'?text(parseFragment(v) as unknown as WebNode).slice(0,max):'';
 const imageURL=(n:WebNode)=>{const picture=parent.get(n),source=picture?.tagName==='picture'?(picture.childNodes||[]).find(s=>s.tagName==='source'):undefined;const set=attr(n,'data-srcset')||attr(n,'srcset')||(source?(attr(source,'data-srcset')||attr(source,'srcset')):''),options=(/data:/i.test(set)?[]:set.split(',').map(s=>s.trim().split(/\s+/))).filter(s=>s[0]&&!/[<>{}]|%3[ce]/i.test(s[0])&&resolve(s[0]));options.sort((a,b)=>(parseInt(b[1])||0)-(parseInt(a[1])||0));return resolve(attr(n,'data-src')||attr(n,'data-lazy-src')||attr(n,'data-original')||options.find(s=>(parseInt(s[1])||0)<=2400)?.[0]||attr(n,'src')||attr(n,'content')||attr(n,'href'));};
 const goodImage=(s:string)=>s&&!/[<>{}]|%3[ce]/i.test(s)&&!/^(?:data:|javascript:)/i.test(s)&&! /\.(?:svg|gif)(?:[?#]|$)/i.test(s);
 function add(name:string,description:string,productUrl:string,images:string[],method:ProductDiscovery['method']){
  name=clean(name,200).replace(/\s+/g,' ').trim();if(!name){stats.rejected++;return;}
  // Reject storefront chrome, services and navigation labeled as if they were sellable SKUs.
  if(/^(?:apple store(?: online)?|store|shop(?: now)?|support|home|menu|cart|bag|search|sign in|log in|account|learn more|buy now|explore|today at apple|services?|gift cards?|order status|find a store)$/i.test(name)||/\b(?:customer service|tech support|gift card|order status)\b/i.test(name)){stats.rejected++;return;}
  const explicit=resolve(productUrl);productUrl=canonicalProductURL(explicit||url);
  if(new URL(productUrl).origin!==new URL(url).origin){stats.rejected++;return;}
  const key=createHash('sha256').update(productUrl+'\n'+name).digest('hex').slice(0,16);
  images=[...new Set(images.map(resolve).filter(goodImage))].slice(0,3);
  const existing=products.find(p=>p.discovery.key===key||productPermalink(productUrl,url)&&p.sourceUrl===productUrl);
  if(existing){stats.duplicates++;if(!existing.description&&description)existing.description=clean(description);if(!existing.discovery.imageUrls.length&&images.length){existing.discovery.imageUrls=images;existing.discovery.method=method;}return;}
  if(products.length>=40){stats.limit=true;return;}
  products.push({name,description:clean(description),sellingPoints:'',sourceUrl:productUrl,discovery:{key,sourceId:'',method,imageUrls:images,linked:!!explicit||productPermalink(url,url)||method==='product-metadata'}});if(productPermalink(productUrl,url))links.push(productUrl);
 }
 const types=(x:any)=>Array.isArray(x?.['@type'])?x['@type']:[x?.['@type']];
 const refs=new Map(structured.filter(x=>typeof x?.['@id']==='string').map(x=>[x['@id'],x]));
 const images=(x:any,depth=0):string[]=>{if(depth>5)return [];if(typeof x==='string')return [x];if(Array.isArray(x))return x.slice(0,8).flatMap(v=>images(v,depth+1));if(!x||typeof x!=='object')return [];if(x['@id']&&refs.has(x['@id']))return images({...refs.get(x['@id']),'@id':undefined},depth+1);for(const k of ['url','src','contentUrl'])if(typeof x[k]==='string')return [x[k]];return images(x.edges||x.nodes||x.node,depth+1);};

 for(const x of structured)if(types(x).includes('Product')&&typeof x.name==='string'&&(!/\/(?:blogs?|journal|articles?|news|reviews)(?:\/|$)/i.test(new URL(url).pathname)||productPermalink(resolve(x.url||''),url)))add(x.name,typeof x.description==='string'?x.description:'',typeof x.url==='string'?x.url:typeof x['@id']==='string'&&productPermalink(x['@id'],url)?x['@id']:'',images(x.image),'json-ld');
 for(const list of structured.filter(x=>types(x).includes('ItemList'))){for(const entry of (Array.isArray(list.itemListElement)?list.itemListElement:[]).slice(0,100)){const item=typeof entry.item==='string'?(refs.get(entry.item)||{url:entry.item}):entry.item?.['@id']?(refs.get(entry.item['@id'])||entry.item):entry.item||entry;const link=typeof item.url==='string'?item.url:typeof item['@id']==='string'?item['@id']:'';if(typeof item.name==='string'&&productPermalink(resolve(link),url))add(item.name,item.description||'',link,images(item.image),'item-list');else if(productPermalink(resolve(link),url))links.push(canonicalProductURL(resolve(link)));}}
 // Exact schema.org scope; nested item scopes cannot donate another product's name/image.
 for(const scope of all.filter(n=>/\bhttps?:\/\/schema\.org\/Product\b/i.test(attr(n,'itemtype')))){
  const stack=[scope],inside:WebNode[]=[];while(stack.length){const n=stack.pop()!;if(n!==scope&&n.attrs?.some(a=>a.name==='itemscope'))continue;inside.push(n);stack.push(...(n.childNodes||[]));}
  const prop=(s:string)=>inside.filter(n=>attr(n,'itemprop').split(/\s+/).includes(s)),name=prop('name')[0],desc=prop('description')[0],link=prop('url')[0];if(name)add(attr(name,'content')||text(name),desc?(attr(desc,'content')||text(desc)):'',link?(attr(link,'href')||attr(link,'content')):'',prop('image').map(imageURL),'microdata');
 }
 const meta=(s:string)=>attr(all.find(n=>n.tagName==='meta'&&(attr(n,'property')===s||attr(n,'name')===s))||{} as WebNode,'content');
 if(/(^|:)product$/i.test(meta('og:type')))add(meta('og:title')||text(all.find(n=>n.tagName==='h1')||{} as WebNode),meta('og:description')||meta('description'),url,[meta('og:image')],'product-metadata');
 const card=(n:WebNode)=>/(?:^|\s)(?:product[-_]card|card[-_]product|product[-_]item|product[-_]tile|grid[-_]product|product|card-wrapper|product-card-wrapper|productgrid--item|product-grid-item|product-list-item|grid__item)(?:$|\s|--)/i.test(attr(n,'class'))||n.attrs?.some(a=>a.name==='data-product-id'||a.name==='data-product-card');
 const scopes=new Set<WebNode>();
 for(const a of productAnchors){let n=parent.get(a);for(let depth=0;n&&depth<7;depth++,n=parent.get(n)){if(card(n)){scopes.add(n);break;}if(['main','body','nav','header','footer'].includes(n.tagName||''))break;}}
 for(const scope of scopes){
  // A collection/grid containing multiple product URLs is never a product card.
  const inside=nodes(scope),hrefs=[...new Set(inside.filter(n=>n.tagName==='a'&&!excluded(n)&&productPermalink(resolve(attr(n,'href')),url)).map(n=>canonicalProductURL(resolve(attr(n,'href')))))];if(hrefs.length!==1){stats.rejected++;continue;}
  const titleNodes=inside.filter(n=>['h2','h3','h4'].includes(n.tagName||'')||/(?:product|card)[-_]*(?:card[-_]*)?(?:__|[-_])?(?:title|name|heading)(?:$|[-_\s])/i.test(attr(n,'class')));
  const names=[...new Set(titleNodes.map(text).map(s=>s.trim()).filter(s=>s&&s.length<=200))];const declared=attr(scope,'data-title');let name=declared||names[0]||'';
  if(!name||names.some(s=>s.toLowerCase()!==name.toLowerCase())){stats.rejected++;continue;}
  const candidates=inside.filter(n=>n.tagName==='img').map(n=>({n,url:imageURL(n)})).filter(i=>goodImage(i.url));
  const matching=candidates.filter(i=>attr(i.n,'alt').trim().toLowerCase()===name.toLowerCase());
  const ranked=matching.length?matching:candidates;
  const desc=inside.find(n=>/(?:product|card)[-_]*(?:card[-_]*)?(?:__|[-_])?(?:description|tagline)(?:$|[-_\s])/i.test(attr(n,'class')));
  add(name,desc?text(desc):'',hrefs[0],ranked.map(i=>i.url),'product-card');
 }
 // Legacy self-contained permalink cards (including unclassed simple stores).
 for(const anchor of productAnchors){
  const inside=nodes(anchor),imgs=inside.filter(n=>n.tagName==='img'),titles=inside.filter(n=>['h2','h3','h4'].includes(n.tagName||'')||/product[-_ ]?(title|name)/i.test(attr(n,'class'))),names=[...new Set(titles.map(text).filter(Boolean))];if(!imgs.length||names.length>1)continue;
  const label=[names[0],attr(anchor,'title'),attr(imgs[0],'alt'),attr(anchor,'aria-label'),text(anchor)].find(s=>s&&!/[$??%]|^(view|shop|buy|learn more|details)$/i.test(s))||'';if(label&&label.length<=200)add(label,'',attr(anchor,'href'),imgs.map(imageURL),'product-link');
 }
 // Public JSON hydration only, with a deliberately narrow container vocabulary.
 // No eval, JS assignments, arbitrary graph traversal, cart/config/API-token reads.
 for(const script of all.filter(n=>n.tagName==='script'&&['application/json','text/json'].includes(attr(n,'type')))){
  const raw=(script.childNodes||[]).map(n=>n.value||'').join('');if(raw.length>600000)continue;let data:any;try{data=JSON.parse(raw);}catch{continue;}
  const queue=[{v:data,productContext:/product/i.test(attr(script,'id')+' '+attr(script,'data-type'))}],visited=new Set<any>();let examined=0;
  while(queue.length&&examined++<1000){const {v,productContext}=queue.shift()!;if(!v||typeof v!=='object'||visited.has(v))continue;visited.add(v);
   if(Array.isArray(v)){for(const item of v.slice(0,100))queue.push({v:item,productContext});continue;}
   if(productContext&&(typeof v.title==='string'||typeof v.name==='string')){const name=typeof v.title==='string'?v.title:v.name,link=typeof v.url==='string'?v.url:typeof v.handle==='string'?'/products/'+encodeURIComponent(v.handle):'';
    if(link&&productPermalink(resolve(link),url)){const canonical=canonicalProductURL(resolve(link)),corroborated=linkedProducts.has(canonical),sellable=(Array.isArray(v.variants)?v.variants:Array.isArray(v.variants?.edges)?v.variants.edges.map((x:any)=>x.node):v.variants?.nodes||[]).some((x:any)=>x&&x.id&&(x.price!==undefined||typeof x.available==='boolean'||typeof x.availableForSale==='boolean'));
     if(corroborated||sellable)add(name,v.description||v.body_html||'',link,images(v.images||v.featured_image||v.featuredImage||v.image),'storefront-data');else stats.rejected++;
    }else stats.rejected++;
   }
   for(const k of ['products','product','collection','data','props','pageProps','nodes','edges','node'])if(v[k]&&typeof v[k]==='object')queue.push({v:v[k],productContext:productContext||['products','product'].includes(k)});
  }
 }
 return {products,links:[...new Set(links)],stats};
}
