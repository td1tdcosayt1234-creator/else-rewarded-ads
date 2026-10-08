import json, urllib.request, urllib.error, time
B='http://localhost:3000'
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}; hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    try:
        with urllib.request.urlopen(req) as r:
            return (r.status, json.loads(r.read().decode()), dict(r.headers))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:160], {})
ts=str(int(time.time()))
s,u,_=call('/api/auth/signup','POST',{'firstName':'Ck','lastName':'One','country':'BD','city':'D','zip':'1','username':'ck_'+ts,'birthday':'2000-01-01','email':'ck'+ts+'@t.co','password':'Secret1'})
print('signup:', s)
sc=u and u.get('token')
# check Set-Cookie on signup
s2,_,h2=call('/api/auth/signup','POST',{'firstName':'Ck2','lastName':'Two','country':'BD','city':'D','zip':'1','username':'ck2_'+ts,'birthday':'2000-01-01','email':'ck2'+ts+'@t.co','password':'Secret1'})
setc=h2.get('Set-Cookie','')
print('Set-Cookie:', setc[:120])
print('httpOnly:', 'HttpOnly' in setc, '| SameSite:', 'SameSite=Lax' in setc, '| 12h:', '43200000' in setc)
# cookie login: use cookie jar
import http.cookiejar
cj=http.cookiejar.CookieJar()
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def ccall(p,m='GET',b=None):
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers={'Content-Type':'application/json'})
    with op.open(req) as r:
        return (r.status, json.loads(r.read().decode()))
s3,u3=ccall('/api/auth/login','POST',{'identifier':'ck_'+ts,'password':'Secret1'})
print('cookie-login:', s3, u3['user']['username'])
print('cookies stored:', [c.name for c in cj])
s4,u4=ccall('/api/me')
print('me via cookie:', s4, u4['user']['username'])
s5,_=ccall('/api/auth/logout','POST')
print('logout:', s5)
s6,u6=ccall('/api/me')
print('me after logout (expect 401):', s6)
print('COOKIE QA DONE')
