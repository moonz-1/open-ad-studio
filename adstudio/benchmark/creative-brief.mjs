// Deterministic evidence-authored briefs. No LLM, vision inference or IO.
export function validateBrief(b) {
  const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 3000;
  const list = v => Array.isArray(v) && v.length > 0 && v.length <= 30 && v.every(text);
  if (!b || b.version !== 1 || !/^[a-z][a-z0-9-]{0,40}$/.test(b.id) || !text(b.product)
      || !Array.isArray(b.evidence) || !b.evidence.length || b.evidence.length > 30) throw Error('Invalid creative brief identity/evidence');
  const ids = new Set();
  for (const e of b.evidence) {
    if (!text(e.id) || ids.has(e.id) || !['manual-photo-observation','website-extract'].includes(e.kind)
        || !/^[a-f0-9]{64}$/.test(e.sha256) || !text(e.source)) throw Error('Unsupported or untraceable evidence');
    ids.add(e.id);
  }
  if (!Array.isArray(b.facts) || !b.facts.length || b.facts.length > 30 || b.facts.some(f =>
    !text(f.text) || !Array.isArray(f.evidenceIds) || !f.evidenceIds.length || f.evidenceIds.some(id => !ids.has(id)))) throw Error('Every fact needs recorded evidence');
  for (const key of ['preserve','allowedChanges','forbidden']) if (!list(b[key])) throw Error('Missing brief list: '+key);
  for (const key of ['camera','composition','lighting','environment','negativeSpace','referenceInstruction']) if (!text(b[key])) throw Error('Missing brief field: '+key);
  if (!Array.isArray(b.uncertainties) || !b.uncertainties.every(text)) throw Error('Label unknowns explicitly');
  return b;
}

export function compileQwenBrief(brief) {
  const b = validateBrief(brief);
  return [
    `Make a believable commercial PRODUCT PHOTOGRAPH of ${b.product} by editing image 1. ${b.referenceInstruction}`,
    'SOURCE OBSERVATIONS (visually checked against the source, not permission to redesign the food): '+b.facts.map(f=>f.text).join(' '),
    'IDENTITY PRIORITIES: '+b.preserve.join(' '),
    'ALLOWED PHOTOGRAPHIC CHANGES: '+b.allowedChanges.join(' '),
    'CAMERA: '+b.camera,
    'COMPOSITION: '+b.composition,
    'LIGHT: '+b.lighting,
    'ENVIRONMENT: '+b.environment,
    'COPY SPACE: '+b.negativeSpace+' Leave it empty: no actual text or graphics.',
    'DO NOT INVENT: '+b.forbidden.join(' '),
    'Avoid smoothing the food into a generic perfect pastry. Natural irregularities are identity cues, not defects to correct.'
  ].join('\n\n');
}

export async function campaignGraph(brief) {
  validateBrief(brief);
  const {qwenGraph} = await import('./qwen-hero.mjs');
  const graph = await qwenGraph('lighting','fp8');
  graph['6'].inputs.prompt = compileQwenBrief(brief);
  graph['15'].inputs.filename_prefix = 'adstudio-creative-'+brief.id+'-raw';
  return graph;
}

export function validateCampaign(plan) {
  if (!plan || plan.version !== 1 || plan.model !== 'Qwen-Image-Edit-2511-FP8'
      || !Array.isArray(plan.cases) || plan.cases.length !== 3
      || plan.cases.map(c=>c.id).join(',') !== 'authenticity,intimate,campaign') throw Error('Expected exactly the three prepared concepts');
  for (const c of plan.cases) {
    validateBrief(c.brief);
    if (c.id !== c.brief.id || c.seed !== 42 || c.prompt !== compileQwenBrief(c.brief)
        || !c.reference || !['original','original-crop'].includes(c.reference.kind)
        || typeof c.reference.path !== 'string' || !/^[a-f0-9]{64}$/.test(c.reference.sha256)
        || typeof c.reference.originalPath !== 'string' || !/^[a-f0-9]{64}$/.test(c.reference.originalSha256)) throw Error('Campaign prompt/reference provenance mismatch');
  }
  return plan;
}
