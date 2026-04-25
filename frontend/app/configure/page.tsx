'use client'

import { useState } from 'react'
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits } from 'viem'

const POLICY_GUARD = (process.env.NEXT_PUBLIC_POLICY_GUARD ?? '0xC0375319E7623041875ee485D84A652Da2A36B73') as `0x${string}`

const abi = [
  { name: 'maxTradeSizeUsd',   type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'dailyDrawdownLimit', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'cooldownPeriod',    type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'cumulativeDrawdown', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'updatePolicy', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: '_maxTradeSizeUsd', type: 'uint256' }, { name: '_dailyDrawdownLimit', type: 'uint256' }, { name: '_cooldownPeriod', type: 'uint256' }],
    outputs: [] },
] as const

function fmt18(val: bigint | undefined): string {
  if (val === undefined) return '—'
  return Number(formatUnits(val, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function ConfigurePage() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: POLICY_GUARD, abi, functionName: 'maxTradeSizeUsd' },
      { address: POLICY_GUARD, abi, functionName: 'dailyDrawdownLimit' },
      { address: POLICY_GUARD, abi, functionName: 'cooldownPeriod' },
      { address: POLICY_GUARD, abi, functionName: 'cumulativeDrawdown' },
    ],
  })

  const maxSize      = data?.[0]?.result as bigint | undefined
  const drawdownLim  = data?.[1]?.result as bigint | undefined
  const cooldown     = data?.[2]?.result as bigint | undefined
  const cumDrawdown  = data?.[3]?.result as bigint | undefined

  const [vals, setVals] = useState({ maxTradeSizeUsd: '10000', dailyDrawdownUsd: '1000', cooldownSec: '300', whitelist: '' })
  const bump = (k: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVals(v => ({ ...v, [k]: e.target.value }))

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const submit = () => {
    const toWei = (n: string) => BigInt(Math.floor(Number(n) * 1e18))
    writeContract({
      address: POLICY_GUARD,
      abi,
      functionName: 'updatePolicy',
      args: [toWei(vals.maxTradeSizeUsd), toWei(vals.dailyDrawdownUsd), BigInt(vals.cooldownSec)],
    })
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
        {/* Live on-chain values */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 14 }}>
            Live On-Chain State {isLoading && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· reading…</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Max Trade Size', value: `$${fmt18(maxSize)}` },
              { label: 'Daily Drawdown Limit', value: `$${fmt18(drawdownLim)}` },
              { label: 'Cooldown Period', value: cooldown !== undefined ? `${cooldown.toString()}s` : '—' },
              { label: 'Cumulative Drawdown', value: `$${fmt18(cumDrawdown)}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div className="mono amber" style={{ fontSize: 18 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Update form */}
        <div className="card">
          <div className="label" style={{ marginBottom: 16 }}>Update Policy</div>

          <div className="field">
            <label className="lbl">Max Trade Size (USD)</label>
            <input type="number" className="input" value={vals.maxTradeSizeUsd} onChange={bump('maxTradeSizeUsd')} />
            <div className="desc">Hard ceiling per swap via Chainlink price feed.</div>
          </div>

          <div className="field">
            <label className="lbl">Daily Drawdown Limit (USD)</label>
            <input type="number" className="input" value={vals.dailyDrawdownUsd} onChange={bump('dailyDrawdownUsd')} />
            <div className="desc">Auto-pauses executeSwap if cumulative 24h loss exceeds this.</div>
          </div>

          <div className="field">
            <label className="lbl">Cooldown Period (seconds)</label>
            <input type="number" className="input" value={vals.cooldownSec} onChange={bump('cooldownSec')} />
            <div className="desc">Minimum interval between swaps per token pair.</div>
          </div>

          <div className="field">
            <label className="lbl">Token Whitelist</label>
            <textarea className="textarea" rows={4} value={vals.whitelist} onChange={bump('whitelist')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder="0x4200...0006  # WETH&#10;0x036c...f7e   # USDC" />
            <div className="desc">One address per line. Non-whitelisted tokenOut reverts.</div>
          </div>
        </div>

        <div className="warning-banner" style={{ margin: '24px 0' }}>
          <span className="icon">⚠</span>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
              Changes execute on-chain via PolicyGuard.updatePolicy()
            </div>
            Connect your wallet (must be PolicyGuard owner) to sign the transaction.
          </div>
        </div>

        <button
          className="btn filled"
          style={{ width: '100%', padding: '14px 20px', fontSize: 13 }}
          onClick={submit}
          disabled={isPending}
        >
          {isPending ? '⟳ AWAITING CONFIRMATION…' : isSuccess ? '✓ POLICY UPDATED' : '⎔ UPDATE POLICY ON-CHAIN'}
        </button>

        {txHash && (
          <div className="mono" style={{ fontSize: 11, color: isSuccess ? 'var(--green)' : 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
            {isSuccess ? `✓ confirmed · tx ${txHash.slice(0,10)}…` : `tx ${txHash.slice(0,10)}… · waiting for confirmation`}
          </div>
        )}
      </div>
    </div>
  )
}
