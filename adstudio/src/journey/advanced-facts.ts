/** Live Advanced-field values. Uncontrolled inputs can outrun saved draft props. */
export type FactFieldRoot={querySelector(selectors:string):{value:string}|null};
export function advancedFactsFrom(root:FactFieldRoot|null){
 if(!root)return {};
 const value=(name:string)=>(root.querySelector(`[data-fact="${name}"]`)?.value??'').trim();
 const count=value('count');
 return {
  count:count&&Number.isFinite(Number(count))?Number(count):undefined,
  arrangement:value('arrangement'),
  texture:value('texture'),
  container:value('container'),
 };
}
