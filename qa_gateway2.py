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
s,u=call('/api/auth/login','POST',{'deviceId':'pay2-qa','name':'Pay2','country':'BD'})
H={'Authorization':'Bearer '+u['token']}
# spin remaining tickets for balance
for _ in range(5):
    call('/api/spin','POST',{},H)
print('bal', call('/api/wallet','GET',None,H)[1]['balance'])
# cheap product 0.005
s,mer=call('/api/console/merchants','POST',{'name':'Shop2'},A)
MH={'x-else-secret':mer['secretKey']}
s,prod=call('/api/v1/products','POST',{'name':'Cheap','price':0.005},MH)
s,ch=call('/api/v1/charges','POST',{'product_id':prod['product_id'],'returnUrl':'https://shop.test/ok'},MH)
print('charge', ch)
print('pay', call('/api/pay/'+ch['charge_id']+'/confirm','POST',{},H))
print('verify', call('/api/v1/charges/'+ch['charge_id'],'GET',None,MH))
print('DONE')
