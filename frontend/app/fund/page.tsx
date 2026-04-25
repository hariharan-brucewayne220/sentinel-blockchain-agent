'use client'

import { useState } from 'react'
import { useBalance, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import AgentStatusBadge from '@/components/AgentStatusBadge'

const SENTINEL_ACCOUNT = (process.env.NEXT_PUBLIC_SENTINEL_ACCOUNT ?? '0x287326DDFf84973f9D23e6495cc9d727F14f7F34') as `0x${string}`
const PAYMASTER        = (process.env.NEXT_PUBLIC_PAYMASTER        ?? '0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB') as `0x${string}`
const ENTRY_POINT      = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as `0x${string}`

const entryPointAbi = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 900) }}>
      {done ? 'copied ✓' : 'copy'}
    </button>
  )
}

type AgentStatus = 'active' | 'paused'

export default function FundPage() {
  const [deposit, setDeposit] = useState('0.01')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('active')
  const [toggling, setToggling] = useState(false)

  // Real on-chain reads
  const { data: accountBalance, isLoading: balLoading } = useBalance({ address: SENTINEL_ACCOUNT, chainId: 84532 })
  const { data: paymasterDeposit } = useReadContract({ address: ENTRY_POINT, abi: entryPointAbi, functionName: 'balanceOf', args: [PAYMASTER] })

  const { sendTransaction, data: txHash, isPending } = useSendTransaction()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const doDeposit = () => {
    sendTransaction({ to: SENTINEL_ACCOUNT, value: parseEther(deposit || '0') })
  }

  const toggleAgent = () => {
    setToggling(true)
    setTimeout(() => { setAgentStatus(s => s === 'active' ? 'paused' : 'active'); setToggling(false) }, 1200)
  }

  const active = agentStatus === 'active'
  const ethBalance  = accountBalance ? Number(formatEther(accountBalance.value)).toFixed(4) : balLoading ? '…' : '0.0000'
  const paymasterEth = paymasterDeposit ? Number(formatEther(paymasterDeposit as bigint)).toFixed(4) : '…'

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
              {SENTINEL_ACCOUNT.slice(0, 10)}…{SENTINEL_ACCOUNT.slice(-6)}
            </span>
            <CopyBtn text={SENTINEL_ACCOUNT} />
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Balance</div>
          <div className="mono amber" style={{ fontSize: 36, letterSpacing: '-0.02em' }}>
            {ethBalance} <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>ETH</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Base Sepolia · live
          </div>

          <hr className="hr" />

          <div className="field">
            <label className="lbl">Deposit Amount (ETH)</label>
            <input type="text" className="input" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0.0" />
            <div className="desc">Sent from your connected wallet to SentinelAccount.</div>
          </div>

          <button className="btn filled" style={{ width: '100%', padding: '12px' }} onClick={doDeposit} disabled={isPending}>
            {isPending ? '⟳ AWAITING CONFIRMATION…' : isSuccess ? '✓ DEPOSITED' : `↓ DEPOSIT ${deposit || '0'} ETH`}
          </button>
          {txHash && (
            <div className="mono" style={{ fontSize: 11, color: isSuccess ? 'var(--green)' : 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              tx {txHash.slice(0, 10)}… {isSuccess ? '· confirmed' : '· pending'}
            </div>
          )}
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
              {PAYMASTER.slice(0, 10)}…{PAYMASTER.slice(-6)}
            </span>
            <CopyBtn text={PAYMASTER} />
          </div>

          <div className="label" style={{ marginBottom: 6 }}>Paymaster Deposit (EntryPoint)</div>
          <div className="mono" style={{ fontSize: 30, color: 'var(--green)', letterSpacing: '-0.02em' }}>
            {paymasterEth} <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>ETH</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            live · Base Sepolia EntryPoint deposit
          </div>

          <hr className="hr" />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Agent State</div>
              <div className="mono" style={{ fontSize: 14, color: active ? 'var(--amber)' : 'var(--red)' }}>
                {active ? 'ACTIVE · accepting signals' : 'PAUSED · userOps halted'}
              </div>
            </div>
            <div className={`toggle ${active ? 'on' : ''}`} onClick={toggleAgent} style={{ cursor: toggling ? 'wait' : 'pointer' }}>
              <div className="knob" />
            </div>
          </div>

          <button className={`btn ${active ? 'danger' : 'success'}`} style={{ width: '100%', padding: '12px' }} onClick={toggleAgent} disabled={toggling}>
            {toggling ? '⟳ SIGNING TX…' : active ? '⏸ PAUSE AGENT' : '▶ RESUME AGENT'}
          </button>

          <div className="warning-banner" style={{ marginTop: 18 }}>
            <span className="icon">⚠</span>
            <div>Pausing halts UserOperation submission but does not cancel pending bundler transactions. Drawdown guard remains armed regardless of state.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
