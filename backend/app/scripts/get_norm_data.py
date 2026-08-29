import json
from app.db.session import SessionLocal
from app.models import Emiten, FinancialData, MetricDefinition

db = SessionLocal()
YEAR = 2021

m_asset = db.query(MetricDefinition).filter_by(metric_name="Total Aset").first()
m_roa = db.query(MetricDefinition).filter_by(metric_name="Return on Assets (ROA)").first()

# Pastikan data ROA diubah menjadi format persen aslinya jika perlu (tapi di database sepertinya disimpan dalam rasio/persen)

asset_data = (
    db.query(Emiten.ticker_code, FinancialData.value)
    .join(FinancialData, FinancialData.emiten_id == Emiten.id)
    .filter(FinancialData.metric_id == m_asset.id, FinancialData.year == YEAR)
    .order_by(FinancialData.value.desc())
    .all()
)

roa_data_q = (
    db.query(Emiten.ticker_code, FinancialData.value)
    .join(FinancialData, FinancialData.emiten_id == Emiten.id)
    .filter(FinancialData.metric_id == m_roa.id, FinancialData.year == YEAR)
    .all()
)
roa_dict = {t: float(v) for t, v in roa_data_q if v is not None}
asset_dict = {t: float(v) for t, v in asset_data if v is not None}

sorted_tickers = [t for t, v in asset_data if v is not None]

print(f"Total banks: {len(sorted_tickers)}")
if 'BKSW' in sorted_tickers:
    print(f"BKSW index: {sorted_tickers.index('BKSW')} out of {len(sorted_tickers)} - Asset: {asset_dict.get('BKSW')}")

min_asset = min(asset_dict.values())
max_asset = max(asset_dict.values())
min_roa = min(roa_dict.values())
max_roa = max(roa_dict.values())

top = sorted_tickers[:2]
mid_idx = len(sorted_tickers) // 2
mid = sorted_tickers[mid_idx-1:mid_idx+1]

# Cek 5 bank terbawah, BKSW pasti ada di sana
bottom = sorted_tickers[-5:]

results = []
# Ambil Top 2, Mid 2, dan Bottom 2 (termasuk BKSW)
selected = top + mid + ['BKSW', sorted_tickers[-1]]

for t in selected:
    a_val = asset_dict.get(t)
    r_val = roa_dict.get(t)
    a_norm = (a_val - min_asset) / (max_asset - min_asset) if max_asset > min_asset else 0
    r_norm = (r_val - min_roa) / (max_roa - min_roa) if max_roa > min_roa else 0
    results.append({
        "ticker": t,
        "Total Aset": a_val,
        "Total Aset Norm": round(a_norm, 4),
        "ROA": r_val,
        "ROA Norm": round(r_norm, 4)
    })

print(json.dumps(dict(min_asset=min_asset, max_asset=max_asset, min_roa=min_roa, max_roa=max_roa), indent=2))
print(json.dumps(results, indent=2))
