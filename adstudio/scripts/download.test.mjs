// Fake DOM only: prove download request/cleanup/failure semantics, not Chrome
// download completion. No controller, browser profile or network.
import assert from 'node:assert/strict';
import {browserDownload} from '../src/download.ts';
const previous={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout};
let clicks=0,removed=0,revoked=0,fail=false,attached=false,link;
try{
 URL.createObjectURL=()=> 'blob:MOCK';URL.revokeObjectURL=url=>{assert.equal(url,'blob:MOCK');revoked++;};globalThis.setTimeout=fn=>{fn();return 1;};
 globalThis.document={createElement:tag=>{assert.equal(tag,'a');return link={click:()=>{assert.ok(attached);clicks++;if(fail)throw Error('MOCK blocked click');},remove:()=>{removed++;attached=false;}};},body:{append:a=>{assert.equal(a,link);attached=true;}}};
 await browserDownload(new Blob(['MOCK FILE']),'advertisement.png');assert.equal(clicks,1);assert.equal(link.download,'advertisement.png');assert.equal(removed,1);assert.equal(revoked,1);
 fail=true;assert.throws(()=>browserDownload(new Blob(['SAVED FILE']),'saved.png'),/Saved work is unchanged/);assert.equal(clicks,2);assert.equal(removed,2);assert.equal(revoked,2);assert.equal(attached,false);
 console.log('PASS fake-DOM download initiation, attached anchor, filename, cleanup and explicit blocked-download error. Browser completion remains unverified.');
}finally{globalThis.document=previous.document;URL.createObjectURL=previous.create;URL.revokeObjectURL=previous.revoke;globalThis.setTimeout=previous.timer;}
