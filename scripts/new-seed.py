"""Seed one SKU per aisle/bay and inventory for every warehouse location.

Run from the repository root with the Supabase secret key in .env:
    python scripts/new-seed.py

Use --dry-run to verify the generated warehouse counts without connecting to Supabase.
Existing stock quantities, heatmap counts, orders, and unrelated SKUs are preserved.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from core.warehouse import WarehouseGrid

ZONE = "A"
AISLES = range(1, 21)
BAYS = range(1, 11)
LEVELS = range(1, 4)
BINS = ("A", "B", "C")
CHUNK_SIZE = 500
FILTER_SIZE = 100
PAGE_SIZE = 500

ITEM_NAMES = (
    "Phone Charger", "Power Bank", "Laptop", "Graphics Card", "Wireless Mouse",
    "Mechanical Keyboard", "Bluetooth Speaker", "HDMI Cable", "Webcam", "Laptop Stand",
    "USB-C Hub", "External SSD", "External Hard Drive", "USB Flash Drive", "Wi-Fi Router",
    "Mesh Wi-Fi Node", "Ethernet Switch", "Network Adapter", "USB-C Cable", "Lightning Cable",
    "DisplayPort Cable", "USB-C Charger", "Laptop Power Adapter", "Computer Monitor", "4K Monitor",
    "Portable Monitor", "Desktop Computer", "Mini PC", "Computer Case", "CPU Cooler",
    "Processor", "Motherboard", "DDR5 Memory Kit", "NVMe SSD", "SATA SSD",
    "PC Power Supply", "Case Fan", "Graphics Tablet", "Drawing Stylus", "Headphones",
    "Noise-Cancelling Headphones", "Wireless Earbuds", "Gaming Headset", "USB Microphone", "Audio Interface",
    "Studio Monitor Speaker", "Soundbar", "Webcam Light", "Capture Card", "Game Controller",
    "Gaming Console", "Handheld Console", "Virtual Reality Headset", "Smart TV", "Streaming Stick",
    "Video Projector", "Projector Screen", "Digital Camera", "Mirrorless Camera Lens", "Camera Tripod",
    "Camera Gimbal", "Action Camera", "SD Memory Card", "Memory Card Reader", "Camera Battery",
    "Camera Flash", "Smartwatch", "Fitness Tracker", "Smartphone", "Tablet",
    "E-Reader", "Protective Phone Case", "Tempered Glass Screen Protector", "Wireless Charging Pad", "Car Phone Mount",
    "Bluetooth Tracker", "Smart Speaker", "Smart Display", "Smart Plug", "Smart Light Bulb",
    "LED Strip Light", "Indoor Security Camera", "Video Doorbell", "Motion Sensor", "Door Sensor",
    "Smart Thermostat", "Air Quality Monitor", "Digital Photo Frame", "Portable SSD Enclosure", "Laptop Docking Station",
    "KVM Switch", "Thunderbolt Cable", "USB-A Cable", "USB-C to HDMI Adapter", "USB-C to Ethernet Adapter",
    "USB-C Card Reader", "Laptop Privacy Filter", "Monitor Arm", "Keyboard Wrist Rest", "Mouse Pad",
    "Laser Printer", "Inkjet Printer", "Label Printer", "Document Scanner", "Portable Scanner",
    "Printer Toner Cartridge", "Printer Ink Cartridge", "Thermal Label Roll", "Copy Paper Ream", "Spiral Notebook",
    "Hardcover Journal", "Sticky Note Pack", "Ballpoint Pen Set", "Gel Pen Set", "Mechanical Pencil Set",
    "Highlighter Set", "Permanent Marker Set", "Whiteboard Marker Set", "Whiteboard", "Desktop Calculator",
    "Scientific Calculator", "Desk Organizer", "File Folder Set", "Hanging File Set", "Ring Binder",
    "Sheet Protector Pack", "Desktop Stapler", "Staple Remover", "Paper Punch", "Tape Dispenser",
    "Packing Tape Roll", "Office Scissors", "Paper Cutter", "Clipboard", "Document Tray",
    "Letter Opener", "Envelope Pack", "Shipping Label Pack", "Bubble Mailer Pack", "Mailing Box Set",
    "Desk Lamp", "Floor Lamp", "LED Desk Light", "Ergonomic Office Chair", "Standing Desk Converter",
    "Office Desk", "Under-Desk Footrest", "Laptop Cooling Pad", "Ergonomic Keyboard", "Vertical Mouse",
    "Trackball Mouse", "USB Numeric Keypad", "Wireless Presenter Remote", "Conference Speakerphone", "Conference Camera",
    "Conference Room Microphone", "Headset Stand", "Monitor Privacy Screen", "Cable Management Tray", "Surge Protector",
    "Uninterruptible Power Supply", "Power Strip", "Extension Cord", "Portable Generator", "Rechargeable AA Battery Pack",
    "Rechargeable AAA Battery Pack", "Battery Charger", "Coin Cell Battery Pack", "LED Flashlight", "Rechargeable Work Light",
    "Portable Fan", "Air Purifier", "Humidifier", "Dehumidifier", "Space Heater",
    "Tower Fan", "Portable Air Conditioner", "Canister Vacuum Cleaner", "Handheld Vacuum", "Robot Vacuum",
    "Robotic Mop", "Electric Kettle", "Drip Coffee Maker", "Espresso Machine", "Coffee Grinder",
    "Toaster", "Blender", "Food Processor", "Rice Cooker", "Air Fryer",
    "Microwave Oven", "Slow Cooker", "Digital Kitchen Scale", "Stand Mixer", "Waffle Maker",
    "Sandwich Press", "Water Filter Pitcher", "Insulated Water Bottle", "Travel Mug", "Lunch Container Set",
)


def build_seed_data() -> tuple[
    list[dict[str, Any]], list[dict[str, Any]], list[tuple[str, str]], dict[str, str]
]:
    warehouse = WarehouseGrid()
    skus = []
    locations = []
    stock_keys = []
    legacy_sku_barcodes = {}
    item_index = 0

    for aisle in AISLES:
        for bay in BAYS:
            barcode = f"{ZONE}-{aisle}-{bay}-1-A"
            legacy_sku_barcodes[barcode] = f"WH-{ZONE}-{aisle:02d}-{bay:02d}"
            skus.append({
                "name": ITEM_NAMES[item_index],
                "barcode": barcode,
                "dimensions": "10x10x10cm",
            })
            item_index += 1

            for level in LEVELS:
                for bin_id in BINS:
                    label = f"{ZONE}-{aisle}-{bay}-{level}-{bin_id}"
                    (grid_y, grid_x), (pick_y, pick_x) = warehouse.parse_location(label)
                    locations.append({
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
                    stock_keys.append((label, barcode))

    if len(skus) != 200 or len({sku["name"] for sku in skus}) != 200:
        raise ValueError("Expected exactly 200 uniquely named warehouse products.")
    if len(locations) != 1800 or len(stock_keys) != 1800:
        raise ValueError("Generated warehouse counts do not match the configured grid.")
    if any(barcode not in {location["label"] for location in locations} for barcode in legacy_sku_barcodes):
        raise ValueError("Every SKU barcode must be a warehouse location label.")

    return skus, locations, stock_keys, legacy_sku_barcodes


def chunks(values: list[Any], size: int):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def fetch_filtered(
    client: Client,
    table: str,
    columns: str,
    filter_column: str,
    filter_values: list[str],
) -> list[dict[str, Any]]:
    rows = []
    for value_chunk in chunks(filter_values, FILTER_SIZE):
        offset = 0
        while True:
            response = (
                client.table(table)
                .select(columns)
                .in_(filter_column, value_chunk)
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )
            page = response.data or []
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    return rows


def upsert_chunks(client: Client, table: str, rows: list[dict[str, Any]], conflict: str) -> None:
    for chunk_number, row_chunk in enumerate(chunks(rows, CHUNK_SIZE), start=1):
        client.table(table).upsert(row_chunk, on_conflict=conflict).execute()
        print(f"  upserted {min(chunk_number * CHUNK_SIZE, len(rows))}/{len(rows)} {table}")


def insert_chunks(client: Client, table: str, rows: list[dict[str, Any]]) -> None:
    for chunk_number, row_chunk in enumerate(chunks(rows, CHUNK_SIZE), start=1):
        client.table(table).insert(row_chunk).execute()
        print(f"  inserted {min(chunk_number * CHUNK_SIZE, len(rows))}/{len(rows)} {table}")


def upsert_seed_skus(
    client: Client,
    skus: list[dict[str, Any]],
    legacy_sku_barcodes: dict[str, str],
) -> None:
    all_barcodes = [sku["barcode"] for sku in skus] + list(legacy_sku_barcodes.values())
    existing_rows = fetch_filtered(client, "skus", "id,name,barcode", "barcode", all_barcodes)
    existing_by_barcode = {row["barcode"]: row for row in existing_rows}
    updates = []
    inserts = []

    for sku in skus:
        barcode = sku["barcode"]
        legacy_barcode = legacy_sku_barcodes[barcode]
        current = existing_by_barcode.get(barcode)
        legacy = existing_by_barcode.get(legacy_barcode)
        legacy_parts = legacy_barcode.split("-")
        expected_legacy_name = f"Warehouse Item {legacy_parts[1]}-{legacy_parts[2]}-{legacy_parts[3]}"

        if current and legacy and current["id"] != legacy["id"]:
            raise RuntimeError(
                f"Both old and new SKU records exist for barcode {barcode}. "
                "Resolve this duplicate before seeding; no SKU or stock rows were changed."
            )

        if current:
            if current["name"] != sku["name"]:
                raise RuntimeError(
                    f"Barcode {barcode} already belongs to a different SKU "
                    f"({current['name']!r}); refusing to overwrite it."
                )
            updates.append({**sku, "id": current["id"]})
        elif legacy:
            if legacy["name"] != expected_legacy_name:
                raise RuntimeError(
                    f"Legacy barcode {legacy_barcode} belongs to an unexpected SKU "
                    f"({legacy['name']!r}); refusing to rename it."
                )
            updates.append({**sku, "id": legacy["id"]})
        else:
            inserts.append(sku)

    if updates:
        print("Updating previously seeded SKU records in place...")
        upsert_chunks(client, "skus", updates, "id")
    if inserts:
        print("Adding new warehouse SKUs...")
        upsert_chunks(client, "skus", inserts, "barcode")


def seed(
    client: Client,
    skus: list[dict[str, Any]],
    locations: list[dict[str, Any]],
    stock_keys: list[tuple[str, str]],
    legacy_sku_barcodes: dict[str, str],
) -> None:
    print("Upserting warehouse locations...")
    upsert_chunks(client, "locations", locations, "label")

    upsert_seed_skus(client, skus, legacy_sku_barcodes)

    sku_rows = fetch_filtered(
        client, "skus", "id,barcode", "barcode", [sku["barcode"] for sku in skus]
    )
    location_rows = fetch_filtered(
        client, "locations", "id,label", "label", [location["label"] for location in locations]
    )
    sku_ids = {row["barcode"]: row["id"] for row in sku_rows}
    location_ids = {row["label"]: row["id"] for row in location_rows}

    if len(sku_ids) != len(skus) or len(location_ids) != len(locations):
        raise RuntimeError("Could not look up every seeded SKU and location after upsert.")

    desired_pairs = {
        (location_ids[label], sku_ids[barcode])
        for label, barcode in stock_keys
    }
    target_sku_ids = list(sku_ids.values())
    existing_stock = fetch_filtered(
        client, "stock", "id,location_id,sku_id", "sku_id", target_sku_ids
    )
    existing_pairs: set[tuple[str, str]] = set()
    duplicate_pairs = set()
    for row in existing_stock:
        pair = (row["location_id"], row["sku_id"])
        if pair in existing_pairs:
            duplicate_pairs.add(pair)
        existing_pairs.add(pair)

    if duplicate_pairs:
        raise RuntimeError(
            f"Found {len(duplicate_pairs)} duplicate seeded stock pair(s). "
            "Resolve these in Supabase before rerunning to avoid ambiguous picks."
        )

    print("Adding missing stock rows (existing quantities are left unchanged)...")
    missing_stock = [
        {
            "location_id": location_ids[label],
            "sku_id": sku_ids[barcode],
            "quantity": 100,
        }
        for label, barcode in stock_keys
        if (location_ids[label], sku_ids[barcode]) not in existing_pairs
    ]
    if missing_stock:
        insert_chunks(client, "stock", missing_stock)
    else:
        print("  no missing stock rows")

    location_id_values = list(location_ids.values())
    existing_heatmaps = fetch_filtered(
        client,
        "location_heatmaps",
        "location_id",
        "location_id",
        location_id_values,
    )
    heatmap_location_ids = {row["location_id"] for row in existing_heatmaps}
    missing_heatmaps = [
        {"location_id": location_id, "pick_count": 0}
        for location_id in location_id_values
        if location_id not in heatmap_location_ids
    ]

    print("Adding missing heatmap rows (existing pick counts are preserved)...")
    if missing_heatmaps:
        for row_chunk in chunks(missing_heatmaps, CHUNK_SIZE):
            client.table("location_heatmaps").upsert(
                row_chunk, on_conflict="location_id", ignore_duplicates=True
            ).execute()
        print(f"  ensured {len(missing_heatmaps)} heatmap row(s)")
    else:
        print("  no missing heatmap rows")

    target_location_ids = set(location_id_values)
    other_stock_at_seeded_locations = fetch_filtered(
        client,
        "stock",
        "location_id,sku_id",
        "location_id",
        location_id_values,
    )
    legacy_count = sum(
        1 for row in other_stock_at_seeded_locations
        if (row["location_id"], row["sku_id"]) not in desired_pairs
        and row["location_id"] in target_location_ids
    )
    if legacy_count:
        print(
            f"Note: preserved {legacy_count} pre-existing stock row(s) for other SKUs "
            "at seeded locations. No existing inventory or order history was deleted."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed full warehouse SKU, stock, and heatmap data.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate and validate the seed counts without connecting to Supabase.",
    )
    args = parser.parse_args()

    skus, locations, stock_keys, legacy_sku_barcodes = build_seed_data()
    print(f"Prepared {len(skus)} SKUs, {len(locations)} locations, and {len(stock_keys)} stock rows.")
    if args.dry_run:
        print("Dry run complete; Supabase was not contacted.")
        return

    load_dotenv(ROOT_DIR / ".env")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_secret_key:
        parser.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in the repository .env file.")

    client = create_client(supabase_url, supabase_secret_key)
    seed(client, skus, locations, stock_keys, legacy_sku_barcodes)
    print("Done seeding. Existing stock quantities, heatmap counts, and order history were preserved.")


if __name__ == "__main__":
    main()