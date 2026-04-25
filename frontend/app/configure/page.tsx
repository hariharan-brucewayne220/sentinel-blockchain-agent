'use client'

import { useState } from 'react'
import { SENTINEL_DATA } from '@/lib/data'

type TxState = 'idle' | 'pending' | 'success'

export default function ConfigurePage() {
  const [vals, setVals] = useState(SENTINEL_DATA.policy)
  const [txState, setTxState] = useState<TxState>('idle')

  const bump = (k: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVals(v => ({ ...v, [k]: e.target.value }))

  const submit = () => {
    setTxState('pending')
    setTimeout(() => setTxState('success'), 2200)
    setTimeout(() => setTxState('idle'), 5200)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title display">POLICY CONFIGURATION</div>
        <div className="page-sub">
          Rules enforced on-chain by{' '}
          <span className="mono amber">PolicyGuard.sol</span>.
          Strategist outputs are validated against these bounds before any UserOperation is submitted.
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="card">
          <div className="field">
            <label className="lbl">Max Trade Size (USD)</label>
            <input type="number" className="input" value={vals.maxTradeSizeUsd} onChange={bump('maxTradeSizeUsd')} />
            <div className="desc">
              Hard ceiling per swap, denominated via Chainlink price feed. Current: ${Number(vals.maxTradeSizeUsd).toLocaleString()}.
            </div>
          </div>

          <div className="field">
            <label className="lbl">Daily Drawdown Limit (USD)</label>
            <input type="number" className="input" value={vals.dailyDrawdownUsd} onChange={bump('dailyDrawdownUsd')} />
            <div className="desc">
              If cumulative 24h P&amp;L drops below this threshold, the guard auto-pauses executeSwap.
            </div>
          </div>

          <div className="field">
            <label className="lbl">Cooldown Period (seconds)</label>
            <input type="number" className="input" value={vals.cooldownSec} onChange={bump('cooldownSec')} />
            <div className="desc">
              Minimum interval between swaps. Prevents high-frequency drain attacks. Current: {Number(vals.cooldownSec).toLocaleString()}s.
            </div>
          </div>

          <div className="field">
            <label className="lbl">Token Whitelist</label>
            <textarea
              className="textarea"
              rows={5}
              value={vals.whitelist}
              onChange={bump('whitelist')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <div className="desc">
              One address per line. Any swap with a non-whitelisted tokenOut reverts via RuleViolation().
            </div>
          </div>
        </div>

        <div className="warning-banner" style={{ margin: '24px 0' }}>
          <span className="icon">⚠</span>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
              Changes execute on-chain via SentinelAccount.executeSwap()
            </div>
            Gas is sponsored by the Paymaster. Expect ~84k gas for a policy update; transaction is
            broadcast through the ERC-4337 bundler and confirmed on Base Sepolia within 2 blocks.
          </div>
        </div>

        <button
          className="btn filled"
          style={{ width: '100%', padding: '14px 20px', fontSize: 13 }}
          onClick={submit}
          disabled={txState === 'pending'}
        >
          {txState === 'idle' && <>⎔ UPDATE POLICY ON-CHAIN</>}
          {txState === 'pending' && <>⟳ SUBMITTING USEROP…</>}
          {txState === 'success' && <>✓ CONFIRMED · BLOCK 12,884,417</>}
        </button>

        {txState === 'pending' && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
            userOpHash 0x7f3a…9c21 · waiting for bundler…
          </div>
        )}
        {txState === 'success' && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginTop: 10, textAlign: 'center' }}>
            ✓ PolicyGuard.setLimits() executed · tx 0x8a7b…3e0f · gas 82,114 (sponsored)
          </div>
        )}

        <hr className="hr" />

        <div className="label" style={{ marginBottom: 10 }}>Current On-Chain State</div>
        <div className="json-block" style={{ maxHeight: 'none' }}>
{`policyGuard.limits(sentinelAccount) = {
  maxTradeSizeUsd: ${Number(vals.maxTradeSizeUsd).toLocaleString()},
  dailyDrawdownUsd: ${Number(vals.dailyDrawdownUsd).toLocaleString()},
  cooldownSec: ${vals.cooldownSec},
  lastUpdated: 2026-04-24T09:14:22Z,
  setBy: ${SENTINEL_DATA.shortAddr}
}`}
        </div>
      </div>
    </div>
  )
}
