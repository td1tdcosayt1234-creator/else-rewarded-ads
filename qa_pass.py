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
print('ID:', acc['deviceId'])
print('PASS:', acc['password'])
dev=acc['deviceId']
print('no-pass blocked:', call('/api/auth/login','POST',{'deviceId':dev,'name':'Admin'}))
print('wrong-pass blocked:', call('/api/auth/login','POST',{'deviceId':dev,'name':'Admin','password':'nope'}))
s,u=call('/api/auth/login','POST',{'deviceId':dev,'name':'Admin','password':acc['password']})
print('right-pass login isAdmin:', u['user'].get('isAdmin'), 'bal:', u['user']['balance'])
# normal user unaffected (no password needed)
print('normal login:', call('/api/auth/login','POST',{'deviceId':'normal-qa-1','name':'N','country':'BD'})[0])
print('PASS QA DONE')
