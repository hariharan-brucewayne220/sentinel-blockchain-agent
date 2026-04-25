# Sentinel Frontend

Next.js 16 dashboard for the Sentinel verifiable AI portfolio agent. Shows live on-chain actions, portfolio P&L, policy configuration, and the full reasoning chain behind every trade.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — portfolio value, P&L chart, recent actions, contract registry |
| `/feed` | Action feed — filterable list of all trades with WHY? modal |
| `/configure` | Policy configuration — update on-chain rules |
| `/fund` | Fund account — deposit tokens, toggle agent |

## Stack

- Next.js 16 App Router + Turbopack
- wagmi v2 + RainbowKit — wallet connection and contract reads
- Apollo Client v3 — subgraph queries with 15s polling
- Tailwind CSS — utility styling
- Custom design system — Playfair Display + JetBrains Mono + Syne, amber accent

## Setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

Open http://localhost:3000

## Environment Variables

```bash
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1748822/sentinel/v0.0.1
NEXT_PUBLIC_WALLETCONNECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_SENTINEL_ACCOUNT=0x287326DDFf84973f9D23e6495cc9d727F14f7F34
NEXT_PUBLIC_POLICY_GUARD=0xC0375319E7623041875ee485D84A652Da2A36B73
NEXT_PUBLIC_ACTION_LOG=0x0868A14343fA9A5F12ACdCc716e9f072ec0C0bb4
NEXT_PUBLIC_PAYMASTER=0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB
```

## Commands

```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```
