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
s,u=call('/api/auth/login','POST',{'deviceId':'qa-A','name':'QA A','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
print('min0', call('/api/admin/config','POST',{'minWithdraw':0.001},A)[0])
print('disabled Nagad ->', call('/api/withdraw','POST',{'amount':0.002,'method':'Nagad','account':'x'},H))
print('enabled Binance ->', call('/api/withdraw','POST',{'amount':0.002,'method':'Binance','account':'uid123'},H))
print('restore min10', call('/api/admin/config','POST',{'minWithdraw':10},A)[0])
print('DONE')
