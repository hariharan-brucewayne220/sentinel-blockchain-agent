'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import AgentStatusBadge from '@/components/AgentStatusBadge'
import WhyModal, { type Action } from '@/components/WhyModal'
import { SENTINEL_DATA, formatTimeAgo, fmtUsd } from '@/lib/data'
import { useState } from 'react'

const PnLChart = dynamic(() => import('@/components/PnLChart'), { ssr: false })

function PnlPill({ n }: { n: number }) {
  if (n === 0) return <span className="pill muted">— $0.00</span>
  return (
    <span className={`pill ${n > 0 ? 'green' : 'red'}`}>
      {n > 0 ? '▲' : '▼'} {fmtUsd(n)}
    </span>
  )
}

export default function Dashboard() {
  const D = SENTINEL_DATA
  const [whyAction, setWhyAction] = useState<Action | null>(null)
  const recent = D.actions.slice(0, 3)
  const total = D.dailyPnL[D.dailyPnL.length - 1].totalAmountOut
  const pnl14d = total - D.dailyPnL[0].totalAmountOut
  const dollars = Math.floor(total).toLocaleString()
  const cents = (total % 1).toFixed(2).slice(2)

  return (
    <>
      <div className="page">
        <div style={{ marginBottom: 28 }}>
          <AgentStatusBadge status="active" />
        </div>

        <div className="grid-2">
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Portfolio Total Value</div>
            <div className="big-stat">
              ${dollars}<span className="cents">.{cents}</span>
            </div>
            <div className="stat-sub">
              managed by sentinel · base-sepolia · {D.sentinelAccount.slice(0, 10)}…
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
              {[
                { label: '14d P&L', value: <span className="mono amber" style={{ fontSize: 20 }}>{pnl14d >= 0 ? '+' : '-'}${Math.abs(pnl14d).toLocaleString()}</span> },
                { label: 'Actions · 24h', value: <span className="mono amber" style={{ fontSize: 20 }}>8</span> },
                { label: 'Win Rate · 14d', value: <span className="mono" style={{ fontSize: 20, color: 'var(--green)' }}>68.4%</span> },
                { label: 'Gas Sponsored', value: <span className="mono amber" style={{ fontSize: 20 }}>0.042 ETH</span> },
              ].map(({ label, value }) => (
                <div key={label} className="card" style={{ padding: '14px 18px', minWidth: 160 }}>
                  <div className="label">{label}</div>
                  <div style={{ marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div className="label">Cumulative Value · 14d</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    source: subgraph · DAILY_PNL · synced 14s ago
                  </div>
                </div>
                <span className="pill amber">LIVE</span>
              </div>
              <PnLChart data={D.dailyPnL} />
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="label">Recent Actions</div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {recent.length}/{D.actions.length}
                </span>
              </div>
              {recent.map(a => (
                <div key={a.id} className="mini-row">
                  <div className="row-top">
                    <span suppressHydrationWarning>{formatTimeAgo(a.ts)}</span>
                    <span>{a.id}</span>
                  </div>
                  <div className="row-main">
                    <span className="mono" style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{a.tokenIn}</span>
                      <span style={{ color: 'var(--text-muted)' }}> › </span>
                      <span className="amber">{a.tokenOut}</span>
                    </span>
                    {a.outcome === 'blocked' ? <span className="pill red">BLOCKED</span> : <PnlPill n={a.pnl} />}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {a.amountIn} {a.tokenIn}
                  </div>
                </div>
              ))}
              <Link href="/feed" className="link" style={{ display: 'inline-block', marginTop: 14 }}>
                view all →
              </Link>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div className="label" style={{ marginBottom: 12 }}>Contract Registry</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                {[
                  { label: 'SentinelAccount', addr: D.sentinelAccount },
                  { label: 'PolicyGuard', addr: D.policyGuard },
                  { label: 'Paymaster', addr: D.paymaster },
                ].map(({ label, addr }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div className="mono amber">{addr.slice(0, 10)}…{addr.slice(-6)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {whyAction && <WhyModal action={whyAction} onClose={() => setWhyAction(null)} />}
    </>
  )
}
