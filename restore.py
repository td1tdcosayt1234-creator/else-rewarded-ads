import json, urllib.request
B='http://localhost:3000'
A={'x-admin-key':'else-admin-123','Content-Type':'application/json'}
req=urllib.request.Request(B+'/api/admin/config', data=json.dumps({'ads':{'cooldownSec':30}}).encode(), method='POST', headers=A)
print(urllib.request.urlopen(req).status)
