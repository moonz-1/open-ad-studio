// One strict loopback production origin, with compiled asset/source verification.
import {preview,loadEnv} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {releaseRoot as root,releaseState,verifiedRelease} from './release-build.mjs';
import {installationId,openBrowser} from './launch-utils.mjs';
const env=loadEnv('production',root,''),port=Number(process.env.OSH_RC_PORT||env.OSH_RC_PORT||8341);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('OSH_RC_PORT must be an integer from 1024 to 65535.');
let build;try{build=await verifiedRelease();}catch(error){
 if((await releaseState()).sourceDirty)throw error;
 const npm=process.env.npm_execpath;if(!npm)throw Error('Run npm run build first, then npm start. '+error.message);
 console.log('Building this clean release revision before startup.');execFileSync(process.execPath,[npm,'run','build'],{cwd:root,env:{...process.env,VITE_ADSTUDIO_RC:'1'},stdio:'inherit',windowsHide:true});build=await verifiedRelease();
}
const url='http://127.0.0.1:'+port+'/adstudio/journey.html',identity={installationId:await installationId(root),sourceKind:build.sourceKind,port,application:'Open Ad Studio',channel:'release-candidate',mode:'production',branch:build.branch,commit:build.commit,sourceSha256:build.sourceSha256,buildManifestSha256:build.manifestSha256,builtAt:build.builtAt,url};
const server=await preview({root,configFile:resolve(root,'vite.config.ts'),mode:'production',preview:{port,host:'127.0.0.1',strictPort:true},plugins:[{name:'release-identity',enforce:'pre',configurePreviewServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/api/release')return next();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(identity));});}}]});
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{server.httpServer.close(()=>process.exit(0));});
await mkdir(resolve(root,'outputs'),{recursive:true});await writeFile(resolve(root,'outputs/release-server.json'),JSON.stringify({...identity,pid:process.pid},null,2));console.log('OPEN AD STUDIO PRODUCTION RC: '+url);console.log('Exact revision '+identity.commit+' / source '+identity.sourceSha256);console.log('Strict loopback port; GPU services are not started.');

if(process.env.OSH_OPEN_BROWSER==='1')openBrowser(url);
