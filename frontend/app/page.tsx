'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { useBalance } from 'wagmi'
import { formatUnits } from 'viem'
import AgentStatusBadge from '@/components/AgentStatusBadge'
import WhyModal, { type Action } from '@/components/WhyModal'
import { SENTINEL_DATA, formatTimeAgo } from '@/lib/data'
import { ACTIONS_QUERY, tokenSymbol, formatWei } from '@/lib/queries'
import { gql } from '@apollo/client'

const PnLChart = dynamic(() => import('@/components/PnLChart'), { ssr: false })

const SENTINEL_ACCOUNT = (process.env.NEXT_PUBLIC_SENTINEL_ACCOUNT ?? '0x287326DDFf84973f9D23e6495cc9d727F14f7F34') as `0x${string}`
const POLICY_GUARD = process.env.NEXT_PUBLIC_POLICY_GUARD ?? '0xC0375319E7623041875ee485D84A652Da2A36B73'
const PAYMASTER = process.env.NEXT_PUBLIC_PAYMASTER ?? '0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB'

const DAILY_PNL_QUERY = gql`
  query GetDailyPnL {
    dailyPnLs(first: 14, orderBy: date, orderDirection: asc) {
      id
      date
      tradeCount
      totalAmountIn
      totalAmountOut
    }
  }
`

function PnlPill({ n }: { n: number }) {
  if (n === 0) return <span className="pill muted">— $0.00</span>
  return (
    <span className={`pill ${n > 0 ? 'green' : 'red'}`}>
      {n > 0 ? '▲' : '▼'} ${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  )
}

function shortId(id: string): string {
  const hash = id.split('-')[0]
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

export default function Dashboard() {
  const [whyAction, setWhyAction] = useState<Action | null>(null)

  // Real on-chain ETH balance
  const { data: ethBalance } = useBalance({ address: SENTINEL_ACCOUNT, chainId: 84532 })

  // Real subgraph data
  const { data: actionsData } = useQuery(ACTIONS_QUERY, {
    variables: { first: 20, skip: 0 },
    pollInterval: 15000,
  })
  const { data: pnlData } = useQuery(DAILY_PNL_QUERY, { pollInterval: 15000 })

  const isLive = actionsData?.actions?.length > 0

  // Build recent actions from real data or fall back to mock
  const recentActions: Action[] = isLive
    ? actionsData.actions.slice(0, 3).map((raw: Record<string, string>) => ({
        id: raw.id,
        ts: Number(raw.timestamp) * 1000,
        tokenIn: tokenSymbol(raw.tokenIn),
        tokenOut: tokenSymbol(raw.tokenOut),
        amountIn: formatWei(raw.amountIn, raw.tokenIn),
        amountOut: formatWei(raw.amountOut, raw.tokenOut),
        pnl: 0,
        outcome: 'filled' as const,
        cid: raw.reasoningCID,
        txHash: null,
        sentiment: 0,
        policy: [],
        rationale: '',
        docs: [],
        zk: false,
        proofCid: null,
      }))
    : SENTINEL_DATA.actions.slice(0, 3)

  const totalActions = isLive ? actionsData.actions.length : SENTINEL_DATA.actions.length

  // Portfolio value from real ETH balance + USDC
  const ethFormatted = ethBalance?.value != null ? Number(formatUnits(ethBalance.value, ethBalance.decimals)) : null
  const ethVal = ethFormatted !== null ? ethFormatted * 2315 : null
  const portfolioUsd = isLive && ethVal !== null ? ethVal + 20 : isLive ? 20 : 40_312.56

  // PnL chart data — subgraph stores cumulative USDC amounts (6 decimals)
  const chartData = pnlData?.dailyPnLs?.length > 0
    ? pnlData.dailyPnLs.map((d: Record<string, string>) => ({
        date: d.date,
        tradeCount: Number(d.tradeCount),
        totalAmountIn: Number(d.totalAmountIn) / 1e6,
        totalAmountOut: Number(d.totalAmountOut) / 1e6,
      }))
    : SENTINEL_DATA.dailyPnL

  const portfolioDisplay = portfolioUsd || 0
  const dollars = Math.floor(portfolioDisplay).toLocaleString()
  const cents = (portfolioDisplay % 1).toFixed(2).slice(2)

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
              managed by sentinel · base-sepolia · {SENTINEL_ACCOUNT.slice(0, 10)}…
              {isLive && <span style={{ color: 'var(--green)', marginLeft: 8 }}>· live</span>}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'ETH Balance', value: <span className="mono amber" style={{ fontSize: 20 }}>{ethFormatted !== null ? ethFormatted.toFixed(4) : '—'} ETH</span> },
                { label: 'Total Actions', value: <span className="mono amber" style={{ fontSize: 20 }}>{totalActions}</span> },
                { label: 'Network', value: <span className="mono" style={{ fontSize: 16, color: 'var(--green)' }}>Base Sepolia</span> },
                { label: 'Status', value: <span className="mono amber" style={{ fontSize: 16 }}>{isLive ? 'LIVE' : 'DEMO'}</span> },
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
                    {isLive ? 'live · subgraph · 15s poll' : 'demo data · subgraph indexing'}
                  </div>
                </div>
                <span className="pill amber">{isLive ? 'LIVE' : 'DEMO'}</span>
              </div>
              <PnLChart data={chartData} />
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="label">Recent Actions</div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {recentActions.length}/{totalActions}
                </span>
              </div>
              {recentActions.map(a => (
                <div key={a.id} className="mini-row">
                  <div className="row-top">
                    <span suppressHydrationWarning>{formatTimeAgo(a.ts)}</span>
                    <span className="mono" style={{ fontSize: 10 }}>{shortId(a.id)}</span>
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
                  { label: 'SentinelAccount', addr: SENTINEL_ACCOUNT },
                  { label: 'PolicyGuard', addr: POLICY_GUARD },
                  { label: 'Paymaster', addr: PAYMASTER },
                ].map(({ label, addr }) => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <a
                      href={`https://sepolia.basescan.org/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono amber"
                      style={{ textDecoration: 'none' }}
                    >
                      {addr.slice(0, 10)}…{addr.slice(-6)}
                    </a>
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
