'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client'
import WhyModal, { type Action } from '@/components/WhyModal'
import { SENTINEL_DATA, formatTimeAgo, fmtUsd } from '@/lib/data'
import { ACTIONS_QUERY, tokenSymbol, formatWei } from '@/lib/queries'

function PnlPill({ n }: { n: number }) {
  if (n === 0) return <span className="pill muted">— $0.00</span>
  return (
    <span className={`pill ${n > 0 ? 'green' : 'red'}`}>
      {n > 0 ? '▲' : '▼'} {fmtUsd(n)}
    </span>
  )
}

type Filter = 'all' | 'wins' | 'losses' | 'blocked'

// Shorten subgraph ID (txHash-logIndex) to a readable label
function shortId(id: string): string {
  const parts = id.split('-')
  const hash = parts[0]
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

// Map subgraph Action to WhyModal Action shape
function toAction(raw: Record<string, string>): Action {
  return {
    id: raw.id,
    ts: Number(raw.timestamp) * 1000,
    tokenIn: tokenSymbol(raw.tokenIn),
    tokenOut: tokenSymbol(raw.tokenOut),
    amountIn: formatWei(raw.amountIn, raw.tokenIn),
    amountOut: formatWei(raw.amountOut, raw.tokenOut),
    pnl: 0,
    outcome: 'filled',
    cid: raw.reasoningCID,
    txHash: null,
    sentiment: 0,
    policy: [],
    rationale: '',
    docs: [],
    zk: false,
    proofCid: null,
  }
}

export default function FeedPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [whyAction, setWhyAction] = useState<Action | null>(null)

  const { data, loading, error } = useQuery(ACTIONS_QUERY, {
    variables: { first: 100, skip: 0 },
    pollInterval: 15000,
  })

  // Use real data if available, fall back to mock while subgraph syncs
  const all: Action[] = (data?.actions?.length > 0)
    ? data.actions.map(toAction)
    : SENTINEL_DATA.actions

  const isLive = data?.actions?.length > 0

  const actions = all.filter(a => {
    if (filter === 'all') return true
    if (filter === 'blocked') return a.outcome === 'blocked'
    if (filter === 'wins') return a.pnl > 0 && a.outcome !== 'blocked'
    if (filter === 'losses') return a.pnl < 0 && a.outcome !== 'blocked'
    return true
  })

  const counts = {
    all: all.length,
    wins: all.filter(a => a.pnl > 0 && a.outcome !== 'blocked').length,
    losses: all.filter(a => a.pnl < 0 && a.outcome !== 'blocked').length,
    blocked: all.filter(a => a.outcome === 'blocked').length,
  }

  const FilterBtn = ({ id, label }: { id: Filter; label: string }) => (
    <button
      className={`btn small ${filter === id ? 'filled' : 'ghost'}`}
      onClick={() => setFilter(id)}
    >
      {label} <span style={{ opacity: 0.6, marginLeft: 6 }}>{counts[id]}</span>
    </button>
  )

  return (
    <>
      <div className="page">
        <div className="page-header">
          <div className="page-title display">ACTION FEED</div>
          <div className="page-sub">
            Every decision is verifiable. Click WHY? to read the agent&apos;s reasoning chain — market
            inputs, policy checks, strategist rationale, and ZK attestation — pinned to IPFS.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterBtn id="all" label="ALL" />
          <FilterBtn id="wins" label="WINS" />
          <FilterBtn id="losses" label="LOSSES" />
          <FilterBtn id="blocked" label="BLOCKED" />
          <div style={{ flex: 1 }} />
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {loading ? 'syncing subgraph…' : error ? 'subgraph error — showing demo data' : isLive ? 'live · subgraph · 15s poll' : 'demo data · subgraph indexing'}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 24px', display: 'grid', gridTemplateColumns: '140px 1fr 220px 130px', gap: 16, borderBottom: '1px solid var(--border)' }}>
            <div className="label">Timestamp</div>
            <div className="label">Swap</div>
            <div className="label">Outcome</div>
            <div className="label" style={{ textAlign: 'right' }}>Reasoning</div>
          </div>

          <div style={{ padding: '0 24px' }}>
            {actions.map(a => (
              <div className="action-row" key={a.id}>
                <div>
                  <div className="mono" style={{ fontSize: 12 }} suppressHydrationWarning>{formatTimeAgo(a.ts)}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{shortId(a.id)}</div>
                </div>

                <div className="tok-flow mono">
                  <span className="amber">{a.amountIn}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{a.tokenIn}</span>
                  <span className="arrow">›</span>
                  <span className="arrow">›</span>
                  <span className="amber">{a.amountOut}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{a.tokenOut}</span>
                </div>

                <div>
                  {a.outcome === 'blocked'
                    ? <span className="pill red">✗ POLICY BLOCK</span>
                    : <PnlPill n={a.pnl} />}
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {a.txHash ? `tx ${a.txHash}` : 'no broadcast'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button className="btn terminal" onClick={() => setWhyAction(a)}>
                    $ why?
                  </button>
                </div>
              </div>
            ))}
          </div>

          {actions.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              No actions match this filter.
            </div>
          )}
        </div>
      </div>

      {whyAction && <WhyModal action={whyAction} onClose={() => setWhyAction(null)} />}
    </>
  )
}
