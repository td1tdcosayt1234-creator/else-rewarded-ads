# Else Pay — Domain, DNS & Tunnel Runbook

Everything in one place. New domain, new subdomain, or moving to another
machine — follow this file, nothing else to remember.

> Secrets (Cloudflare API token, tunnel token, admin key) are NOT in this file.
> They live in untracked files under `deploy/` — see section 1.

---

## 0. Current state (at a glance)

| Thing | Value |
|---|---|
| Cloudflare Account ID | `0df834268d45d3b6c1ebe48c1d3217a7` |
| Account name | `Talhamoyelolo52@gmail.com's Account` |
| Zone (site domain) | `elsepay.indevs.in` -> `35f49bacf5869deca9312f23cf6c3e99` |
| Registrar | Porkbun (nameservers pointed to Cloudflare) |
| Cloudflare nameservers | `felipe.ns.cloudflare.com`, `katja.ns.cloudflare.com` |
| Zone status | active, SSL = **full**, **Always Use HTTPS = ON**, Automatic HTTPS Rewrites = ON |
| Tunnel (ours) | **`elsepay-app`** -> `6607a434-05b8-41e9-8140-9114c86459fc` (healthy) |
| Origin app port | `3002` (node `server.js`) |
| cloudflared | `%TEMP%\cloudflared.exe` (2026.10.0, windows amd64) |
| Repo | `github.com/td1tdcosayt1234-creator/else-rewarded-ads` (branch `main`) |
| Local path | `C:\Users\RDP\Documents\Default Project\else-rewarded-ads` |

### DNS records (zone `elsepay.indevs.in`)

| Name | Type | Content | Proxied | TTL |
|---|---|---|---|---|
| `elsepay.indevs.in` | CNAME | `6607a434-05b8-41e9-8140-9114c86459fc.cfargotunnel.com` | ON | auto |
| `app.elsepay.indevs.in` | CNAME | `6607a434-05b8-41e9-8140-9114c86459fc.cfargotunnel.com` | ON | auto |
| `api.elsepay.indevs.in` | CNAME | `6607a434-05b8-41e9-8140-9114c86459fc.cfargotunnel.com` | ON | auto |

Orange cloud (proxied = ON) gives TLS, cache and DDoS protection at the edge.
Tunnel hostnames MUST be proxied, otherwise Cloudflare expects a real origin cert.

### Tunnel ingress (remote config)

```json
{
  "ingress": [
    { "hostname": "app.elsepay.indevs.in", "service": "http://localhost:3002" },
    { "hostname": "elsepay.indevs.in",     "service": "http://localhost:3002" },
    { "hostname": "api.elsepay.indevs.in", "service": "http://localhost:3002" },
    { "service": "http_status:404" }
  ]
}
```

The LAST entry must always be the catch-all `http_status:404`. Cloudflare
rejects ingress configs without it, and without it unmatched hosts get sent
to a wrong origin.

### What is served where

| Host | Serves |
|---|---|
| `elsepay.indevs.in` | `/` home page, `/docs`, `/privacy`, `/robots.txt` — everything else 302 -> app host |
| `app.elsepay.indevs.in` | earn app: `/`, `/app`, `/admin`, `/api/*`, SPA deep links |
| `api.elsepay.indevs.in` | billing API: `/api/v1/*`, `/api/pay/*`, `/api/plans`, `/api/subscribe`, `/api/config` — everything else 404 |
| any other host / raw IP | behaves like the app host |

---

## 1. Where the secrets live (never committed)

| File | Holds | Committed |
|---|---|---|
| `deploy/.cf-token` | Cloudflare API token (Zone.DNS + Tunnel edit + account tunnel) | no |
| `deploy/.tunnel-token` | tunnel run token (base64 JWT) | no |
| `deploy/.tunnel-id` | tunnel ID only (not secret, convenience) | no |
| `deploy/.admin-key` | `ADMIN_KEY` for the admin console | no |

All are listed in `.gitignore` along with `.env`.

On a fresh machine create:

```
deploy\.cf-token      <- your Cloudflare API token
deploy\.admin-key     <- your own strong admin key
```

The tunnel token is fetched via API (section 3, step 3).

---

## 2. Architecture (where a packet goes)

```
Browser
  -> Cloudflare edge (TLS, secure cookies, http -> https 301)
  -> CNAME: host.elsepay.indevs.in
  -> Cloudflare Tunnel "elsepay-app" (QUIC, 4 connections)
  -> local cloudflared (kept alive by the supervisor script)
  -> http://localhost:3002  ->  node server.js  ->  express routes
```

---

## 3. Creating a dedicated tunnel (do this, always)

**Why dedicated:** Else Pay used to share tunnel `codebridge-web`
(343eef94...) with another project. That project's supervisor pushed its own
local ingress config and wiped our hostnames, so every elsepay URL returned
404. A dedicated tunnel cannot be touched by another project.

### Create via API (PowerShell)

```powershell
$h    = @{ Authorization = "Bearer $(Get-Content deploy\.cf-token -Raw).Trim()" }
$acct = "0df834268d45d3b6c1ebe48c1d3217a7"
$zone = "35f49bacf5869deca9312f23cf6c3e99"

# 1) 32-byte secret -> new tunnel
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$body = @{ name = "elsepay-app"; tunnel_secret = [Convert]::ToBase64String($b) } | ConvertTo-Json
$t   = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$acct/cfd_tunnel" `
        -Headers $h -Method POST -ContentType "application/json" -Body $body
$tid = $t.result.id                       # <- new tunnel ID

# 2) push ingress (the JSON from section 0)
$cfg = @{ config = @{ ingress = @(
  @{ hostname="app.elsepay.indevs.in"; service="http://localhost:3002" },
  @{ hostname="elsepay.indevs.in";     service="http://localhost:3002" },
  @{ hostname="api.elsepay.indevs.in"; service="http://localhost:3002" },
  @{ service="http_status:404" }
) } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$acct/cfd_tunnel/$tid/configurations" `
  -Headers $h -Method PUT -ContentType "application/json" -Body $cfg

# 3) run token -> file (the supervisor reads it)
$tok = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$acct/cfd_tunnel/$tid/token" -Headers $h
[IO.File]::WriteAllText("deploy\.tunnel-token", $tok.result)
[IO.File]::WriteAllText("deploy\.tunnel-id", $tid)

# 4) DNS CNAMEs straight at the new tunnel
foreach ($n in @("elsepay.indevs.in","app.elsepay.indevs.in","api.elsepay.indevs.in")) {
  $b2 = @{ type="CNAME"; name=$n; content="$tid.cfargotunnel.com"; proxied=$true } | ConvertTo-Json
  Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zone/dns_records" `
    -Headers $h -Method POST -ContentType "application/json" -Body $b2
}
```

### Run it

```
deploy\start-tunnel-supervisor.bat   -> cloudflared supervisor (auto-restart)
deploy\start-elsepay.bat             -> node + tunnel + URL verification
deploy\stop-elsepay.bat              -> stop node + tunnel
```

`deploy/tunnel-supervisor.ps1` reads the token from `deploy/.tunnel-token`,
downloads cloudflared if missing, and restarts it 3s after any exit.

---

## 4. Fast recipe: add a subdomain

Two API calls — a DNS record and one more hostname in the ingress:

```powershell
$h    = @{ Authorization = "Bearer $(Get-Content deploy\.cf-token -Raw).Trim()" }
$zone = "35f49bacf5869deca9312f23cf6c3e99"
$tid  = (Get-Content deploy\.tunnel-id -Raw).Trim()

# 1) DNS
$body = @{ type="CNAME"; name="NEW.elsepay.indevs.in"; content="$tid.cfargotunnel.com"; proxied=$true } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$zone/dns_records" `
  -Headers $h -Method POST -ContentType "application/json" -Body $body

# 2) ingress: resend the whole array with the new hostname added
$ingress = @(
  @{ hostname="app.elsepay.indevs.in"; service="http://localhost:3002" },
  @{ hostname="elsepay.indevs.in";     service="http://localhost:3002" },
  @{ hostname="api.elsepay.indevs.in"; service="http://localhost:3002" },
  @{ hostname="NEW.elsepay.indevs.in"; service="http://localhost:3002" },
  @{ service="http_status:404" }
)
Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/0df834268d45d3b6c1ebe48c1d3217a7/cfd_tunnel/$tid/configurations" `
  -Headers $h -Method PUT -ContentType "application/json" `
  -Body (@{ config = @{ ingress = $ingress } } | ConvertTo-Json -Depth 5)
```

cloudflared picks up the new config on its own within a few seconds.
Then decide the behaviour in `server.js` host routing (`SITE_HOST`,
`APP_SERVER_HOST`, `API_HOST`) — see section 6.

---

## 5. Fast recipe: add a whole new domain

1. Cloudflare dashboard -> Add a site -> `newdomain.com` -> Free plan.
2. At the registrar (Porkbun) set Cloudflare's two nameservers:
   `felipe.ns.cloudflare.com`, `katja.ns.cloudflare.com`
3. Once the zone is active, add:
   ```
   newdomain.com      CNAME  <tunnel-id>.cfargotunnel.com   proxied
   www.newdomain.com  CNAME  <tunnel-id>.cfargotunnel.com   proxied
   ```
4. SSL/TLS -> **Full**, Edge Certificates -> **Always Use HTTPS = ON**
5. Add the new hostnames to the tunnel ingress (section 4)
6. Update the zone ID in section 0 of this file, and make sure the API token
   has edit rights on the new zone
7. Change `PUBLIC_URL` in `deploy\start-elsepay.bat`, restart node

---

## 6. Host routing in code

`server.js` derives three hosts:

```js
const SITE_HOST       = (process.env.PUBLIC_URL || 'https://elsepay.indevs.in').replace(/^https?:\/\//,'').replace(/\/.*$/,'').toLowerCase(); // elsepay.indevs.in
const APP_SERVER_HOST = 'app.' + SITE_HOST;                              // app.elsepay.indevs.in
const API_HOST        = (process.env.API_HOST || ('api.' + SITE_HOST)).toLowerCase(); // api.elsepay.indevs.in
```

```js
function hostClass(h){
  if (h === API_HOST) return 'api';
  if (h === APP_SERVER_HOST) return 'app';
  if (h === SITE_HOST) return 'site';
  return 'other';
}
```

To change rules: edit `API_SCOPE` (the billing whitelist) and the
`if (cls === 'site')` / `if (cls === 'api')` blocks near the top.

---

## 7. Everyday management commands

```powershell
$h = @{ Authorization = "Bearer $(Get-Content deploy\.cf-token -Raw).Trim()" }

# view ingress
curl -s "https://api.cloudflare.com/client/v4/accounts/0df834268d45d3b6c1ebe48c1d3217a7/cfd_tunnel/<TID>/configurations" -H $h

# list DNS
curl -s "https://api.cloudflare.com/client/v4/zones/35f49bacf5869deca9312f23cf6c3e99/dns_records" -H $h

# tunnel health
(Invoke-RestMethod "https://api.cloudflare.com/client/v4/accounts/0df834268d45d3b6c1ebe48c1d3217a7/cfd_tunnel?per_page=50" -Headers $h).result |
  ForEach-Object { "$($_.name)  $($_.status)" }

# quick smoke
deploy\start-elsepay.bat
```

`source: "cloudflare"` in the ingress response means the config is remote
(dashboard/PUT managed), which is what we want.

---

## 8. Known bugs and their fixes

| Symptom | Cause | Fix |
|---|---|---|
| every host 404 | another project's supervisor overwrote the shared ingress | dedicated tunnel (section 3) |
| root shows blank page | SPA hardcoded `basename="/app"` | dynamic basename in `web/src/main.tsx` |
| refresh on `/dashboard` gives 404 | no SPA catch-all | catch-all at the end of `server.js` |
| `/app` returns a 301 hop | `express.static` directory redirect | `redirect: false` in static options |
| cloudflared prints help and exits | unsupported flag (`--protocol`, wrong flag order) | only `tunnel --no-autoupdate run` with `TUNNEL_TOKEN` |
| `Start-Process -Environment` not found | PowerShell 5.1 has it as `$env:` | set `$env:` in the parent before launching |
| 502 | origin (node) is down | run `deploy\start-elsepay.bat` |
| 530 | tunnel down or incomplete config | supervisor + make sure the catch-all exists |
| landing page appears stale in browser | old HTML cached | `no-store` header (already set) + hard refresh |

---

## 9. Moving to a new machine / restore checklist

1. `git clone https://<github_token>@github.com/td1tdcosayt1234-creator/else-rewarded-ads.git`
2. `cd else-rewarded-ads && npm install`
3. Create `deploy\.cf-token` and `deploy\.admin-key` with fresh values
4. The tunnel survives machines. Fetch a fresh run token for the same tunnel
   (ingress + DNS stay valid) and store it:
   ```powershell
   $t = Invoke-RestMethod "https://api.cloudflare.com/client/v4/accounts/0df834268d45d3b6c1ebe48c1d3217a7/cfd_tunnel/6607a434-05b8-41e9-8140-9114c86459fc/token" `
     -Headers @{ Authorization = "Bearer $(Get-Content deploy\.cf-token -Raw).Trim()" }
   [IO.File]::WriteAllText("deploy\.tunnel-token", $t.result)
   ```
5. Run `deploy\start-elsepay.bat` and verify the URLs
