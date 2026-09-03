#!/usr/bin/env python3
"""
Verification script: cross-check Min-Max normalization output
against thesis draft reference values.
Uses urllib (stdlib) to avoid dependency on 'requests'.
"""
import json
import http.cookiejar
import urllib.request
import urllib.parse

BASE = "http://localhost:8000"

# Setup cookie-aware opener
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def post_json(path, data):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with opener.open(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_json(path):
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, method="GET")
    with opener.open(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

# Login
status, data = post_json("/api/auth/login", {"username": "admin", "password": "admin123"})
assert status == 200, f"Login failed: {data}"
print("Login OK\n")

def get_scorecard(year, ticker):
    s, d = post_json("/api/wsm/scorecard", {"year": year, "ticker": ticker, "missing_policy": "zero"})
    assert s == 200, f"Scorecard failed for {ticker} {year}: {d}"
    return d

def find_metric(scorecard, metric_name):
    for m in scorecard.get("metrics", []):
        if m["metric_name"] == metric_name:
            return m
    return None

print("=" * 80)
print("ACUAN 1: PENGUJIAN TAHUN 2021")
print("=" * 80)

# Total Aset 2021
print("\n--- Total Aset (Benefit) tahun 2021 ---")
for ticker in ["DNAR", "BMRI", "BKSW"]:
    sc = get_scorecard(2021, ticker)
    m = find_metric(sc, "Total Aset")
    if m:
        rv = m['raw_value'] if m['raw_value'] is not None else "NULL"
        print(f"  {ticker}: raw = {str(rv):>15}  |  normalized = {m['normalized_value']:.6f}  |  type = {m['type']}")
    else:
        print(f"  {ticker}: Total Aset NOT FOUND")

# ROA 2021
print("\n--- Return on Assets / ROA (Benefit) tahun 2021 ---")
for ticker in ["BKSW", "DNAR", "BMRI"]:
    sc = get_scorecard(2021, ticker)
    m = find_metric(sc, "Return on Assets (ROA)")
    if m:
        rv = m['raw_value'] if m['raw_value'] is not None else "NULL"
        print(f"  {ticker}: raw = {str(rv):>15}  |  normalized = {m['normalized_value']:.6f}  |  type = {m['type']}")
    else:
        print(f"  {ticker}: ROA NOT FOUND")

print("\n" + "=" * 80)
print("ACUAN 2: BEBAN USAHA (COST) TAHUN 2024")
print("=" * 80)

print("\n--- Beban Usaha (Cost) tahun 2024 - 4 Bank Besar ---")
for ticker in ["BBNI", "BMRI", "BBCA", "BBRI"]:
    sc = get_scorecard(2024, ticker)
    m = find_metric(sc, "Beban Usaha")
    if m:
        rv = m['raw_value'] if m['raw_value'] is not None else "NULL"
        print(f"  {ticker}: raw = {str(rv):>15}  |  normalized = {m['normalized_value']:.6f}  |  type = {m['type']}")
    else:
        print(f"  {ticker}: Beban Usaha NOT FOUND")

# Find population min/max for Beban Usaha 2024
print("\n--- Population Min/Max Beban Usaha 2024 ---")
all_tickers = ["AGRS", "ARTO", "BABP", "BACA", "BBCA", "BBKP", "BBNI", "BBRI",
               "BBTN", "BDMN", "BINA", "BJBR", "BJTM", "BKSW", "BMAS", "BMRI",
               "BNBA", "BNGA", "BNII", "BNLI", "BSIM", "BTPN", "BVIC", "DNAR",
               "INPC", "MAYA", "MCOR", "MEGA", "NISP", "NOBU", "PNBN", "SDRA"]

bu_vals = {}
for t in all_tickers:
    try:
        sc = get_scorecard(2024, t)
        m = find_metric(sc, "Beban Usaha")
        if m and m["raw_value"] is not None:
            bu_vals[t] = m["raw_value"]
    except Exception as e:
        pass

if bu_vals:
    bu_max_t = max(bu_vals, key=bu_vals.get)
    bu_min_t = min(bu_vals, key=bu_vals.get)
    print(f"  MAX: {bu_max_t} = {bu_vals[bu_max_t]}")
    print(f"  MIN: {bu_min_t} = {bu_vals[bu_min_t]}")
    
    bu_max = bu_vals[bu_max_t]
    bu_min = bu_vals[bu_min_t]
    
    print("\n--- Manual Calc: Beban Usaha 2024 (Cost) = (max - x) / (max - min) ---")
    for t in ["BBNI", "BMRI", "BBCA", "BBRI"]:
        v = bu_vals.get(t, 0)
        norm = (bu_max - v) / (bu_max - bu_min) if bu_max != bu_min else 0.0
        print(f"  {t}: ({bu_max} - {v}) / ({bu_max} - {bu_min}) = {norm:.6f}")

print("\n" + "=" * 80)
print("KALKULASI MANUAL REFERENSI DRAF")
print("=" * 80)

print("\n--- Total Aset 2021 ---")
ta_max = 1725611.0
ta_min = 7721.0
print(f"  DNAR (min):  ({7721} - {ta_min}) / ({ta_max} - {ta_min}) = {(7721 - ta_min)/(ta_max - ta_min):.6f}")
print(f"  BMRI (max):  ({1725611} - {ta_min}) / ({ta_max} - {ta_min}) = {(1725611 - ta_min)/(ta_max - ta_min):.6f}")
print(f"  BKSW:        ({17702} - {ta_min}) / ({ta_max} - {ta_min}) = {(17702 - ta_min)/(ta_max - ta_min):.6f}")

print("\n--- ROA 2021 ---")
roa_max = 0.0378
roa_min = -0.0892
print(f"  BKSW (min):  ({-0.0892} - ({roa_min})) / ({roa_max} - ({roa_min})) = {(-0.0892 - roa_min)/(roa_max - roa_min):.6f}")
print(f"  DNAR:        ({0.0023} - ({roa_min})) / ({roa_max} - ({roa_min})) = {(0.0023 - roa_min)/(roa_max - roa_min):.6f}")
print(f"  BMRI:        ({0.0162} - ({roa_min})) / ({roa_max} - ({roa_min})) = {(0.0162 - roa_min)/(roa_max - roa_min):.6f}")

print("\nDONE.")
