// CPU TEST DATA ONLY. Rectangles are not generated product photographs.
import {Resvg} from '@resvg/resvg-js';
import {crc32} from 'node:zlib';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {creativeContext,fallbackConcepts} from '../../shared/lib/creative-engine.ts';
export const png=new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128"><rect width="96" height="128" fill="#d8b585"/><rect x="16" y="24" width="64" height="80" fill="#f5e7c4"/></svg>').render().asPng();
export const dataURL=bytes=>'data:image/png;base64,'+Buffer.from(bytes).toString('base64');
export const encode=async blob=>'data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');
export function inputFixture(kind='bakery'){
 const bakery=kind==='bakery',brand=newBrand(bakery?'No Crumbs Bakery':'Field Objects');brand.id=bakery?'fixture-bakery':'fixture-field';
 brand.dna.description=bakery?'A bakery making cinnamon rolls.':'Objects for thoughtful daily routines.';brand.dna.tone=bakery?'Warm, inviting and playful.':'Precise, calm and functional.';brand.dna.visualStyle=bakery?'Warm cream, cocoa and texture.':'Cool mineral tones and material clarity.';brand.colors=bakery?['#f5e7c4','#321a12']:['#dce4e7','#142a35'];brand.overrides=['name','description','tone','visualStyle'];
 const source={id:'source-'+kind,name:'MOCK reference, not a photograph.png',sha256:heroSha(png),originalSha256:heroSha(png),kind:'original'};
 const facts=bakery?{description:'Nine cinnamon rolls with varied cream frosting and visible spirals.',count:9,arrangement:'Three rows of three closely packed rolls.',texture:'Uneven visible frosting.',container:'White rectangular baking dish with handles.',confirmed:true}:{description:'One blue bottle with its printed Field label and screw cap.',count:1,arrangement:'Single bottle upright.',texture:'Matte blue surface and printed white label.',container:'The bottle is the product.',confirmed:true};
 if(!bakery){brand.assets=[{id:'bottle-photo',assetId:source.id,name:source.name,role:'product',productId:'bottle'}];brand.products=[{id:'bottle',name:'Field Bottle',description:'A blue bottle.',sellingPoints:'',imageIds:['bottle-photo']}];}
 return {version:1,projectId:'fixture-project-'+kind,brand,source,facts,productType:bakery?'cinnamon-rolls':'packaged-goods',...(bakery?{}:{productId:'bottle'}),request:bakery?'An inviting shared-table advertisement, without extra food.':'A precise functional product advertisement.',intent:'campaign',format:'feed',seed:42};
}
export function mockConcepts(input){const concepts=fallbackConcepts(input,creativeContext(input));concepts.forEach((c,i)=>{c.id='mock-ai-'+i;c.rationale='MOCK model evaluation for CPU tests only.';c.scores={impact:i===1?5:3,relevance:4,accuracy:5,feasibility:4};});return {concepts};}
export function textNodesFixture(){return {CLIPLoader:{input:{required:{clip_name:[['qwen_3_4b_fp8_mixed.safetensors']],type:[['lumina2']],device:[['default','cpu']]}}},TextGenerate:{input:{required:{clip:['CLIP'],prompt:['STRING'],max_length:['INT',{max:32768}],sampling_mode:[['off','on']]},optional:{system_prompt:['STRING'],thinking:['BOOLEAN'],use_default_template:['BOOLEAN']}}},SaveText:{input:{required:{text:['STRING'],filename_prefix:['STRING'],format:[['txt','json']]}}}};}
export function withPrompt(graph){const type=Buffer.from('tEXt'),data=Buffer.from('prompt\0'+JSON.stringify(graph)),chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]);}

// These compact lines are injected test proposals, never real AI output.
export function mockProposals(input){const replace=creativeContext(input).controls.background==='replace';return [
 ['EDITORIAL','An approachable everyday pause with warm tactile surroundings','A quiet plain bakery counter and receding cream wall','Broad window light with soft reflected fill and gradual falloff'],
 ['DETAIL','Observed surface relief becomes the central visual interest','A matte neutral paper sweep without surrounding objects','Low soft grazing light reveals relief with a gentle opposing fill'],
 ['GRAPHIC','A memorable silhouette through deliberate restrained tonal contrast','A simple two tone neutral backdrop with a plain supporting surface','A broad frontal light and subtle rim separation make contrast legible']
].map(([tag,hook,setting,light])=>[tag,hook,...(replace?[setting]:[]),light].join(' | ')).join('\n');}
