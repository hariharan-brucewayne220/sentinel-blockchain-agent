'use client'

import { useRef, useState, useEffect } from 'react'

interface DataPoint {
  date: string
  dateLabel: string
  totalAmountOut: number
  pnl: number
}

interface HoverState {
  i: number
  x: number
  y: number
}

export default function PnLChart({ data }: { data: DataPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [dim, setDim] = useState({ w: 800, h: 260 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = { t: 20, r: 20, b: 28, l: 52 }
  const { w, h } = dim
  const iw = Math.max(0, w - pad.l - pad.r)
  const ih = Math.max(0, h - pad.t - pad.b)

  const values = data.map(d => d.totalAmountOut)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const yMin = min - range * 0.1
  const yMax = max + range * 0.1

  const xPos = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * iw
  const yPos = (v: number) => pad.t + ih - ((v - yMin) / (yMax - yMin)) * ih

  const path = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(d.totalAmountOut).toFixed(1)}`
  ).join(' ')
  const areaPath = `${path} L ${xPos(data.length - 1).toFixed(1)} ${(pad.t + ih).toFixed(1)} L ${xPos(0).toFixed(1)} ${(pad.t + ih).toFixed(1)} Z`

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks)

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    if (mx < pad.l || mx > pad.l + iw) { setHover(null); return }
    const ratio = (mx - pad.l) / iw
    const i = Math.round(ratio * (data.length - 1))
    setHover({ i, x: xPos(i), y: yPos(data[i].totalAmountOut) })
  }

  return (
    <div className="pnl-chart" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5a623" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={yPos(t)} y2={yPos(t)}
              stroke="#2a2a3a" strokeDasharray="2 4" strokeWidth={1} />
            <text x={pad.l - 10} y={yPos(t) + 4} textAnchor="end"
              fontFamily="var(--font-mono)" fontSize={10} fill="#4a4a66">
              ${Math.round(t / 1000)}k
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          if (i % 2 !== 0 && i !== data.length - 1) return null
          return (
            <text key={i} x={xPos(i)} y={h - 8} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize={10} fill="#4a4a66">
              {d.dateLabel}
            </text>
          )
        })}
        <path d={areaPath} fill="url(#amberGrad)" />
        <path d={path} fill="none" stroke="#f5a623" strokeWidth={1.8} />
        {data.map((d, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(d.totalAmountOut)} r={2.2}
            fill="#0c0c0f" stroke="#f5a623" strokeWidth={1.2} />
        ))}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={pad.t} y2={pad.t + ih}
              stroke="#f5a623" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
            <circle cx={hover.x} cy={hover.y} r={4} fill="#f5a623" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="t-date">{data[hover.i].date}</div>
          <div className="t-val">${data[hover.i].totalAmountOut.toLocaleString()}</div>
          <div style={{ color: data[hover.i].pnl >= 0 ? '#00d4a8' : '#ff4444' }}>
            {data[hover.i].pnl >= 0 ? '+' : ''}${data[hover.i].pnl}
          </div>
        </div>
      )}
    </div>
  )
}
