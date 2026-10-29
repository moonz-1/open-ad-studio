if(import.meta.env.VITE_ADSTUDIO_RC==='1')document.title='Open Ad Studio · Release candidate';
import {createRoot} from 'react-dom/client';
import {Component,type ReactNode} from 'react';
import {WorkspaceStore} from '../workspace-store.ts';
import {openProjectDriver,memoryDriver} from '../projects.ts';
import {AdApplication} from '../ad-application.ts';
import {JourneyService} from '../journey-service.ts';
import {Journey} from './journey.tsx';
import './journey.css';
import './editorial.css';
class Boundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message};}render(){return this.state.error?<main className="fatal"><h1>Your work is still here.</h1><p>{this.state.error}</p><button onClick={()=>location.reload()}>Reopen workspace</button></main>:this.props.children;}}
async function start(){let driver,durable=true;try{driver=await openProjectDriver();}catch{driver=memoryDriver();durable=false;}let remember:Storage|undefined;try{remember=localStorage;}catch{}const store=await new WorkspaceStore(driver,remember,openProjectDriver,durable).initialize(),app=new AdApplication(store),journey=new JourneyService(app);await journey.recover();const root=createRoot(document.getElementById('journey-root')!);root.render(<Boundary><Journey service={journey}/></Boundary>);window.addEventListener('beforeunload',e=>{if(journey.running||store.getSnapshot().dirty){e.preventDefault();e.returnValue='';}});window.addEventListener('pagehide',()=>{root.unmount();store.dispose();},{once:true});}
void start().catch(e=>{document.getElementById('journey-root')!.textContent='Could not open the saved workspace: '+e.message+'. Existing data has not been reset.';});
