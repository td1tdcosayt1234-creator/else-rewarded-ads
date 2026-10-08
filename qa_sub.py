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
print('plans-admin', call('/api/console/plans','GET',None,A)[0])
s,pl=call('/api/console/plans','POST',{'name':'QA Test Plan','price':0.01,'days':7,'mult':1.5,'dailyMax':50},A)
print('plan-create', s, pl.get('id'))
s,u=call('/api/auth/login','POST',{'deviceId':'sub-qa','name':'Sub QA','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
print('plans-user', call('/api/plans','GET',None,H))
print('subscribe low bal?', call('/api/subscribe','POST',{'planId':pl['id'],'method':'Binance','account':'x'},H))
# fund: credit via ad+checkin? use admin min trick: give balance by subscribing cheap? Instead topup via direct ad rewards loop with cooldown 0
call('/api/admin/config','POST',{'ads':{'cooldownSec':0}},A)
for _ in range(3):
    s,st=call('/api/ads/rewarded/start','POST',{},H)
    if isinstance(st,dict) and 'sessionId' in st:
        call('/api/ads/rewarded/complete','POST',{'sessionId':st['sessionId']},H)
call('/api/checkin','POST',{},H)
for _ in range(3):
    call('/api/spin','POST',{},H)
print('bal', call('/api/wallet','GET',None,H)[1]['balance'])
s,sub=call('/api/subscribe','POST',{'planId':pl['id'],'method':'Binance','account':'uid'},H)
print('subscribe', s, sub.get('status') if isinstance(sub,dict) else sub)
print('my before approve', call('/api/subscription/my','GET',None,H))
print('approve', call('/api/console/subscriptions/'+sub['id']+'/approve','POST',{},A))
print('my after approve (AUTO ACTIVE?)', call('/api/subscription/my','GET',None,H))
print('me sub?', call('/api/me','GET',None,H))
print('routes:', [(r, urllib.request.urlopen(B+r).status) for r in ['/app/dashboard/subscription','/app/console/subscriptions']])
print('SUB QA DONE')
