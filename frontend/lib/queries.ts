import { gql } from '@apollo/client'

export const ACTIONS_QUERY = gql`
  query GetActions($first: Int!, $skip: Int!) {
    actions(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      actionId
      tokenIn
      tokenOut
      amountIn
      amountOut
      reasoningCID
      timestamp
    }
  }
`

export const DAILY_PNL_QUERY = gql`
  query GetDailyPnL($first: Int!) {
    dailyPnLs(first: $first, orderBy: date, orderDirection: desc) {
      id
      date
      tradeCount
      totalAmountIn
      totalAmountOut
    }
  }
`

export const STATS_QUERY = gql`
  query GetStats {
    actions(first: 1000) {
      id
      amountIn
      amountOut
      timestamp
    }
  }
`

// Known token addresses on Base Sepolia → symbol
const TOKEN_SYMBOLS: Record<string, string> = {
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': 'USDC',
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'cbETH',
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': 'USDC',
}

export function tokenSymbol(address: string): string {
  return TOKEN_SYMBOLS[address.toLowerCase()] ?? address.slice(0, 6) + '…'
}

const TOKEN_DECIMALS: Record<string, number> = {
  '0x4200000000000000000000000000000000000006': 18, // WETH
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': 6,  // USDC
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 18, // cbETH
}

export function formatWei(wei: string, tokenAddress?: string): string {
  const decimals = tokenAddress ? (TOKEN_DECIMALS[tokenAddress.toLowerCase()] ?? 18) : 18
  const val = Number(BigInt(wei)) / 10 ** decimals
  if (val === 0) return '0'
  if (val < 0.0001) return '~0'
  if (val < 0.01) return val.toFixed(6)
  return val.toFixed(4)
}
