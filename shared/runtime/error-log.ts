import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {errorText,type ErrorEntry} from '../lib/error-log.ts';
export class ErrorJournal{
 private entries:ErrorEntry[]=[];
 private path:string;
 constructor(path:string){this.path=path;try{if(existsSync(path)&&statSync(path).size<4_000_000){const value=JSON.parse(readFileSync(path,'utf8'));if(Array.isArray(value))this.entries=value.filter(entry=>typeof entry?.id==='string'&&Number.isFinite(entry.at)&&typeof entry.message==='string').slice(-100).map(entry=>({...entry,source:errorText(entry.source,120),message:errorText(entry.message,1000),details:errorText(entry.details)}))}}catch{}}
 private persist(){try{mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path+'.tmp',JSON.stringify(this.entries));renameSync(this.path+'.tmp',this.path)}catch{/* Logging must never interrupt the application. */}}
 add(source:string,error:unknown,meta:{requestId?:string;status?:number}={}){const cause=error instanceof Error?error:Error(String(error));const requestId=meta.requestId&&/^[a-f0-9]{32}$/.test(meta.requestId)?meta.requestId:undefined;this.entries.push({id:randomUUID(),at:Date.now(),source:errorText(source,120),message:errorText(cause.message,1000),details:errorText(cause.stack||cause.message),...(requestId?{requestId}:{}),...(meta.status?{status:meta.status}:{})});this.entries=this.entries.slice(-100);this.persist()}
 list(){return this.entries.slice().reverse().map(entry=>({...entry}))}
 clear(){this.entries=[];this.persist()}
}
