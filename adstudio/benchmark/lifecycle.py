"""Two independently hosted watchdogs use the SAME lease/deadline.
No provisioning endpoint exists here. Default is offline dry run.
"""
import argparse, datetime, json, math, os, pathlib, re, sys, time, urllib.error, urllib.parse, urllib.request
BASE='https://api.runpod.io/v2'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('Runpod redirect refused; credential stays on the pinned API origin')

def amount(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<0:
        raise ValueError('Missing/non-finite monetary amount')
    return value

def identity(p,pod):
    if not isinstance(pod,dict) or pod.get('id')!=p['podId'] or pod.get('name')!=p['name']:
        raise RuntimeError('Pod ID/name mismatch; manual intervention required')

def live_rate(p,pod):
    identity(p,pod)
    # v2 only. Never silently use a legacy or adjusted/discounted price field.
    rate=amount(pod.get('cost'))
    if 'costPerHr' in pod:raise ValueError('Mixed v1/v2 Pod response')
    if not 0<rate<=p['gpuRate']+p['storageHourly']:raise ValueError('Unknown/higher live rate')
    return rate
def validate_lease(p, now=None):
    now=time.time() if now is None else now
    valid=(p['version']==1 and isinstance(p['podId'],str) and re.fullmatch(r'[a-zA-Z0-9_-]+',p['podId'])
           and p['name'].startswith('adstudio-ltx25-')
           and all(isinstance(p[k],(int,float)) and not isinstance(p[k],bool) and math.isfinite(p[k]) for k in ['created','deadline','gpuRate','storageHourly','sessionCap','feesUSD'])
           and 0 < p['deadline']-p['created'] <= 9000 and 0 < p['created'] <= now+30
           and 0 < p['gpuRate'] <= 1.79 and 0 <= p['storageHourly'] <= .04 and 0 < p['sessionCap'] <= 6
           and p['networkVolumeId'] is None
           and p['feesUSD']>=0
           and (p['deadline']-p['created'])/3600*(p['gpuRate']+p['storageHourly'])+p['feesUSD']<=p['sessionCap'])
    if not valid: raise ValueError('Invalid lease/budget bounds')
    return p

def require_armed(p, path, now=None):
    now=time.time() if now is None else now
    validate_lease(p,now)
    proof=json.loads(pathlib.Path(path).read_text())
    if expired(p,now) or any(proof.get(k)!=p[k] for k in ['podId','created','deadline']) or proof.get('state')!='armed' or not 0<=now-proof.get('checked',0)<=45:
        raise RuntimeError('No fresh authenticated watchdog heartbeat for this lease; stop before setup/download/upload')
    return True

def write_ready(p,path):
    if not path:return
    target=pathlib.Path(path);target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_suffix(target.suffix+f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps({k:p[k] for k in ['podId','created','deadline']}|{'state':'armed','checked':time.time()}))
    temp.replace(target)
def request(path,method='GET'):
    if method not in ('GET','DELETE') or not path.startswith('/') or path.startswith('//'):
        raise ValueError('Only pinned-origin GET/DELETE operations are supported')
    if method=='DELETE' and not re.fullmatch(r'/pods/[a-zA-Z0-9_-]+',path):
        raise ValueError('DELETE is restricted to an exact Pod ID')
    req=urllib.request.Request(BASE+path,method=method,headers={'Authorization':'Bearer '+os.environ['RUNPOD_API_KEY']})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=10) as r:
            raw=r.read(); return r.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        code=e.code;e.close()
        if code==404: return 404,None
        raise RuntimeError(f'Runpod {method}: HTTP {code}') from None
def expired(p,now):
    # Begin termination 5min early, reserving time for control-plane retries.
    elapsed=max(0,now-p['created'])
    return now>=p['deadline']-300 or elapsed/3600*(p['gpuRate']+p['storageHourly'])+p['feesUSD']>=p['sessionCap']-.20
def terminate(p):
    status,pod=request('/pods/'+p['podId'])
    if status==404:return True
    if status!=200:raise RuntimeError('Pod identity read failed')
    identity(p,pod)
    status,_=request('/pods/'+p['podId'],'DELETE')
    if status not in (200,202,204,404):raise RuntimeError('Termination not acknowledged')
    status,_=request('/pods/'+p['podId'])
    if status==200:identity(p,_)
    return status==404

def terminate_until_gone(p):
    # Never report deletion as successful until the provider confirms absence.
    while True:
        try:
            if terminate(p):print('Termination verified: GET Pod returned404',flush=True);return
        except Exception as e:print('TERMINATION NOT VERIFIED:',type(e).__name__,'check console now',flush=True)
        time.sleep(10)
def audit(p,folder):
    folder.mkdir(parents=True,exist_ok=True)
    status,_=request('/pods/'+p['podId'])
    start=datetime.datetime.fromtimestamp(p['created'],datetime.timezone.utc).isoformat()
    end=datetime.datetime.now(datetime.timezone.utc).isoformat()
    query=urllib.parse.urlencode({'startTime':start,'endTime':end,'bucketSize':'hour','podId':p['podId']})
    billing=request('/billing/pods?'+query)[1]
    rows,total=billing_total(p,billing)
    volumes=request('/network-volumes')[1]
    summary={'checked':end,'podId':p['podId'],'podAbsent':status==404,'billingRows':rows,'reportedCost':total,'networkVolumes':volumes,'billingFinal':False,'note':'Billing can lag. Recheck console and history after meter catches up; absence is not proof of final settled spend.'}
    (folder/'billing-audit.json').write_text(json.dumps(summary,indent=2))
    print('Pod absent:',summary['podAbsent'],'reported session cost:',summary['reportedCost'],'(may lag); private audit saved')
    if status!=404:raise RuntimeError('Pod still exists: termination not verified')

def billing_total(p,billing):
    if not isinstance(billing,dict) or not isinstance(billing.get('records'),list):raise ValueError('Expected v2 billing envelope')
    rows=billing['records'];meta=billing['metadata']
    if meta['query'].get('podId')!=p['podId'] or meta['recordCount']!=len(rows):raise ValueError('Billing query/count mismatch')
    for row in rows:
        if row.get('podId')!=p['podId']:raise ValueError('Foreign Pod in filtered billing')
        if not math.isclose(amount(row.get('totalAmount')),sum(amount(row.get(k)) for k in ['gpuAmount','cpuAmount','diskAmount']),abs_tol=1e-8):raise ValueError('Billing components mismatch')
    total=sum(amount(r.get('totalAmount')) for r in rows)
    if not math.isclose(total,amount(meta['totals'].get('totalAmount')),abs_tol=1e-8):raise ValueError('Billing total mismatch')
    return rows,total

def watch(p,ready_file=None):
    print('Watchdog checking; termination begins at',p['deadline']-300,flush=True)
    while not expired(p,time.time()):
        try:
            status,pod=request('/pods/'+p['podId'])
            if status==404:return
            if status!=200:raise RuntimeError('Pod read failed')
            identity(p,pod)
        except Exception:
            print('Identity/authentication unavailable; readiness not refreshed. Check console.',flush=True)
            time.sleep(5);continue
        try:live_rate(p,pod)
        except (ValueError,TypeError):
            print('Unknown/higher/malformed rate: terminating now',flush=True);break
        try:write_ready(p,ready_file)
        except OSError:print('Cannot publish heartbeat; workers must stop.',flush=True)
        time.sleep(min(15,max(0,p['deadline']-300-time.time())))
    terminate_until_gone(p)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['watch','terminate','audit','verify-ready']);parser.add_argument('--lease',required=True);parser.add_argument('--approved',action='store_true');parser.add_argument('--out',default='outputs/ltx25-benchmark/lifecycle');parser.add_argument('--ready-file')
    args=parser.parse_args();p=validate_lease(json.loads(pathlib.Path(args.lease).read_text()))
    if not args.approved:print('DRY RUN:',args.action,'for named lease; no API calls. Requires explicit user approval.');return
    if args.action=='verify-ready':require_armed(p,args.ready_file);print('Fresh authenticated watchdog heartbeat verified');return
    if args.action=='audit':audit(p,pathlib.Path(args.out));return
    if args.action=='watch':
        try:watch(p,args.ready_file)
        except KeyboardInterrupt:
            print('Interrupted: terminating now',flush=True);terminate_until_gone(p)
        return
    # Retry beyond the deadline until deletion is actually verified; never claim
    # a hard provider guarantee when its control plane is unreachable.
    terminate_until_gone(p)
if __name__=='__main__':main()
