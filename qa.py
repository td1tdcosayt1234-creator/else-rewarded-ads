import json, urllib.request, urllib.error
B='http://localhost:3000'
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}
    hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    try:
        with urllib.request.urlopen(req) as r:
            ct=r.headers.get('Content-Type','')
            body=r.read().decode()
            if 'json' in ct:
                return (r.status, json.loads(body))
            return (r.status, body[:200])
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:300])

print('1 config', call('/api/config')[0])
s,a=call('/api/auth/login','POST',{'deviceId':'qa-A','name':'QA A','country':'BD'})
print('2 loginA', s, 'ref=', a['user']['referralCode'] if isinstance(a,dict) else a)
tokA=a['token']; HA={'Authorization':'Bearer '+tokA}
s,b=call('/api/auth/login','POST',{'deviceId':'qa-B','name':'QA B','country':'US','referralCode':a['user']['referralCode']})
print('3 loginB with ref', s)
tokB=b['token']; HB={'Authorization':'Bearer '+tokB}
s,e=call('/api/auth/login','POST',{'deviceId':'qa-emu','name':'E','isEmulator':True})
tokE=e['token']; HE={'Authorization':'Bearer '+tokE}
print('5 emu start blocked?', call('/api/ads/rewarded/start','POST',{},HE))
s,v=call('/api/auth/login','POST',{'deviceId':'qa-vpn','name':'V','isVpn':True})
print('7 vpn start blocked?', call('/api/ads/rewarded/start','POST',{}, {'Authorization':'Bearer '+v['token']}))
print('8 reset-cd', call('/api/admin/reset-cooldown','POST',{}, {'x-admin-key':'else-admin-123'}))
print('9 set cooldown 0', call('/api/admin/config','POST',{'ads':{'cooldownSec':0,'dailyMax':20}}, {'x-admin-key':'else-admin-123'})[0])
s,st=call('/api/ads/rewarded/start','POST',{},HA)
print('10 startA', s, str(st)[:120])
s,cp=call('/api/ads/rewarded/complete','POST',{'sessionId':st['sessionId']},HA)
print('11 completeA BD lowest reward=', cp)
print('12 double-spend blocked?', call('/api/ads/rewarded/complete','POST',{'sessionId':st['sessionId']},HA))
s,st2=call('/api/ads/rewarded/start','POST',{},HB)
s,cp2=call('/api/ads/rewarded/complete','POST',{'sessionId':st2['sessionId']},HB)
print('13 completeB US reward=', cp2)
print('14 walletA (referral commission check)', call('/api/wallet','GET',None,HA))
print('15 checkin', call('/api/checkin','POST',{},HA))
print('16 checkin again blocked?', call('/api/checkin','POST',{},HA))
print('17 spin', call('/api/spin','POST',{},HA))
print('18 tasks', call('/api/tasks','GET',None,HA)[1])
print('19 interstitial', call('/api/ads/interstitial/view','POST',{},HA))
print('20 banner', call('/api/ads/banner/impression','POST',{},HA))
print('21 leaderboard', call('/api/leaderboard')[0])
print('22 withdraw low blocked (min10)?', call('/api/withdraw','POST',{'amount':5,'method':'Binance','account':'x'},HA))
print('23 set minWithdraw 0 temp', call('/api/admin/config','POST',{'minWithdraw':0.001}, {'x-admin-key':'else-admin-123'})[0])
s,w=call('/api/withdraw','POST',{'amount':0.002,'method':'Binance','account':'test-acc'},HA)
print('24 withdraw create', s, w)
print('25 admin withdraws', call('/api/admin/withdraws','GET',None,{'x-admin-key':'else-admin-123'})[0])
if isinstance(w,dict) and 'id' in w:
    print('26 approve', call('/api/admin/withdraw/'+w['id']+'/approve','POST',{}, {'x-admin-key':'else-admin-123'}))
print('27 restore min10', call('/api/admin/config','POST',{'minWithdraw':10,'ads':{'cooldownSec':30}}, {'x-admin-key':'else-admin-123'})[0])
print('28 support', call('/api/support','POST',{'msg':'help test'},HA))
print('29 admin tickets', call('/api/admin/tickets','GET',None,{'x-admin-key':'else-admin-123'})[0])
print('30 admin stats', call('/api/admin/stats','GET',None,{'x-admin-key':'else-admin-123'}))
print('31 UI home', call('/')[0], 'admin', call('/admin')[0])
print('ALL FUNCTIONAL QA DONE')
