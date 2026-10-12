# Warehouse Shortest Path Simulator

A cloud-native web app that simulates order fulfillment in a warehouse: customers place
orders, pickers receive them, and the app calculates the shortest pick route (A* for walking
distance plus a visiting-order search) and shows the worker an interactive route through the
warehouse — with stock updates, a history page, and a pick-frequency heatmap.

**Team:** *(add names/IDs here)*
**Live app:** *(add Vercel URL here)*

---

## 1. Project Overview

- **Painpoint:** Warehouse workers currently walk to pick items in an unoptimized order,
  wasting time.
- **Goal:** Simulate order fulfillment and visualize the most efficient pick route through
  the warehouse.
- **In scope:** Pathfinding + route optimization, interactive pick UI, stock/history pages,
  customer ordering and order status, traffic heatmap.
- **Out of scope:** Integration with real warehouse hardware.

## 2. Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Core algorithm | Python (A*, exact route search for small orders, Nearest-Neighbor fallback) | Shortest path + visiting order |
| Frontend | Next.js (React, TypeScript) + Tailwind | Dashboard, stock/history/orders/login pages |
| Backend compute | Vercel Serverless Functions (Python) | Wraps the algorithm as an API |
| Database & Auth | Supabase (Postgres) | Stores users, stock, orders, locations, heatmap counts |
| Message queue | Upstash Redis | Planned: buffers rapid "Receive Order" clicks (not built yet) |
| Hosting/CI-CD | Vercel + GitHub | Auto-deploy on push to `main` |

Everything runs on free tiers — see the project proposal doc for the full cost/security
breakdown.

## 3. Repo Structure

```
warehouse_app/
├── core/                    # Pure algorithm logic — no cloud dependencies
│   ├── __init__.py
│   ├── warehouse.py         # Grid generation + location label parsing
│   └── pathfinder.py        # A* search + route optimizer (exact search <= 8 items, else Nearest-Neighbor)
├── scripts/
│   ├── demo.py               # Local CLI test runner (was main.py)
│   └── seed.py                # Populates Supabase with locations, SKUs, and demo stock
├── api/
│   └── path.py                # Vercel Python function wrapping the route optimizer
├── supabase/
│   ├── schema.sql             # Creates all 7 tables + enables Realtime on 2 of them
│   ├── rls.sql                 # Row Level Security policies
│   ├── grants.sql              # Table-level GRANTs (required since "auto-expose new
│   │                            # tables" is off in our Supabase project settings)
│   ├── patch-customer-and-heatmap.sql   # 'customer' role, heatmap UPDATE grant + row backfill
│   └── patch-order-ownership.sql        # orders.customer_id, is_staff(), order read policy
├── app/                       # Next.js App Router pages
│   ├── layout.tsx              # Root layout — fonts (JetBrains Mono, Karla, Bai Jamjuree)
│   ├── login/page.tsx           # Login (customers -> /create-order, staff -> /dashboard)
│   ├── dashboard/page.tsx        # Staff picking dashboard: accept order, route, picks, heatmap
│   ├── create-order/page.tsx      # Order creation (customers and managers)
│   ├── orders/page.tsx            # Customer Order Status (own orders, 20/page, date filter)
│   ├── stock/page.tsx             # Stock table, search, and Restock All
│   └── history/page.tsx           # Completed orders: date filter, click a row for its items
├── components/
│   ├── Sidebar.tsx              # Collapsible nav; links depend on the user's role
│   ├── WarehouseMap.tsx          # SVG grid/cell renderer, heatmap colors
│   └── WarehouseRoute.tsx        # Animated route overlay with gradient and arrows
├── lib/
│   ├── supabaseClient.ts         # Shared Supabase JS client
│   └── warehouseGrid.ts           # TS mirror of core/warehouse.py's grid layout — keep both in sync
├── color-reference.txt        # Current hex values for every UI color — check before styling anything
├── layout-reference.txt       # Per-page layout spec (structure only, no colors)
├── TESTING_GUIDE.txt          # Setup + end-to-end test procedure
├── .env                        # Local secrets — NOT committed (see .env.example)
├── .env.local                   # Frontend env vars (NEXT_PUBLIC_ prefixed) — also not committed
├── .gitignore
├── requirements.txt
└── README.md
```

Not built yet: the order-ingestion queue/worker (Upstash), atomic order claiming, and
server-side stock/heatmap transactions. Today the browser talks to Supabase directly for
creating orders, accepting them, and recording picks; only route calculation runs on the
Python serverless function.

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

The virtual environment folder must be gitignored (`venv/` is). If you name yours `.venv`,
add `.venv/` to `.gitignore` before running `git add .`.

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
4. `supabase/patch-customer-and-heatmap.sql` — allows the `customer` role, grants `UPDATE` on
   `location_heatmaps`, and backfills one heatmap row (pick_count 0) per location
5. `supabase/patch-order-ownership.sql` — adds `orders.customer_id`, the `is_staff()` helper,
   and the order/profile read policies

Steps 4 and 5 are already applied to our shared project; run them again only on a fresh one.
Step 5 replaces the optional order-read policy at the end of step 4.

Skipping step 3 causes `permission denied for table ...` errors even though RLS policies
look correct — GRANT and RLS are two separate layers; RLS filters rows, GRANT decides
whether a role can attempt the action at all.

**Do not re-run `schema.sql` if tables already exist** — coordinate any schema changes
together rather than one person re-running it solo.

**Deploy order matters for schema changes.** If a SQL change and the frontend code that
depends on it ship separately, the live site breaks in between. Push the code and run the SQL
at the same time, and run `npm run build` locally first (see Troubleshooting).

### User roles

Every login needs a row in `public.users` with one of three roles (exactly `picker`,
`manager` or `customer` — no brackets or quotes inside the value).

| Role | Sidebar links | Lands on after login |
|---|---|---|
| picker | Dashboard, Stock, History | /dashboard |
| manager | Dashboard, Create Order, Stock, History | /dashboard |
| customer | Create Order, Order Status | /create-order |

Create the account in Supabase → Authentication → Users → Add user (enable Auto Confirm), then
link it without copying a UID by hand:
```sql
insert into public.users (id, email, full_name, role)
select id, email, 'Test Customer', 'customer'
from auth.users
where email = 'customer@example.com';
```

The sidebar only hides links. What a role can actually read is enforced by Row Level Security,
and today only orders are role-aware (customers can read only their own). Other tables still
allow any signed-in user — tightening that is on the checklist below.

### How orders are owned

`orders` has two links to `users`:

- `customer_id` — who placed the order (used by the customer's Order Status page)
- `user_id` — the employee who accepted/fulfilled it (set when a picker clicks Accept Order;
  shown as "Employee" on History)

Because there are two links, any query that embeds `users` from `orders` must say which one,
e.g. `user:users!user_id(full_name)`.

## 6. Seeding the Database

```bash
python scripts/seed.py           # locations, SKUs, and demo stock; safe to rerun
```

Reuses `core/warehouse.py`'s `parse_location()` so seeded coordinates always match what the
pathfinder computes — never hand-generate grid coordinates separately.

**Heatmap rows:** `location_heatmaps` needs one row per location. The step-4 patch backfills
them. After seeding any new locations (for example the real seed later), run this again:
```sql
insert into public.location_heatmaps (location_id, pick_count)
select id, 0 from public.locations
on conflict (location_id) do nothing;
```

**Grid layout change:** the warehouse grid gained an extra walkway row (now 24 rows instead
of 23). If locations were seeded before that change, re-run `python scripts/seed.py` so their
coordinates are refreshed. Don't delete locations to start over — stock, order items and
heatmap rows reference them and the delete will fail.

## 7. Running the Algorithm Locally

```bash
python scripts/demo.py
```

Runs a sample 4-item order through the grid and prints the naive vs. optimized distance and
the step-by-step pick sequence. Good smoke test after touching `core/`.

## 8. Running the Frontend Locally

```bash
npm run dev
```

Open `http://localhost:3000/login`. You'll need a real account — create one via Supabase
Dashboard → Authentication → Users → Add User and link it to `public.users` (see User roles).

`npm run dev` does **not** run the Python function at `api/path.py`, so Accept Order cannot
calculate a route there and the dashboard shows an error (typically "Unexpected token '<'…").
To test picking, either use the deployed Vercel site or run `vercel dev` locally.

Before every push, run `npm run build`. Vercel runs the same type check; if it fails, the
deploy is rejected and the live site keeps running the previous version.

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
      `core/pathfinder.py` (A* + route optimizer) done and tested via `scripts/demo.py`.
- [x] **Phase 2 — Cloud DB & Auth:** Supabase project created, schema + RLS + grants
      applied, seed script working.
- [ ] **Phase 3 — Frontend & CI/CD (in progress):**
      - [x] Next.js project scaffolded, connected to Vercel (auto-deploys on push to `main`)
      - [x] Login page (Supabase Auth) with role-based landing page
      - [x] Sidebar nav (collapsible, shared across pages, links depend on role)
      - [x] Dashboard loads pending orders and accepts the oldest PENDING order
      - [x] Warehouse map renders from `lib/warehouseGrid.ts` (mirrors the Python grid layout)
      - [x] Stock page with search and Restock All demo action
      - [x] History page with completed-order metrics, date filter, and expandable item list
      - [x] Create Order page (automatic order numbers, locations derived from stock)
      - [x] Customer role + Order Status page (own orders, 20 per page, date filter)
      - [x] Database-backed interactive pick flow and order completion
      - [x] Stock decreases and heatmap counts increase on every pick
      - [x] Heatmap overlay (on/off toggle, colors scaled to the busiest rack)
      - [x] Animated gradient route and current-target glow
      - [x] Route segments calculated by the Python API; optimized route is never longer than naive
- [ ] **Phase 4 — Serverless compute & queuing:** API done for routing; Upstash queue not started.
- [ ] **Phase 5 — Analytics & polish:** not started.

## 11. How the Main Features Work

**Picking an order (Dashboard).** Accept Order claims the oldest PENDING order, sets it to
PICKING and records the picker in `orders.user_id`, then asks `/api/path` for the route. Each
checkbox tick marks `order_items.picked_status`, subtracts the ordered quantity from
`stock.quantity`, and adds 1 to that location's `pick_count` (with `last_picked_at`). The last
tick sets the order to COMPLETED and stores `naive_distance`, `optimized_distance` and
`distance_saved`. These writes are done one after another from the browser, so they are not
atomic yet (see checklist).

**Route optimization.** *Naive* distance = visit items in the order they were added to the
order. *Optimized* distance = the shortest visiting order found: for up to 8 items every order
is tried (exact); for larger orders Nearest-Neighbor is used, falling back to the naive order
if that is shorter. Either way "Saved" is never negative, and it is 0 when the customer's
order was already the best one. Older History rows computed before this change may still show
negative savings.

**Heatmap.** `location_heatmaps.pick_count` counts picks (one per order line, not per unit).
A map tile is one aisle + bay, which holds 9 bins, so counts are summed per tile. Colors use
5 levels scaled relative to the busiest tile, so the hottest rack is always the darkest.

**Customer view.** Customers see only orders where `orders.customer_id` is their own id.
The sidebar hides the staff pages from them, and the order read policy limits what they could
see even if they typed a staff URL — but the pages themselves aren't blocked yet.

## 12. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'core'` | Ran a script from inside `scripts/` instead of repo root | Run as `python scripts/seed.py`, not `cd scripts && python seed.py` |
| `permission denied for table ...` | `grants.sql` (or the heatmap grant in patch 4) not run | Run the missing SQL file in the SQL Editor |
| `relation "locations" does not exist` | `schema.sql` not run yet | Run `supabase/schema.sql` first |
| `KeyError: 'SUPABASE_URL'` | `.env` missing or key name mismatch | Check `.env` exists at repo root with exact key names above |
| Fonts show as default/Arial in browser | `app/globals.css` has a hardcoded `body { font-family: ... }` rule overriding the ones from `layout.tsx` | Remove that rule, or change it to `font-family: var(--font-body);` |
| Frontend can't read Supabase env vars | Used `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL` | Next.js only exposes `NEXT_PUBLIC_`-prefixed vars to browser code |
| Accept Order shows "Unexpected token '<'" or does nothing locally | `npm run dev` doesn't run `api/path.py` | Test on the deployed site, or run `vercel dev` |
| Vercel build fails with a TypeScript error | Type errors fail the build; the live site stays on the previous deploy | Run `npm run build` locally, fix, push again |
| History is empty or shows "more than one relationship" | Code and the `orders.customer_id` patch are out of sync, or an embed lacks the hint | Deploy the matching code; embed as `users!user_id(...)` (or `users!orders_user_id_fkey(...)`) |
| Customer's Order Status is missing orders | `orders.customer_id` is null (order made before the patch, or by old code) | See the repair query in TESTING_GUIDE.txt, section 18 |
| `violates check constraint "users_role_check"` | Role isn't exactly `picker`, `manager` or `customer` | Remove brackets/typos; run patch 4 if `customer` is rejected |
| Heatmap/`pick_count` never changes | No `location_heatmaps` rows, or missing `UPDATE` grant/policy | Run the backfill SQL in section 6 and patch 4 |
| A list shows only 1,000 rows | The Supabase API caps responses at 1,000 rows | Add pagination or server-side filtering (matters for the real seed) |

## 13. Completion Checklist

### Completed

- [x] Core warehouse grid, location parsing, A* pathfinding, and route ordering
- [x] Optimized route is never worse than the naive route (exact search for up to 8 items)
- [x] Supabase schema, RLS/grants, seed script, authentication, shared sidebar, stock, and history pages
- [x] Warehouse map component separated from the animated route component
- [x] Authenticated order creation with automatic order numbers
- [x] SKU selection with location derived from positive stock records
- [x] PENDING -> PICKING -> COMPLETED order lifecycle
- [x] Database-backed item picking and History records (with date filter and item details)
- [x] Customer role, role-based landing page, and Order Status page
- [x] Orders record both who placed them (`customer_id`) and who fulfilled them (`user_id`)
- [x] Stock decrement and heatmap pick counts on every pick (client-side)
- [x] Heatmap overlay with on/off toggle
- [x] Animated route gradient, current-target glow, completed paths, and walk-speed control
- [x] Server-side route calculation using the Python pathfinder
- [x] Complete the order, store distance metrics, and show it in History

### Still required for a complete production system

- [ ] Receive orders from an external source/queue and persist them as `PENDING`
- [ ] Accept one pending order atomically and mark it `PICKING`
- [ ] Make the stock decrement + heatmap update transactional (currently read-then-write)
- [ ] Resume existing `PICKING` orders after refresh
- [ ] Role checks beyond orders: e.g. Restock All and stock edits should be manager-only
- [ ] Pagination/server-side search for large tables (Stock) before the real seed
- [ ] Realtime updates (e.g. Order Status without refresh) and automated tests

### Recommended next additions

1. Add a server-side `POST /api/orders/accept` endpoint that claims the oldest pending order atomically.
2. Resume `PICKING` orders when the Dashboard loads.
3. Move pick, stock, and heatmap writes into one database function (RPC) so they commit together.
4. Decide whether to add the Upstash queue (e.g. a "burst of orders" button) to show decoupling.
5. Add integration tests for create, accept, pick, stock decrement, completion, and failure cases.

## 14. Roadmap

See the full phase-by-phase task breakdown and cloud architecture diagrams in the project
proposal doc (Google Drive / shared folder — add link here).
