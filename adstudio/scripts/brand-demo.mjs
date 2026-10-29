// Private local example from actual research + existing owned assets. No inference.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newBrand,applyResearch,validateBrand} from '../../shared/lib/brand.ts';
const root='outputs/brand-demo';await mkdir(root,{recursive:true});
const research=JSON.parse(await readFile(root+'/research.json','utf8')),brand=applyResearch(newBrand(),research);brand.id='no-crumbs-local-brand-v1';
const files=[],hashes=[];for(const [path,name,role]of [['outputs/website-logo.png','No Crumbs original website logo.png','logo'],['outputs/ltx25-benchmark/inputs/cookie.source.jpeg','Original cookie tray - confirm product.jpeg','product']]){
 const data=await readFile(path),assetId=crypto.randomUUID(),type=path.endsWith('png')?'image/png':'image/jpeg';brand.assets.push({id:crypto.randomUUID(),assetId,name,role});files.push({assetId,name,original:'data:'+type+';base64,'+data.toString('base64')});hashes.push({path,sha256:createHash('sha256').update(data).digest('hex'),note:role==='product'?'Original photo is unassigned; customer must identify which product it depicts.':'Existing authentic website logo'});
}
validateBrand(brand);await writeFile(root+'/demo.json',JSON.stringify({brand,files}));await writeFile(root+'/provenance.json',JSON.stringify({created:new Date().toISOString(),aiCompleted:research.aiCompleted,provider:research.provider,sourceHashes:research.sources.map(s=>({url:s.url,sha256:s.sha256})),assets:hashes,reviewed:false,notes:'No prices/availability invented or imported; all original bytes kept. Review audience/style manually without a configured local model.'},null,2));
console.log('Prepared real private No Crumbs onboarding example; review required. No AI inference claimed.');
