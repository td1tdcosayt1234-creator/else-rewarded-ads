# Else Pay Hosting — elsepay.indevs.in

Node অ্যাপ লোকালি চলছে, Cloudflare Tunnel দিয়ে `elsepay.indevs.in`-এ live।

## Live URLs

| Host | কী |
|---|---|
| https://elsepay.indevs.in/ | **ইয়ার্ন অ্যাপ (root = earn place)** |
| https://elsepay.indevs.in/app | same app (backwards compat / পুরনো WebView links) |
| https://elsepay.indevs.in/admin | Admin / operator console |
| https://elsepay.indevs.in/api/* | earn app API |
| https://api.elsepay.indevs.in/api/* | **billing/API only** |

Root-এ earn appserve হয় (`app.get(['/', '/app', /^\/app(\/.*)?$/])`) — assets absolute path
(`/app/assets/*`) ব্যবহার করে, তাই root থেকে লোড হয়। Android WebView-এ শুধু
`SERVER_URL = https://elsepay.indevs.in` বসালেই হবে, `/app` লাগবে না।

### Host scope (api subdomain = API/billing only)

`server.js`-এ host-based middleware: `api.elsepay.indevs.in`-এ শুধু নিচের surface, বাকি সব 404:

```
ALLOW: /api/v1/*              (merchant gateway, secret-key auth)
       /api/pay/:id, /api/pay/:id/confirm
       /api/plans, /api/payments/methods, /api/subscribe, /api/subscription/my
       /api/config
BLOCK: /app, /admin, static, এবং earn routes (+ /api/console, /api/admin)
```

Main host (`elsepay.indevs.in`) অপরিবর্তিত — home + earn app + console সব চলে
(karon `/app` SPA-র ভিতরেই billing console screens আছে, সেগুলো main host থেকে `api/console/*` ডাকে)।

नया endpoint API_SCOPE-এ যোগ করতে হলে `server.js`-এর `API_SCOPE` array-তে regex বসান।

## Architecture

```
Internet → Cloudflare edge (proxied, HTTPS)
  → elsepay.indevs.in / app.elsepay.indevs.in / api.elsepay.indevs.in
  → CNAME → 6607a434-05b8-41e9-8140-9114c86459fc.cfargotunnel.com
  → Cloudflare Tunnel "elsepay-app" (id 6607a434-05b8-41e9-8140-9114c86459fc)
  → ingress (all three) → http://localhost:3002
```

⚠️ **Dedicated tunnel matters.** Else Pay used to share tunnel `codebridge-web`
(343eef94…) with the codebridge-mcp-web project. That project's `cloudflared`
kept pushing its own local ingress config, which **deleted our hostnames** and
made every elsepay URL 404. The dedicated tunnel above fixes that permanently —
nothing else can rewrite its ingress.

Elsemail/codebridge hosts stay on the old tunnel, untouched.

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
    { "hostname": "app.elsepay.indevs.in",   "service": "http://localhost:3002" },
    { "hostname": "elsepay.indevs.in",        "service": "http://localhost:3002" },
    { "hostname": "api.elsepay.indevs.in",     "service": "http://localhost:3002" },
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
