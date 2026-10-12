"""Else Pay deep QA - login/signup/ads/pay/admin edge cases (prod-safe).

Usage:  set PORT=3002 && python deploy/qa-deep.py
Reads admin key from deploy/.admin-key (or ADMIN_KEY env).
Touches global config (cooldown/minWithdraw/authSettings/adminKeyOverride)
but snapshots + restores everything in a finally block.
Runtime ~90s (real 10s ad watches).
"""
import json, os, sys, time, urllib.request, urllib.error

PORT = os.environ.get("PORT", "3002")
B = f"http://localhost:{PORT}"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AK = os.environ.get("ADMIN_KEY", "")
if not AK:
    with open(os.path.join(ROOT, "deploy", ".admin-key"), encoding="utf-8") as f:
        AK = f.read().strip()
A = {"x-admin-key": AK}
fails = []
last_login = [0.0]
def acall(p, m="GET", b=None, h=None):
    """auth-endpoint call paced to stay under the 10/min login limit."""
    if p.startswith("/api/auth/login"):
        wait = 7.0 - (time.time() - last_login[0])
        if wait > 0:
            time.sleep(wait)
        last_login[0] = time.time()
    return call(p, m, b, h)
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
        return (e.code, e.read().decode()[:500])

T = str(int(time.time()) % 100000)
def mkuser(tag, **kw):
    base = {"firstName": "Deep", "lastName": tag, "country": "BD", "city": "Dhaka",
            "zip": "1200", "username": f"dq_{T}_{tag}", "birthday": "2000-01-01",
            "email": f"dq{T}{tag}@example.com", "password": "Dq123456",
            "deviceId": f"deep-dev-{T}-{tag}"}
    base.update(kw)
    return call("/api/auth/signup", "POST", base)

orig = {}
try:
    # snapshot config we will mutate
    s, cfg = call("/api/config")
    orig["cooldown"] = cfg["ads"]["cooldownSec"]
    orig["minW"] = cfg["minWithdraw"]
    s, aus = call("/api/console/auth-settings", "GET", None, A)
    orig["auth"] = dict(aus)
    call("/api/admin/config", "POST", {"ads": {"cooldownSec": 0}}, A)
    call("/api/admin/config", "POST", {"minWithdraw": 0.001}, A)

    # ---- signup validation ----
    s, b = call("/api/auth/signup", "POST", {"lastName": "x"})
    check("signup missing -> 400 step1", s == 400 and "step" in str(b), f"{s} {b}")
    s, b = call("/api/auth/signup", "POST", {"firstName": "a", "lastName": "b", "country": "BD",
          "city": "c", "zip": "1", "username": "ab", "birthday": "2000-01-01",
          "email": "x@y.zz", "password": "Aa123456"})
    check("signup bad username -> 400 step2", s == 400, f"{s} {b}")
    s, b = call("/api/auth/signup", "POST", {"firstName": "a", "lastName": "b", "country": "BD",
          "city": "c", "zip": "1", "username": f"dq_{T}_ok1", "birthday": "2000-01-01",
          "email": "not-an-email", "password": "Aa123456"})
    check("signup bad email -> 400", s == 400, f"{s} {b}")
    s, b = call("/api/auth/signup", "POST", {"firstName": "a", "lastName": "b", "country": "BD",
          "city": "c", "zip": "1", "username": f"dq_{T}_ok2", "birthday": "2000-01-01",
          "email": f"dq{T}ok2@example.com", "password": "weak"})
    check("signup weak pw -> 400", s == 400, f"{s} {b}")

    # ---- device cap (3 per device) ----
    dev = f"cap-dev-{T}"
    for i in range(3):
        s, _ = mkuser(f"cap{i}", deviceId=dev, username=f"dq_{T}_cap{i}", email=f"dq{T}cap{i}@example.com")
        check(f"device signup {i+1}/3 ok", s == 200, f"HTTP {s}")
    s, b = mkuser("capX", deviceId=dev, username=f"dq_{T}_capX", email=f"dq{T}capX@example.com")
    check("4th device signup blocked", s == 403 and "too many" in str(b), f"{s} {b}")

    # ---- login flows ----
    s, u1 = mkuser("u1")
    H1 = {"Authorization": "Bearer " + u1["token"]}
    s, b = acall("/api/auth/login", "POST", {"identifier": "nobody-here-xyz", "password": "Xx123456"})
    check("unknown user -> 401 invalid credentials", s == 401 and "invalid credentials" in str(b), f"{s}")
    s, b = acall("/api/auth/login", "POST", {"identifier": u1["user"]["username"], "password": "Dq123456",
                                            "deviceId": "brand-new-phone"})
    check("new device blocked 403", s == 403 and "another device" in str(b), f"{s} {b}")
    # admin unbind -> login works (new endpoint)
    uid = u1["user"]["id"]
    s, _ = call(f"/api/console/users/{uid}/reset-device", "POST", {}, A)
    check("reset-device 200", s == 200, f"HTTP {s}")
    s, r = acall("/api/auth/login", "POST", {"identifier": u1["user"]["username"], "password": "Dq123456",
                                            "deviceId": "brand-new-phone"})
    check("login after unbind ok", s == 200, f"HTTP {s}")
    H1 = {"Authorization": "Bearer " + (r["token"] if isinstance(r, dict) else "")}

    # ---- brute force lockout ----
    s, u2 = mkuser("u2")
    for _ in range(5):
        acall("/api/auth/login", "POST", {"identifier": u2["user"]["username"], "password": "Bad12345"})
    s, b = acall("/api/auth/login", "POST", {"identifier": u2["user"]["username"], "password": "Bad12345"})
    check("6th wrong pw -> 429 locked", s == 429, f"{s} {b}")

    # ---- legacy device path ----
    s, b = acall("/api/auth/login", "POST", {"name": "Old"})
    check("legacy no device -> 400", s == 400, f"{s} {b}")
    s, b = acall("/api/auth/login", "POST", {"deviceId": "ghost-dev-zzz"})
    check("legacy unknown device -> 401 (requireLogin)", s == 401, f"{s} {b}")

    # ---- referral commission math ----
    s, ra = mkuser("refA")
    codeA = ra["user"]["referralCode"]
    s, rb = mkuser("refB", referralCode=codeA)
    HB = {"Authorization": "Bearer " + rb["token"]}
    s, st = call("/api/ads/rewarded/start", "POST", {}, HB)
    time.sleep(10)
    s, cp = call("/api/ads/rewarded/complete", "POST", {"sessionId": st["sessionId"]}, HB)
    earn = cp.get("reward", 0)
    s, meA = call("/api/me", "GET", None, {"Authorization": "Bearer " + ra["token"]})
    expect = round(earn * 0.10, 4)
    check("referral 10% commission", abs(meA["user"]["balance"] - expect) < 0.0002, f"earn={earn} A={meA['user']['balance']} exp={expect}")

    # ---- leaderboard hides admin ----
    s, lb = call("/api/leaderboard", "GET", None, H1)
    check("leaderboard 200, no admin", s == 200 and all(x["balance"] < 999999999 for x in lb), f"HTTP {s} n={len(lb) if isinstance(lb, list) else '?'}")

    # ---- checkin / spin / tasks ----
    s, _ = call("/api/checkin", "POST", {}, H1)
    s, b = call("/api/checkin", "POST", {}, H1)
    check("double checkin 400", s == 400, f"{s}")
    s, _ = call("/api/spin", "POST", {}, H1)
    s, b = call("/api/spin", "POST", {}, H1)
    check("spin w/o ticket 400", s == 400, f"{s} {b}")
    s, b = call("/api/tasks/t1/complete", "POST", {}, H1)
    check("task ineligible 400", s == 400, f"{s} {b}")

    # ---- merchant pay flow ----
    s, mer = call("/api/console/merchants", "POST", {"name": f"DeepShop{T}"}, A)
    MH = {"x-else-secret": mer["secretKey"]}
    s, b = call("/api/v1/charges", "POST", {"amount": 5, "returnUrl": "javascript:alert(1)"}, MH)
    check("bad returnUrl rejected", s == 400, f"{s} {b}")
    s, prod = call("/api/v1/products", "POST", {"name": "Deep Item", "price": 0.001}, MH)
    s, ch = call("/api/v1/charges", "POST", {"product_id": prod["product_id"], "returnUrl": "https://example.com/ok"}, MH)
    check("charge created + checkout url", s == 200 and "/app/pay/" in ch.get("checkout_url", ""), f"{s} {ch}")
    cid = ch["charge_id"]
    s, pay = call(f"/api/pay/{cid}", "GET", None, H1)
    check("pay view 200", s == 200, f"{s}")
    # fund u1 with one ad then pay
    s, st = call("/api/ads/rewarded/start", "POST", {}, H1)
    time.sleep(10)
    call("/api/ads/rewarded/complete", "POST", {"sessionId": st["sessionId"]}, H1)
    s, cf = call(f"/api/pay/{cid}/confirm", "POST", {}, H1)
    check("pay confirm paid", s == 200 and cf.get("status") == "paid" and cf.get("returnUrl") == "https://example.com/ok", f"{s} {cf}")
    s, cf2 = call(f"/api/pay/{cid}/confirm", "POST", {}, H1)
    check("pay double-confirm idempotent", s == 200 and cf2.get("status") == "paid", f"{s}")
    s, mer2 = call("/api/console/merchants", "POST", {"name": f"DeepShop2{T}"}, A)
    s, b = call(f"/api/v1/charges/{cid}", "GET", None, {"x-else-secret": mer2["secretKey"]})
    check("other merchant cannot see charge", s == 404, f"{s}")

    # ---- subscribe flow (cheap plan, then deactivate) ----
    s, plan = call("/api/console/plans", "POST", {"name": f"DeepPlan{T}", "price": 0.001, "days": 7, "mult": 1.2, "dailyMax": 30}, A)
    s, sub = call("/api/subscribe", "POST", {"planId": plan["id"], "method": "wallet", "account": "x"}, H1)
    check("subscribe active", s == 200 and sub.get("status") == "active", f"{s} {sub}")
    s, b = call("/api/subscribe", "POST", {"planId": plan["id"], "method": "wallet", "account": "x"}, H1)
    check("double subscribe blocked", s == 400, f"{s} {b}")
    call(f"/api/console/plans/{plan['id']}/toggle", "POST", {}, A)

    # ---- withdraw approve + reject-refund ----
    s, w1 = call("/api/withdraw", "POST", {"amount": 0.001, "method": "TestPay", "account": "acc-1"}, H1)
    check("withdraw created", s == 200, f"{s} {w1}")
    s, b = call(f"/api/admin/withdraw/{w1['id']}/approve", "POST", {}, A)
    check("withdraw approved paid", s == 200 and b.get("status") == "paid", f"{s}")
    s, me1 = call("/api/me", "GET", None, H1)
    bal_after_pay = me1["user"]["balance"]
    s, w2 = call("/api/withdraw", "POST", {"amount": 0.001, "method": "TestPay", "account": "acc-2"}, H1)
    s, b = call(f"/api/admin/withdraw/{w2['id']}/reject", "POST", {}, A)
    s, me2 = call("/api/me", "GET", None, H1)
    check("withdraw reject refunds", s == 200 and abs(me2["user"]["balance"] - bal_after_pay) < 0.0002, f"bal {me2['user']['balance']} vs {bal_after_pay}")

    # ---- ban ----
    s, _ = call(f"/api/admin/user/{uid}/ban", "POST", {}, A)
    s, b = acall("/api/auth/login", "POST", {"identifier": u1["user"]["username"], "password": "Dq123456", "deviceId": "brand-new-phone"})
    check("banned login 403", s == 403, f"{s} {b}")
    call(f"/api/admin/user/{uid}/ban", "POST", {}, A)

    # ---- maintenance ----
    call("/api/admin/config", "POST", {"maintenance": True}, A)
    s, _ = acall("/api/auth/login", "POST", {"identifier": u1["user"]["username"], "password": "Dq123456", "deviceId": "brand-new-phone"})
    check("maintenance login 503", s == 503, f"{s}")
    s, _ = call("/api/auth/signup", "POST", {"firstName": "m"})
    check("maintenance signup 503", s == 503, f"{s}")
    call("/api/admin/config", "POST", {"maintenance": False}, A)

    # ---- authSettings honored ----
    call("/api/console/auth-settings", "POST", {"vpnBlock": False}, A)
    s, uv = mkuser("vpn")
    acall("/api/auth/login", "POST", {"identifier": uv["user"]["username"], "password": "Dq123456",
                                     "deviceId": f"deep-dev-{T}-vpn", "isVpn": True})
    HV = {"Authorization": "Bearer " + uv["token"]}
    s, b = call("/api/ads/rewarded/start", "POST", {}, HV)
    check("vpn allowed when flag off", s == 200, f"{s} {b}")
    call("/api/console/auth-settings", "POST", {"vpnBlock": True}, A)

    # ---- admin key override ----
    call("/api/console/change-key", "POST", {"newKey": "deep-temp-key-99"}, A)
    s, _ = call("/api/admin/stats", "GET", None, A)
    check("old key dead after change", s == 401, f"{s}")
    A2 = {"x-admin-key": "deep-temp-key-99"}
    s, _ = call("/api/admin/stats", "GET", None, A2)
    check("new key works", s == 200, f"{s}")
finally:
    # ---- restore ----
    try:
        call("/api/console/change-key", "POST", {"newKey": AK}, {"x-admin-key": "deep-temp-key-99"})
    except Exception:
        pass
    call("/api/admin/config", "POST", {"maintenance": False, "minWithdraw": orig.get("minW", 10),
                                       "ads": {"cooldownSec": orig.get("cooldown", 30)}}, A)
    if "auth" in orig:
        call("/api/console/auth-settings", "POST", orig["auth"], A)

print("DEEP " + ("OK" if not fails else f"FAILED: {fails}"))
sys.exit(1 if fails else 0)
