import json, urllib.request, urllib.error, base64
B='http://localhost:3000'
A={'x-admin-key':'else-admin-123'}
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}; hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    try:
        with urllib.request.urlopen(req) as r:
            return (r.status, json.loads(r.read().decode()), dict(r.headers))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:120], {})
# 1. forged old-style token must FAIL
s,u,_=call('/api/auth/login','POST',{'deviceId':'sec-qa','name':'S','country':'BD'})
tok=u['token']
print('signed token format:', tok.count('.')==1)
fake=base64.b64encode(u['user']['id'].encode()).decode()
print('forged token blocked:', call('/api/me','GET',None,{'Authorization':'Bearer '+fake})[0]==401)
print('tampered sig blocked:', call('/api/me','GET',None,{'Authorization':'Bearer '+tok[:-2]+'xx'})[0]==401)
print('real token works:', call('/api/me','GET',None,{'Authorization':'Bearer '+tok})[0]==200)
# 2. admin pass (same as before, now hashed)
s,acc,_=call('/api/console/admin-account','GET',None,A)
print('pass hidden:', 'password' not in acc, '| set:', acc.get('passwordSet'))
print('admin login:', call('/api/auth/login','POST',{'deviceId':acc['deviceId'],'name':'Admin','password':'Admin-MUZAP1S8'})[0])
# 3. security headers
s,b,h=call('/api/config')
print('headers:', h.get('X-Content-Type-Options'), h.get('X-Frame-Options'), h.get('Referrer-Policy'))
print('SEC QA DONE')
