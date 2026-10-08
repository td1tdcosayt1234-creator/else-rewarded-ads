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
        return (e.code, e.read().decode()[:200])
dev='sub-fresh-%d' % int(time.time())
s,u=call('/api/auth/login','POST',{'deviceId':dev,'name':'Fresh','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
call('/api/admin/config','POST',{'ads':{'cooldownSec':0}},A)
for _ in range(3):
    s2,st=call('/api/ads/rewarded/start','POST',{},H)
    if isinstance(st,dict) and 'sessionId' in st:
        call('/api/ads/rewarded/complete','POST',{'sessionId':st['sessionId']},H)
call('/api/checkin','POST',{},H)
for _ in range(4):
    call('/api/spin','POST',{},H)
s,pl=call('/api/console/plans','POST',{'name':'Fresh Plan','price':0.01,'days':7,'mult':1.5,'dailyMax':50},A)
s,sub=call('/api/subscribe','POST',{'planId':pl['id'],'method':'Else Pay','account':'x'},H)
print('subscribe:', s, sub.get('status') if isinstance(sub,dict) else sub)
print('approve:', call('/api/console/subscriptions/'+sub['id']+'/approve','POST',{},A)[0])
print('my:', call('/api/subscription/my','GET',None,H)[1]['active']['status'])
print('me sub:', call('/api/me','GET',None,H)[1]['user']['sub'])
call('/api/admin/config','POST',{'ads':{'cooldownSec':30}},A)
print('SUB FRESH QA DONE')
