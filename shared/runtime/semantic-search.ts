export type SearchDocument={id:string;text:string};
export function searchInput(body:unknown):{query:string;documents:SearchDocument[]}{
 const value=body as {query?:unknown;documents?:unknown};
 if(typeof value?.query!=='string'||!value.query.trim()||value.query.length>256||!Array.isArray(value.documents)||!value.documents.length||value.documents.length>128)throw Error('Search needs a query under 256 characters and up to 128 descriptions.');
 const ids=new Set<string>();
 const documents=value.documents.map((entry:unknown)=>{const doc=entry as SearchDocument;if(!doc||typeof doc.id!=='string'||!doc.id||doc.id.length>128||ids.has(doc.id)||typeof doc.text!=='string'||doc.text.length>1200)throw Error('Invalid search description.');ids.add(doc.id);return {id:doc.id,text:doc.text}});
 return {query:value.query.trim(),documents};
}
export function searchResults(documents:SearchDocument[],scores:unknown){
 if(!Array.isArray(scores)||scores.length!==documents.length||scores.some(score=>typeof score!=='number'||!Number.isFinite(score)||score< -1.001||score>1.001))throw Error('Local search returned invalid scores.');
 return documents.map((doc,index)=>({id:doc.id,score:scores[index] as number})).sort((a,b)=>b.score-a.score);
}
