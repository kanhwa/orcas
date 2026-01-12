# WSM Backend Verification (2026-01-12)

## Latest verification (2026-01-12)

- Weight templates: create metric/section 201; negative cases stay 422; foreign-owner access 404.
- Template usage: score, scorecard, compare all 200 using `weight_template_id`.
- Drop policy: score uses dropped_tickers list; scorecard returns 422 for ineligible drop; compare keeps all tickers in series with dropped_tickers entry and null scores for dropped ones.
- Command: `python3 backend/scripts/verify_wsm.py`.

## Environment

- Base URL: http://localhost:8000
- Auth: session login via `/api/auth/login` with seeded admin/admin123 (cookie-based). WSM/years/emitens require auth; `/api/wsm/metrics-catalog` is public.
- Backend restart: stopped prior uvicorn PID 1840, then started via `nohup ./\.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 >/tmp/orcas-backend.log 2>&1 &` from `backend/`. Listener confirmed on 127.0.0.1:8000.
- Script: `python3 backend/scripts/verify_wsm.py` (run after restart).

## Discovery

- Years: 2024–2015 (`/api/years`).
- Emitens sample (first 6): AGRS, ARTO, BABP, BACA, BBCA, BBKP (`/api/emitens?limit=10`).
- Metrics catalog: 39 metrics, sections income/balance/cashflow.
- Coverage scan @2024:
  - Complete: AGRS (39/39).
  - Incomplete: ARTO (38/39, missing `Pinjaman yang Diterima`).

## Scorecard (`POST /api/wsm/scorecard`)

- AGRS (complete): zero/redistribute/drop all 200 with score 0.103571, coverage 39/39.
- ARTO (incomplete):
  - zero: 200, score 0.121317, coverage 38/39 (missing `Pinjaman yang Diterima`).
  - redistribute: 200, score 0.124383, coverage 38/39.
  - drop: **422** with friendly detail `{message: "Ticker ARTO is not eligible for missing_policy=drop", missing_metrics: ["Pinjaman yang Diterima"]}` (no longer 404).

## Score (`POST /api/wsm/score`)

- Payload: full 39 metrics, tickers [AGRS, ARTO].
- zero: 200 ranking ARTO 0.801102, AGRS 0.618756.
- redistribute: 200 ranking ARTO 0.821347, AGRS 0.618756.
- drop: 200 ranking AGRS 0.618756; **dropped_tickers** reports ARTO with reason "Dropped due to missing metrics" and missing_metrics `["Pinjaman yang Diterima"]`.

## Compare Overall (`POST /api/wsm/compare`, tickers [AGRS, ARTO], years 2023–2024)

- zero: 200, AGRS [0.07812, 0.103571], ARTO [0.098663, 0.121317], dropped_tickers [].
- redistribute: 200, AGRS same, ARTO [0.101156, 0.124383], dropped_tickers [].
- drop: 200, series retains AGRS plus ARTO with scores [null, null] and missing_years [2023, 2024]; **dropped_tickers** lists ARTO reason "Missing metrics: Pinjaman yang Diterima".

## Compare Section (income) (`POST /api/wsm/compare`, same tickers/years, mode=section)

- All policies return AGRS ~0.158/0.136 and ARTO ~0.0748/0.0786 with dropped_tickers []. Section has full coverage so drop does not exclude ARTO.

## Weight Templates (`/api/weight-templates`)

- Create metric template (metric-sample-<suffix>): **201** with 4-metric weights; section template (section-sample-<suffix>): **201** with balance/income/cash_flow 1/1/1.
- Duplicate names per owner hit unique `uq_weight_template_owner_name` and now return **409**.
- Negative cases remain **422**: invalid scope, non-numeric, zero-sum, unknown metric, unknown section.
- Ownership: secondary user `wsmtestuser_<suffix>` gets **404** when accessing another user’s template.
- Template usage with `weight_template_id` works: score/scorecard/compare all **200** using the created template (scorecard shows template weights applied).

## Contract / Behavior Notes

- Drop policy: score/preview honor `dropped_tickers`; scorecard returns **422** with friendly message for ineligible tickers under `missing_policy=drop`; compare keeps every requested ticker in `series` and marks dropped tickers with null scores plus `dropped_tickers` reasons.
- Weight templates: schema present via migration, create/update guarded with **409** on duplicate owner/name; template usage across score/scorecard/compare now works with authentication.

## Next Fixes Suggested

- None blocking; rerun verification after future schema/data changes to ensure drop-policy and template behaviors stay stable.
