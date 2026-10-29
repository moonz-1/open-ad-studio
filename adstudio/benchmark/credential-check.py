"""Opt-in GET-only check. Never proves DELETE permission or personal identity."""
import argparse, base64, datetime, getpass, hashlib, json, os, pathlib, re
from lifecycle import request, amount

def check(args):
    if args.billing_only:
        status,billing=request('/billing?lastN=1&bucketSize=month')
        if status!=200:raise RuntimeError('Billing read failed')
        total=amount(billing['metadata']['totals']['totalAmount'])
        if total!=0:raise RuntimeError('Nonzero current-month billing; reconcile allocation before deployment')
        return {'currentMonthSpendUSD':total,'billingRead':True}
    if not args.public_key:raise ValueError('Dedicated .pub path required; never pass a private key')
    path=pathlib.Path(args.public_key)
    if path.suffix!='.pub':raise ValueError('Only .pub public-key files accepted')
    parts=path.read_text().split()
    if len(parts)<2 or parts[0]!='ssh-ed25519':raise ValueError('Expected dedicated ED25519 public key')
    expected=parts[:2]
    status,keys=request('/account/ssh-keys')
    if status!=200 or not any(k.split()[:2]==expected for k in keys['keys']):raise RuntimeError('Dedicated public key does not match credential account')
    status,pods=request('/pods?includeClusterPods=true&limit=1000')
    if status!=200 or not isinstance(pods.get('pods'),list) or pods['pagination']['hasNextPage'] or pods['pods']:
        raise RuntimeError('Expected complete empty Pod inventory before first experiment')
    fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(base64.b64decode(expected[1],validate=True)).digest()).decode().rstrip('=')
    return {'dedicatedPublicKeyFingerprint':fingerprint,'podCount':0,'completeInventory':True}

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument('--check-read-only',action='store_true')
    parser.add_argument('--billing-only',action='store_true')
    parser.add_argument('--public-key',required=False)
    parser.add_argument('--out',help='Optional sanitized JSON evidence in a gitignored outputs/ folder')
    args=parser.parse_args(argv)
    if not args.check_read_only:
        print('DRY RUN: credential check needs --check-read-only; no requests.');return
    target=None
    if args.out:
        target=pathlib.Path(args.out).resolve()
        if not target.is_relative_to(pathlib.Path('outputs').resolve()):raise ValueError('Evidence must stay in local outputs/')
        # Invalidate stale success before prompting or making requests.
        target.parent.mkdir(parents=True,exist_ok=True)
    report={'version':1,'checkedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'mode':'billing' if args.billing_only else 'termination-read', 'status':'NOT RUN',
            'credentialSource':'environment' if os.environ.get('RUNPOD_API_KEY') else 'hidden-prompt',
            'limitations':['Does not prove DELETE scope, personal account identity, credit balance or automatic termination.']}
    def save():
        if target:
            temporary=target.with_suffix('.tmp');temporary.write_text(json.dumps(report,indent=2));temporary.replace(target)
    save()
    try:
        if not os.environ.get('RUNPOD_API_KEY'):
            # Refuse getpass's echoing fallback when invoked without a real console.
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('error',getpass.GetPassWarning)
                os.environ['RUNPOD_API_KEY']=getpass.getpass('Temporary '+('read-only billing' if args.billing_only else 'Runpod termination')+' key (hidden): ')
        if not os.environ['RUNPOD_API_KEY']:raise ValueError('Missing credential')
        report['checks']=check(args);report['status']='PASS';save()
        print('PASS GET-only '+report['mode']+' checks. No credential saved; identity, balance and DELETE scope remain separate.')
    except BaseException as error:
        report['status']='FAIL';report['errorType']=type(error).__name__;save()
        safe_http=re.fullmatch(r'Runpod (GET|DELETE): HTTP (\d{3})',str(error))
        if safe_http:report['httpStatus']=int(safe_http[2]);save()
        # Provider bodies/exception details must never enter credential evidence.
        print('FAIL '+report['mode']+': '+type(error).__name__+'; inspect account permissions/connectivity privately.')
        return 1
    finally:os.environ.pop('RUNPOD_API_KEY',None)
    return 0

if __name__=='__main__':raise SystemExit(main())
