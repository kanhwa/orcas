#!/usr/bin/env python3
"""Find the actual ROA min/max from the 2021 population in the database."""
import json, http.cookiejar, urllib.request

BASE = "http://localhost:8000"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def post_json(path, data):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with opener.open(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

post_json("/api/auth/login", {"username": "admin", "password": "admin123"})

tickers = ["AGRS", "ARTO", "BABP", "BACA", "BBCA", "BBKP", "BBNI", "BBRI",
           "BBTN", "BDMN", "BINA", "BJBR", "BJTM", "BKSW", "BMAS", "BMRI",
           "BNBA", "BNGA", "BNII", "BNLI", "BSIM", "BTPN", "BVIC", "DNAR",
           "INPC", "MAYA", "MCOR", "MEGA", "NISP", "NOBU", "PNBN", "SDRA"]

roa_vals = {}
for t in tickers:
    try:
        sc = post_json("/api/wsm/scorecard", {"year": 2021, "ticker": t, "missing_policy": "zero"})
        for m in sc.get("metrics", []):
            if m["metric_name"] == "Return on Assets (ROA)" and m["raw_value"] is not None:
                roa_vals[t] = m["raw_value"]
    except:
        pass

print("--- ROA values for all 32 emitens (2021) ---")
for t in sorted(roa_vals, key=roa_vals.get):
    print(f"  {t}: {roa_vals[t]}")

print(f"\n  MIN: {min(roa_vals, key=roa_vals.get)} = {min(roa_vals.values())}")
print(f"  MAX: {max(roa_vals, key=roa_vals.get)} = {max(roa_vals.values())}")

roa_min = min(roa_vals.values())
roa_max = max(roa_vals.values())
for t in ["BKSW", "DNAR", "BMRI"]:
    v = roa_vals.get(t, 0)
    norm = (v - roa_min) / (roa_max - roa_min) if roa_max != roa_min else 0.0
    print(f"\n  {t}: ({v} - {roa_min}) / ({roa_max} - {roa_min}) = {norm:.10f}")
