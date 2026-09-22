// Mirrors core/warehouse.py's _build_warehouse_layout() exactly.
// If the Python grid layout ever changes, update both together.

export const ROWS = 24
export const COLS = 16

export const PACKING_STATION = { row: 0, col: 0 }

// Columns that hold racks within a bay-block row (same as warehouse.py)
export const RACK_COLS = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]

// Row ranges for the two aisle blocks (shifted down 1 for the new buffer walkway)
export const TOP_BLOCK_ROWS = { start: 2, end: 11 }    // aisles 1-10
export const BOTTOM_BLOCK_ROWS = { start: 13, end: 22 } // aisles 11-20

export type CellType = 'packing_station' | 'rack' | 'walkway'

export function getCellType(row: number, col: number): CellType {
  if (row === PACKING_STATION.row && col === PACKING_STATION.col) {
    return 'packing_station'
  }
  const inTopBlock = row >= TOP_BLOCK_ROWS.start && row <= TOP_BLOCK_ROWS.end
  const inBottomBlock = row >= BOTTOM_BLOCK_ROWS.start && row <= BOTTOM_BLOCK_ROWS.end
  if ((inTopBlock || inBottomBlock) && RACK_COLS.includes(col)) {
    return 'rack'
  }
  return 'walkway'
}

// Suggested hotness buckets: 5 levels, scaled relative to the busiest
// location currently in view. Adjust the divisor thresholds once real
// pick_count data makes the actual distribution visible.
const HEAT_COLORS = ['#ff9b54', '#ff7f51', '#ce4257', '#720026', '#4f000b']

export function getHeatColor(pickCount: number, maxPickCount: number): string | null {
  if (pickCount <= 0 || maxPickCount <= 0) return null
  const ratio = pickCount / maxPickCount
  const bucket = Math.min(HEAT_COLORS.length - 1, Math.floor(ratio * HEAT_COLORS.length))
  return HEAT_COLORS[bucket]
}

// Repeating gradient for drawn pick paths
export const PATH_COLORS = ['#dbc2cf', '#9fa2b2', '#3c7a89', '#2e4756', '#16262e']
