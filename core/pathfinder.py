# A* Search + TSP Route Optimizer

import heapq
from itertools import permutations
from typing import List, Tuple, Dict, Optional
from core.warehouse import WarehouseGrid

# Orders with up to this many items get an exact search: every visiting order
# is tried and the shortest one wins (8 items = 8! = 40,320 orders, still
# instant). Bigger orders fall back to the Nearest-Neighbor heuristic.
EXACT_SEARCH_LIMIT = 8

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

	# The goal was never reached (e.g. a rack tile, or a coordinate outside the
	# grid). Fail loudly instead of returning a one-tile "path".
	if goal not in came_from:
		raise ValueError(f"No walkable path from {start} to {goal}")

	# Reconstruct Path
	path = []
	curr = goal
	while curr is not None:
		path.append(curr)
		curr = came_from.get(curr)
	path.reverse()
	return path

# Nearest-Neighbor ordering: always walk to the closest unvisited item next.
# dist[i][j] = walking distance between point i and j (0 = packing station,
# 1..n = items). Greedy, so it is NOT guaranteed to be the shortest order.
def nearest_neighbor_order(dist: List[List[int]], n: int) -> List[int]:
	remaining = list(range(1, n + 1))
	order = []
	current = 0
	while remaining:
		nxt = min(remaining, key=lambda idx: dist[current][idx])
		order.append(nxt)
		remaining.remove(nxt)
		current = nxt
	return order

"""
Sorts Multi-item Order -> Optimal Pick Route (start & end at Racking Station)
Returns Path Coords & Total Distance Saved

Naive route     = items visited in the order they were given.
Optimized route = shortest visiting order we can find:
  - up to EXACT_SEARCH_LIMIT items: try every order, keep the shortest (exact)
  - more items: Nearest-Neighbor, falling back to the naive order if that is shorter
Either way the optimized route is never longer than the naive one, so
distance_saved is never negative.
"""
def calculate_optimal_route(warehouse: WarehouseGrid, item_pick_coords: List[Dict]) -> Dict:
	start_pos = warehouse.packing_station
	items = list(item_pick_coords)
	n = len(items)

	# Point 0 is the packing station, points 1..n are the items' pick tiles.
	points = [start_pos] + [tuple(item['pick_coord']) for item in items]

	# Shortest path between every pair of points, computed once with A*.
	# Walking is symmetric on this grid, so only i < j is searched.
	paths: Dict[Tuple[int, int], List[Tuple[int, int]]] = {}
	dist = [[0] * (n + 1) for _ in range(n + 1)]
	for i in range(n + 1):
		for j in range(i + 1, n + 1):
			p = a_star_search(warehouse, points[i], points[j])
			paths[(i, j)] = p
			dist[i][j] = dist[j][i] = len(p) - 1

	def path_between(i: int, j: int) -> List[Tuple[int, int]]:
		if i == j:
			return [points[i]]
		if i < j:
			return list(paths[(i, j)])
		return list(reversed(paths[(j, i)]))

	def tour_length(order) -> int:
		# Packing station -> items in this order -> back to the packing station
		total, current = 0, 0
		for idx in order:
			total += dist[current][idx]
			current = idx
		return total + dist[current][0]

	# 1. Naive route (items in the order given)
	naive_order = list(range(1, n + 1))
	naive_distance = tour_length(naive_order)

	# 2. Optimized route
	if n <= EXACT_SEARCH_LIMIT:
		# permutations() yields the naive order first, so if it is already the
		# shortest, ties keep it and the saving is simply 0.
		best_order = list(min(permutations(naive_order), key=tour_length))
	else:
		best_order = nearest_neighbor_order(dist, n)
		if tour_length(best_order) > naive_distance:
			best_order = naive_order

	# 3. Build the walking route for the chosen order
	full_route_path = [start_pos]
	optimized_order_steps = []
	total_optimized_distance = 0
	current = 0

	for idx in best_order:
		segment = path_between(current, idx)
		item = items[idx - 1]
		segment_distance = len(segment) - 1

		total_optimized_distance += segment_distance
		full_route_path.extend(segment[1:])  # exclude duplicate start point

		optimized_order_steps.append({
			'item_name': item['name'],
			'location_label': item['label'],
			'pick_coord': points[idx],
			'segment_distance': segment_distance,
			'path': segment
		})
		current = idx

	# 4. Return to Packing Station
	return_path = path_between(current, 0)
	total_optimized_distance += len(return_path) - 1
	full_route_path.extend(return_path[1:])

	return {
		'total_optimized_distance': total_optimized_distance,
		'naive_distance': naive_distance,
		'distance_saved': naive_distance - total_optimized_distance,
		'pick_steps': optimized_order_steps,
		'full_path_coordinates': full_route_path
	}
