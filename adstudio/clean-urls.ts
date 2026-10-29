import type {Connect,Plugin} from 'vite';

/** Clean URLs for Open Ad Studio only (no Cinema Studio / Director routes). */
const pages:Record<string,string>={
 '/adstudio':'/adstudio/index.html',
 '/adstudio/workspace':'/adstudio/workspace.html',
 '/adstudio/tools':'/adstudio/tools.html',
 '/adstudio/journey':'/adstudio/journey.html',
};

export function adstudioRoute(raw:string):{redirect?:string;rewrite?:string}{
 const query=raw.indexOf('?'),path=query<0?raw:raw.slice(0,query),search=query<0?'':raw.slice(query);
 if(path==='/'||path==='/index.html')return {redirect:'/adstudio/'+search};
 if(path==='/adstudio'||path==='/adstudio/')return {rewrite:'/adstudio/index.html'+search};
 for(const [clean,html]of Object.entries(pages)){
  if(path===html)return {rewrite:html+search};
  if(path===clean+'/')return {redirect:clean+search};
  if(path===clean)return {rewrite:html+search};
 }
 return {};
}

export function cleanAdStudioUrls():Plugin{
 const route:Connect.NextHandleFunction=(request,response,next)=>{
  if(!['GET','HEAD'].includes(request.method||''))return next();
  const result=adstudioRoute(request.url||'/');
  if(result.redirect){response.statusCode=308;response.setHeader('Location',result.redirect);response.end();return;}
  if(result.rewrite)request.url=result.rewrite;
  next();
 };
 return {name:'adstudio-clean-urls',configureServer(server){server.middlewares.use(route)},configurePreviewServer(server){server.middlewares.use(route)}};
}
