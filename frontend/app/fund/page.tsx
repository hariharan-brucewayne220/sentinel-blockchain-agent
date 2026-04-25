'use client'

import { useState } from 'react'
import AgentStatusBadge from '@/components/AgentStatusBadge'
import { SENTINEL_DATA } from '@/lib/data'

type AgentStatus = 'active' | 'paused' | 'blocked'

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 900)
      }}
    >
      {done ? 'copied ✓' : 'copy'}
    </button>
  )
}

export default function FundPage() {
  const D = SENTINEL_DATA
  const [deposit, setDeposit] = useState('0.5')
  const [depositing, setDepositing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('active')
  const [toggling, setToggling] = useState(false)

  const doDeposit = () => {
    setDepositing(true)
    setTimeout(() => setDepositing(false), 2400)
  }

  const toggleAgent = () => {
    setToggling(true)
    setTimeout(() => {
      setAgentStatus(s => s === 'active' ? 'paused' : 'active')
      setToggling(false)
    }, 1200)
  }

  const active = agentStatus === 'active'

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title display">ACCOUNT MANAGEMENT</div>
        <div className="page-sub">
          Fund the smart account, sponsor paymaster gas, and pause the strategist. All writes route
          through an ERC-4337 entrypoint — the EOA never signs swaps directly.
        </div>
      </div>

      <div className="grid-2-even">
        {/* Deposit */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="label">Deposit Funds</div>
            <span className="pill amber">SMART ACCOUNT</span>
          </div>

          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>SentinelAccount</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span className="mono amber" style={{ fontSize: 13 }}>
              {D.sentinelAccount.slice(0, 10)}…{D.sentinelAccount.slice(-6)}
            </span>
            <CopyBtn text={D.sentinelAccount} />
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Balance</div>
          <div className="mono amber" style={{ fontSize: 36, letterSpacing: '-0.02em' }}>
            2.841 <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>ETH</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            ≈ $10,312.77 · sepolia-eth
          </div>

          <hr className="hr" />

          <div className="field">
            <label className="lbl">Deposit Amount (ETH)</label>
            <input
              type="text"
              className="input"
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
              placeholder="0.0"
            />
            <div className="desc">Sent from your EOA to SentinelAccount. Allocated to trading pool immediately.</div>
          </div>

          <button
            className="btn filled"
            style={{ width: '100%', padding: '12px' }}
            onClick={doDeposit}
            disabled={depositing}
          >
            {depositing ? '⟳ AWAITING CONFIRMATION…' : `↓ DEPOSIT ${deposit || '0'} ETH`}
          </button>
        </div>

        {/* Agent Controls */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="label">Agent Controls</div>
            <AgentStatusBadge status={agentStatus} />
          </div>

          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Paymaster</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span className="mono amber" style={{ fontSize: 13 }}>
              {D.paymaster.slice(0, 10)}…{D.paymaster.slice(-6)}
            </span>
            <CopyBtn text={D.paymaster} />
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Paymaster Deposit</div>
          <div className="mono" style={{ fontSize: 30, color: 'var(--green)', letterSpacing: '-0.02em' }}>
            0.420 <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>ETH</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            ≈ 120 sponsored userOps remaining · auto-top-up at 0.05 ETH
          </div>

          <hr className="hr" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Agent State</div>
              <div className="mono" style={{ fontSize: 14, color: active ? 'var(--amber)' : 'var(--red)' }}>
                {active ? 'ACTIVE · accepting signals' : 'PAUSED · userOps halted'}
              </div>
            </div>
            <div
              className={`toggle ${active ? 'on' : ''}`}
              onClick={toggleAgent}
              style={{ cursor: toggling ? 'wait' : 'pointer' }}
            >
              <div className="knob" />
            </div>
          </div>

          <button
            className={`btn ${active ? 'danger' : 'success'}`}
            style={{ width: '100%', padding: '12px' }}
            onClick={toggleAgent}
            disabled={toggling}
          >
            {toggling ? '⟳ SIGNING TX…' : active ? '⏸ PAUSE AGENT' : '▶ RESUME AGENT'}
          </button>

          <div className="warning-banner" style={{ marginTop: 18 }}>
            <span className="icon">⚠</span>
            <div>
              Pausing halts UserOperation submission but <b>does not</b> cancel pending bundler
              transactions. Drawdown guard remains armed regardless of state.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
