import type { Action } from '@/components/WhyModal'

const now = Date.now()
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const SENTINEL_DATA = {
  shortAddr: '0x7f4a...9c31',
  sentinelAccount: process.env.NEXT_PUBLIC_SENTINEL_ACCOUNT_ADDRESS ?? '0x9d3a81F6c4E2B0aF7F81ad3e41B0c5c0a3e429c2',
  policyGuard: process.env.NEXT_PUBLIC_POLICY_GUARD_ADDRESS ?? '0x4c81E2A6d3BfA90d12cbEa70fE7f4B1c9aD2e77a',
  paymaster: process.env.NEXT_PUBLIC_SENTINEL_PAYMASTER_ADDRESS ?? '0x2a9E3d0a4bBc812e04fD1a03b3a8f26c8d1c7e3F',

  actions: [
    { id: 'act_021', ts: now - 14*MIN,  tokenIn: 'USDC', tokenOut: 'WETH',  amountIn: '12,400.00', amountOut: '3.412',    pnl: +186.42, outcome: 'filled',  cid: 'bafybeigdyrztkxf4p7d...q2xn4', txHash: '0xa3...8fe1', sentiment: 0.78, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '12,400', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-0.8%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '412', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'WETH', value: 'WETH', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '18', pass: true }], rationale: 'ETH 4h momentum inflected positive after sustained consolidation above the 20-day SMA. Funding rates remain neutral and spot CVD is accumulating at the bid — a low-risk entry window within daily drawdown budget. Allocating 38% of dry powder, keeping cooldown intact.', docs: [{ source: 'coingecko', title: 'ETH 24h +2.4%, vol +18%', ts: '12m ago' },{ source: 'l1-oracle', title: 'Basefee 4.1 gwei', ts: '12m ago' },{ source: 'news-feed', title: 'Base network TVL up 3.8%', ts: '1h ago' }], zk: true, proofCid: 'bafyrzkp3e...9c21' },
    { id: 'act_020', ts: now - 48*MIN,  tokenIn: 'WETH', tokenOut: 'USDC',  amountIn: '0.820',    amountOut: '2,981.14', pnl: -14.08,  outcome: 'filled',  cid: 'bafybeigh7kql2m3p...bd91x', txHash: '0x82...a1bc', sentiment: 0.41, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '2,981', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-2.1%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '2,088', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'USDC', value: 'USDC', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '22', pass: true }], rationale: 'De-risking into stables as 1h RSI diverges and open interest climbs without price follow-through. Expected reversion below 3,640. Cutting 18% of ETH exposure preemptively.', docs: [{ source: 'coingecko', title: 'ETH/USD short-term reversal signal', ts: '50m ago' },{ source: 'derivs', title: 'Perp OI +4.2%, funding flat', ts: '1h ago' }], zk: false, proofCid: null },
    { id: 'act_019', ts: now - 3*HOUR,  tokenIn: 'USDC', tokenOut: 'CBETH', amountIn: '5,000.00', amountOut: '1.382',    pnl: +62.10,  outcome: 'filled',  cid: 'bafybeihsquwn7kd91a...xm2df', txHash: '0x61...be34', sentiment: 0.66, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '5,000', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-1.4%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '911', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'cbETH', value: 'cbETH', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '11', pass: true }], rationale: 'Rotating into cbETH to capture stacked staking yield while maintaining ETH-beta. Coinbase-attested liquid staking premium tightened to 12 bps — favorable entry. Low slippage on Base pools.', docs: [{ source: 'defillama', title: 'cbETH/ETH price premium narrowing', ts: '3h ago' },{ source: 'coinbase', title: 'cbETH APR steady at 3.1%', ts: '6h ago' }], zk: true, proofCid: 'bafyrzkp3f...112a' },
    { id: 'act_018', ts: now - 6*HOUR,  tokenIn: 'WETH', tokenOut: 'USDC',  amountIn: '2.100',    amountOut: '7,624.30', pnl: +421.55, outcome: 'filled',  cid: 'bafybeigm7hk38pv...qz7nb', txHash: '0x12...f0a2', sentiment: 0.28, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '7,624', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-0.2%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '4,122', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'USDC', value: 'USDC', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '9', pass: true }], rationale: 'Bearish macro candle on 1D with clear distribution volume. Exiting 60% of ETH into stables to preserve weekly P&L gains. Will re-enter on reclaim of 3,620 or confirmed consolidation.', docs: [{ source: 'macro', title: 'CPI print hotter than expected', ts: '6h ago' },{ source: 'news-feed', title: 'Risk assets broadly offered', ts: '5h ago' }], zk: true, proofCid: 'bafyrzkp81...882f' },
    { id: 'act_016', ts: now - 14*HOUR, tokenIn: 'WETH', tokenOut: 'WBTC',  amountIn: '1.800',    amountOut: '0.1042',   pnl: -48.22,  outcome: 'filled',  cid: 'bafybeigqq2m9khjrp...1af4b', txHash: '0xa9...ed18', sentiment: 0.52, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '6,530', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-1.8%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '702', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'WBTC', value: 'WBTC', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '28', pass: true }], rationale: 'Rebalance toward BTC-beta as ETH/BTC ratio breaks 20-day support. Modest conviction — position sized accordingly. Willing to wear near-term chop.', docs: [{ source: 'derivs', title: 'ETH/BTC ratio breakdown', ts: '14h ago' },{ source: 'news-feed', title: 'BTC dominance +0.4pp', ts: '16h ago' }], zk: true, proofCid: 'bafyrzkp4a...881c' },
    { id: 'act_015', ts: now - 20*HOUR, tokenIn: 'USDC', tokenOut: 'WETH',  amountIn: '8,200.00', amountOut: '2.281',    pnl: +128.66, outcome: 'filled',  cid: 'bafybeiefm7p4q1xld...nq22a', txHash: '0x38...7712', sentiment: 0.72, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '8,200', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-0.3%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '1,110', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'WETH', value: 'WETH', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '16', pass: true }], rationale: 'Volatility compression into a binary macro window. Asymmetric upside on a break of 3,720. Entering with a tight invalidation at 3,640.', docs: [{ source: 'coingecko', title: 'ETH realized vol at 6-week low', ts: '22h ago' }], zk: true, proofCid: 'bafyrzkp9c...003e' },
    { id: 'act_014', ts: now - 26*HOUR, tokenIn: 'WETH', tokenOut: 'USDC',  amountIn: '3.100',    amountOut: '11,240.22', pnl: -91.40, outcome: 'filled',  cid: 'bafybeihmnpq7x3ld...zl4qa', txHash: '0xcd...1a05', sentiment: 0.35, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '11,240', pass: true },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-2.8%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '388', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'USDC', value: 'USDC', pass: true },{ rule: 'SLIPPAGE_BPS', limit: '50', value: '34', pass: true }], rationale: 'Stop-loss trigger; loss within policy. Preserving capital for next setup; waiting for reclaim.', docs: [{ source: 'risk', title: 'Stop at 3,625 executed', ts: '26h ago' }], zk: false, proofCid: null },
    { id: 'act_013_blocked', ts: now - 2*DAY, tokenIn: 'USDC', tokenOut: 'WETH', amountIn: '30,000.00', amountOut: '—', pnl: 0, outcome: 'blocked', cid: 'bafybeibl7z2qm4pdls...k91bn', txHash: null, sentiment: 0.81, policy: [{ rule: 'MAX_TRADE_SIZE_USD', limit: '25,000', value: '30,000', pass: false },{ rule: 'DAILY_DRAWDOWN', limit: '-5.0%', value: '-0.6%', pass: true },{ rule: 'COOLDOWN_SEC', limit: '300', value: '5,122', pass: true },{ rule: 'TOKEN_WHITELIST', limit: 'WETH', value: 'WETH', pass: true }], rationale: 'Strategist intended a larger add on breakout confirmation. PolicyGuard rejected the UserOp — max trade size exceeded. Consider raising cap if this regime persists.', docs: [{ source: 'policy-guard', title: 'RuleViolation(MAX_TRADE_SIZE_USD)', ts: '2d ago' }], zk: true, proofCid: 'bafyrzkpblk...441a' },
  ] as Action[],

  dailyPnL: (() => {
    const base = 48000
    const path = [0, 240, -80, 360, 420, 180, 620, 540, 880, 720, 990, 1180, 1340, 1540]
    return path.map((d, i) => {
      const date = new Date(now - (13 - i) * DAY)
      return {
        date: date.toISOString().slice(0, 10),
        dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalAmountOut: base + d,
        pnl: d,
      }
    })
  })(),

  policy: {
    maxTradeSizeUsd: 25000,
    dailyDrawdownUsd: 2500,
    cooldownSec: 300,
    whitelist: [
      '0x4200000000000000000000000000000000000006  // WETH',
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  // USDC',
      '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22  // cbETH',
      '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb  // DAI',
    ].join('\n'),
  },
}

export function formatTimeAgo(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

export function fmtUsd(n: number, signed = true): string {
  const sign = n >= 0 ? '+' : '-'
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${signed ? sign : ''}$${s}`
}
