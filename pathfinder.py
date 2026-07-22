# A* Search + TSP Route Optimizer

import heapq
from typing import List, Tuple, Dict, Optional
from warehouse import WarehouseGrid

# Manhattan Distance Hueristic for Grid Movement: |x1 - x2| + |y1 - y2|
def heuristic(a: Tuple[int, int], b: Tuple[int, int]) -> int:
	return abs(a[0] - b[0]) + abs(a[1]- b[1])

# Calculate Shortest Path (how to get from A to B on walkable tiles)
def a_star_search(warehouse: WarehouseGrid, start: Tuple[int, int], goal: Tuple[int, int]) -> List[Tuple[int, int]]:
	if start == goal:
		return [start]
	
	frontier = []
	heapq.heappush(frontier, (0, start))
	came_from: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {start: None}
	cost_so_far:Dict[Tuple[int, int], int] = {start: 0}

	# 4-Directional Grid Movement {Up, Down, Left, Right}
	neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]

	while frontier:
		_, current = heapq.heappop(frontier)

		if current == goal:
			break

		for dr, dc in neighbors:
			nxt = (current[0] + dr, current[1] + dc)
			if warehouse.is_walkable(nxt[0], nxt[1]):
				new_cost = cost_so_far[current] + 1
				if nxt not in cost_so_far or new_cost < cost_so_far[nxt]:
					cost_so_far[nxt] = new_cost
					priority = new_cost + heuristic(goal, nxt)
					heapq.heappush(frontier, (priority, nxt))
					came_from[nxt] = current

	# Reconstruct Path
	path = []
	curr = goal
	while curr is not None:
		path.append(curr)
		curr = came_from.get(curr)
	path.reverse()
	return path

"""
Sorts Multi-item Order -> Optimal Pick Route (start & end at Racking Station)
Returns Path Coords & Total Distance Saved
"""
def calculate_optimal_route(warehouse: WarehouseGrid, item_pick_coords: List[Dict]) -> Dict:
	start_pos = warehouse.packing_station
	unvisited = item_pick_coords.copy()

	current_pos = start_pos
	full_route_path = [start_pos]
	optimized_order_steps = []
	total_optimized_distance = 0

	# 1. Nearest Neighbor (which item to visit next)
	while unvisited:
		nearest_item = None
		best_path = []
		shortest_dist = float('inf')

		for item in unvisited:
			path = a_star_search(warehouse, current_pos, item['pick_coord'])
			dist = len(path) - 1
			if dist < shortest_dist: 
				shortest_dist = dist
				best_path = path
				nearest_item = item

		total_optimized_distance += shortest_dist
		full_route_path.extend(best_path[1:]) # Append segment (exclude duplicate start point)
		current_pos = nearest_item['pick_coord']

		optimized_order_steps.append({
			'item_name': nearest_item['name'],
			'location_label': nearest_item['label'],
			'pick_coord': nearest_item['pick_coord'],
			'segment_distance': shortest_dist
		})
		unvisited.remove(nearest_item)

	# 2. Return to Packing Station
	return_path = a_star_search(warehouse, current_pos, start_pos)
	return_dist = len(return_path) - 1
	total_optimized_distance += return_dist
	full_route_path.extend(return_path[1:])

	# 3. Naive Path
	naive_distance = 0
	curr_naive = start_pos
	for item in item_pick_coords:
		p = a_star_search(warehouse, curr_naive, item['pick_coord'])
		naive_distance += (len(p) - 1)
		curr_naive = item['pick_coord']
	naive_distance += (len(a_star_search(warehouse, curr_naive, start_pos)) - 1)

	return {
		'total_optimized_distance': total_optimized_distance,
		'naive_distance': naive_distance,
		'distance_saved': naive_distance - total_optimized_distance,
		'pick_steps': optimized_order_steps,
		'full_path_coordinates': full_route_path
	}