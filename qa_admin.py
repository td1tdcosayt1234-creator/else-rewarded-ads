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
s,acc=call('/api/console/admin-account','GET',None,A)
print('admin account:', acc)
dev=acc['deviceId']
s,u=call('/api/auth/login','POST',{'deviceId':dev,'name':'Admin','country':'US'})
print('login isAdmin:', u['user'].get('isAdmin'), 'bal:', u['user']['balance'])
H={'Authorization':'Bearer '+u['token']}
b0=call('/api/wallet','GET',None,H)[1]['balance']
# admin subscribes to most expensive plan -> balance must NOT drop
plans=call('/api/plans','GET',None,H)[1]
top=max(plans, key=lambda p: p['price'])
s,sub=call('/api/subscribe','POST',{'planId':top['id'],'method':'Else Pay','account':'x'},H)
b1=call('/api/wallet','GET',None,H)[1]['balance']
print('bought', top['name'], '$'+str(top['price']), '| before:', b0, '| after:', b1, '| unlimited:', b0==b1)
print('ADMIN QA DONE')
