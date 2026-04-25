'use client'

import { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApolloProvider } from '@apollo/client'
import { wagmiConfig } from '@/lib/wagmi'
import { apolloClient } from '@/lib/apollo'

const queryClient = new QueryClient()

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ApolloProvider client={apolloClient}>
          {children}
        </ApolloProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
