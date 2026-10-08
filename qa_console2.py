import json, urllib.request, urllib.error
B='http://localhost:3000'
A={'x-admin-key':'else-admin-123'}
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}; hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    try:
        with urllib.request.urlopen(req) as r:
            return (r.status, json.loads(r.read().decode()))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:200])
# fund user via balance hack: use admin config min 0 then earn? simplest: direct db topup not possible, so lower min + use referral? Use existing rich user qa-A
s,u=call('/api/auth/login','POST',{'deviceId':'qa-A','name':'QA A','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
print('bal', call('/api/wallet','GET',None,H)[1]['balance'])
print('disabled Nagad blocked?', call('/api/withdraw','POST',{'amount':10,'method':'Nagad','account':'x'},H))
# restore bkash default off fee 2
print('restore', call('/api/console/billing/provider/bkash','POST',{'enabled':False,'feePct':2},A))
print('methods now', call('/api/payments/methods','GET',None,H))
print('DONE')
