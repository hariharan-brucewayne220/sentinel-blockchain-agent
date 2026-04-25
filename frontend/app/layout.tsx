import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Sentinel · Verifiable AI Portfolio Agent',
  description: 'Autonomous on-chain portfolio agent with verifiable reasoning. Every trade is auditable.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  )
}
