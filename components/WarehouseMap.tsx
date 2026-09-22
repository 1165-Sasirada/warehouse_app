'use client'

import {
  ROWS,
  COLS,
  getCellType,
  getHeatColor,
  PATH_COLORS,
} from '@/lib/warehouseGrid'

const CELL = 25
const GAP = 5
const STEP = CELL + GAP

type Point = { row: number; col: number }

interface WarehouseMapProps {
  // Optional: pick_count per location, keyed as "row-col", for the heatmap overlay
  heatmap?: Record<string, number>
  showHeatmap?: boolean
  // Optional: the current pick route, in visiting order, for drawing the path
  activePath?: Point[]
  // Optional: the item currently being picked, to apply the glow highlight
  targetCell?: Point
}

export default function WarehouseMap({
  heatmap = {},
  showHeatmap = false,
  activePath = [],
  targetCell,
}: WarehouseMapProps) {
  const width = COLS * STEP
  const height = ROWS * STEP
  const maxPickCount = Math.max(0, ...Object.values(heatmap))

  const cells: React.ReactElement[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = getCellType(row, col)
      if (type === 'walkway') continue // blank, nothing drawn

      const x = col * STEP
      const y = row * STEP
      const isTarget = targetCell && targetCell.row === row && targetCell.col === col

      if (type === 'packing_station') {
        cells.push(
          <g key={`${row}-${col}`}>
            <text
              x={x + CELL / 2}
              y={y - 2}
              textAnchor="middle"
              className="fill-[#231942]"
              style={{ font: '15px var(--font-body)' }}
            >
              Packing Station
            </text>
            <rect x={x - 6} y={y + 6} width={CELL + 5} height={CELL + 2} rx={1.5} fill="#5e548e" />
          </g>
        )
        continue
      }

      // Rack cell
      const heatColor = showHeatmap
        ? getHeatColor(heatmap[`${row}-${col}`] ?? 0, maxPickCount)
        : null

      cells.push(
        <rect
          key={`${row}-${col}`}
          x={x}
          y={y}
          width={CELL}
          height={CELL}
          rx={4}
          fill={isTarget ? '#ffd166' : heatColor ?? '#f5ebfa'}
          stroke="#9f86c0"
          strokeWidth={1.3}
          style={isTarget ? { filter: 'drop-shadow(0 0 4px #ffd166)' } : undefined}
        />
      )
    }
  }

  // Path line through the visiting order, colored with the repeating gradient
  let pathEl: React.ReactElement | null = null
  if (activePath.length > 1) {
    const points = activePath
      .map((p) => `${p.col * STEP + CELL / 2},${p.row * STEP + CELL / 2}`)
      .join(' ')
    pathEl = (
      <polyline
        points={points}
        fill="none"
        stroke={PATH_COLORS[activePath.length % PATH_COLORS.length]}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    )
  }

  return (
    <svg
      viewBox={`-4 -14 ${width + 8} ${height + 18}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {cells}
      {pathEl}
    </svg>
  )
}
