import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from core.warehouse import WarehouseGrid
from core.pathfinder import calculate_optimal_route

if __name__ == "__main__":
	warehouse = WarehouseGrid()

	# Simulate Incoming Order
	order_items = [
		{"name": "Phone Charger", "label": "A-15-3-2-B"},
		{"name": "Wireless Mouse", "label": "A-2-5-1-A"},
		{"name": "USB Cable", "label": "A-8-10-3-C"},
		{"name": "Mechanical Keyboard", "label": "A-11-1-1-A"}
	]

	# Parse Label Location to Grid Coords
	parsed_items = []
	for item in order_items:
		rack_coord, pick_coord = warehouse.parse_location(item['label'])
		parsed_items.append({
			"name": item['name'],
			"label": item['label'],
			"rack_coord": rack_coord,
			"pick_coord": pick_coord
		})

	# Run Shortest Path Optimization
	result = calculate_optimal_route(warehouse, parsed_items)

	# Print Results
	print("=" * 80)
	print("WAREHOUSE SHORTEST PATH")
	print("=" * 80)
	print(f"Order Items Count: {len(order_items)}")
	print(f"Naive Route Distance: {result['naive_distance']} steps")
	print(f"Optimized Route Distance: {result['total_optimized_distance']} steps")
	print(f"Distance Saved: {result['distance_saved']} steps ({round((result['distance_saved'] / result['naive_distance']) * 100, 1)}% reduction)")
	print(f"=" * 80)
	print("Optimized Pick-Up Sequence: ")

	print(f"	Start: Packing Station {{X}} at {warehouse.packing_station}")
	for idx, step in enumerate(result['pick_steps'], 1):
		print(f"	Step {idx}: Pick '{step['item_name']}' [{step['location_label']}] at {step['pick_coord']} (+{step['segment_distance']} steps)")
	print(f"	End: Return to Packing Station {{X}} at {warehouse.packing_station}")
	print("=" * 80)