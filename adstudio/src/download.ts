// Initiating a browser download is observable; completion in the OS is not.
export type Download=(blob:Blob,name:string)=>void|Promise<void>;
export const browserDownload:Download=(blob,name)=>{
 let url='',link:HTMLAnchorElement|undefined;
 try{url=URL.createObjectURL(blob);link=document.createElement('a');link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();}
 catch{if(url)URL.revokeObjectURL(url);throw Error('The browser could not start the download. Saved work is unchanged; check download permissions and try the saved file again.');}
 finally{link?.remove();}
 setTimeout(()=>URL.revokeObjectURL(url),60000);
};
