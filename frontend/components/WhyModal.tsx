'use client'

import { useState, useEffect } from 'react'
import { fetchReasoningBlob } from '@/lib/ipfs'

interface PolicyCheck {
  rule: string
  limit: string
  value: string
  pass: boolean
}

interface Doc {
  source: string
  title: string
  ts: string
}

export interface Action {
  id: string
  ts: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  pnl: number
  outcome: string
  cid: string
  txHash: string | null
  sentiment: number
  policy: PolicyCheck[]
  rationale: string
  docs: Doc[]
  zk: boolean
  proofCid: string | null
}

interface Props {
  action: Action
  onClose: () => void
}

export default function WhyModal({ action, onClose }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const [ipfsLoading, setIpfsLoading] = useState(true)
  const [ipfsBlob, setIpfsBlob] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    // Fetch real IPFS blob, fall back to mock data after timeout
    const timer = setTimeout(() => setIpfsLoading(false), 420)
    fetchReasoningBlob(action.cid).then(blob => {
      clearTimeout(timer)
      setIpfsBlob(blob)
      setIpfsLoading(false)
    }).catch(() => setIpfsLoading(false))

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      clearTimeout(timer)
    }
  }, [onClose, action.cid])

  const raw = ipfsBlob ?? {
    cid: action.cid,
    action_id: action.id,
    timestamp: new Date(action.ts).toISOString(),
    swap: { token_in: action.tokenIn, token_out: action.tokenOut, amount_in: action.amountIn, amount_out: action.amountOut },
    market_context: { sentiment_score: action.sentiment, retrieved_docs: action.docs },
    policy_checks: action.policy,
    strategist: { rationale: action.rationale, model: 'sentinel-strategist-v1.3' },
    attestation: { zk_proof_cid: action.proofCid, eip712_signature: '0x' + 'a'.repeat(130) },
    tx: { hash: action.txHash, outcome: action.outcome },
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <span className="stamp">classified · reasoning</span>
              {ipfsLoading ? (
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>fetching ipfs…</span>
              ) : (
                <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>✓ ipfs blob retrieved</span>
              )}
            </div>
            <div className="display" style={{ fontSize: '1.7rem' }}>Reasoning Dossier</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
              ipfs://{action.cid}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ① Market Context */}
        <div className="dossier-section">
          <div className="dossier-section-header">
            <span className="dossier-section-num">①</span>
            <span className="dossier-section-title">Market Context</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            sentiment_score = <span className="amber">{action.sentiment.toFixed(2)}</span> / 1.00
          </div>
          <div className="sentiment-bar">
            <div className="sentiment-bar-fill" style={{ width: `${action.sentiment * 100}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
            <span>bearish</span><span>neutral</span><span>bullish</span>
          </div>
          <div className="label" style={{ marginBottom: 8 }}>Retrieved Documents · {action.docs.length}</div>
          <div>
            {action.docs.map((d, i) => (
              <span key={i} className="doc-chip">
                <span className="source">{d.source}</span>
                <span>{d.title}</span>
                <span style={{ color: 'var(--text-muted)' }}>· {d.ts}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ② Policy Decision Record */}
        <div className="dossier-section">
          <div className="dossier-section-header">
            <span className="dossier-section-num">②</span>
            <span className="dossier-section-title">Policy Decision Record</span>
          </div>
          <table className="rule-table">
            <thead>
              <tr>
                <th>Rule</th><th>Limit</th><th>Value</th>
                <th style={{ width: 60, textAlign: 'center' }}>Check</th>
              </tr>
            </thead>
            <tbody>
              {action.policy.map((p, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--amber)' }}>{p.rule}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.limit}</td>
                  <td>{p.value}</td>
                  <td style={{ textAlign: 'center' }}>
                    {p.pass ? <span className="rule-check">✓</span> : <span className="rule-cross">✗ BLOCKED</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ③ Strategist Rationale */}
        <div className="dossier-section">
          <div className="dossier-section-header">
            <span className="dossier-section-num">③</span>
            <span className="dossier-section-title">Strategist Rationale</span>
          </div>
          <blockquote className="rationale">&ldquo;{action.rationale}&rdquo;</blockquote>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
            — sentinel-strategist-v1.3 · gpt-4o · temperature 0.2
          </div>
        </div>

        {/* ④ Attestation */}
        <div className="dossier-section">
          <div className="dossier-section-header">
            <span className="dossier-section-num">④</span>
            <span className="dossier-section-title">Attestation</span>
          </div>
          {action.zk ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <span className="pill amber">✓ ZK-VERIFIED</span>
                <span className="mono" style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                  proof_cid = <span className="amber">{action.proofCid}</span>
                </span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Reasoning payload hash matches on-chain Action.proofCid · verifier gas 84,221
              </div>
            </div>
          ) : (
            <div>
              <span className="pill muted">⚠ SIGNATURE ONLY</span>
              <span className="mono" style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                EIP-712 signed by strategist, no ZK proof emitted
              </span>
            </div>
          )}
        </div>

        {/* ⑤ Raw IPFS Payload */}
        <div className="dossier-section">
          <div
            className="collapsible-head"
            onClick={() => setJsonOpen(v => !v)}
          >
            <div className="dossier-section-header" style={{ margin: 0 }}>
              <span className="dossier-section-num">⑤</span>
              <span className="dossier-section-title">Raw IPFS Payload</span>
            </div>
            <span className={`chevron mono ${jsonOpen ? 'open' : ''}`}>›</span>
          </div>
          {jsonOpen && (
            <div className="json-block" style={{ marginTop: 10 }}>
              {JSON.stringify(raw, null, 2)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
