import json
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
ADMIN_USER = os.environ.get("WSM_USER", "admin")
ADMIN_PASS = os.environ.get("WSM_PASS", "admin123")


def request_json(session: requests.Session, method: str, path: str, **kwargs) -> Tuple[int, Any]:
    url = f"{BASE_URL}{path}"
    resp = session.request(method, url, **kwargs)
    try:
        data = resp.json()
    except Exception:
        data = resp.text
    return resp.status_code, data


def login(username: str, password: str) -> requests.Session:
    session = requests.Session()
    status, data = request_json(
        session,
        "post",
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    if status != 200:
        raise SystemExit(f"Login failed ({status}): {data}")
    return session


def fetch_metrics_catalog() -> Dict[str, Any]:
    resp = requests.get(f"{BASE_URL}/api/wsm/metrics-catalog")
    resp.raise_for_status()
    return resp.json()


def build_metrics_from_catalog(catalog: Dict[str, Any]) -> List[Dict[str, Any]]:
    metrics: List[Dict[str, Any]] = []
    for section in catalog.get("sections", []):
        for m in section.get("metrics", []):
            metrics.append(
                {
                    "metric_name": m["key"],
                    "type": m.get("type") or "benefit",
                    "weight": m.get("default_weight", 1.0),
                }
            )
    return metrics


def find_tickers_for_coverage(
    session: requests.Session, tickers: List[str], year: int
) -> Tuple[Optional[str], Optional[str], List[Dict[str, Any]]]:
    coverage_records: List[Dict[str, Any]] = []
    complete = None
    incomplete = None
    for ticker in tickers:
        status, data = request_json(
            session,
            "post",
            "/api/wsm/scorecard",
            json={"year": year, "ticker": ticker, "missing_policy": "zero"},
        )
        record = {"ticker": ticker, "status": status, "coverage": None, "detail": None}
        if status == 200:
            record["coverage"] = data.get("coverage")
            pct = data.get("coverage", {}).get("pct", 0)
            if pct == 1 and not complete:
                complete = ticker
            if pct < 1 and not incomplete:
                incomplete = ticker
        else:
            record["detail"] = data
        coverage_records.append(record)
        if complete and incomplete:
            break
    return complete, incomplete, coverage_records


def run_scorecard_matrix(
    session: requests.Session, ticker: str, year: int, policies: List[str]
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for policy in policies:
        status, data = request_json(
            session,
            "post",
            "/api/wsm/scorecard",
            json={"year": year, "ticker": ticker, "missing_policy": policy},
        )
        results.append(
            {
                "policy": policy,
                "status": status,
                "summary": {
                    "total_score": data.get("total_score"),
                    "coverage": data.get("coverage"),
                    "detail": data.get("detail") if isinstance(data, dict) else data,
                }
                if isinstance(data, dict)
                else {"raw": data},
            }
        )
    return results


def run_score_tests(
    session: requests.Session,
    year: int,
    metrics: List[Dict[str, Any]],
    tickers: List[str],
    policies: List[str],
) -> List[Dict[str, Any]]:
    outputs: List[Dict[str, Any]] = []
    for policy in policies:
        status, data = request_json(
            session,
            "post",
            "/api/wsm/score",
            json={
                "year": year,
                "metrics": metrics,
                "tickers": tickers,
                "missing_policy": policy,
            },
        )
        outputs.append(
            {
                "policy": policy,
                "status": status,
                "ranking": data.get("ranking") if isinstance(data, dict) else None,
                "dropped_tickers": data.get("dropped_tickers") if isinstance(data, dict) else None,
                "detail": data if status != 200 else None,
            }
        )
    return outputs


def run_compare_tests(
    session: requests.Session,
    tickers: List[str],
    year_from: int,
    year_to: int,
    policies: List[str],
    mode: str = "overall",
    section: Optional[str] = None,
    extra_payload: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    outputs: List[Dict[str, Any]] = []
    for policy in policies:
        payload = {
            "tickers": tickers,
            "year_from": year_from,
            "year_to": year_to,
            "mode": mode,
            "section": section,
            "missing_policy": policy,
        }
        if extra_payload:
            payload.update(extra_payload)
        status, data = request_json(session, "post", "/api/wsm/compare", json=payload)
        outputs.append(
            {
                "policy": policy,
                "status": status,
                "series": data.get("series") if isinstance(data, dict) else None,
                "dropped_tickers": data.get("dropped_tickers") if isinstance(data, dict) else None,
                "detail": data if status != 200 else None,
            }
        )
    return outputs


def create_weight_template(
    session: requests.Session, payload: Dict[str, Any]
) -> Tuple[Optional[int], Dict[str, Any]]:
    status, data = request_json(session, "post", "/api/weight-templates", json=payload)
    template_id = data.get("id") if status in (200, 201) and isinstance(data, dict) else None
    return template_id, {"status": status, "response": data}


def negative_template_tests(session: requests.Session) -> List[Dict[str, Any]]:
    tests = [
        {
            "name": "invalid_scope",
            "payload": {"name": "invalid-scope", "mode": "foo", "weights": {"x": 1}},
        },
        {
            "name": "non_numeric",
            "payload": {"name": "non-numeric", "mode": "metric", "weights": {"Return on Assets (ROA)": "bad"}},
        },
        {
            "name": "zero_sum",
            "payload": {"name": "zero-sum", "mode": "metric", "weights": {"Return on Assets (ROA)": 0, "Return on Equity (ROE)": 0}},
        },
        {
            "name": "unknown_metric",
            "payload": {"name": "unknown-metric", "mode": "metric", "weights": {"not-a-metric": 1}},
        },
        {
            "name": "unknown_section",
            "payload": {"name": "unknown-section", "mode": "section", "weights": {"balance": 1, "foo": 1}},
        },
    ]
    results: List[Dict[str, Any]] = []
    for case in tests:
        status, data = request_json(session, "post", "/api/weight-templates", json=case["payload"])
        results.append({"case": case["name"], "status": status, "detail": data})
    return results


def ownership_test(
    admin_session: requests.Session, template_id: int, new_username: str = "wsmtestuser"
) -> Dict[str, Any]:
    # Create secondary user
    create_payload = {
        "username": new_username,
        "password": "testpass123",
        "first_name": "WSM",
        "last_name": "User",
    }
    status, data = request_json(
        admin_session, "post", "/api/admin/users", json=create_payload
    )
    user_created = status in (200, 201)
    # Login as the new user (even if already exists)
    try:
        other_session = login(new_username, "testpass123")
    except SystemExit:
        other_session = None
    result: Dict[str, Any] = {"create_user": {"status": status, "detail": data}}
    if other_session:
        s, resp = request_json(
            other_session, "get", f"/api/weight-templates/{template_id}"
        )
        result["foreign_access"] = {"status": s, "detail": resp}
    else:
        result["foreign_access"] = {"status": None, "detail": "login_failed"}
    return result


def template_usage_tests(
    session: requests.Session, template_id: int, compare_payload: Dict[str, Any]
) -> List[Dict[str, Any]]:
    tests: List[Dict[str, Any]] = []
    # score
    status, data = request_json(
        session,
        "post",
        "/api/wsm/score",
        json={"year": compare_payload["year_from"], "tickers": compare_payload["tickers"], "missing_policy": "zero", "weight_template_id": template_id},
    )
    tests.append({"endpoint": "score", "status": status, "detail": data})

    # scorecard (single ticker)
    if compare_payload.get("tickers"):
        status, data = request_json(
            session,
            "post",
            "/api/wsm/scorecard",
            json={
                "year": compare_payload["year_from"],
                "ticker": compare_payload["tickers"][0],
                "missing_policy": "zero",
                "weight_template_id": template_id,
            },
        )
        tests.append({"endpoint": "scorecard", "status": status, "detail": data})

    # compare
    payload = dict(compare_payload)
    payload["weight_template_id"] = template_id
    status, data = request_json(session, "post", "/api/wsm/compare", json=payload)
    tests.append({"endpoint": "compare", "status": status, "detail": data})
    return tests


def main() -> None:
    summary: Dict[str, Any] = {}

    run_suffix = os.environ.get("WSM_RUN_SUFFIX") or uuid.uuid4().hex[:8]

    # Login
    admin_session = login(ADMIN_USER, ADMIN_PASS)
    summary["login"] = {"user": ADMIN_USER, "base_url": BASE_URL}

    # Discovery
    years_status, years_data = request_json(admin_session, "get", "/api/years")
    emit_status, emit_data = request_json(admin_session, "get", "/api/emitens?limit=10")
    catalog = fetch_metrics_catalog()
    metrics = build_metrics_from_catalog(catalog)
    summary["discovery"] = {
        "years_status": years_status,
        "years": years_data.get("years") if isinstance(years_data, dict) else years_data,
        "emitens_status": emit_status,
        "emitens_sample": emit_data.get("items") if isinstance(emit_data, dict) else emit_data,
        "metrics_count": len(metrics),
    }

    year = summary["discovery"].get("years", [2024])[0]
    tickers = [item["ticker_code"] for item in summary["discovery"].get("emitens_sample", [])][:6]

    complete, incomplete, coverage_scan = find_tickers_for_coverage(admin_session, tickers, year)
    summary["coverage_scan"] = {
        "complete": complete,
        "incomplete": incomplete,
        "records": coverage_scan,
    }

    policies = ["zero", "redistribute", "drop"]
    scorecard_results: Dict[str, Any] = {}
    for label, ticker in [("complete", complete), ("incomplete", incomplete)]:
        if ticker:
            scorecard_results[label] = run_scorecard_matrix(admin_session, ticker, year, policies)
    summary["scorecard"] = scorecard_results

    chosen_tickers = [t for t in [complete, incomplete] if t]
    score_results = run_score_tests(admin_session, year, metrics, chosen_tickers, policies)
    summary["score"] = score_results

    if len(summary["discovery"].get("years", [])) > 1:
        year_to = summary["discovery"]["years"][0]
        year_from = summary["discovery"]["years"][1]
    else:
        year_to = year
    year_from = summary["discovery"].get("years", [year])[min(1, len(summary["discovery"].get("years", [])) - 1)]

    compare_payload = {
        "tickers": chosen_tickers,
        "year_from": year_from,
        "year_to": year_to,
        "mode": "overall",
    }
    compare_results = run_compare_tests(
        admin_session, chosen_tickers, year_from, year_to, policies, mode="overall"
    )
    summary["compare_overall"] = compare_results

    if complete:
        section_results = run_compare_tests(
            admin_session,
            chosen_tickers,
            year_from,
            year_to,
            policies,
            mode="section",
            section="income",
        )
        summary["compare_section_income"] = section_results

    # Weight templates
    metric_template_payload = {
        "name": f"metric-sample-{run_suffix}",
        "description": "auto test metric scope",
        "mode": "metric",
        "weights": {m["metric_name"]: m["weight"] for m in metrics[:4]},
    }
    metric_template_id, metric_template_result = create_weight_template(
        admin_session, metric_template_payload
    )

    section_template_payload = {
        "name": f"section-sample-{run_suffix}",
        "description": "auto test section scope",
        "mode": "section",
        "weights": {"balance": 1, "income": 1, "cash_flow": 1},
    }
    section_template_id, section_template_result = create_weight_template(
        admin_session, section_template_payload
    )

    summary["weight_templates"] = {
        "metric": metric_template_result,
        "section": section_template_result,
    }

    summary["weight_template_negative"] = negative_template_tests(admin_session)

    if metric_template_id:
        summary["ownership"] = ownership_test(admin_session, metric_template_id, new_username=f"wsmtestuser_{run_suffix}")
        summary["template_usage"] = template_usage_tests(
            admin_session,
            metric_template_id,
            {
                "tickers": chosen_tickers,
                "year_from": year_from,
                "year_to": year_to,
                "mode": "overall",
                "missing_policy": "zero",
            },
        )

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
