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
print('products', call('/api/console/products','GET',None,A)[0])
s,p=call('/api/console/products','POST',{'name':'QA Pack','price':0.009},A)
print('create', s, p.get('id') if isinstance(p,dict) else p)
print('toggle', call('/api/console/products/'+p['id']+'/toggle','POST',{},A)[0])
print('notif', call('/api/console/notifications','GET',None,A)[0])
print('notif-save', call('/api/console/notifications','POST',{'pushTitle':'Else!'},A)[0])
print('dev', call('/api/console/developers','GET',None,A)[0])
print('regen', call('/api/console/developers/regenerate','POST',{'key':'webhookSecret'},A)[0])
print('txs', call('/api/console/transactions','GET',None,A)[0])
print('reports', call('/api/console/reports','GET',None,A)[0])
print('events', call('/api/console/events','GET',None,A)[0])
print('routes:')
for r in ['/app/console','/app/console/products','/app/console/payments','/app/console/transactions','/app/console/customers','/app/console/billing','/app/console/notifications','/app/console/webhooks','/app/console/developers','/app/console/reports','/app/console/authentication','/app/console/rates','/app/console/users','/app/console/settings']:
    print(' ', r, urllib.request.urlopen(B+r).status)
print('PADDLE QA DONE')
