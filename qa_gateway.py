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
# 1. admin creates merchant (other web) -> api key + product id
s,mer=call('/api/console/merchants','POST',{'name':'Demo Shop','website':'https://shop.test','webhookUrl':''},A)
print('merchant', s, mer.get('publicKey'))
sk=mer['secretKey']; MH={'x-else-secret':sk}
# 2. merchant server creates product -> product_id
s,prod=call('/api/v1/products','POST',{'name':'Ebook','price':0.02},MH)
print('product', s, prod)
# 3. merchant creates charge -> checkout_url
s,ch=call('/api/v1/charges','POST',{'product_id':prod['product_id'],'returnUrl':'https://shop.test/ok'},MH)
print('charge', s, ch)
# 4. user (earned $) pays: need balance - fund via ads
s,u=call('/api/auth/login','POST',{'deviceId':'pay2-qa','name':'Pay2','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
call('/api/admin/config','POST',{'ads':{'cooldownSec':0}},A)
for _ in range(4):
    s2,st=call('/api/ads/rewarded/start','POST',{},H)
    if isinstance(st,dict) and 'sessionId' in st:
        call('/api/ads/rewarded/complete','POST',{'sessionId':st['sessionId']},H)
call('/api/checkin','POST',{},H)
print('bal', call('/api/wallet','GET',None,H)[1]['balance'])
print('order view', call('/api/pay/'+ch['charge_id'],'GET',None,H))
print('confirm pay with earned $', call('/api/pay/'+ch['charge_id']+'/confirm','POST',{},H))
print('verify merchant', call('/api/v1/charges/'+ch['charge_id'],'GET',None,MH))
call('/api/admin/config','POST',{'ads':{'cooldownSec':30}},A)
print('routes:', [(r, urllib.request.urlopen(B+r).status) for r in ['/app/pay/'+ch['charge_id'],'/app/console/merchants','/app/console/checkout','/app/console/api-docs']])
print('GATEWAY QA DONE')
