# Sentinel — Verifiable AI Portfolio Agent

An autonomous AI agent that manages a crypto portfolio on Base Sepolia via an ERC-4337 smart account, constrained by on-chain policy guard contracts. Every trade decision is pinned to IPFS and auditable from a live dashboard.

## What It Does

The agent runs a LangGraph pipeline every 15 minutes:
1. **Researcher** — fetches live prices, holdings, and market sentiment
2. **Strategist** — proposes a swap using GPT-4o and 1inch quotes
3. **Risk Check** — validates the proposal against on-chain policy rules
4. **Executor** — builds an ERC-4337 UserOperation, pins reasoning to IPFS, broadcasts via Pimlico
5. **Auditor** — saves the full action record to Supabase

Every on-chain action emits an event indexed by The Graph subgraph. The frontend reads it via Apollo and lets you click **WHY?** on any trade to see the full reasoning chain — market context, policy decision, strategist rationale, and ZK attestation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  Connect → Fund → Configure Policy → Watch Feed → Why?  │
└────────────────────────┬────────────────────────────────┘
                         │ wagmi / viem / Apollo
┌────────────────────────▼────────────────────────────────┐
│                   AGENT LAYER (Python)                   │
│  LangGraph: Researcher → Strategist → Risk → Executor   │
│                        ↓                                │
│              IPFS (Pinata) — reasoning JSON             │
└────────────────────────┬────────────────────────────────┘
                         │ ERC-4337 UserOperation
┌────────────────────────▼────────────────────────────────┐
│              EXECUTION INFRA                             │
│  Pimlico bundler → Paymaster (gasless) → EntryPoint     │
└────────────────────────┬────────────────────────────────┘
                         │ on-chain
┌────────────────────────▼────────────────────────────────┐
│                   CONTRACT LAYER (Solidity)              │
│  SentinelAccount (ERC-4337) + PolicyGuard + ActionLog   │
└────────────────────────┬────────────────────────────────┘
                         │ events
┌────────────────────────▼────────────────────────────────┐
│               INDEXER (The Graph)                        │
│  ActionLog.ActionExecuted → Action + DailyPnL entities  │
└─────────────────────────────────────────────────────────┘
```

---

## Key Data Flow

1. Agent builds an ERC-4337 `UserOperation` with `SentinelAccount.execute()` calldata
2. Reasoning JSON is pinned to IPFS (Pinata) — CID injected into calldata
3. UserOperation submitted to Pimlico bundler; `SentinelPaymaster` sponsors gas
4. On-chain: `PolicyGuard.checkPolicy()` enforces rules, then DEX swap executes, `ActionLog` emits event with IPFS CID
5. The Graph indexes the event; frontend polls via Apollo every 15s
6. "Why?" button fetches the IPFS blob and renders the full reasoning chain

---

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| SentinelAccount | `0x287326DDFf84973f9D23e6495cc9d727F14f7F34` |
| PolicyGuard | `0xC0375319E7623041875ee485D84A652Da2A36B73` |
| ActionLog | `0x0868A14343fA9A5F12ACdCc716e9f072ec0C0bb4` |
| SentinelPaymaster | `0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB` |

---

## Running Locally

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

### Agent (one cycle)
```bash
cd agent
uv venv .venv && source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env   # fill in your keys
python -m agent.main           # single cycle
python -m agent.main --loop    # 15-min cron
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # fill in subgraph URL and contract addresses
npm run dev
```

Open http://localhost:3000

### 4. Subgraph

```bash
cd subgraph
npm install
graph auth <deploy-key>
graph codegen && graph build
graph deploy sentinel
```

## Environment Variables

### Agent (`agent/.env`)

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` | Agent signing wallet private key |
| `BASE_SEPOLIA_RPC` | RPC endpoint (default: https://sepolia.base.org) |
| `PIMLICO_API_KEY` | ERC-4337 bundler (pimlico.io) |
| `PINATA_JWT` | IPFS pinning (pinata.cloud) |
| `OPENAI_API_KEY` | GPT-4o for researcher/strategist nodes |
| `ONEINCH_API_KEY` | DEX swap quotes (portal.1inch.dev) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `SENTINEL_ACCOUNT_ADDRESS` | Deployed proxy address |
| `POLICY_GUARD_ADDRESS` | Deployed PolicyGuard address |
| `ACTION_LOG_ADDRESS` | Deployed ActionLog address |
| `PAYMASTER_ADDRESS` | Deployed SentinelPaymaster address |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUBGRAPH_URL` | The Graph Studio query endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | RainbowKit WalletConnect project ID |
| `NEXT_PUBLIC_SENTINEL_ACCOUNT` | SentinelAccount proxy address |
| `NEXT_PUBLIC_POLICY_GUARD` | PolicyGuard address |
| `NEXT_PUBLIC_ACTION_LOG` | ActionLog address |

## Supabase Migration

Run once in the SQL editor:

```sql
create table action_records (
  id           bigserial primary key,
  agent_run_id text unique not null,
  timestamp    timestamptz not null,
  data         jsonb not null
);
create index on action_records (timestamp desc);
```

## ZK Attestation

The drawdown check is provable via EZKL:

```bash
cd zk
pip install ezkl torch onnx
python export_model.py       # export PyTorch model to ONNX
python generate_proof.py     # run full EZKL pipeline → PolicyVerifier.sol
cp model/PolicyVerifier.sol ../contracts/src/PolicyVerifier.sol
```

## License

MIT
