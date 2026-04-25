'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { useEffect, useState } from 'react'

export default function Nav({ agentActive = true }: { agentActive?: boolean }) {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/feed', label: 'Feed' },
    { href: '/configure', label: 'Configure' },
    { href: '/fund', label: 'Fund' },
  ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="nav">
      <div className="nav-brand">
        <span>SENTINEL</span>
        <span className={`pulse-dot ${agentActive ? '' : 'muted'}`} />
      </div>

      <div className="nav-center">
        {links.map(({ href, label }) => (
          <Link key={href} href={href} className={`nav-link nav-label ${isActive(href) ? 'active' : ''}`}>
            {label}
          </Link>
        ))}
      </div>

      {mounted && isConnected && address ? (
        <button className="wallet-btn" onClick={() => disconnect()}>
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
      ) : (
        <button className="wallet-btn" onClick={() => connect({ connector: injected() })}>
          CONNECT WALLET
        </button>
      )}
    </nav>
  )
}
