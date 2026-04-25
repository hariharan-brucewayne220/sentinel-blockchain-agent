'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Nav({ agentActive = true }: { agentActive?: boolean }) {
  const pathname = usePathname()

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
          <Link
            key={href}
            href={href}
            className={`nav-link nav-label ${isActive(href) ? 'active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
          if (!mounted) return null
          if (!account || !chain) {
            return (
              <button className="wallet-btn" onClick={openConnectModal}>
                CONNECT WALLET
              </button>
            )
          }
          return (
            <button className="wallet-btn" onClick={openAccountModal}>
              <span className="avatar" />
              <span>{account.displayName}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.8 }}>{account.displayBalance ?? '—'}</span>
            </button>
          )
        }}
      </ConnectButton.Custom>
    </nav>
  )
}
