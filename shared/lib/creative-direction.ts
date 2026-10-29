// Interpretable planning rules, not a vision model or an aesthetic evaluator.
import type {CreativeInput,CreativeConcept,CreativeContext} from './creative-engine.ts';
import {brandFieldStatus,advertisingColors} from './brand.ts';

export type CreativeGrounding={
 identity:string[]; appearance:string[]; positioning:string[]; preferences:string[];
 hypotheses:string[]; objective:string; direction:string; palette:string[]; warnings:string[];
};
// Only named preference fields contribute to visual style. Business descriptions
// and website boilerplate stay evidence, even if no visual preference was given.
export function creativeGrounding(input:CreativeInput):CreativeGrounding {
 const b=input.brand,read=(keys:('tone'|'visualStyle'|'guidelines'|'positioning'|'audience'|'creativePreferences')[])=>keys.filter(k=>b.dna[k]?.trim()).map(k=>({key:k,text:b.dna[k]||'',status:brandFieldStatus(b,k)}));
 // Explicitly accepted AI style preferences can guide surroundings. Their
 // evidence remains inferred: acceptance is not proof of a business claim.
 const declared=read(['tone','visualStyle','guidelines','creativePreferences']).filter(s=>s.status!=='inferred'||b.approvedFields?.includes(s.key));
 const request=input.request||'',signals=[...declared.map(s=>s.text),request].join(' ').toLowerCase();
 // Deliberately limited vocabulary: unknown prose is retained in the objective,
 // never repeated as photographic direction or treated as new product evidence.
 const matches=(text:string,pattern:RegExp)=>text.split(/[.!?;,\n]/).some(s=>pattern.test(s)&&!/\b(?:do not|don't|no|not|avoid|without|never)\b/i.test(s));
 const has=(pattern:RegExp)=>matches(signals,pattern),warm=/\b(warm|welcoming|inviting|friendly|cozy)\b/,cool=/\b(precise|precision|functional|technical|cool|mineral)\b/;
 const requestWarm=matches(request.toLowerCase(),warm),requestCool=matches(request.toLowerCase(),cool);
 const useWarm=requestWarm&&!requestCool||!requestCool&&has(warm)&&!has(cool),useCool=requestCool&&!requestWarm||!requestWarm&&has(cool)&&!has(warm);
 const treatments:string[]=[];
 if(useWarm)treatments.push('welcoming light, warm neutral surroundings and approachable scale');
 if(useCool)treatments.push('precise alignment, cool neutral surroundings and clear material edges');
 if(has(/\b(playful|bold|energetic|graphic)\b/))treatments.push('a clear diagonal or graphic silhouette with confident negative space');
 if(has(/\b(calm|quiet|minimal|restrained)\b/))treatments.push('quiet negative space, restrained staging and gradual light falloff');
 if(has(/\b(natural|tactile|handmade|texture|material)\b/))treatments.push('visible natural surface relief and tactile surrounding materials');
 const controls=input.constraints||{},warnings:string[]=[];
 if(has(warm)&&has(cool)&&!useWarm&&!useCool)warnings.push('Warm and cool direction cues conflict; neutral treatment is proposed until review.');
 if(!declared.length)warnings.push('No declared visual preference: neutral material-led art direction is a proposal, not inferred brand style.');
 if(/\b(remove|add|duplicate|multiply|rearrange|scatter|rotate|crop|redraw|redesign|new label)\b/i.test(request))warnings.push('Customer transformation language must be reconciled with the product locks; locks take priority, not the request.');
 if(controls.angle==='none'&&/\b(angle|rotate|overhead|profile|perspective)\b/i.test(request))warnings.push('Requested viewpoint change conflicts with the no-angle-change lock.');
 if((controls.exactCount||controls.fidelity==='strict')&&/\b(crop|single|one item|remove|duplicate)\b/i.test(request))warnings.push('Requested framing/count change may conflict with full-batch preservation.');
 return {identity:[b.dna.name,b.dna.description,b.dna.story].filter(Boolean),appearance:[input.facts.description,input.facts.texture,input.facts.container,input.facts.arrangement].filter(Boolean),positioning:read(['positioning']).filter(s=>s.status!=='inferred').map(s=>s.text),preferences:declared.map(s=>`${s.key} (${s.status}): ${s.text}`),hypotheses:read(['tone','visualStyle','guidelines','positioning','audience']).filter(s=>s.status==='inferred').map(s=>`${s.key}: ${s.text}`),objective:request,direction:treatments.join('; ')||'clear material-led photography, neutral surroundings and readable product boundaries',palette:advertisingColors(b).slice(0,3),warnings};
}

const tokens=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>w.length>3&&!['with','from','only','product','original','source','preserve','keep','photograph'].includes(w))||[]);
function similarity(a:string,b:string){const x=tokens(a),y=tokens(b);return [...x].filter(t=>y.has(t)).length/Math.max(1,new Set([...x,...y]).size);}
// Lexical/contract gates catch collapsed directions, not visual quality. A judge
// must still inspect the eventual images; passing these is never an ad rating.
export function conceptQuality(concepts:CreativeConcept[],context:CreativeContext){
 const pairs:{ids:string[];differentChannels:number;overlap:number}[]=[],issues:string[]=[];
 if(context.controls.intent==='campaign'&&context.controls.crop!=='none'&&concepts.every(c=>/\b(cent(?:er|re)(?:ed)?|middle)\b/i.test(c.composition)&&!/\b(off.?cent|third|diagonal|lower.left|upper.right|left third|right third)/i.test(c.composition)))issues.push('All three concepts use the same centered product framing; vary placement/scale/negative space within the locks.');
 for(const c of concepts)if(context.grounding?.identity.slice(1).some(s=>s.length>45&&[c.idea,c.environment,c.lighting].some(v=>v.toLowerCase().includes(s.toLowerCase().slice(0,100)))))issues.push(`${c.id}: business-description prose was copied into visual direction.`);
 for(let i=0;i<concepts.length;i++)for(let j=i+1;j<concepts.length;j++){
  const a=concepts[i],b=concepts[j],keys=['composition','environment','lighting'] as const;
  const differentChannels=keys.filter(k=>similarity(a[k],b[k])<.8).length;
  const overlap=similarity(keys.map(k=>a[k]).join(' '),keys.map(k=>b[k]).join(' '));
  pairs.push({ids:[a.id,b.id],differentChannels,overlap});
  const limited=context.controls.intent==='enhancement'||(context.controls.crop==='none'&&context.controls.background!=='replace');
  if(differentChannels<(limited?1:2)||!limited&&overlap>.8)issues.push(`${a.id}/${b.id}: visual decisions are too similar.`);
 }
 return {method:'Lexical decision-channel checks, not image-quality measurement.',pairs,issues};
}

export function conceptConstraintIssues(c:CreativeConcept,context:CreativeContext){
 const p=context.controls,issues:string[]=[],physical=[c.idea,c.camera,c.composition,c.environment].join(' ');
 const clauses=physical.split(/[.!?;\n]/).filter(s=>!/^\s*(no|never|do not|without|avoid|retain|preserve|keep)\b/i.test(s)).join(' ');
 if(p.exactCount&&/\b(?:hide|remove|duplicate|add|merge)\s+(?:an?\s+|the\s+|some\s+)?(?:units?|products?|rolls?|cookies?|bottles?)\b/i.test(clauses))issues.push('Direction changes the locked product count.');
 if(p.exactCount&&(context.observedCount??0)>1&&/\b(?:single|one|individual)\s+(?:cinnamon\s+)?(?:roll|cookie|bottle|item|unit|piece)\b/i.test(clauses))issues.push('Single-unit direction contradicts the exact full-batch count lock.');
 const appearance=context.facts.find(f=>f.id==='photo')?.text||'';
 for(const item of ['glass of milk','cup of coffee','cutting board','spoon','fork','hands','garnish'])if(new RegExp('\\b'+item+'\\b','i').test(clauses)&&!new RegExp('\\b'+item+'\\b','i').test(appearance))issues.push('Direction introduces an unobserved extra item: '+item+'.');
 if(p.crop==='none'&&/\b(tight crop|crop into|cut off|edge crop|extreme close.?up)\b/i.test(clauses))issues.push('Direction contradicts the no-crop lock.');
 if(p.angle==='none'&&/\b(rotate the|new viewpoint|change the angle|change viewpoint)\b/i.test(clauses))issues.push('Direction contradicts the source-viewpoint lock.');
 // Match affirmative viewpoint shifts. Ignore "side-light" and negated phrases ("not … overhead").
 if(p.angle==='slight'){
  const cam=c.camera.replace(/\b(not|no|never|avoid|without)\b[^.!?;\n]{0,40}/gi,' ');
  if(/\b(wide[\s-]?angle|low[\s-]?angle|bird'?s[\s-]?eye|aerial|overhead|top[\s-]?down|from the side|side view|profile)\b/i.test(cam)&&!/\b(same|keep|retain|source|slightly?|small|modest)\b/i.test(c.camera))
   issues.push('Camera proposal exceeds the slight perspective-change permission.');
 }
 if(p.arrangement==='exactly'&&/\b(rearrange|scatter|separate the|change spacing)\b/i.test(clauses))issues.push('Direction contradicts the exact-arrangement lock.');
 if(/\b(?:with|add|render|generate|write|include)\s+(?:a\s+|new\s+)?(?:brand text|text on the|a new logo|typography on the)\b/i.test([c.idea,c.environment,c.camera,c.lighting].join(' ')))issues.push('Direction asks for generated typography/branding; leave it to separate composition.');
 return issues;
}

// Recommendation uses observable text/constraint properties. Model self-scores
// remain archived but cannot make a weak/contradictory plan win automatically.
export function conceptRecommendation(c:CreativeConcept,context:CreativeContext){
 const grounded=c.evidenceIds.filter(id=>context.facts.some(f=>f.id===id&&['source','owner'].includes(f.kind))).length;
 const specificity=['composition','environment','lighting'].filter(k=>tokens(c[k as keyof CreativeConcept] as string).size>=7).length;
 const conflicts=conceptConstraintIssues(c,context).length;
 const objective=context.grounding?.objective||'';
 const fit=(/\b(shared|table|everyday|occasion)\b/i.test(objective)&&c.layout==='editorial')||(/\b(texture|detail|material|close.up)\b/i.test(objective)&&c.layout==='spotlight')||(/\b(graphic|bold|statement)\b/i.test(objective)&&c.layout==='poster');
 return {score:Math.max(0,20+Math.min(grounded,3)*5+specificity*5+(fit?8:0)-conflicts*25),method:'Deterministic grounding, objective/layout relevance, executable visual specificity and constraint checks; not a commercial-quality score. Model self-scores do not select the recommendation.'};
}
