# Auction Tracker

Auction Tracker is a full-stack app for tracking Nellis Auction purchases after checkout. It helps you sync purchases, manage item status, submit returns, and track resale performance.

## Features

- Nellis account login from the app UI
- Purchase sync from Nellis with pagination and detail enrichment
- SQLite-backed local storage with safe migrations
- Status workflow (`pending`, `received`, `inspected`, `returned`, `keep`, `sell_fb`, `sold_fb`)
- Bulk status updates for selected items
- Return submission endpoint for eligible orders
- Summary metrics for spend, sold revenue, and profit

## Tech Stack

- Frontend: React + Vite
- Backend: Express
- Database: SQLite (`better-sqlite3`)
- Styling/UI: Tailwind CSS + Lucide icons

## Project Structure

```text
src/             React UI, hooks, API client
server/          Express API, Nellis integration, SQLite setup
public/          Static assets
auction-tracker.db  Local SQLite file (auto-created)
```

## Prerequisites

- Node.js 20+
- npm 10+
- A valid Nellis Auction account

## Environment Variables

Copy `.env.example` to `.env` and provide your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | API server port. Defaults to `3001`. |
| `NODE_ENV` | No | Set to `production` to make Express serve the built client from `dist/`. Defaults to `development`. |
| `DB_PATH` | No | Path to the SQLite database file. Defaults to `./auction-tracker.db`. In containerized deploys, point this at a persistent volume (e.g. `/data/auction-tracker.db`). |
| `NELLIS_COOKIES` | No | Optional bootstrap cookie string for auth session. In normal usage, login from UI and let the app manage session cookies. |

Security notes:

- Never commit `.env`.
- Rotate Nellis credentials/cookies if you suspect exposure.

## Install

```bash
npm install
```

## Run Locally

Start client and server together:

```bash
npm run dev
```

This launches:

- Client: Vite dev server (default `http://localhost:5173`)
- API: Express server (default `http://localhost:3001`)

## Build and Lint

```bash
npm run lint
npm run build
```

## API Overview

The backend is mounted at `/api`.

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/purchases`
- `GET /api/purchases/summary`
- `PATCH /api/purchases/:id`
- `PATCH /api/purchases/bulk/status`
- `POST /api/sync`
- `POST /api/returns/:buyNowId`

Detailed request/response docs are in `docs/api.md`.

## Data Model Notes

The app stores purchases locally in SQLite and applies migrations at startup. The database file is generated automatically and ignored by git.

Core fields include:

- Purchase identity (`product_id`, `buy_now_id`, `title`)
- Pricing (`purchase_price`, `buyer_premium`, `tax_amount`, `total_cost`, `fb_sold_price`)
- Workflow and annotations (`status`, `notes`, `fb_sold_date`, `return_submitted`)

## Troubleshooting

- Login fails:
	- Verify Nellis credentials.
	- Confirm outbound access to `https://www.nellisauction.com`.
- Sync fails with auth errors:
	- Log out and log back in from the app.
- Empty list after sync:
	- Confirm your Nellis account has purchase history.

## License

MIT. See `LICENSE`.
