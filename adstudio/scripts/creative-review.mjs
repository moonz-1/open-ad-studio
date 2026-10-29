// Local proposal artifact, never an owner review, inference request or upload.
// Usage: node --experimental-transform-types adstudio/scripts/creative-review.mjs
//   <saved-private-plan.json> <original.jpg> <normalized.png> [output-directory]
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {creativeContext,fallbackConcepts,assembleCreativePlan,selectCreativePlan} from '../../shared/lib/creative-engine.ts';
import {conceptQuality} from '../../shared/lib/creative-direction.ts';
import {validateGenerationDraft,draftReviewed} from '../../shared/lib/product-brief.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {qwenContract,qwenWorkflow} from '../../shared/runtime/qwen-hero.ts';
const [saved,original,reference,destination='outputs/creative-intelligence-review']=process.argv.slice(2);
if(!saved||!original||!reference)throw Error('Supply an existing private plan, retained original and normalized guide. Nothing is generated or reviewed.');
const outputs=resolve('outputs'),out=resolve(destination),rel=relative(outputs,out);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Review artifacts must stay under local outputs/.');
const prior=JSON.parse(await readFile(saved,'utf8')),input=structuredClone(prior.input),raw=await readFile(original),png=await readFile(reference);
if(heroSha(raw)!==input.source.originalSha256||heroSha(png)!==input.source.sha256)throw Error('Retained source bytes do not match the saved plan.');
if(input.productId)throw Error('Benchmark needs the original unassigned nine-roll photograph, not a two-roll SKU.');
input.intent='campaign';input.constraints={...input.constraints,exactCount:true,arrangement:'exactly'};input.seed=42;
const context=creativeContext(input),concepts=fallbackConcepts(input,context),plan=assembleCreativePlan(input,concepts,{mode:'deterministic',reason:'Local text model missing: rule-based proposal only; no AI planning or image inference.'},heroSha(JSON.stringify(input)).slice(0,16));
const variants=plan.concepts.map(c=>selectCreativePlan(plan,c.id,heroSha(plan.id+c.id).slice(0,16)));
for(const p of variants){validateGenerationDraft(p.draft);if(draftReviewed(p.draft))throw Error('Proposal must never carry a reviewed snapshot.');}
const graph=await qwenWorkflow(),contract=await qwenContract(),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const codeDirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8'}).trim());
const proposal={status:'UNREVIEWED_CAMPAIGN_PROPOSAL_NOT_AN_EXECUTION_REQUEST',codeCommit:commit,codeDirty,paidApproved:false,privateUploadApproved:false,ownerApproved:false,generationRun:false,source:input.source,seed:42,model:contract.id,modelPromptSha256:heroSha(plan.draft.modelPrompt),workflowTemplateSha256:heroSha(JSON.stringify(graph)),workflowFileSha256:contract.graphSha256,workflowTemplate:graph,modelFiles:contract.files,constraints:context.controls,quality:conceptQuality(concepts,context),expectedIntent:'New background, deliberate editorial/graphic placement and directional light; same nine-roll grouping, individual positions, frosting and white dish. No extra food, added logo or invented offer. Inspect all inferred geometry after a separately authorized run.',selectedPlan:plan,alternatives:variants};
await mkdir(out,{recursive:true});await copyFile(reference,join(out,'reference.png'));await writeFile(join(out,'campaign-proposal.json'),JSON.stringify(proposal,null,2));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await writeFile(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Private creative intelligence review</title><style>body{font:16px system-ui;margin:32px;max-width:1200px}img{max-width:300px;max-height:350px}article{border-top:1px solid #888;padding:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}</style><h1>No Crumbs: campaign planning review</h1><p>PRIVATE LOCAL PROPOSALS. Deterministic planning, no AI text/image inference. No owner approval or paid/private-upload authorization. Existing original and all earlier outputs remain unchanged.</p><img src="reference.png" alt="Retained original nine-roll reference"><p>Code '+esc(commit)+'</p><details><summary>Business evidence versus actual art-direction preferences</summary><pre>'+esc(JSON.stringify(context,null,2))+'</pre></details><section>'+variants.map(p=>{const c=p.concepts.find(c=>c.id===p.selectedId);return '<article><h2>'+esc(c.title)+'</h2><p>'+esc(c.idea)+'</p><p>'+esc(c.composition)+'</p><p>'+esc(c.environment)+'</p><p>'+esc(c.lighting)+'</p><details><summary>Exact unreviewed Qwen prompt</summary><pre>'+esc(p.draft.modelPrompt)+'</pre></details><details><summary>Full structured evidence brief</summary><pre>'+esc(p.draft.prompt)+'</pre></details></article>';}).join('')+'</section><p>Prompt differences are contract-tested, not proof of better generated fidelity or commercial quality. New in-app owner review and separate execution approval are required.</p><a href="campaign-proposal.json">Full local proposal and hashes</a>');
console.log(JSON.stringify({out,commit,source:input.source.sha256,proposalReviewed:false,paidApproved:false,privateUploadApproved:false,quality:proposal.quality},null,2));
