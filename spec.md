# Sentinel — Verifiable AI Portfolio Agent

## Concept

An autonomous AI agent that manages an on-chain portfolio through an ERC-4337 smart account, constrained by on-chain policy guard contracts. Every trade decision's reasoning is pinned to IPFS and auditable from a dashboard. The system is fully verifiable: you can trace any on-chain action back to the exact reasoning chain that produced it.

**Why this stack matters now:** AI×crypto convergence is the single hottest hiring area in blockchain (Coinbase AgentKit, Base, Olas, Virtuals, Skyfire). This project is a small version of what those protocols are shipping — account abstraction + autonomous agents + verifiable execution.

**Academic positioning:** Per the agent-blockchain standards survey (arxiv:2601.04583), Sentinel operates at **Execution Level 4 — Autonomous Signing**: the agent independently signs and submits UserOperations without human approval per transaction, constrained only by on-chain policy contracts. The two core primitives it implements — Transaction Intent Schema (ProposedAction) and Policy Decision Record (ActionLog + IPFS blob) — align directly with the emerging interface standards the survey proposes for this execution level.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│  Connect → Fund → Configure Policy → Watch Feed → Why?  │
└────────────────────────┬────────────────────────────────┘
                         │ wagmi / viem / RainbowKit
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
│  Chainlink price feeds for policy enforcement           │
└────────────────────────┬────────────────────────────────┘
                         │ events
┌────────────────────────▼────────────────────────────────┐
│               INDEXER (The Graph)                        │
│  ActionLog subgraph — P&L feed, reasoning CIDs          │
└─────────────────────────────────────────────────────────┘
```

---

## Module 1 — Smart Contract Layer

**Stack:** Solidity, Foundry, Base Sepolia, Chainlink, Etherscan

### Contracts

#### `SentinelAccount.sol`
Minimal ERC-4337 smart account (fork or extend Safe's SimpleAccount).

Responsibilities:
- Implements `validateUserOp` per EIP-4337
- Delegates execution to PolicyGuard before any swap
- Owner is an EOA (the agent's signing key); guardian can be set for recovery
- Upgradeable via UUPS proxy (optional for v1, required for differentiator)

#### `PolicyGuard.sol`
Enforces per-action constraints. Called by SentinelAccount before execution.

Enforced rules:
- `maxTradeSize`: per-trade cap in USD (Chainlink feed converted)
- `tokenWhitelist`: mapping of allowed ERC-20 token addresses
- `dailyDrawdownLimit`: max cumulative loss in a 24h window
- `cooldownPeriod`: minimum blocks between trades on same asset

```solidity
function checkPolicy(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    bytes32 reasoningCID
) external returns (bool);
```

Reverts with descriptive errors: `PolicyGuard__TokenNotWhitelisted`, `PolicyGuard__DrawdownExceeded`, etc.

#### `ActionLog.sol`
Append-only event log. Emitted on every successful agent action.

```solidity
event ActionExecuted(
    uint256 indexed actionId,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    bytes32 reasoningCID,   // IPFS CID of the agent's reasoning blob
    uint256 timestamp
);
```

`reasoningCID` links every on-chain trade to its off-chain explanation — the core verifiability primitive.

#### `SentinelPaymaster.sol`
Simple verifying paymaster that sponsors gas for the agent's UserOperations. Holds an ETH deposit on the EntryPoint, validates that the operation came from a registered SentinelAccount.

### Oracle Integration
- Chainlink Data Feeds on Base for ETH/USD, BTC/USD, USDC/USD
- PolicyGuard calls `AggregatorV3Interface.latestRoundData()` to convert `amountIn` to USD before applying `maxTradeSize`
- Staleness check: revert if answer is older than 3600 seconds

### Testing (Foundry)

Coverage target: **>90%**

Test categories:
- `SentinelAccount.t.sol` — validateUserOp, signature validation, replay protection
- `PolicyGuard.t.sol` — invariant tests for drawdown tracking, fuzz on `amountIn` values, whitelist enforcement
- `ActionLog.t.sol` — event emission, CID storage integrity
- `Integration.t.sol` — full UserOperation flow through EntryPoint fork test

Key invariants (for `forge test --fuzz-runs 10000`):
- Policy can never be bypassed: if `checkPolicy` reverts, no swap executes
- Drawdown never exceeds `dailyDrawdownLimit` in any sequence of trades
- Only whitelisted tokens ever appear in ActionLog events

Deployment:
- `forge script` deploy to Base Sepolia
- Verify all contracts on Basescan with `forge verify-contract`
- Deployment addresses committed to `deployments/base-sepolia.json`

---

## Module 2 — AI Agent Layer

**Stack:** Python, LangGraph, web3.py / viem via subprocess, Pinata, 1inch API, OpenAI API

**Model assignment:**
- Researcher + Strategist: `gpt-4o` (reasoning-heavy nodes)
- RiskCheck + Auditor: `gpt-4o-mini` (structured checks, cost savings)
- Executor: no LLM call (pure deterministic construction)

### LangGraph Node Pipeline

```
Researcher → Strategist → RiskCheck → Executor → Auditor
```

#### `Researcher`
Inputs: current portfolio state (pulled from subgraph), live prices (Chainlink), news sentiment.

Tools:
- `get_portfolio_state()` — reads SentinelAccount balances via subgraph
- `get_chainlink_prices(tokens)` — fetches latest round data
- `rag_search(query)` — **Multi-HyDE + BM25 + pgvector + RRF + cross-encoder reranker** pipeline for news/sentiment retrieval

**RAG architecture note:** Plain HyDE is unreliable for financial data — LLMs fabricate numerically plausible but incorrect figures, pulling embeddings away from correct context (see arxiv:2509.16369). Use Multi-HyDE (multiple hypothetical docs fused with BM25 via RRF) then apply a cross-encoder reranker. This yields Recall@5 of 0.816 vs 0.587 for dense-only (arxiv:2604.01733).

**Prompt injection hardening:** Sanitize all retrieved documents before passing to Strategist. Strip raw HTML, limit to extracted text + metadata. This is OWASP LLM Top 10 #1 (2025) for agents consuming external content.

Outputs: `MarketContext` object with prices, holdings, sentiment scores, recent events.

#### `Strategist`
Inputs: `MarketContext`

Responsibilities:
- Evaluates rebalancing opportunities
- Queries 1inch Pathfinder API for DEX quotes on candidate swaps
- Scores candidate actions by expected Sharpe contribution
- Selects top action or `NO_ACTION` with justification

Outputs: `ProposedAction` (tokenIn, tokenOut, amountIn, rationale string)

#### `RiskCheck`
Inputs: `ProposedAction`, current policy config (read from PolicyGuard on-chain)

Responsibilities:
- Simulates PolicyGuard constraints locally before sending on-chain
- Checks: trade size vs `maxTradeSize`, token in whitelist, drawdown headroom
- If check fails: returns `BLOCKED` with reason, node graph routes back to Strategist
- Produces a **Policy Decision Record** (per arxiv:2601.04583 taxonomy) — a structured, auditable record of each enforcement decision, included in the IPFS reasoning blob

Outputs: `RiskCheckResult` (pass/fail + per-rule breakdown) — this is what the ZK circuit proves in the differentiator module

#### `Executor`
Inputs: approved `ProposedAction`

Steps:
1. Build swap calldata via 1inch API
2. Encode as `SentinelAccount.execute()` call
3. Construct ERC-4337 `UserOperation` struct
4. Sign with agent's private key
5. Pin reasoning blob to IPFS via Pinata, get CID
6. Inject CID into calldata (passed through to ActionLog)
7. Submit UserOperation to Pimlico bundler via `eth_sendUserOperation`

Outputs: `ExecutionReceipt` (txHash, userOpHash, ipfsCID)

#### `Auditor`
Inputs: `ExecutionReceipt`

Responsibilities:
- Polls for UserOperation inclusion (Pimlico API)
- Verifies ActionLog event was emitted with correct CID
- Logs success/failure to structured JSON
- On failure: triggers alert and halts agent loop until manual review

Outputs: final `ActionRecord` written to local DB (SQLite for v1)

### Reasoning Blob Schema (IPFS)

Every pinned blob is a JSON document:

```json
{
  "version": "1.0",
  "timestamp": "2026-04-24T12:00:00Z",
  "agent_run_id": "uuid",
  "market_context": {
    "prices": {},
    "sentiment_score": 0.72,
    "retrieved_docs": []
  },
  "proposed_action": {
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "1000000000000000000",
    "rationale": "ETH/USDC ratio 15% below 30d MA, sentiment neutral-positive..."
  },
  "risk_check": {
    "passed": true,
    "checks": []
  },
  "execution": {
    "userOpHash": "0x...",
    "txHash": "0x..."
  }
}
```

This blob is what the frontend "Why?" button fetches and renders.

### Agent Scheduling
- Runs on a 15-minute cron (configurable)
- Idempotent: each run starts from on-chain state, not local cache
- Graceful shutdown: completes current node before stopping

### Threat Model (from arxiv:2601.04583)

| Threat | Mitigation in Sentinel |
|--------|----------------------|
| Prompt injection via retrieved news | Strip HTML from RAG docs; pass only extracted text to Strategist |
| Policy misuse (loophole finding) | PolicyGuard enforces rules on-chain — agent cannot bypass even if Strategist tries |
| Agent key compromise | Signing key in env var; PolicyGuard `maxTradeSize` caps blast radius; daily drawdown limit is a circuit breaker |
| Excessive agency | Hard caps enforced at contract level, not prompt level — cannot be jailbroken |

---

## Module 3 — Execution Infrastructure

### Bundler
- **Pimlico** as primary bundler on Base Sepolia
- Submit UserOperations via `eth_sendUserOperation` JSON-RPC
- Poll status via `eth_getUserOperationReceipt`
- Fallback: Alchemy Account Kit bundler endpoint

### Paymaster
- `SentinelPaymaster.sol` deployed and deposited on EntryPoint
- Sponsors gas for all agent-initiated operations
- Validates caller is a registered SentinelAccount
- For demo: pre-funded with 0.1 ETH

### Subgraph (The Graph)
Indexes `ActionLog.ActionExecuted` events.

Schema:
```graphql
type Action @entity {
  id: ID!
  actionId: BigInt!
  tokenIn: Bytes!
  tokenOut: Bytes!
  amountIn: BigInt!
  amountOut: BigInt!
  reasoningCID: String!
  timestamp: BigInt!
}

type DailyPnL @entity {
  id: ID!       # date string
  realizedPnL: BigDecimal!
  tradeCount: Int!
}
```

Queries used by frontend:
- Latest 20 actions (feed)
- DailyPnL for chart
- Lookup by reasoningCID

Deploy to Subgraph Studio, publish to decentralized network.

---

## Module 4 — Frontend

**Stack:** Next.js 14 (App Router), wagmi v2, viem, RainbowKit, Tailwind, shadcn/ui, Apollo Client

### Pages

#### `/` — Dashboard
- Connect wallet (RainbowKit)
- Portfolio summary: holdings, total value (from subgraph + Chainlink)
- P&L chart (daily, from DailyPnL subgraph entity)
- Agent status badge: RUNNING / PAUSED / BLOCKED

#### `/feed` — Action Feed
Live list of agent actions, newest first.

Each row:
- Timestamp, tokenIn → tokenOut, amount, outcome (profit/loss in USD)
- **"Why?" button** → opens modal fetching IPFS blob, renders:
  - Sentiment score and retrieved news snippets
  - Risk check results (pass/fail per rule)
  - Full rationale string from Strategist node
  - Raw JSON toggle

#### `/configure` — Policy Settings
Form to update PolicyGuard parameters:
- Max trade size slider
- Token whitelist multi-select
- Daily drawdown limit input
- Cooldown period input

Submits via `wagmi.writeContract` → SentinelAccount → PolicyGuard.

#### `/fund` — Account Management
- Deposit ETH or ERC-20 to SentinelAccount
- View current Paymaster balance
- Pause / resume agent (sets a flag read by agent cron)

### Key Frontend Patterns
- All contract reads via wagmi `useReadContract` hooks with Chainlink price enrichment
- Subgraph queries via Apollo with 15s polling for live feed
- Optimistic UI on policy updates with revert on tx failure
- Mobile responsive, dark mode default

---

## Differentiator — ZK Policy Attestation (EZKL)

**Academic framing:** Sentinel implements a **ZKPoI (Zero-Knowledge Proof of Inference)** as defined in "Framework for End-to-End Verifiable AI Pipelines" (arxiv:2503.22573). This is Stage 5 of the academic six-stage verifiable AI pipeline — proving a specific model made a correct inference on a given input, without revealing private parameters.

**What it proves:** The RiskCheck node actually evaluated the drawdown policy it claims to have run — not a different policy, not a skipped check.

**Implementation:**

1. Export the RiskCheck drawdown comparison as an ONNX model (single comparison node: `cumulative_loss < daily_limit`)
2. Use **EZKL** (Halo2 backend, **no trusted setup required**) to compile to a SNARK circuit
3. Generate a proof for each RiskCheck execution — expected performance based on ZKML survey (arxiv:2502.18535):
   - Proof generation: **< 10 seconds** (far simpler than the 10s MobileNet v2 benchmark)
   - Proof size: **< 1 KB** (no matrix multiplications)
   - On-chain verification: ~200k gas (standard Halo2 verifier)
4. Store proof CID alongside the IPFS reasoning blob (`proof_cid` field)
5. Deploy `PolicyVerifier.sol` (EZKL-generated Halo2 verifier contract) to Base Sepolia
6. Frontend "Why?" modal shows: "✓ ZK-verified policy check" with link to proof

**Why this is architecturally correct, not just a gimmick:**
- Proves the trust gap identified in arxiv:2402.02675: "benchmark results are impossible to verify without re-performing them on black-box outputs"
- Matches the Proof-of-Thought (PoT) primitive proposed in the AI-blockchain security survey
- EU AI Act (August 2024) mandates audit trails for autonomous systems — ZKPoI satisfies the highest-assurance variant of this requirement

Scope constraint: prove only the drawdown comparison (single ONNX node). Document explicitly in README what is proven vs. what is attested by signature only.

---

## Build Plan

### Week 1 — Contracts + Infra

| Day | Task |
|-----|------|
| 1 | Foundry repo init, SentinelAccount.sol (fork SimpleAccount) |
| 2 | PolicyGuard.sol with Chainlink integration |
| 3 | ActionLog.sol + SentinelPaymaster.sol |
| 4 | Full test suite (unit + invariant + fuzz) |
| 5 | Deploy to Base Sepolia, verify on Basescan |
| 6 | Subgraph schema + mappings, deploy to Subgraph Studio |
| 7 | wagmi/viem skeleton Next.js app connected to deployed contracts |

Checkpoint: can send a manually crafted UserOperation and see it indexed in the subgraph.

### Week 2 — Agent

| Day | Task |
|-----|------|
| 8 | LangGraph scaffolding, Researcher node + tools |
| 9 | Strategist node + 1inch API integration |
| 10 | RiskCheck node with local policy simulation |
| 11 | Executor node: UserOperation construction + Pimlico submission |
| 12 | IPFS pinning via Pinata, CID injection into calldata |
| 13 | Auditor node + end-to-end test: agent → bundler → on-chain → subgraph |
| 14 | Agent cron, error handling, graceful shutdown |

Checkpoint: full agent cycle running end-to-end on Base Sepolia, reasoning blobs on IPFS, ActionLog events indexed.

### Week 3 — Polish + Differentiator

| Day | Task |
|-----|------|
| 15 | Frontend dashboard + P&L chart |
| 16 | Action feed + "Why?" modal (IPFS fetch + render) |
| 17 | Configure page (policy update flow) |
| 18 | ZK attestation: EZKL circuit for drawdown check |
| 19 | PolicyVerifier.sol deployed, proof stored in reasoning blob |
| 20 | Frontend ZK verification badge in "Why?" modal |
| 21 | Demo video, README, cleanup |

Checkpoint: live demo showing agent trade → on-chain action → "Why?" button → ZK-verified reasoning.

---

## Repository Structure

```
sentinel/
├── contracts/                  # Foundry project
│   ├── src/
│   │   ├── SentinelAccount.sol
│   │   ├── PolicyGuard.sol
│   │   ├── ActionLog.sol
│   │   └── SentinelPaymaster.sol
│   ├── test/
│   ├── script/
│   └── deployments/
│       └── base-sepolia.json
├── agent/                      # Python LangGraph agent
│   ├── nodes/
│   │   ├── researcher.py
│   │   ├── strategist.py
│   │   ├── risk_check.py
│   │   ├── executor.py
│   │   └── auditor.py
│   ├── tools/
│   ├── graph.py
│   ├── schemas.py
│   └── main.py
├── subgraph/                   # The Graph subgraph
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/mappings.ts
├── frontend/                   # Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   ├── wagmi.ts
│   │   ├── apollo.ts
│   │   └── ipfs.ts
│   └── public/
├── zk/                         # EZKL differentiator
│   ├── model/
│   ├── circuits/
│   └── verifier/
└── README.md
```

---

## Key Technical Signals (for Interviews)

| What you built | What it signals |
|----------------|-----------------|
| ERC-4337 smart account from scratch | Understands AA, not just using Safe SDK |
| PolicyGuard with Chainlink | Knows how oracles plug into security logic |
| Foundry fuzz + invariant tests | Production security mindset |
| LangGraph multi-node pipeline | Agentic architecture, not a single-prompt hack |
| IPFS CID in ActionLog events | Understands verifiability as a first-class concern |
| Pimlico bundler + paymaster | Has touched actual AA infra, not just read the EIP |
| Subgraph indexing | Standard indexer workflow, day-one-intern skill demonstrated |
| EZKL ZK attestation (toy) | Awareness of the trust gap problem in AI agents |

---

## Name

**Sentinel** — infrastructure-grade, implies watchfulness and constraint enforcement, no meme-coin connotations.

Alternatives on the shelf: Argos, Verdict, Accord.

---

## Deployment Targets

- Contracts: Base Sepolia (testnet), upgrade path to Base mainnet documented
- Agent: local cron for demo, Docker image for portability
- Frontend: Vercel
- Subgraph: The Graph Subgraph Studio → decentralized network
