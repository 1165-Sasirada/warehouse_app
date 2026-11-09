'use client'

import { PATH_COLORS } from '@/lib/warehouseGrid'

type Point = { row: number; col: number }

interface WarehouseRouteProps {
  path: Point[]
  completedPath?: Point[]
  animate?: boolean
  speed?: number
}

const CELL = 25
const GAP = 5
const STEP = CELL + GAP
const FILTER_PADDING = 20

function toSvgPoint(point: Point) {
  return {
    x: point.col * STEP + CELL / 2,
    y: point.row * STEP + CELL / 2,
  }
}

export default function WarehouseRoute({
  path,
  completedPath = [],
  animate = true,
  speed = 1,
}: WarehouseRouteProps) {
  if (path.length < 2 && completedPath.length < 2) return null

  const pathData = path
    .map((point, index) => {
      const x = point.col * STEP + CELL / 2
      const y = point.row * STEP + CELL / 2
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  const startPoint = path[0]
  const endPoint = path[path.length - 1]
  const startX = startPoint ? startPoint.col * STEP + CELL / 2 : 0
  const startY = startPoint ? startPoint.row * STEP + CELL / 2 : 0
  const endX = endPoint ? endPoint.col * STEP + CELL / 2 : 0
  const endY = endPoint ? endPoint.row * STEP + CELL / 2 : 0
  const flowX = startX - endX
  const flowY = startY - endY
  const routePoints = path.map(toSvgPoint)
  const filterPoints = routePoints.length > 0
    ? routePoints
    : completedPath.map(toSvgPoint)
  const minX = Math.min(...filterPoints.map((point) => point.x))
  const maxX = Math.max(...filterPoints.map((point) => point.x))
  const minY = Math.min(...filterPoints.map((point) => point.y))
  const maxY = Math.max(...filterPoints.map((point) => point.y))
  const filterX = minX - FILTER_PADDING
  const filterY = minY - FILTER_PADDING
  const filterWidth = Math.max(maxX - minX, 1) + FILTER_PADDING * 2
  const filterHeight = Math.max(maxY - minY, 1) + FILTER_PADDING * 2
  const routeStartMarker = path.length > 0 ? toSvgPoint(path[0]) : null

  return (
    <g aria-label="Pick route">
      <defs>
        <linearGradient
          id="warehouse-route-gradient"
          gradientUnits="userSpaceOnUse"
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          spreadMethod="repeat"
        >
          {PATH_COLORS.map((color, index) => (
            <stop
              key={color}
              offset={`${(index / (PATH_COLORS.length - 1)) * 100}%`}
              stopColor={color}
            />
          ))}
          {animate && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from={`${flowX} ${flowY}`}
              to="0 0"
              dur={`${2.5 / speed}s`}
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
        <filter
          id="warehouse-route-glow"
          filterUnits="userSpaceOnUse"
          x={filterX}
          y={filterY}
          width={filterWidth}
          height={filterHeight}
        >
          <feGaussianBlur stdDeviation="4" result="blurredRoute" />
          <feMerge>
            <feMergeNode in="blurredRoute" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {completedPath.length > 1 && (
        <path
          d={completedPath.map((point, index) => {
            const x = point.col * STEP + CELL / 2
            const y = point.row * STEP + CELL / 2
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
          }).join(' ')}
          fill="none"
          stroke="#5e548e"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}

      {path.length > 1 && (
        <>
          <path
            d={pathData}
            fill="none"
            stroke="#c085e0"
            strokeWidth={8}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.32}
            filter="url(#warehouse-route-glow)"
          />
          <path
            d={pathData}
            fill="none"
            stroke="url(#warehouse-route-gradient)"
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#warehouse-route-glow)"
          />
        </>
      )}

      {animate && routeStartMarker && (
        <circle
          cx={routeStartMarker.x}
          cy={routeStartMarker.y}
          r="7"
          fill="#231942"
          stroke="#f5ebfa"
          strokeWidth="1.5"
        />
      )}

      {animate && path.length > 1 && (
        <circle
          key={pathData}
          r="7"
          fill="#231942"
          stroke="#f5ebfa"
          strokeWidth="1.5"
        >
          <animateMotion dur={`${8 / speed}s`} repeatCount="indefinite" path={pathData} />
        </circle>
      )}

    </g>
  )
}