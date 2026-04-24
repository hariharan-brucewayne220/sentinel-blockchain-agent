# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**Sentinel** — a verifiable AI portfolio agent. An autonomous LangGraph agent manages an on-chain portfolio via an ERC-4337 smart account, constrained by on-chain policy guard contracts. Every trade decision is pinned to IPFS and auditable from a dashboard. See `spec.md` for the full specification.

## Planned Repository Layout

```
sentinel/
├── contracts/      # Foundry — Solidity contracts + tests
├── agent/          # Python — LangGraph pipeline
├── subgraph/       # The Graph — ActionLog indexer
├── frontend/       # Next.js 14 — dashboard + feed + policy UI
└── zk/             # EZKL — ZK policy attestation (differentiator)
```

## Contracts (Foundry)

```bash
cd contracts
forge build                          # compile
forge test                           # all tests
forge test --match-test testFuzz -vv # single test, verbose
forge test --fuzz-runs 10000         # invariant/fuzz suite
forge coverage                       # coverage report
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
forge verify-contract <addr> src/PolicyGuard.sol:PolicyGuard --chain base-sepolia
```

Coverage target is **>90%**. Tests live in `contracts/test/` and are split by contract (`SentinelAccount.t.sol`, `PolicyGuard.t.sol`, `ActionLog.t.sol`, `Integration.t.sol`). Deployment addresses are committed to `contracts/deployments/base-sepolia.json`.

## Agent (Python + LangGraph)

```bash
cd agent
uv venv .venv && source .venv/bin/activate
uv pip install -r requirements.txt
python main.py            # run one agent cycle
python main.py --loop     # run on 15-minute cron
pytest                    # unit tests
pytest tests/test_risk_check.py  # single test file
```

The graph definition is in `agent/graph.py`. Nodes are in `agent/nodes/` (researcher, strategist, risk_check, executor, auditor). Shared schemas (Pydantic models) are in `agent/schemas.py`. Tool implementations are in `agent/tools/`.

## Subgraph (The Graph)

```bash
cd subgraph
npm install
graph codegen && graph build
graph deploy --studio sentinel
```

Schema is `subgraph/schema.graphql`. Event mappings are in `subgraph/src/mappings.ts`. The subgraph indexes `ActionLog.ActionExecuted` events, producing `Action` and `DailyPnL` entities.

## Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
```

Uses Next.js 14 App Router. Contract interaction via wagmi v2 + viem. Subgraph queries via Apollo Client with 15s polling. IPFS reasoning blobs fetched client-side in the "Why?" modal (`components/WhyModal`). Wagmi config is in `frontend/lib/wagmi.ts`, Apollo config in `frontend/lib/apollo.ts`.

## ZK Attestation (EZKL)

```bash
cd zk
pip install ezkl
python export_model.py     # export RiskCheck ONNX model
ezkl gen-settings -M model/risk_check.onnx
ezkl compile-circuit
ezkl prove
```

Proves only the drawdown check (single comparison). The generated `PolicyVerifier.sol` goes into `contracts/src/`. Proof CID is stored alongside the reasoning blob in IPFS under the `proof_cid` field.

## Key Cross-Module Data Flow

1. Agent Executor builds an ERC-4337 `UserOperation` containing `SentinelAccount.execute()` calldata.
2. Before submission, Executor pins a reasoning JSON blob to IPFS via Pinata and injects the CID into the calldata.
3. The UserOperation is submitted to Pimlico's bundler (`eth_sendUserOperation`); `SentinelPaymaster` sponsors gas.
4. On-chain: `SentinelAccount` calls `PolicyGuard.checkPolicy()` — reverts if any rule is violated — then calls the DEX swap and emits `ActionLog.ActionExecuted` with the IPFS CID.
5. The Graph subgraph indexes the event; the frontend reads it via Apollo.
6. The frontend "Why?" button fetches the IPFS blob by CID and renders the full reasoning chain.

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `PRIVATE_KEY` | contracts deploy script, agent | agent signing key |
| `BASE_SEPOLIA_RPC` | contracts, agent | RPC endpoint |
| `PIMLICO_API_KEY` | agent executor | bundler access |
| `PINATA_JWT` | agent executor | IPFS pinning |
| `OPENAI_API_KEY` | agent nodes | gpt-4o (Researcher/Strategist), gpt-4o-mini (RiskCheck/Auditor) |
| `ONEINCH_API_KEY` | agent strategist | DEX quotes |
| `NEXT_PUBLIC_SUBGRAPH_URL` | frontend | Apollo endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | frontend | RainbowKit |

Store in `.env` files per module (`.env` at each subdirectory root, never committed).
