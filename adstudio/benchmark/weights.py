"""Remote-only exact-file downloader. No download on import/default invocation."""
import hashlib, json, os, pathlib, re, sys, time, urllib.parse, urllib.request
from lifecycle import require_armed, validate_lease, terminate_until_gone

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if urllib.parse.urlparse(newurl).scheme!='https':raise RuntimeError('Refuse insecure model redirect')
        redirected=super().redirect_request(req,fp,code,msg,headers,newurl)
        if redirected is not None:
            redirected.method=req.get_method()  # HEAD must never become a weight GET.
            if urllib.parse.urlparse(newurl).netloc!=urllib.parse.urlparse(req.full_url).netloc:
                redirected.remove_header('Authorization')
        return redirected

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(16*1024*1024), b''): h.update(b)
    return h.hexdigest()

def download_weight(pins,w,base,token,guard,opener=None):
    guard()
    path=base/w['path'];path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists():
        if path.stat().st_size==w['bytes'] and digest(path)==w['sha256']:return
        raise RuntimeError('Existing mismatched weight; refuse to overwrite: '+str(path))
    part=path.with_suffix(path.suffix+'.part');offset=part.stat().st_size if part.exists() else 0
    if offset>=w['bytes']:
        if offset==w['bytes'] and digest(part)==w['sha256']:part.rename(path);return
        raise RuntimeError('Invalid complete/oversized partial weight; inspect it before retry')
    url=f"https://huggingface.co/{pins['modelRepo']}/resolve/{pins['modelRevision']}/{w['path']}"
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,**({'Range':f'bytes={offset}-'} if offset else {})})
    opener=opener or urllib.request.build_opener(SafeRedirect())
    with opener.open(req,timeout=60) as response:
        if offset:
            content_range=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',response.headers.get('Content-Range',''))
            if response.status!=206 or not content_range or int(content_range[1])!=offset or int(content_range[3])!=w['bytes']:
                raise RuntimeError('Range not honored/mismatched; refusing to append')
        with part.open('ab' if offset else 'wb') as out:
            while data:=response.read(16*1024*1024):guard();out.write(data)
    if part.stat().st_size!=w['bytes'] or digest(part)!=w['sha256']:raise RuntimeError('Weight size/SHA mismatch: '+w['path'])
    part.rename(path);print('Verified:',w['path'])

def main():
    if sys.argv[1:]!=['--approved']:
        print('DRY RUN: five pinned BF16 files (~71.1GB). Requires explicit approval and gated HF access.');return
    pins=json.loads(pathlib.Path(__file__).with_name('pins.json').read_text())
    lease=json.loads(pathlib.Path(os.environ['BENCHMARK_LEASE']).read_text())
    validate_lease(lease)
    def guard():
        require_armed(lease,os.environ['BENCHMARK_WATCHDOG_READY'])
        if time.time()>lease['created']+2700:raise RuntimeError('45-minute bootstrap limit exceeded; terminate and report')
    try:
        guard()
        for weight in pins['weights']:download_weight(pins,weight,pathlib.Path('/workspace/adstudio-benchmark/ComfyUI/models'),os.environ['HF_TOKEN'],guard)
    except Exception:
        print('Weight bootstrap failed; terminating this approved lease before further spending.',flush=True)
        terminate_until_gone(lease)
        raise
if __name__=='__main__':main()
