'use client'

import { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { ApolloProvider } from '@apollo/client'
import { wagmiConfig } from '@/lib/wagmi'
import { apolloClient } from '@/lib/apollo'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const sentinelTheme = darkTheme({
  accentColor: '#f5a623',
  accentColorForeground: '#000000',
  borderRadius: 'none',
  fontStack: 'system',
})

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={sentinelTheme}>
          <ApolloProvider client={apolloClient}>
            {children}
          </ApolloProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
