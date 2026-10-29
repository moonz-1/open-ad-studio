// Pure upload/submission guard. No network, credentials or side effects.
export function validateRunGate(lease,watch,health,pinsHash,now=Date.now()/1000){
 const finite=k=>typeof lease[k]==='number'&&Number.isFinite(lease[k]);
 if(lease.version!==1||!/^[-a-zA-Z0-9_]+$/.test(lease.podId)||!lease.name?.startsWith('adstudio-ltx25-')||!['created','deadline','gpuRate','storageHourly','sessionCap','feesUSD'].every(finite)||lease.created<=0||lease.created>now+30||lease.deadline-lease.created>9000||lease.deadline-now<1800||lease.gpuRate<=0||lease.gpuRate>1.79||lease.storageHourly<0||lease.storageHourly>.04||lease.sessionCap<=0||lease.sessionCap>6||lease.feesUSD<0||(lease.deadline-lease.created)/3600*(lease.gpuRate+lease.storageHourly)+lease.feesUSD>lease.sessionCap||lease.networkVolumeId!==null)throw Error('Invalid/expired approved lease or insufficient session time');
 const matches=p=>['podId','created','deadline'].every(k=>p?.[k]===lease[k]);
 if(!matches(watch)||watch.state!=='armed'||!Number.isFinite(watch.checked)||now-watch.checked<0||now-watch.checked>45)throw Error('Fresh external watchdog heartbeat required before private upload');
 if(!matches(health)||health.ready!==true||health.pinsSha256!==pinsHash||!Number.isFinite(health.checked)||health.checked<lease.created||health.checked>now||!/A100/.test(health.gpu)||!Number.isFinite(health.vram)||health.vram<79*1024**3||!Number.isFinite(health.ram)||health.ram<100*1024**3||health.torch!=='2.10.0+cu128'||health.cuda!=='12.8')throw Error('Matching remote health/weight-hash report required before private upload');
 return true;
}
