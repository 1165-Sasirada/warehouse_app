# Grid Generator + Location Parsing
from typing import Tuple

# Grid Cell Types
WALKABLE = 0
RACK = 1
PACKING_STATION = 'X'

# Warehouse 2D Grid
class WarehouseGrid:
    """
    Row 0:      Top walkway (packing station)
    Row 1:      Extra walkway (new — buffer row before racks start)
    Row 2-11:   Top block (aisles 1-10)
    Row 12:     Mid walkway
    Row 13-22:  Bottom block (aisles 11-20)
    Row 23:     Bottom walkway
    16 Columns (Walkways at col 0, 3, 6, 9, 12, 15; racks in double columns
    in between)
    """
    def __init__(self):
        self.rows = 24
        self.cols = 16
        self.grid = [[WALKABLE for _ in range(self.cols)] for _ in range(self.rows)]
        self.packing_station = (0, 0)
        self._build_warehouse_layout()

    def _build_warehouse_layout(self):
        # Packing Station {X} at (0, 0)
        self.grid[0][0] = PACKING_STATION

        # Top Block: Rows 2-11 (Bays 1-10 for Aisles 1-10)
        for row in range(2, 12):
            for col in [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]:
                self.grid[row][col] = RACK

        # Bottom Block: Rows 13-22 (Bays 1-10 for Aisles 11-20)
        for row in range(13, 23):
            for col in [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]:
                self.grid[row][col] = RACK

    def parse_location(self, location_str: str) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """
        - Label: ZONE-AISLE-BAY-LEVEL-BIN
        - rack_coord: item's coordinate
        - pick_coord: adjacent walkable tile where worker stands to pickup the item
        """
        parts = location_str.strip().split('-')
        zone, aisle, bay, level, bin_id = parts[0], int(parts[1]), int(parts[2]), int(parts[3]), parts[4]

        # Calculate Row on 2D Matrix
        if aisle <= 10:
            row = bay + 1   # Rows 2 to 11 (shifted down by the new buffer row)
        else:
            row = 12 + bay  # Rows 13 to 22

        # Calculate Column on 2D Matrix (unchanged — only rows shifted)
        rel_aisle = (aisle - 1) % 10 + 1
        pair_idx = (rel_aisle - 1) // 2

        # Odd Aisle (left rack of pair)
        if rel_aisle % 2 != 0:
            rack_col = 3 * pair_idx + 1
            pick_col = rack_col - 1  # Worker stands on the LEFT
        # Even Aisle (right rack of pair)
        else:
            rack_col = 3 * pair_idx + 2
            pick_col = rack_col + 1  # Worker stands on the RIGHT

        return (row, rack_col), (row, pick_col)

    def is_walkable(self, r: int, c: int) -> bool:
        if 0 <= r < self.rows and 0 <= c < self.cols:
            return self.grid[r][c] != RACK
        return False