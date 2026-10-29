// Separate worktree + origin. Does not start/stop the generator on 8301.
import {createServer} from 'vite';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const server=await createServer({root,configFile:resolve(root,'vite.config.ts'),cacheDir:resolve(root,'.journey-cache'),server:{host:'127.0.0.1',port:8302,strictPort:true,hmr:false},define:{__ADSTUDIO_BUILD__:JSON.stringify('creative-journey-preview')}});
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,async()=>{await server.close();process.exit(0);});
await server.listen();console.log('Journey ready: http://127.0.0.1:8302/adstudio/journey.html');
