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
├── frontend/       # Next.js 16 — dashboard + feed + policy UI
└── zk/             # EZKL — ZK policy attestation scaffold (verifier is a placeholder)
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

Coverage target is **>90%**. Tests live in `contracts/test/` and are split by contract (`SentinelAccount.t.sol`, `PolicyGuard.t.sol`, `ActionLog.t.sol`, `SentinelPaymaster.t.sol`; there is no `Integration.t.sol`). Deployment addresses are committed to `contracts/deployments/base-sepolia.json`.

## Agent (Python + LangGraph)

Run from the repository root — `agent/` is a package (`agent/main.py` imports `agent.graph`),
which is how `.github/workflows/agent.yml` and `nixpacks.toml` invoke it:

```bash
uv venv .venv && source .venv/bin/activate
uv pip install -r agent/requirements.txt
python -m agent.main            # run one agent cycle
python -m agent.main --loop     # run on 15-minute cron
python -m pytest agent/tests    # unit tests (they import agent.*)
python -m pytest agent/tests/test_risk_check.py  # single test file
```

The graph definition is in `agent/graph.py`. Nodes are in `agent/nodes/` (researcher, strategist, risk_check, executor, auditor). Shared schemas (Pydantic models) are in `agent/schemas.py`. Tool implementations are in `agent/tools/`.

Current behaviour to keep in mind (see README "Implementation Status"):
- `risk_check.py` reads PolicyGuard params on-chain and asks `gpt-4o-mini` to judge pass/fail; the deterministic gate is `PolicyGuard.checkPolicy()` reverting on-chain.
- `executor.py` builds the v0.7 UserOp with all `paymaster*` fields `None`, so the deployed `SentinelPaymaster` is not used and the account pays gas.
- `tools/uniswap.py` encodes a Uniswap V3 `exactInputSingle` call but targets `MockDex.sol` (`0x992e…a936`), not a Uniswap router.

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

Uses Next.js 16.2 App Router with Turbopack (`frontend/package.json`: `next` 16.2.4, `react` 19.2.4). Contract interaction via wagmi 3.6 + viem 2 using only the `injected()` connector — RainbowKit was removed, although `frontend/next.config.ts` still lists `@rainbow-me/rainbowkit` in `transpilePackages` (harmless leftover). Subgraph queries via Apollo Client with 15s polling. IPFS reasoning blobs fetched client-side in the "Why?" modal (`components/WhyModal`). Wagmi config is in `frontend/lib/wagmi.ts`, Apollo config in `frontend/lib/apollo.ts`.

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

Status: scaffold only. The committed `contracts/src/PolicyVerifier.sol` is a placeholder that returns `true` for any non-empty proof, it is not deployed, and no node in `agent/` generates or submits proofs. The frontend shows a ZK badge only for the demo rows in `frontend/lib/data.ts`.

## Key Cross-Module Data Flow

1. Agent Executor builds an ERC-4337 v0.7 `UserOperation` containing `SentinelAccount.executeSwap()` calldata.
2. Before submission, Executor pins a reasoning JSON blob to IPFS via Pinata and injects the CID into the calldata.
3. The UserOperation is submitted to Pimlico's bundler (`eth_sendUserOperation`). Gas is paid from the account's own EntryPoint deposit; `SentinelPaymaster` is deployed but not attached to the UserOp (paymaster fields are `None` in `executor.py`).
4. On-chain: `SentinelAccount` calls `PolicyGuard.checkPolicy()` — reverts if any rule is violated — then calls the DEX (currently `MockDex.sol`) and emits `ActionLog.ActionExecuted` with the IPFS CID.
5. The Graph subgraph indexes the event; the frontend reads it via Apollo.
6. The frontend "Why?" button fetches the IPFS blob by CID and renders the full reasoning chain.

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `PRIVATE_KEY` | contracts deploy script, agent | agent signing key |
| `BASE_SEPOLIA_RPC` | contracts, agent | RPC endpoint |
| `PIMLICO_API_KEY` | agent executor | bundler access |
| `PINATA_JWT` | agent executor | IPFS pinning |
| `OPENAI_API_KEY` | agent nodes | gpt-4o (Researcher/Strategist), gpt-4o-mini (RiskCheck; the Auditor makes no LLM call) |
| `ONEINCH_API_KEY` | agent strategist | DEX quotes |
| `NEXT_PUBLIC_SUBGRAPH_URL` | frontend | Apollo endpoint |
| `SUPABASE_URL` | agent db | Supabase project URL |
| `SUPABASE_KEY` | agent db | Supabase anon/service key |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | frontend | unused — RainbowKit removed, wallet connect is wagmi `injected()` only |

Store in `.env` files per module (`.env` at each subdirectory root, never committed).

## Supabase Table Migration

Run once in the Supabase SQL editor to create the `action_records` table:

```sql
create table action_records (
  id           bigserial primary key,
  agent_run_id text unique not null,
  timestamp    timestamptz not null,
  data         jsonb not null
);
create index on action_records (timestamp desc);
```
