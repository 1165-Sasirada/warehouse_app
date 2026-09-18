# warehouse-app

# Warehouse Shortest Path Simulator

A cloud-native web app that simulates order fulfillment in a warehouse: it receives orders,
calculates the shortest pick path using A* + a Nearest-Neighbor TSP heuristic, and shows
workers an interactive route through the warehouse — plus a stock/history dashboard and a
pick-frequency heatmap.

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
├── core/                 # Pure algorithm logic — no cloud dependencies
│   ├── __init__.py
│   ├── warehouse.py      # Grid generation + location label parsing
│   └── pathfinder.py     # A* search + TSP nearest-neighbor route optimizer
├── scripts/
│   ├── demo.py           # Local CLI test runner (was main.py)
│   └── seed.py           # Populates Supabase with 1,800 locations + 50 SKUs
├── supabase/
│   ├── schema.sql         # Creates all 7 tables + enables Realtime on 2 of them
│   ├── rls.sql             # Row Level Security policies
│   └── grants.sql       # Table-level GRANTs (required since "auto-expose new
│                           # tables" is off in our Supabase project settings)
├── .env                   # Local secrets — NOT committed (see .env.example)
├── .gitignore
├── requirements.txt
└── README.md
```

Not yet created (coming in later phases): `api/` (Vercel Python functions), the Next.js
frontend app itself, `venv/` (local only, gitignored).

## 4. Getting Started

```bash
git clone <repo-url>
cd warehouse_app

python -m venv venv
source venv/Scripts/activate      # Git Bash on Windows / VSCode
# source venv/bin/activate        # macOS/Linux

pip install -r requirements.txt   # or: pip install supabase python-dotenv
```

Create a `.env` file at the repo root (copy `.env.example` if present):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxx
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxx
```

Get these from the Supabase dashboard → Project Settings → API Keys. **Never commit `.env`**
— it's already in `.gitignore`.

## 5. Supabase Setup

Ask whoever set up the project to add you as a member, or share the project ref. Then, in
the Supabase SQL Editor, run these **in order**:

1. `supabase/schema.sql` — creates all 7 tables
2. `supabase/rls.sql` — locks tables down, then reopens access per-role
3. `supabase/grants.sql` — grants base table access to `anon`/`authenticated`/`service_role`
   (needed because table creation doesn't auto-grant when "Automatically expose new tables"
   is disabled in project settings)

Skipping step 3 causes `permission denied for table ...` errors even though RLS policies
look correct — GRANT and RLS are two separate layers; RLS filters rows, GRANT decides
whether a role can attempt the action at all.

## 6. Seeding the Database

```bash
python scripts/seed.py --test    # 180 locations, run this first to validate
python scripts/seed.py           # full 1,800 locations, once --test succeeds
```

Reuses `core/warehouse.py`'s `parse_location()` so seeded coordinates always match what the
pathfinder computes — never hand-generate grid coordinates separately.

## 7. Running the Algorithm Locally

```bash
python scripts/demo.py
```

Runs a sample 4-item order through the grid and prints the naive vs. optimized distance and
the step-by-step pick sequence. Good smoke test after touching `core/`.

## 8. Current Status

- [x] **Phase 1 — Core algorithm:** `core/warehouse.py` (grid + label parsing) and
      `core/pathfinder.py` (A* + TSP) are done and tested locally via `scripts/demo.py`.
- [ ] **Phase 2 — Cloud DB & Auth (in progress):** Supabase project created, schema + RLS +
      grants applied, seed script working in test mode.
- [ ] **Phase 3 — Frontend & CI/CD:** not started.
- [ ] **Phase 4 — Serverless compute & queuing:** not started.
- [ ] **Phase 5 — Analytics & polish:** not started.

## 9. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'core'` | Ran a script from inside `scripts/` instead of repo root | Run as `python scripts/seed.py`, not `cd scripts && python seed.py` |
| `permission denied for table ...` | `grants.sql` not run yet | Run `supabase/grants.sql` in the SQL Editor |
| `relation "locations" does not exist` | `schema.sql` not run yet | Run `supabase/schema.sql` first |
| `KeyError: 'SUPABASE_URL'` | `.env` missing or key name mismatch | Check `.env` exists at repo root with exact key names above |

## 10. Roadmap

See the full phase-by-phase task breakdown and cloud architecture diagrams in the project
proposal doc (Google Drive / shared folder — add link here).