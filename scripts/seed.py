"""
Seed Supabase with the 1,800 warehouse locations and ~50 dummy SKUs.

Setup:
    pip install supabase python-dotenv
    Create a .env file (see .env.example) with:
        SUPABASE_URL=https://xxxx.supabase.co
        SUPABASE_SECRET_KEY=<secret key, from Project Settings > API Keys>

Run (test mode, 180 locations, good for a first validation run):
    python scripts/seed.py --test

Run (full 1,800 locations, once you trust the pipeline):
    python scripts/seed.py

Note: uses the secret key (not the publishable key) because seeding
bypasses RLS. Never ship the secret key to the frontend.
"""

import os
import random
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

# Make sure the repo root is importable so `core` resolves
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from core.warehouse import WarehouseGrid  # noqa: E402

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
warehouse = WarehouseGrid()

ZONE = "A"
BAYS = range(1, 11)     # 10 bays
LEVELS = range(1, 4)    # 3 levels
BINS = ["A", "B", "C"]  # 3 bins


def build_locations(aisles):
    rows = []
    for aisle in aisles:
        for bay in BAYS:
            for level in LEVELS:
                for bin_id in BINS:
                    label = f"{ZONE}-{aisle}-{bay}-{level}-{bin_id}"
                    (grid_y, grid_x), (pick_y, pick_x) = warehouse.parse_location(label)
                    rows.append({
                        "zone": ZONE,
                        "aisle": aisle,
                        "bay": bay,
                        "level": level,
                        "bin": bin_id,
                        "label": label,
                        "grid_x": grid_x,
                        "grid_y": grid_y,
                        "pick_x": pick_x,
                        "pick_y": pick_y,
                    })
    return rows


def build_skus(n=50):
    sample_names = [
        "Wireless Mouse", "Phone Charger", "USB Cable", "Mechanical Keyboard",
        "Bluetooth Speaker", "HDMI Cable", "Webcam", "Laptop Stand",
        "Desk Lamp", "Power Bank",
    ]
    rows = []
    for i in range(n):
        base = sample_names[i % len(sample_names)]
        rows.append({
            "name": f"{base} #{i + 1}",
            "barcode": f"SKU{100000 + i}",
            "dimensions": f"{random.randint(5,30)}x{random.randint(5,30)}x{random.randint(2,15)}cm",
        })
    return rows


def chunked_insert(table_name: str, rows: list, chunk_size: int = 500):
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        supabase.table(table_name).insert(chunk).execute()
        print(f"  inserted {i + len(chunk)}/{len(rows)} into {table_name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--test", action="store_true",
        help="Seed only aisles 1-2 (180 locations) instead of the full 1,800, to validate the pipeline first."
    )
    args = parser.parse_args()

    aisles = range(1, 3) if args.test else range(1, 21)

    print(f"Building locations for {len(list(aisles))} aisle(s){' (TEST MODE)' if args.test else ''}...")
    locations = build_locations(aisles)
    print(f"Generated {len(locations)} locations. Inserting...")
    chunked_insert("locations", locations)

    print("\nBuilding SKUs...")
    skus = build_skus(50)
    print(f"Generated {len(skus)} SKUs. Inserting...")
    chunked_insert("skus", skus)

    print("\nDone seeding.")