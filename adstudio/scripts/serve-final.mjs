// Isolated final-integration preview. Does not touch 8301 / 8302 / 8303.
import {createServer} from 'vite';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const server=await createServer({
 root,
 configFile:resolve(root,'vite.config.ts'),
 cacheDir:resolve(root,'.final-cache'),
 server:{host:'127.0.0.1',port:8304,strictPort:true,hmr:false},
 define:{__ADSTUDIO_BUILD__:JSON.stringify('adstudio-final-integration')}
});
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,async()=>{await server.close();process.exit(0);});
await server.listen();
console.log('Final Ad Studio: http://127.0.0.1:8304/adstudio/');
