# Else Pay Hosting — elsepay.indevs.in

Node অ্যাপ লোকালি চলছে, Cloudflare Tunnel দিয়ে `elsepay.indevs.in`-এ live।

## Live URLs

| URL | কী |
|---|---|
| https://elsepay.indevs.in/app | ইউজার অ্যাপ (mobile UI, `/app` route) |
| https://elsepay.indevs.in/admin | Admin console |
| https://elsepay.indevs.in/api/* | API |
| https://api.elsepay.indevs.in/api/* | API (dedicated subdomain) |

`api.elsepay.indevs.in` একই origin (`localhost:3002`) — তাই `/app`, `/admin` ও serve করে,
কিন্তু মূল উদ্দেশ্য API; frontend থেকে base URL বসাও:
`const API = 'https://api.elsepay.indevs.in'`

> নোট: `/` (root) ইচ্ছাকৃতভাবে 404 — `server.js:947-950` অনুযায়ী static mount `index:false` সহ, অ্যাপ `/app`-এ, admin `/admin`-এ।

## Architecture

```
Internet → Cloudflare edge (proxied, HTTPS)
  → elsepay.indevs.in  (CNAME → <tunnel>.cfargotunnel.com)
  → Cloudflare Tunnel  (id 343eef94-77fb-460a-b5ab-d8b2ab2a278a, name codebridge-web)
  → ingress: elsepay.indevs.in → http://localhost:3002
```

একই tunnel-এ অন্য সার্ভিসও আছে (নষ্ট হয় না):
- `elsemail.indevs.in` ও `dash.elsemail.indevs.in` → localhost:3000
- `codebridge.elsemail.indevs.in` → localhost:3001

## DNS (already configured)

Zone `elsepay.indevs.in` (id `35f49bacf5869deca9312f23cf6c3e99`):

```
CNAME elsepay.indevs.in  →  343eef94-77fb-460a-b5ab-d8b2ab2a278a.cfargotunnel.com  proxied=true ttl=auto
CNAME api.elsepay.indevs.in →  343eef94-77fb-460a-b5ab-d8b2ab2a278a.cfargotunnel.com  proxied=true ttl=auto
```

## Tunnel ingress (remote config)

```json
{
  "ingress": [
    { "hostname": "elsemail.indevs.in",        "service": "http://localhost:3000" },
    { "hostname": "dash.elsemail.indevs.in",   "service": "http://localhost:3000" },
    { "hostname": "codebridge.elsemail.indevs.in", "service": "http://localhost:3001" },
    { "hostname": "elsepay.indevs.in",         "service": "http://localhost:3002" },
    { "hostname": "api.elsepay.indevs.in",      "service": "http://localhost:3002" },
    { "service": "http_status:404" }
  ]
}
```

⚠️ ingress বদলালে **সবসময় catch-all `http_status:404` দিয়ে শেষ করতে হবে**, নাহলে tunnel error হবে।

## চালানো (Windows)

```bat
deploy\start-elsepay.bat
deploy\stop-elsepay.bat
```

স্ক্রিপ্ট যা করে:
1. `node server.js` চালায় `.env` থেকে env নিয়ে (PORT=3002, NODE_ENV=production, PUBLIC_URL)
2. `cloudflared tunnel run --token-file` দিয়ে tunnel কানেক্ট করে
3. অ্যাক্সেসলে public URL গুলো টেস্ট করে

`cloudflared` PATH-এ না থাকলে `https://github.com/cloudflare/cloudflared/releases/latest` থেকে
`cloudflared-windows-amd64.exe` নামে রাখুন (deploy স্ক্রিপ্ট `%TEMP%\cloudflared.exe` খোঁজে, না পেলে download করে)।

## Env

⚠️ এই অ্যাপের `package.json`-এ `dotenv` dependency **নেই**, তাই `.env` ফাইল read হয় না —
env var গুলো সরাসরি process-এ set করতে হয়। `deploy/start-elsepay.bat` আগেই set করে নেয়:

```bat
set PORT=3002
set NODE_ENV=production
set PUBLIC_URL=https://elsepay.indevs.in
set ADMIN_KEY=else-admin-0c839a038308466e
```

Docker/VPS-এ যাওয়ার সময় একই var গুলো environment-এ দিন (docker run -e ...)।
`ADMIN_KEY` বদলাতে হলে `.bat`-এর মান বদলান — repo private, তাই script-এ আছে; public করলে بیر করে নিন।

## Security checklist (already live)

- [x] HTTPS only (Cloudflare proxied + HSTS)
- [x] Strong random `ADMIN_KEY` (default `else-admin-123` চলে গেছে)
- [x] `NODE_ENV=production` → `Secure` cookies
- [x] `PUBLIC_URL=https://elsepay.indevs.in` → generated payment/checkout links ঠিক host
- [x] `db.json` gitignored — production DB repo-তে push হয় না

## Gotchas (learned the hard way)

1. **`cloudflared tunnel run` flag placement** — `--no-autoupdate` হলো *tunnel* option, `run`-এর আগে;
   `--protocol` এই version-এ নেই। ভুল দিলে চুপচাপ help print করে, tunnel ওঠে না।
2. **Local ingress config remote config override করে** — `--config <file>` দিয়ে চালালে local ingress-এর
   hostname গুলো remote-এ push হয়ে অন্যদের ingress মুছে যায়। token-only (`--token-file`) চালাই,
   যাতে remote (dashboard/PUT করা) config টেকে।
3. **Multiple cloudflared instance = connection churn** — এই মেশিনে অন্য প্রজেক্টের
   `tunnel-supervisor.ps1` একই tunnel (343eef94…) supervise করে; নিজের instance চালু করলে
   ডুপ্লিকেট হয়। একটার বেশি রাখবেন না।
4. **`/` 404 by design** — app route `/app`, admin `/admin`, root-এ কিছু নেই (`index:false`)।
5. **Cloudflare token endpoint** tunnel token দেয়: `GET /accounts/{acct}/cfd_tunnel/{id}/token`।
   curl-এ timeout দেওয়া não হলে স্ক্রিপ্ট আটকে যায়; PowerShell `Invoke-RestMethod` ব্যবহার করুন।

## AdMob SSV (real $ flow)

AdMob dashboard → Apps → SSV callback URL:

```
https://elsepay.indevs.in/api/ads/ssv
```

Server verify করলে তবেই coin credit হয় (C10)।
