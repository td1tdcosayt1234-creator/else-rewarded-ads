"""Else Pay smoke QA - the one real health check (replaces 17 stale qa_*.py scripts).

Usage (Windows):
  set PORT=3002
  python deploy/qa-smoke.py
Admin key is read from deploy/.admin-key (or ADMIN_KEY env).
Targets http://localhost:<PORT>. Exits non-zero on first failure.
"""
import json, os, sys, time, urllib.request, urllib.error

PORT = os.environ.get("PORT", "3002")
B = f"http://localhost:{PORT}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AK = os.environ.get("ADMIN_KEY", "")
if not AK:
    try:
        with open(os.path.join(ROOT, "deploy", ".admin-key"), encoding="utf-8") as f:
            AK = f.read().strip()
    except OSError:
        pass

fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name, detail)
    if not cond:
        fails.append(name)

def call(p, m="GET", b=None, h=None):
    hd = {"Content-Type": "application/json"}
    hd.update(h or {})
    req = urllib.request.Request(B + p, data=json.dumps(b).encode() if b is not None else None,
                                 method=m, headers=hd)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            ct = r.headers.get("Content-Type", "")
            body = r.read().decode()
            return (r.status, json.loads(body) if "json" in ct else body)
    except urllib.error.HTTPError as e:
        return (e.code, e.read().decode()[:400])

# 1. public config
s, cfg = call("/api/config")
check("config 200", s == 200, f"HTTP {s}")
AD_SECS = 10

# 2. signup fresh user
tag = f"qa{int(time.time()) % 100000}"
s, r = call("/api/auth/signup", "POST", {
    "firstName": "Qa", "lastName": "Smoke", "country": "BD", "city": "Dhaka",
    "zip": "1200", "username": f"qa_{tag}", "birthday": "2000-01-01",
    "email": f"{tag}@example.com", "password": "Qa123456"})
check("signup 200", s == 200, f"HTTP {s}")
tok = r.get("token", "") if isinstance(r, dict) else ""
H = {"Authorization": "Bearer " + tok}

# 3. wrong password -> unified message (no user enumeration)
s, b = call("/api/auth/login", "POST", {"identifier": f"{tag}@example.com", "password": "Wrong123"})
check("wrong-pass 401 invalid credentials", s == 401 and "invalid credentials" in str(b), f"HTTP {s} {b}")

# 4. instant complete must be rejected (watch-time enforced)
s, st = call("/api/ads/rewarded/start", "POST", {}, H)
check("ad start 200", s == 200 and isinstance(st, dict) and "sessionId" in st, f"HTTP {s}")
sid = st.get("sessionId", "") if isinstance(st, dict) else ""
s, b = call("/api/ads/rewarded/complete", "POST", {"sessionId": sid}, H)
check("instant complete blocked 429", s == 429 and "watch full ad" in str(b), f"HTTP {s} {b}")

# 5. real watch -> credit
time.sleep(AD_SECS)
s, cp = call("/api/ads/rewarded/complete", "POST", {"sessionId": sid}, H)
ok = s == 200 and isinstance(cp, dict) and (cp.get("reward") or 0) > 0
check("complete after watch credits", ok, f"HTTP {s} {cp}")

# 6. double-spend blocked
s, b = call("/api/ads/rewarded/complete", "POST", {"sessionId": sid}, H)
check("double-spend 400", s == 400, f"HTTP {s} {b}")

# 7. withdraw below min blocked
s, b = call("/api/withdraw", "POST", {"amount": 0.001, "method": "wallet", "account": "abc"}, H)
check("withdraw min enforced", s == 400, f"HTTP {s} {b}")

# 8. session works
s, me = call("/api/me", "GET", None, H)
check("me 200", s == 200, f"HTTP {s}")

# 9. admin closed without key, open with key
s, _ = call("/api/admin/stats", "GET", None, {"x-admin-key": "wrong"})
check("admin wrong key 401", s == 401, f"HTTP {s}")
if AK:
    s, _ = call("/api/admin/stats", "GET", None, {"x-admin-key": AK})
    check("admin stats 200", s == 200, f"HTTP {s}")
else:
    print("SKIP admin stats 200 (no key found)")

# 10. SSV without session fails
s, _ = call("/api/ads/ssv?user_id=x&session_id=y")
check("ssv no-session fails", s in (400, 403), f"HTTP {s}")

print("SMOKE " + ("OK" if not fails else f"FAILED: {fails}"))
sys.exit(1 if fails else 0)
