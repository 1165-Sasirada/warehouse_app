# Warehouse Shortest Path Simulator

A cloud-native web app that simulates order fulfillment in a warehouse: it receives orders,
calculates the shortest pick path using A* + a Nearest-Neighbor TSP heuristic, and shows
workers an interactive route through the warehouse — plus a stock/history dashboard and a
pick-frequency heatmap.

**Team:** *(add names/IDs here)*
**Live app:** *(add Vercel URL here)*

---

## 1. Project Overview

- **Painpoint:** Warehouse workers currently walk to pick items in an unoptimized order,
  wasting time.
- **Goal:** Simulate order fulfillment and visualize the most efficient pick route through
  the warehouse.
- **In scope:** Pathfinding + route optimization, interactive pick UI, stock/history pages,
  traffic heatmap.
- **Out of scope:** Integration with real warehouse hardware.

## 2. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Core algorithm | Python (A*, TSP nearest-neighbor) | Shortest path + route ordering |
| Frontend | Next.js (React, TypeScript) + Tailwind | Dashboard, stock/history/login pages |
| Backend compute | Vercel Serverless Functions (Python) | Wraps the algorithm as an API |
| Database & Auth | Supabase (Postgres) | Stores users, stock, orders, locations |
| Message queue | Upstash Redis | Buffers rapid "Receive Order" clicks |
| Hosting/CI-CD | Vercel + GitHub | Auto-deploy on push to `main` |

Everything runs on free tiers — see the project proposal doc for the full cost/security
breakdown.

## 3. Repo Structure

```
warehouse_app/
├── core/                    # Pure algorithm logic — no cloud dependencies
│   ├── __init__.py
│   ├── warehouse.py         # Grid generation + location label parsing
│   └── pathfinder.py        # A* search + TSP nearest-neighbor route optimizer
├── scripts/
│   ├── demo.py               # Local CLI test runner (was main.py)
│   └── seed.py                # Populates Supabase with locations, SKUs, and demo stock
├── api/
│   └── path.py                # Vercel Python function wrapping the A* route optimizer
├── supabase/
│   ├── schema.sql             # Creates all 7 tables + enables Realtime on 2 of them
│   ├── rls.sql                 # Row Level Security policies
│   └── grants.sql            # Table-level GRANTs (required since "auto-expose new
│                                # tables" is off in our Supabase project settings)
├── app/                       # Next.js App Router pages
│   ├── layout.tsx              # Root layout — fonts (JetBrains Mono, Karla, Bai Jamjuree)
│   ├── login/page.tsx           # Login page (Supabase Auth)
│   ├── dashboard/page.tsx        # Live pending-order picking dashboard
│   ├── create-order/page.tsx      # Authenticated order creation page
│   ├── stock/page.tsx             # Stock table and restock action
│   └── history/page.tsx           # Completed-order history
├── components/
│   ├── Sidebar.tsx              # Shared collapsible nav, used on every authenticated page
│   ├── WarehouseMap.tsx          # SVG grid/cell renderer
│   └── WarehouseRoute.tsx        # Animated route overlay with gradient and arrows
├── lib/
│   ├── supabaseClient.ts         # Shared Supabase JS client
│   └── warehouseGrid.ts           # TS mirror of core/warehouse.py's grid layout — keep both in sync
├── color-reference.txt        # Current hex values for every UI color — check before styling anything
├── layout-reference.txt       # Per-page layout spec (structure only, no colors)
├── .env                        # Local secrets — NOT committed (see .env.example)
├── .env.local                   # Frontend env vars (NEXT_PUBLIC_ prefixed) — also not committed
├── .gitignore
├── requirements.txt
└── README.md
```

Not yet created: the production order-ingestion API, atomic order claiming, and queue worker.
The route calculation API is implemented as a Vercel Python function. The current Create Order
and order mutations still use Supabase directly from the authenticated client.

## 4. Getting Started

**Python side:**
```bash
git clone <repo-url>
cd warehouse_app

python -m venv venv
source venv/Scripts/activate      # Git Bash on Windows
# source venv/bin/activate        # macOS/Linux

pip install -r requirements.txt
```

**Frontend side:**
```bash
npm install
```

Create a `.env` file at the repo root (Python — see `.env.example`):
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxx
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
```

Create a `.env.local` file at the repo root (Next.js — note the `NEXT_PUBLIC_` prefix,
required for any env var used in browser-side code):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
```

Get both sets of values from the Supabase dashboard → Project Settings → API Keys. **Never
commit `.env` or `.env.local`** — both are in `.gitignore`.

Ask whoever set up Supabase and Vercel to add you as a project member on both, or share
credentials directly over a private channel.

## 5. Supabase Setup

In the Supabase SQL Editor, run these **in order** (only needs to be done once per project,
not per person):

1. `supabase/schema.sql` — creates all 7 tables
2. `supabase/rls.sql` — enables authenticated access policies
3. `supabase/grants.sql` — grants base table access to `anon`/`authenticated`/`service_role`
   (needed because table creation doesn't auto-grant when "Automatically expose new tables"
   is disabled in project settings)

Skipping step 3 causes `permission denied for table ...` errors even though RLS policies
look correct — GRANT and RLS are two separate layers; RLS filters rows, GRANT decides
whether a role can attempt the action at all.

**Do not re-run `schema.sql` if tables already exist** — coordinate any schema changes
together rather than one person re-running it solo.

## 6. Seeding the Database

```bash
python scripts/seed.py           # locations, SKUs, and demo stock; safe to rerun
```

Reuses `core/warehouse.py`'s `parse_location()` so seeded coordinates always match what the
pathfinder computes — never hand-generate grid coordinates separately.

**Note:** the warehouse grid layout changed (an extra walkway row was inserted between the
packing station and the top block — grid is now 24 rows instead of 23). If you seeded data
before this change, clear it and re-seed:
```sql
delete from public.locations;
```

## 7. Running the Algorithm Locally

```bash
python scripts/seed.py --test
python scripts/seed.py           # locations, SKUs, and demo stock; safe to rerun
```

Runs a sample 4-item order through the grid and prints the naive vs. optimized distance and
the step-by-step pick sequence. Good smoke test after touching `core/`.

## 8. Running the Frontend Locally

```bash
npm run dev
```

Open `http://localhost:3000/login`. You'll need a real employee account to log in — create
one via Supabase Dashboard → Authentication → Users → Add User if you don't have one yet.

For the complete setup and end-to-end test procedure, see
[TESTING_GUIDE.txt](TESTING_GUIDE.txt).

## 9. Design Reference

Before changing any styling, check:
- **`color-reference.txt`** — every confirmed hex value, organized by where it's used
- **`layout-reference.txt`** — each page's structure, independent of color

These are the source of truth over anything said in old chat messages or earlier drafts —
update them whenever a color or layout decision changes, so we don't regress to old values.

## 10. Current Status

- [x] **Phase 1 — Core algorithm:** `core/warehouse.py` (grid + label parsing) and
      `core/pathfinder.py` (A* + TSP) done and tested via `scripts/demo.py`.
- [x] **Phase 2 — Cloud DB & Auth:** Supabase project created, schema + RLS + grants
      applied, seed script working.
- [ ] **Phase 3 — Frontend & CI/CD (in progress):**
      - [x] Next.js project scaffolded, connected to Vercel (auto-deploys on push to `main`)
      - [x] Login page (Supabase Auth) built
      - [x] Sidebar nav (collapsible, shared across pages) built
      - [x] Dashboard loads pending orders and accepts the oldest PENDING order
      - [x] Warehouse map renders from `lib/warehouseGrid.ts` (mirrors the Python grid layout)
      - [x] Stock page with search and Restock All demo action
      - [x] History page with completed-order metrics
      - [x] Authenticated Create Order page for creating PENDING orders
      - [x] Automatic order numbers and stock-derived locations
      - [x] Database-backed interactive pick flow and order completion
      - [x] Animated gradient route and current-target glow
      - [x] Dashboard route segments calculated by the Python A* API
- [ ] **Phase 4 — Serverless compute & queuing:** API and queue not started.
- [ ] **Phase 5 — Analytics & polish:** not started.

## 11. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'core'` | Ran a script from inside `scripts/` instead of repo root | Run as `python scripts/seed.py`, not `cd scripts && python seed.py` |
| `permission denied for table ...` | `grants.sql` not run yet | Run `supabase/grants.sql` in the SQL Editor |
| `relation "locations" does not exist` | `schema.sql` not run yet | Run `supabase/schema.sql` first |
| `KeyError: 'SUPABASE_URL'` | `.env` missing or key name mismatch | Check `.env` exists at repo root with exact key names above |
| Fonts show as default/Arial in browser | `app/globals.css` has a hardcoded `body { font-family: ... }` rule overriding the ones from `layout.tsx` | Remove that rule, or change it to `font-family: var(--font-body);` |
| Frontend can't read Supabase env vars | Used `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL` | Next.js only exposes `NEXT_PUBLIC_`-prefixed vars to browser code |

## 12. Completion Checklist

### Completed

- [x] Core warehouse grid, location parsing, A* pathfinding, and nearest-neighbor route ordering
- [x] Supabase schema, RLS/grants, seed script, authentication, shared sidebar, stock, and history pages
- [x] Warehouse map component separated from the animated route component
- [x] Authenticated order creation with automatic order numbers
- [x] SKU selection with location derived from positive stock records
- [x] PENDING -> PICKING -> COMPLETED order lifecycle
- [x] Database-backed item picking and History records
- [x] Animated route gradient, current-target glow, completed paths, and walk-speed control

### Still required for a complete production system

- [ ] Receive orders from an external source and persist them as `PENDING`
- [x] Server-side route calculation using the Python pathfinder
- [ ] Accept one pending order atomically and mark it `PICKING`
- [ ] Decrease stock and update heatmap quantities transactionally
- [ ] Complete the order, calculate/store distance metrics, and move it to History
- [ ] Resume existing `PICKING` orders after refresh
- [ ] Add realtime updates, queue handling, stronger role checks, and automated tests

### Recommended next additions

1. Add a server-side `POST /api/orders/accept` endpoint that claims the oldest pending order atomically.
2. Resume `PICKING` orders when the Dashboard loads.
3. Keep pick and stock mutations behind server-side transactions.
4. Add integration tests for create, accept, pick, stock decrement, completion, and failure cases.

## 13. Roadmap

See the full phase-by-phase task breakdown and cloud architecture diagrams in the project
proposal doc (Google Drive / shared folder — add link here).
