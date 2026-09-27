'use client'

import {
  ROWS,
  COLS,
  getCellType,
  getHeatColor,
} from '@/lib/warehouseGrid'
import WarehouseRoute from '@/components/WarehouseRoute'

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
  completedPath?: Point[]
  // Optional: the item currently being picked, to apply the glow highlight
  targetCell?: Point
  completedTargets?: Point[]
  animateRoute?: boolean
  routeSpeed?: number
}

export default function WarehouseMap({
  heatmap = {},
  showHeatmap = false,
  activePath = [],
  completedPath = [],
  targetCell,
  completedTargets = [],
  animateRoute = true,
  routeSpeed = 1,
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
      const isCompleted = completedTargets.some((point) => point.row === row && point.col === col)

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
          fill={isTarget ? '#ffd166' : isCompleted ? '#e0b1cb' : heatColor ?? '#f5ebfa'}
          stroke={isTarget ? '#ffd166' : isCompleted ? '#e0b1cb' : '#9f86c0'}
          strokeWidth={isTarget || isCompleted ? 2 : 1.3}
          style={isTarget ? { filter: 'url(#target-rack-glow)' } : undefined}
        />
      )
    }
  }

  return (
    <svg
      viewBox={`-4 -14 ${width + 8} ${height + 18}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="target-rack-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feFlood floodColor="#ffd166" floodOpacity="1" result="glowColor" />
          <feComposite in="glowColor" in2="SourceGraphic" operator="in" result="glowShape" />
          <feGaussianBlur in="glowShape" stdDeviation="7" result="blurredGlow" />
          <feMerge>
            <feMergeNode in="blurredGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {cells}
      <WarehouseRoute
        path={activePath}
        completedPath={completedPath}
        animate={animateRoute}
        speed={routeSpeed}
      />
    </svg>
  )
}
