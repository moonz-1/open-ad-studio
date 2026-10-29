import {mkdir,readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {trainingInput,type TrainingRun} from '../lib/training.ts';
export * from '../lib/training.ts';
export async function trainingRuns(root:string):Promise<TrainingRun[]>{
 const folder=join(root,'training-runs');const files=await readdir(folder).catch(()=>[]);
 const runs=await Promise.all(files.filter(file=>/^[a-f0-9]{32}\.json$/.test(file)).slice(-200).map(async file=>{try{const run=JSON.parse(await readFile(join(folder,file),'utf8'));trainingInput(run);if(run.id!==file.slice(0,-5)||!['running','complete','error'].includes(run.status))return null;return run as TrainingRun}catch{return null}}));
 return runs.filter((run):run is TrainingRun=>!!run).sort((a,b)=>b.createdAt-a.createdAt);
}
export async function saveTrainingRun(root:string,run:TrainingRun){
 if(!/^[a-f0-9]{32}$/.test(run.id))throw Error('Invalid training ID.');const folder=join(root,'training-runs');await mkdir(folder,{recursive:true});const path=join(folder,run.id+'.json');await writeFile(path+'.tmp',JSON.stringify(run,null,2));await rename(path+'.tmp',path);
}
