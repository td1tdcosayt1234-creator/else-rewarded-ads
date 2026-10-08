import { useState } from 'react';

function Code({ title, text }: { title: string; text: string }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); alert('copied: ' + title); }
    catch { prompt('copy:', text); }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>{title}</b><button onClick={copy}>Copy</button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8f6ff', padding: 10, borderRadius: 12 }}>{text}</pre>
    </div>
  );
}

export default function ApiDocs() {
  const [tab, setTab] = useState<'curl' | 'node' | 'python' | 'php'>('curl');
  const base = 'https://your-else-server';
  const snippets: Record<string, string> = {
    curl: `# 1) Product (you will get a product_id)
curl -X POST ${base}/api/v1/products \\
  -H "Content-Type: application/json" \\
  -H "x-else-secret: else_sk_YOUR_KEY" \\
  -d '{"name":"Pro Ebook","price":2.5}'

# 2) Charge (you will get a checkout_url)
curl -X POST ${base}/api/v1/charges \\
  -H "Content-Type: application/json" \\
  -H "x-else-secret: else_sk_YOUR_KEY" \\
  -d '{"product_id":"else_prod_...","returnUrl":"https://shop.com/success"}'

# 3) Verify
curl ${base}/api/v1/charges/ch_... \\
  -H "x-else-secret: else_sk_YOUR_KEY"`,
    node: `// Node.js - Else Pay charge
const r = await fetch('${base}/api/v1/charges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-else-secret': process.env.ELSE_SECRET },
  body: JSON.stringify({ product_id: 'else_prod_...', returnUrl: 'https://shop.com/success' })
});
const { checkout_url, charge_id, amount } = await r.json();
// redirect the user to checkout_url
// verify later:
const v = await fetch(\`${base}/api/v1/charges/\${charge_id}\`, {
  headers: { 'x-else-secret': process.env.ELSE_SECRET }
}).then(x => x.json());
// deliver the order when v.status === 'paid'`,
    python: `# Python - Else Pay charge
import requests
H = {'x-else-secret': 'else_sk_YOUR_KEY'}
p = requests.post(f'{base}/api/v1/products', json={'name': 'Pro Ebook', 'price': 2.5}, headers=H).json()
print(p['product_id'])  # else_prod_...
c = requests.post(f'{base}/api/v1/charges', json={'product_id': p['product_id'], 'returnUrl': 'https://shop.com/success'}, headers=H).json()
print(c['checkout_url'])  # send the user here -> /app/pay/ch_...
v = requests.get(f"{base}/api/v1/charges/{c['charge_id']}", headers=H).json()
assert v['status'] == 'paid'`,
    php: `<?php // PHP - Else Pay charge
$sk = 'else_sk_YOUR_KEY';
$ch = curl_init('${base}/api/v1/charges');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', "x-else-secret: $sk"],
  CURLOPT_POSTFIELDS => json_encode(['product_id' => 'else_prod_...', 'returnUrl' => 'https://shop.com/success'])]);
$c = json_decode(curl_exec($ch), true);
header('Location: ' . $c['checkout_url']); // send the user to Else checkout`,
  };
  return (
    <div className="card"><h3>API docs - Else Pay integration</h3>
      <div className="small">Other websites charge the user's earned $ with an API key (secret) + product_id.</div>
      <h4>Step 0 - Keys (from console/merchants)</h4>
      <div className="listrow"><span>Public key <small>else_pk_... (safe for frontend)</small></span></div>
      <div className="listrow"><span>Secret key <small>else_sk_... (server only, never in frontend)</small></span></div>
      <div className="listrow"><span>Product ID <small>else_prod_... (from console/products or the API)</small></span></div>
      <h4>Steps 1-4 - Charge flow</h4>
      <div className="listrow"><span>1. Create product <small>name + price - you get a product_id</small></span></div>
      <div className="listrow"><span>2. Create charge <small>you get a checkout_url - send the user there</small></span></div>
      <div className="listrow"><span>3. User logs into Else and pays with earned $ <small>/app/pay/ch_...</small></span></div>
      <div className="listrow"><span>4. Verify + webhook <small>deliver when status is paid</small></span></div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {(['curl', 'node', 'python', 'php'] as const).map(t => (
          <button key={t} className={tab === t ? 'btn' : 'btn btn2'} style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <Code title={'code: ' + tab} text={snippets[tab]} />
      <Code title="webhook verify (merchant server)" text={`POST webhookUrl (JSON body exactly as received):
{"charge_id":"ch_...","status":"paid","amount":2.5,"product":"Pro Ebook"}
Headers: x-else-key = else_pk_...
         x-else-signature = t=TIMESTAMP,v1=HMAC_SHA256(secret, TIMESTAMP + "." + body)
Reject when: signature mismatch, timestamp older than 5 min (replay), or key mismatch.
Node verify:
const crypto = require('crypto');
const [t, v1] = sig.split(',').map(x => x.split('=')[1]);
const ok = Date.now() - Number(t) < 5 * 60 * 1000 &&
  crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(crypto.createHmac('sha256', SECRET).update(t + '.' + rawBody).digest('hex')));`} />
      <Code title="errors" text={`401 bad else secret key -> wrong secret / merchant OFF
404 bad product_id -> product belongs to another merchant / missing
400 amount required -> price 0 / product inactive
400 low balance, earn more $ -> user has too little earned $`} />
      <div className="small" style={{ marginTop: 8 }}>Test: create a Demo Shop in /app/console/merchants, add a $0.005 product, create a charge, pay at /app/pay/ch_... and see paid in verify.</div>
    </div>
  );
}
