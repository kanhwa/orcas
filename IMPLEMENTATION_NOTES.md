# Metric Ranking Best/Worst Feature - Backend Implementation

## Summary
Successfully implemented backend support for the Best/Worst toggle in the Metric Ranking feature. Both ranking endpoints now accept an optional `rank_type` query parameter that controls the sorting direction based on the metric type.

## Changes Made

### 1. New Helper Function: `_get_sort_order()`
**File:** `backend/app/api/routes/metric_ranking.py`

Added a reusable helper function that determines the correct SQLAlchemy sort order:

```python
def _get_sort_order(metric: MetricDefinition, rank_type: str = "best"):
    """
    Determine sort order based on metric type and rank_type.
    
    Logic:
    - Benefit metrics (higher is better):
        - best => DESC (highest first)
        - worst => ASC (lowest first)
    - Cost metrics (lower is better):
        - best => ASC (lowest first)
        - worst => DESC (highest first)
    """
    is_benefit = metric.type and metric.type.value == "benefit"
    
    if rank_type == "worst":
        return asc if is_benefit else desc
    else:
        return desc if is_benefit else asc
```

### 2. Updated `/api/metric-ranking/panel` Endpoint
**Changes:**
- Added `rank_type` query parameter with regex validation: `^(best|worst)$`
- Default value: `"best"`
- Uses `_get_sort_order()` to determine sort direction
- Response shape unchanged (backward compatible)

**Example Usage:**
```
GET /api/metric-ranking/panel?metric_id=1&from_year=2020&to_year=2024&top_n=5&rank_type=best
GET /api/metric-ranking/panel?metric_id=1&from_year=2020&to_year=2024&top_n=5&rank_type=worst
```

### 3. Updated `/api/metric-ranking/by-year` Endpoint
**Changes:**
- Added `rank_type` query parameter with regex validation: `^(best|worst)$`
- Default value: `"best"`
- Uses `_get_sort_order()` to determine sort direction
- Response shape unchanged (backward compatible)

**Example Usage:**
```
GET /api/metric-ranking/by-year?metric_id=1&year=2024&top_n=10&rank_type=best
GET /api/metric-ranking/by-year?metric_id=1&year=2024&top_n=10&rank_type=worst
```

## Sorting Logic

### Benefit Metrics (e.g., ROE, ROA, Net Profit)
Higher values are better:
- **Best (rank_type=best):** Returns highest values → `ORDER BY value DESC`
- **Worst (rank_type=worst):** Returns lowest values → `ORDER BY value ASC`

### Cost Metrics (e.g., NPL, Cost-to-Income Ratio)
Lower values are better:
- **Best (rank_type=best):** Returns lowest values → `ORDER BY value ASC`
- **Worst (rank_type=worst):** Returns highest values → `ORDER BY value DESC`

## Testing

### Automated Test
Created `backend/test_rank_type.py` to verify the sorting logic:

```bash
cd backend && python3 test_rank_type.py
```

**Test Results:**
```
✅ TEST 1: BENEFIT METRIC - PASSED
   rank_type='best'  => DESC => [200, 150, 100]
   rank_type='worst' => ASC => [25, 50, 75]

✅ TEST 2: COST METRIC - PASSED
   rank_type='best'  => ASC => [25, 50, 75]
   rank_type='worst' => DESC => [200, 150, 100]

✅ TEST 3: VERIFY BEST != WORST - PASSED
   Results differ correctly between best and worst rankings
```

### Manual Testing
To test with the running backend:

1. **Login to get session:**
   ```bash
   curl -c cookies.txt -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "your_username", "password": "your_password"}'
   ```

2. **Get available metrics:**
   ```bash
   curl -b cookies.txt http://localhost:8000/api/metric-ranking/available-metrics
   ```

3. **Test Best ranking:**
   ```bash
   curl -b cookies.txt "http://localhost:8000/api/metric-ranking/by-year?metric_id=1&year=2024&top_n=5&rank_type=best"
   ```

4. **Test Worst ranking:**
   ```bash
   curl -b cookies.txt "http://localhost:8000/api/metric-ranking/by-year?metric_id=1&year=2024&top_n=5&rank_type=worst"
   ```

5. **Verify results differ:**
   Compare the ticker lists from steps 3 and 4 - they should be different (unless all values are equal).

## Key Features

✅ **Backward Compatible:** Default value `rank_type=best` maintains existing behavior  
✅ **Input Validation:** Regex pattern ensures only "best" or "worst" values accepted  
✅ **NULL Handling:** Query already filters `value.isnot(None)` to exclude NULL values  
✅ **Type Safety:** Uses existing `metric.type` field from database (no migration needed)  
✅ **Response Unchanged:** API response structure remains identical  
✅ **Tested:** Logic verified with automated test script  

## Frontend Integration

The frontend already sends the `rank_type` parameter:
- Toggle button in UI allows users to select "Best" or "Worst"
- API service automatically includes the parameter in requests
- No frontend changes needed - feature is ready to use

## Notes

- The backend server with `--reload` flag automatically picks up these changes
- No database migration required - uses existing `metric.type` column
- Sorting respects metric semantics (benefit vs cost) automatically
- Results are correctly limited to `top_n` after sorting
