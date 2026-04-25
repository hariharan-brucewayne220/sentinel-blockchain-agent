'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Sentinel',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'sentinel-dev',
  chains: [baseSepolia],
  ssr: true,
})
