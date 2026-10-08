import json, urllib.request, urllib.error
B='http://localhost:3000'
A={'x-admin-key':'else-admin-123'}
def call(p,m='GET',b=None,h={}):
    hd={'Content-Type':'application/json'}; hd.update(h or {})
    req=urllib.request.Request(B+p, data=json.dumps(b).encode() if b else None, method=m, headers=hd)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())
mer=call('/api/console/merchants','POST',{'name':'Preview Shop'},A)
sk=mer['secretKey']
MH={'x-else-secret':sk}
prod=call('/api/v1/products','POST',{'name':'Preview Item','price':1.5},MH)
ch=call('/api/v1/charges','POST',{'product_id':prod['product_id'],'returnUrl':'https://shop.test/ok'},MH)
print(ch['charge_id'])
