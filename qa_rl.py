import json, urllib.request, urllib.error
B='http://localhost:3000'
def burst(n):
    codes=[]
    for i in range(n):
        req=urllib.request.Request(B+'/api/auth/login', data=json.dumps({'deviceId':'rl-x','name':'x'}).encode(), method='POST', headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req) as r:
                codes.append(r.status)
        except urllib.error.HTTPError as e:
            codes.append(e.code)
    return codes
codes=burst(25)
print('429 count (expect >=5):', sum(1 for c in codes if c==429))
print('RATE QA DONE')
