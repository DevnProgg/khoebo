# Khoebo API

A multi-business backend for inventory, point-of-sale, double-entry bookkeeping,
performance analytics, reporting and reminders. Built with FastAPI, SQLAlchemy 2,
SQLite by default and PostgreSQL via migrations.

## Features

- **Authentication & user management** — Argon2id password hashing, short-lived
  JWT access tokens, rotating refresh tokens (hashed at rest and revocable),
  password changes, superuser user management.
- **Business accounts** — users can belong to multiple businesses with
  `owner` / `admin` / `member` roles. Every business gets a seeded chart of
  accounts.
- **Inventory** — products, SKU uniqueness per business, stock in/out/adjustment
  movements, stock ledger and low-stock detection.
- **Point of sale** — multi-line sales, discounts, tax, payment methods,
  automatic stock deduction and refunds that restore stock.
- **Double-entry bookkeeping** — every sale posts balanced journal entries
  (cash, revenue, discounts, tax payable, COGS, inventory). Expenses post
  automatically, manual journal entries are validated, and entries can be
  reversed.
- **Analytics** — revenue, COGS, gross/net profit, expenses, average sale,
  discounts, tax collected, inventory valuation, low-stock count, top products,
  daily revenue and payment-method breakdown.
- **Reports** — trial balance, income statement, inventory valuation and sales
  summary.
- **Reminders** — one-off or recurring reminders for low stock, recording sales,
  stock counts or custom tasks, with due/overdue evaluation, trigger and snooze.
- **Security** — tenant isolation on every business-scoped query, role checks,
  generic login errors, disabled interactive docs and secret validation in
  production, security headers, CORS allow-list and SQLite foreign keys enabled.

## Stack

FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · SQLite / PostgreSQL · PyJWT ·
argon2-cffi · pytest

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then change SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs while `ENVIRONMENT=development`.

`AUTO_CREATE_TABLES=true` lets the app create missing tables in development.
Production requires `AUTO_CREATE_TABLES=false` and `alembic upgrade head`.

### PostgreSQL

```bash
export DATABASE_URL=postgresql+psycopg://khoebo:khoebo@localhost:5432/khoebo
alembic upgrade head
uvicorn app.main:app
```

The migrations are dialect-neutral: UUIDs use SQLAlchemy `Uuid`, money uses
`Numeric`, and enums are stored as portable `VARCHAR` values.

## Tests

```bash
pytest
```

The suite uses an in-memory SQLite database and covers authentication/security,
refresh-token rotation, role permissions, tenant isolation, inventory rules,
POS + accounting integration, refunds, analytics, reminders, cascade deletion
and a real Alembic upgrade/downgrade.

## API overview

All routes are under `/api/v1`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`, `GET /auth/me` |
| Users | `PATCH /users/me`, `GET /users`, `PATCH /users/{id}/status` (superuser) |
| Businesses | CRUD `/businesses`, `/businesses/{id}/members` |
| Inventory | `/businesses/{id}/products`, `/products/low-stock`, `/products/{pid}/stock-movements` |
| Sales | `/businesses/{id}/sales`, `/sales/{sid}/refund` |
| Accounting | `/businesses/{id}/accounts`, `/journal-entries`, `/expenses` |
| Reports | `/businesses/{id}/reports/trial-balance`, `/income-statement`, `/inventory-valuation`, `/sales-summary` |
| Analytics | `/businesses/{id}/analytics/overview` |
| Reminders | `/businesses/{id}/reminders`, `/due`, `/{rid}/trigger`, `/{rid}/snooze` |

### Permissions

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| View business data / reports | yes | yes | yes |
| Create sales, adjust stock | yes | yes | yes |
| Manage products, accounts, expenses, journal entries | yes | yes | no |
| Refund sales | yes | yes | no |
| Manage members | yes | member only | no |
| Grant/remove admin or owner roles | yes | no | no |
| Update / delete business | yes | update only | no |

## Accounting model

Each business is seeded with:

`1000 Cash`, `1010 Accounts Receivable`, `1200 Inventory`, `2000 Accounts
Payable`, `2200 Tax Payable`, `3000 Owner's Equity`, `4000 Sales Revenue`,
`4010 Sales Discounts`, `5000 Cost of Goods Sold`, and operating expense
accounts `5100`–`5600`.

A completed sale posts, in one balanced entry:

- Debit Cash for the amount paid
- Debit Sales Discounts for any discount
- Debit COGS for the cost of items sold
- Credit Sales Revenue for the subtotal
- Credit Tax Payable for collected tax
- Credit Inventory for COGS

Refunds reverse the original entry and return stock.

## Configuration

See `.env.example`. Important settings:

- `SECRET_KEY` — required, at least 32 characters in production
- `DATABASE_URL` — SQLite or `postgresql+psycopg://...`
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default 15)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default 7)
- `AUTO_CREATE_TABLES` — development only
- `CORS_ORIGINS` — JSON array of allowed front-end origins

## Production hardening

The app validates the secret and disables schema auto-creation and interactive
docs in production. For internet-facing deployments also:

- terminate TLS and put login/refresh endpoints behind rate limiting at the
  gateway or reverse proxy,
- back up the database and run `alembic upgrade head` as part of deployment,
- keep `CORS_ORIGINS` restricted to trusted front-end origins,
- rotate `SECRET_KEY` only with a planned session invalidation.
