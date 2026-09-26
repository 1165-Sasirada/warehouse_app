import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.pathfinder import calculate_optimal_route
from core.warehouse import WarehouseGrid


def serialize_route(result):
    return {
        "naive_distance": result["naive_distance"],
        "optimized_distance": result["total_optimized_distance"],
        "distance_saved": result["distance_saved"],
        "pick_steps": [
            {
                **step,
                "pick_coord": list(step["pick_coord"]),
                "path": [list(point) for point in step["path"]],
            }
            for step in result["pick_steps"]
        ],
        "full_path_coordinates": [list(point) for point in result["full_path_coordinates"]],
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            items = payload.get("items")
            if not isinstance(items, list) or not items:
                raise ValueError("items must be a non-empty list")

            parsed_items = []
            for item in items:
                coord = item.get("pick_coord")
                if not isinstance(coord, list) or len(coord) != 2:
                    raise ValueError("each item needs a two-value pick_coord")
                parsed_items.append({
                    "name": str(item.get("name", "Unknown SKU")),
                    "label": str(item.get("label", "Unknown location")),
                    "pick_coord": (int(coord[0]), int(coord[1])),
                })

            result = serialize_route(calculate_optimal_route(WarehouseGrid(), parsed_items))
            body = json.dumps(result).encode("utf-8")
            self.send_response(200)
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            body = json.dumps({"error": str(error)}).encode("utf-8")
            self.send_response(400)
        except Exception as error:
            body = json.dumps({"error": str(error)}).encode("utf-8")
            self.send_response(500)

        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)