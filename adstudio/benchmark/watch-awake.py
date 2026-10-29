"""Existing Windows host, retained console. No power/API action by default."""
import argparse, ctypes, getpass, json, os, pathlib, warnings
from lifecycle import validate_lease, watch, terminate_until_gone

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--lease');parser.add_argument('--ready-file')
    parser.add_argument('--approved',action='store_true')
    args=parser.parse_args()
    if not args.approved:
        print('DRY RUN: no API calls, credential prompts or power changes.');return
    if os.name!='nt':raise RuntimeError('Windows wrapper only; use lifecycle.py on an existing Linux host')
    if not args.lease or not args.ready_file:raise ValueError('Exact lease and heartbeat path required')
    lease=validate_lease(json.loads(pathlib.Path(args.lease).read_text()))
    awake=ctypes.WinDLL('kernel32',use_last_error=True).SetThreadExecutionState
    awake.argtypes=[ctypes.c_uint];awake.restype=ctypes.c_uint
    try:
        if not os.environ.get('RUNPOD_API_KEY'):
            with warnings.catch_warnings():
                warnings.simplefilter('error',getpass.GetPassWarning)
                os.environ['RUNPOD_API_KEY']=getpass.getpass('Temporary Runpod termination key (hidden): ')
        if not os.environ['RUNPOD_API_KEY']:raise ValueError('Missing key')
        if not awake(0x80000001):raise RuntimeError('Could not request awake state')
        try:watch(lease,args.ready_file)
        except KeyboardInterrupt:
            print('Interrupted: terminating exact approved Pod now');terminate_until_gone(lease)
    finally:
        awake(0x80000000)
        os.environ.pop('RUNPOD_API_KEY',None)

if __name__=='__main__':main()
