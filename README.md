# Khoebo

Khoebo is a multi-business platform for inventory, point-of-sale, double-entry
bookkeeping, analytics, reporting and reminders.

It ships in two parts:

- **`app/`** — the FastAPI backend that stores your data and exposes the REST API.
- **`mobile/`** — the React Native (Expo) app for phones, tablets and the web.

You can run the backend on its own, or pair it with the mobile app for a complete
day-to-day shop experience: sell, track stock, record expenses, review reports and
get reminded about what needs attention.

---

## What you get

- **Authentication & user management** — Argon2id password hashing, short-lived
  JWT access tokens, rotating refresh tokens (hashed at rest and revocable),
  password changes and superuser user management.
- **Business accounts** — users can belong to multiple businesses with
  `owner` / `admin` / `member` roles. Every business gets a seeded chart of
  accounts.
- **Inventory** — products, SKU uniqueness per business, stock in/out/adjustment
  movements, a stock ledger and low-stock detection.
- **Point of sale** — multi-line sales, discounts, tax, payment methods,
  automatic stock deduction and refunds that restore stock.
- **Double-entry bookkeeping** — every sale posts balanced journal entries (cash,
  revenue, discounts, tax payable, COGS, inventory). Expenses post automatically,
  manual journal entries are validated, and entries can be reversed.
- **Analytics** — revenue, COGS, gross/net profit, expenses, average sale,
  discounts, tax collected, inventory valuation, low-stock count, top products,
  daily revenue and payment-method breakdown.
- **Reports** — trial balance, income statement, inventory valuation and sales
  summary.
- **Reminders** — one-off or recurring reminders for low stock, recording sales,
  stock counts or custom tasks, with due/overdue evaluation, trigger and snooze.
- **Security** — tenant isolation on every business-scoped query, role checks,
  generic login errors, disabled interactive docs and secret validation in
  production, security headers, a CORS allow-list and SQLite foreign keys enabled.

### Mobile app extras

- **Offline-first** — recent data is cached and writes are queued while the
  device is offline, then synced when the connection returns.
- **Bilingual** — English and Sesotho interfaces.
- **Native feel** — bottom-tab navigation, secure token storage and a clean,
  touch-friendly layout.
- **Works everywhere** — run it on Android, iOS or in the browser with Expo.

## Stack

**Backend:** FastAPI · SQLAlchemy 2 · Alembic · Pydantic v2 · SQLite / PostgreSQL ·
PyJWT · argon2-cffi · pytest

**Mobile:** React Native · Expo · Expo Router · TanStack Query · TypeScript ·
SQLite (offline cache) · SecureStore

---

## Requirements

- **Python 3.10+**
- **Node.js 20+** and npm (only needed for the mobile app)
- One of: an Android emulator, an iOS simulator (macOS), a physical device with
  [Expo Go](https://expo.dev/go), or just a web browser

## Repository layout

```
khoebo/
├── app/         Backend application (FastAPI)
├── alembic/     Database migrations
├── tests/       Backend test suite
├── mobile/      React Native (Expo) app
├── assets/      Shared project assets
└── README.md
```

---

## Quick start

### 1. Start the backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then change SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

The API is now running at `http://localhost:8000`. While
`ENVIRONMENT=development`, browse the interactive docs at
http://localhost:8000/docs.

`AUTO_CREATE_TABLES=true` lets the app create missing tables in development.
Production requires `AUTO_CREATE_TABLES=false` and `alembic upgrade head`.

### 2. Start the mobile app

In a second terminal:

```bash
cd mobile
npm install
cp .env.example .env          # point the app at your backend
npm start
```

Then press:

- **`a`** to open Android,
- **`i`** to open iOS (macOS only),
- **`w`** to open the web version,

or scan the QR code with **Expo Go** on your phone.

### Connecting the app to the backend

The app reads the API address from `EXPO_PUBLIC_API_URL` in `mobile/.env`:

| Where you are running it | Value to use |
| --- | --- |
| iOS simulator or web | `http://localhost:8000/api/v1` |
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical phone | `http://<your-computer-LAN-IP>:8000/api/v1` |

For a physical device, make sure the phone and computer are on the same Wi-Fi
network and that port `8000` is reachable. If you change `.env`, restart the Expo
dev server so the new value is picked up.

### Mobile build commands

```bash
cd mobile
npm run android     # start and open on Android
npm run ios         # start and open on iOS (macOS only)
npm run web         # start in the browser
npm run typecheck   # type-check the app
npm run lint        # lint the app
```

To produce an installable build, use Expo's native tooling:

```bash
cd mobile
npx expo run:android            # native Android build (requires Android SDK)
npx expo run:ios                # native iOS build (requires Xcode on macOS)
npx expo export --platform web  # static web build into dist/
```

For app-store binaries, use [EAS Build](https://docs.expo.dev/build/introduction/).

---

## Tests

Run the backend suite from the project root:

```bash
pytest
```

The suite uses an in-memory SQLite database and covers authentication/security,
refresh-token rotation, role permissions, tenant isolation, inventory rules,
POS + accounting integration, refunds, analytics, reminders, cascade deletion and
a real Alembic upgrade/downgrade.

Type-check and lint the mobile app:

```bash
cd mobile
npm run typecheck
npm run lint
```

---

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

---

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

---

## Configuration

### Backend

See `.env.example`. Important settings:

- `SECRET_KEY` — required, at least 32 characters in production
- `DATABASE_URL` — SQLite or `postgresql+psycopg://...`
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default 15)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default 7)
- `AUTO_CREATE_TABLES` — development only
- `CORS_ORIGINS` — JSON array of allowed front-end origins

### Mobile

See `mobile/.env.example`:

- `EXPO_PUBLIC_API_URL` — the backend API base URL (see the table above)

### Using PostgreSQL

```bash
export DATABASE_URL=postgresql+psycopg://khoebo:khoebo@localhost:5432/khoebo
alembic upgrade head
uvicorn app.main:app
```

The migrations are dialect-neutral: UUIDs use SQLAlchemy `Uuid`, money uses
`Numeric`, and enums are stored as portable `VARCHAR` values.

---

## Production hardening

The app validates the secret and disables schema auto-creation and interactive
docs in production. For internet-facing deployments also:

- terminate TLS and put login/refresh endpoints behind rate limiting at the
  gateway or reverse proxy,
- back up the database and run `alembic upgrade head` as part of deployment,
- keep `CORS_ORIGINS` restricted to trusted front-end origins,
- serve the mobile web build (or store builds) over HTTPS and point
  `EXPO_PUBLIC_API_URL` at the public API URL,
- rotate `SECRET_KEY` only with a planned session invalidation.

---

## Troubleshooting

- **The app can't reach the backend.** Check `EXPO_PUBLIC_API_URL`, make sure the
  backend is running, and use your LAN IP (not `localhost`) for a physical phone.
- **Android emulator gets connection errors.** Use `http://10.0.2.2:8000/api/v1`
  instead of `localhost`.
- **Changes to `mobile/.env` are ignored.** Restart `npm start` after editing it.
- **Database looks out of date.** Run `alembic upgrade head` from the project
  root.
