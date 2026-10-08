import json, urllib.request, urllib.error, time
B='http://localhost:3000'
A={'x-admin-key':'else-admin-123'}
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}; hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    try:
        with urllib.request.urlopen(req) as r:
            return (r.status, json.loads(r.read().decode()))
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:160])
ts=str(int(time.time()))
# step validation
print('no fname:', call('/api/auth/signup','POST',{'lastName':'L','country':'BD','city':'D','zip':'1','username':'u1','birthday':'2000-01-01','email':'a@b.co','password':'secret1'}))
print('bad user:', call('/api/auth/signup','POST',{'firstName':'A','lastName':'L','country':'BD','city':'D','zip':'1','username':'ab','birthday':'2000-01-01','email':'a@b.co','password':'secret1'}))
print('bad mail:', call('/api/auth/signup','POST',{'firstName':'A','lastName':'L','country':'BD','city':'D','zip':'1','username':'qa_'+ts,'birthday':'2000-01-01','email':'nope','password':'secret1'}))
print('short pass:', call('/api/auth/signup','POST',{'firstName':'A','lastName':'L','country':'BD','city':'D','zip':'1','username':'qa_'+ts,'birthday':'2000-01-01','email':'q'+ts+'@t.co','password':'123'}))
print('bad bday:', call('/api/auth/signup','POST',{'firstName':'A','lastName':'L','country':'BD','city':'D','zip':'1','username':'qa_'+ts,'birthday':'x','email':'q'+ts+'@t.co','password':'secret1'}))
# full signup
s,u=call('/api/auth/signup','POST',{'firstName':'Qa','lastName':'One','country':'BD','city':'Dhaka','zip':'1200','username':'qa_'+ts,'birthday':'2000-05-05','email':'q'+ts+'@t.co','password':'secret1'})
print('signup:', s, u['user']['username'], u['user']['email'])
print('dup user:', call('/api/auth/signup','POST',{'firstName':'Q','lastName':'O','country':'BD','city':'D','zip':'1','username':'qa_'+ts,'birthday':'2000-01-01','email':'other@t.co','password':'secret1'}))
print('dup mail:', call('/api/auth/signup','POST',{'firstName':'Q','lastName':'O','country':'BD','city':'D','zip':'1','username':'other_'+ts,'birthday':'2000-01-01','email':'q'+ts+'@t.co','password':'secret1'}))
H={'Authorization':'Bearer '+u['token']}
# login via email + username
print('login email:', call('/api/auth/login','POST',{'identifier':'q'+ts+'@t.co','password':'secret1','deviceId':'dev-x'})[0])
print('login user:', call('/api/auth/login','POST',{'identifier':'qa_'+ts,'password':'secret1','deviceId':'dev-x'})[0])
print('wrong pass:', call('/api/auth/login','POST',{'identifier':'qa_'+ts,'password':'bad'})[0])
print('upper email:', call('/api/auth/login','POST',{'identifier':'Q'+ts+'@T.CO','password':'secret1','deviceId':'dev-x'})[0])
print('other device blocked:', call('/api/auth/login','POST',{'identifier':'qa_'+ts,'password':'secret1','deviceId':'dev-other'})[0])
print('me:', call('/api/me','GET',None,H)[1]['user']['username'])
# admin new-style
print('admin email login:', call('/api/auth/login','POST',{'identifier':'admin@else.pay','password':'Admin-MUZAP1S8'})[0])
print('legacy device login still works:', call('/api/auth/login','POST',{'deviceId':'qa-A','name':'QA'})[0])
print('AUTH QA DONE')
