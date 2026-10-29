import {createRoot} from 'react-dom/client';
import {Component,type ReactNode} from 'react';
import {AdStudio} from './app.tsx';
import {WorkspaceStore} from '../workspace-store.ts';
import {openProjectDriver,memoryDriver} from '../projects.ts';
import {AdApplication} from '../ad-application.ts';
import {openCampaignReview} from '../review-handoff.ts';
import './app.css';
class WorkspaceBoundary extends Component<{children:ReactNode},{error:string}>{
 state={error:''};
 static getDerivedStateFromError(error:Error){return {error:error.message};}
 render(){return this.state.error?<section className="boot"><h1>This workspace needs attention.</h1><p>{this.state.error}</p><p>Your saved projects and original files have not been reset.</p><button onClick={()=>location.reload()}>Retry opening workspace</button><a href="./">Creative Journey →</a><a href="./tools.html#hero">Open specialist tools →</a></section>:this.props.children;}
}
async function start(){
 if(['#static','#create','#compose'].includes(location.hash)){location.replace('./tools.html'+location.hash);return;}
 let driver,durable=true;try{driver=await openProjectDriver();}catch{driver=memoryDriver();durable=false;}
 // Validate all records before writes. Never replace failed reads with a demo.
 let remember:Storage|undefined;try{remember=localStorage;}catch{/* Explicit session-only warning in store. */}
 const store=await new WorkspaceStore(driver,remember,openProjectDriver,durable).initialize(),app=new AdApplication(store),root=createRoot(document.getElementById('adstudio-root')!);
 root.render(<WorkspaceBoundary><AdStudio app={app}/></WorkspaceBoundary>);
 // Existing project only, at the same origin. No automatic review or inference.
 void openCampaignReview(location.href,app).then(url=>{if(url)history.replaceState(null,'',url);}).catch(error=>store.report(error));
 window.addEventListener('pagehide',()=>{root.unmount();store.dispose();},{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}
void start().catch(error=>{const root=document.getElementById('adstudio-root')!;root.replaceChildren();const section=document.createElement('section');section.className='boot';const title=document.createElement('h1');title.textContent='Your workspace could not be opened.';const detail=document.createElement('p');detail.textContent=error.message+' Existing projects and original files have not been reset. Keep this browser profile and retry when storage is available.';const button=document.createElement('button');button.textContent='Retry opening workspace';button.onclick=()=>location.reload();section.append(title,detail,button);root.append(section);});
