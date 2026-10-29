// Existing application API only, bound to loopback on the approved GPU host.
import {defineConfig} from 'vite';
import {comfyApi} from '../../shared/runtime/api.ts';
export default defineConfig({
  appType:'custom',plugins:[comfyApi(process.env)],
  optimizeDeps:{noDiscovery:true,include:[]},
  server:{host:'127.0.0.1',port:28301,strictPort:true,
    fs:{strict:true,deny:['.env','.env.*','**/.git/**','**/.venv/**','**/node_modules/**']}}
});
