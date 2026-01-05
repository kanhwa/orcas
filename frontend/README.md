# ORCAS Frontend

React + TypeScript + Vite frontend for ORCAS Bank Stock Ranking System.

## Prerequisites

- Node.js 18+
- Backend running at `http://localhost:8000`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment (optional, defaults work for local dev):

   ```bash
   # .env
   VITE_API_URL=http://127.0.0.1:8000
   ```

3. Start development server:

   ```bash
   npm run dev
   ```

4. Open browser at `http://localhost:5173`

## Features

- **Login**: Cookie-based session authentication
- **Dashboard**:
  - Year selector (2015-2024)
  - Mode: Section Ranking or Overall WSM
  - Section selector (Income, Balance, Cashflow)
  - Missing Policy selector (zero, redistribute, drop)
  - Limit (1-32)
  - Results table with rank, ticker, score

## API Endpoints Used

| Endpoint                   | Method | Description                                     |
| -------------------------- | ------ | ----------------------------------------------- |
| `/api/auth/login`          | POST   | Login with username/password                    |
| `/api/auth/me`             | GET    | Get current user from session                   |
| `/api/auth/logout`         | POST   | Logout and clear session                        |
| `/api/wsm/score`           | POST   | Overall WSM ranking with custom metrics         |
| `/api/wsm/section-ranking` | POST   | Section-based ranking (income/balance/cashflow) |

## Missing Policy

- **zero** (default): Missing metrics get score 0, ticker stays in ranking
- **redistribute**: Weights redistributed among available metrics only
- **drop**: Ticker excluded if any metric is missing

## Build

```bash
npm run build
```

Output in `dist/` folder.
