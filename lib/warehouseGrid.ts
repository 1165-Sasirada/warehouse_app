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

export type GridPoint = { row: number; col: number }

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

export function findWalkablePath(start: GridPoint, goal: GridPoint): GridPoint[] {
  const startKey = `${start.row}-${start.col}`
  const queue: GridPoint[] = [start]
  const cameFrom = new Map<string, GridPoint | null>([[startKey, null]])
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.row === goal.row && current.col === goal.col) break

    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col }
      const nextKey = `${next.row}-${next.col}`
      if (next.row < 0 || next.row >= ROWS || next.col < 0 || next.col >= COLS) continue
      if (getCellType(next.row, next.col) === 'rack' || cameFrom.has(nextKey)) continue
      cameFrom.set(nextKey, current)
      queue.push(next)
    }
  }

  const goalKey = `${goal.row}-${goal.col}`
  if (!cameFrom.has(goalKey)) return []

  const path: GridPoint[] = []
  let current: GridPoint | null = goal
  while (current) {
    path.push(current)
    current = cameFrom.get(`${current.row}-${current.col}`) ?? null
  }
  return path.reverse()
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
export const PATH_COLORS = ['#F58529', '#FEDA77', '#DD2A7B', '#8134AF', '#515BD4']
