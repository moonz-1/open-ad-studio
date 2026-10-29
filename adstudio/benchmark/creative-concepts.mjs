// Creative decisions are suggestions, separate from source-supported facts.
export function cinnamonConcepts({originalSha256,websiteSha256,website}) {
  const evidence = [
    {id:'photo-1',kind:'manual-photo-observation',sha256:originalSha256,source:'Original heroshotV2_og.jpeg; manually inspected'},
    {id:'brand-1',kind:'website-extract',sha256:websiteSha256,source:website}
  ];
  const facts = [
    {text:'The original full-pan photograph, before any crop, shows nine cinnamon rolls in a three-by-three arrangement in a white rectangular baking dish.',evidenceIds:['photo-1']},
    {text:'Rolls are irregular and pillow-shaped, with uneven exposed cinnamon seams, folded dough, browned edges and thick pale hand-spread frosting.',evidenceIds:['photo-1']},
    {text:'Frosting has broad drag marks, raised ridges, uneven coverage and small glossy highlights; spiral centers are not uniform circles.',evidenceIds:['photo-1']},
    {text:'The brand name is No Crumbs Bakery.',evidenceIds:['brand-1']}
  ];
  const base = {
    version:1,product:'the authentic No Crumbs cinnamon rolls in the original photograph',evidence,facts,
    preserve:['Retain the irregular folded dough silhouette and individual cinnamon seams.','Keep the observed thick, uneven hand-spread frosting and its drag marks; light can change its highlights, but do not repaint it into thin smooth glaze.','Keep the original white baking dish wherever the dish is visible.'],
    forbidden:['No new ingredients, dust, garnish, berries, nuts, chocolate, extra food, steam or hands.','No new packaging, branded props, logo, letters, typography, price or sales claims.','No standardized perfect round swirls, plastic frosting or liquid waterfalls.'],
    uncertainties:[]
  };
  return [
    {...structuredClone(base),id:'authenticity',
      referenceInstruction:'Image 1 is the original full-pan photograph. This is a restrained photographic correction, not a new batch of rolls.',
      preserve:[...base.preserve,'Keep all nine individually recognizable rolls, their arrangement, relative sizes and the baking marks on the original dish. Fidelity takes priority over polish.'],
      allowedChanges:['Replace only the surrounding countertop and improve photographic light, white balance and exposure.','Allow slightly wider framing to make the dish readable; retain the original overhead view.'],
      camera:'Direct overhead, natural perspective, deep enough focus to read the whole batch. Do not rotate into a three-quarter angle.',
      composition:'Full nine-roll dish fills the lower three quarters of a portrait photograph. Keep the pan and handles inside the frame; no elaborate styling.',
      lighting:'Large soft window from upper left, gentle fill on the shadow side, neutral whites and warm baked edges. Keep real frosting surface relief, not broad blown-out shine.',
      environment:'Quiet pale warm limestone counter, matte and believable; no props or additional food.',
      negativeSpace:'Reserve about the upper fifth as calm, lightly textured counter for a later short headline.'},
    {...structuredClone(base),id:'intimate',
      referenceInstruction:'Image 1 is a genuine crop of the middle-right roll from the original nine-roll photograph. It is not an AI-enhanced reference. Feature this irregular roll; do not turn it into a newly designed pastry.',
      preserve:[...base.preserve,'The cropped roll has an uneven dark spiral seam, layered folded dough and lopsided frosting coverage. Keep these distinguishing asymmetries.'],
      allowedChanges:['Move closer and explore a shallow three-quarter camera angle.','Use the actual cropped roll as the hero; partial neighboring rolls may remain at the edge, without inventing additional pastries.'],
      camera:'Intimate three-quarter food-editorial close-up. Moderate shallow depth of field: the cinnamon seam and frosting ridges are sharply readable; falloff is gentle, not an artificial blur cutout.',
      composition:'One large irregular pastry is the focal point, off-center low/right. Let the original white dish and partial adjacent dough establish context. Do not force the entire tray into this close-up.',
      lighting:'Soft low side light skims the dough folds and natural frosting ridges, delicate specular detail, no wet-plastic sheen.',
      environment:'Tonal cream and baked chestnut food-editorial setting. Background is the softly receding original white dish, not a new prop display.',
      negativeSpace:'A small quiet pale upper-left area for a brief caption; texture detail and the pastry dominate.',
      uncertainties:['The original is overhead. Any newly visible side/back geometry is inferred, not independently verified.','A crop supplies higher relative product detail; an improvement in conditioning is untested.']},
    {...structuredClone(base),id:'campaign',
      referenceInstruction:'Image 1 supplies the real batch and product identity, not the final set design. Create a distinct campaign photograph without idealizing these pastries into generic cinnamon buns.',
      preserve:[...base.preserve,'Preserve the batch of nine and its varied pillow-like shapes, not nine identical small round buns.'],
      allowedChanges:['Change camera distance and angle, the counter/background and the lighting design.','Frame the original pan diagonally in a substantially different, darker campaign environment.'],
      camera:'A deliberate three-quarter view looking down about 45 degrees, with believable scale and a complete readable baking dish. Focus is on the front-middle irregular rolls; background recedes naturally.',
      composition:'A quiet, dramatic bakery campaign: the white pan runs diagonally through the lower two thirds, with one frosting ridge and cinnamon seam as the focal point. Use strong visual separation and an uncluttered upper third.',
      lighting:'One realistic shaft of warm late window light grazes the pastry and ceramic. Deep chocolate shadows retain detail, with restrained neutral fill; no neon rim, fake rays or theatrical smoke.',
      environment:'An understated dark warm-charcoal stone bakery counter and soft shadowed backplane. A faint real window-frame shadow gives structure. No linen-table breakfast scene, no extra utensils or food.',
      negativeSpace:'Keep the upper third as clean dark warm shadow with a soft tonal gradient, suitable for cream-colored typography added later.',
      uncertainties:['A changed angle reveals hidden geometry which the model must infer. Product/shape fidelity needs strict visual review.','Dark campaign art direction is a creative proposal, not a verified brand rule.']}
  ];
}
