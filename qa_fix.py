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
print('billing providers (must be empty):', call('/api/console/billing','GET',None,A)[1])
s,p=call('/api/console/products','POST',{'name':'ID Check Item','price':1.23},A)
print('product create id:', p.get('id'), '| name:', p.get('name'))
s,u=call('/api/auth/login','POST',{'deviceId':'mchk','name':'M','country':'BD'})
print('user methods (empty ok):', call('/api/payments/methods','GET',None,{'Authorization':'Bearer '+u['token']}))
print('routes:', [(r, urllib.request.urlopen(B+r).status) for r in ['/app/console/products','/app/console/billing','/app/console/api-docs','/app/console/merchants']])
print('QA DONE')
