"""Pre-Pod gated-file access test. HEAD only, never weight download/upload/billing."""
import json, os, pathlib, sys, urllib.error, urllib.request
from weights import SafeRedirect
def main():
    if sys.argv[1:]!=['--check-head']:
        print('DRY RUN: use --check-head with a privately supplied HF_TOKEN to check gated access. No model download.');return
    token=os.environ.get('HF_TOKEN')
    if not token:raise RuntimeError('HF_TOKEN is missing. Accept repository terms and supply a read token privately before reserving any GPU.')
    pins=json.loads(pathlib.Path(__file__).with_name('pins.json').read_text());opener=urllib.request.build_opener(SafeRedirect())
    for w in pins['weights']:
        url=f"https://huggingface.co/{pins['modelRepo']}/resolve/{pins['modelRevision']}/{w['path']}"
        req=urllib.request.Request(url,method='HEAD',headers={'Authorization':'Bearer '+token})
        try:
            with opener.open(req,timeout=20) as r:
                size=r.headers.get('Content-Length') or r.headers.get('X-Linked-Size')
                if r.status!=200 or size is None or int(size)!=w['bytes']:raise RuntimeError('Unexpected file metadata for '+w['path'])
        except urllib.error.HTTPError as e:raise RuntimeError(f'Gated access failed: HTTP{e.code}; check account terms/token before paying for a Pod') from None
        print('HEAD access/size verified:',w['path'])
    print('PASS gated access for all five pins. No weight bytes downloaded. This does not approve deployment.')
if __name__=='__main__':main()
