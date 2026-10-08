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
print('overview', call('/api/console/overview','GET',None,A)[0])
print('billing', call('/api/console/billing','GET',None,A))
print('toggle bkash', call('/api/console/billing/provider/bkash/toggle','POST',{},A))
print('set bkash fee', call('/api/console/billing/provider/bkash','POST',{'feePct':2.5},A)[0])
print('auth-get', call('/api/console/auth-settings','GET',None,A)[0])
print('auth-save', call('/api/console/auth-settings','POST',{'vpnBlock':True},A)[0])
print('webhooks', call('/api/console/webhooks','GET',None,A))
# user withdraw with enabled method + fee
s,u=call('/api/auth/login','POST',{'deviceId':'pay-qa','name':'Pay QA','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
print('methods (need login)', call('/api/payments/methods','GET',None,H))
print('withdraw disabled method blocked?', call('/api/withdraw','POST',{'amount':10,'method':'Nagad','account':'x'},H))
print('routes:', [(r, urllib.request.urlopen(B+r).status) for r in ['/app/console','/app/console/billing','/app/console/authentication','/app/console/payments','/app/console/rates','/app/console/users','/app/console/settings']])
print('CONSOLE QA DONE')
