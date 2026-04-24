# Sentinel — Research Backing

Papers and findings that inform each module's design. Where research contradicts the current spec, the spec section below notes the correction.

---

## 1. ERC-4337 / Account Abstraction

### Primary Specification
**ERC-4337: Account Abstraction Using Alt Mempool**
Authors: Vitalik Buterin, Yoav Weiss, Dror Tirosh, Shahaf Nacson et al. (2021, deployed mainnet March 2023)
- https://eips.ethereum.org/EIPS/eip-4337

Defines the full UserOperation struct, EntryPoint contract interface, Bundler protocol, and Paymaster design. Everything Sentinel builds on sits in this EIP. Key validation rules in `validateUserOp` are mandatory — including the `nonce` anti-replay scheme and the two-phase `validateUserOp` / `executeUserOp` separation.

**Adoption numbers (2024):** 40M+ smart accounts deployed, 100M+ UserOperations processed — the standard is production-mature, not experimental.

---

## 2. Autonomous AI Agents on Blockchains

### Survey Paper (317 papers systematized)
**"Autonomous Agents on Blockchains: Standards, Execution Models, and Trust Boundaries"**
arxiv: https://arxiv.org/abs/2601.04583

#### Execution Model Taxonomy (5 levels)
The paper defines a five-tier capability ladder. Sentinel sits at **Level 4 — Autonomous Signing**:

| Level | Name | Description |
|-------|------|-------------|
| 1 | Read-only analytics | Agent reads chain state, no writes |
| 2 | Simulation & intent generation | Agent proposes actions, human executes |
| 3 | Delegated execution | Agent executes pre-approved playbooks |
| **4** | **Autonomous signing** | **Agent signs and submits UserOperations** |
| 5 | Multi-agent workflows | Agents coordinate across protocols |

This taxonomy is directly useful for README framing and interview pitching: "Sentinel operates at execution level 4 per the 2025 agent-blockchain standards survey."

#### Two Core Interface Abstractions
The paper proposes exactly two primitives for verifiable agent-blockchain interaction:
1. **Transaction Intent Schema** — portable specification of agent goals (maps to Sentinel's `ProposedAction` Pydantic model)
2. **Policy Decision Record** — auditable, verifiable enforcement of policies (maps to Sentinel's ActionLog + IPFS reasoning blob)

**This is direct academic validation that Sentinel's architecture follows the emerging standard.**

#### Threat Model (apply to Sentinel design)
- **Prompt injection** — malicious content in retrieved news/docs hijacks Researcher node (OWASP LLM #1, 2025)
- **Policy misuse** — agent finds loophole in PolicyGuard rules to bypass intent
- **Key compromise** — agent signing key exfiltration enables unauthorized UserOperations
- **Multi-agent collusion** — not applicable to Sentinel v1 (single agent)

---

## 3. Autonomous AI Agents in DeFi

### Peer-Reviewed Paper
**"Autonomous AI Agents in Decentralized Finance: Market Dynamics, Application Areas, and Theoretical Implications"**
Lennart Ante, Blockchain Research Lab (December 2024)
- arxiv/ScienceDirect: https://arxiv.org/pdf/2601.04583 (related), ScienceDirect: https://www.sciencedirect.com/science/article/pii/S0040162526001460

Key findings:
- Portfolio rebalancing and yield optimization are the dominant application area
- Agents dynamically rebalancing across Aave, Compound, Uniswap pools — factoring APY, gas, and risk — is the core use case
- Grid strategy agents have achieved >70% win rates in backtesting
- The paper identifies three required layers: **infrastructural** (wallets, RPC), **behavioral** (LLM + tools), **governance** (policy enforcement) — all three are present in Sentinel

### Survey: AI Agents × Blockchain Security
**"AI Agents Meet Blockchain: A Survey on Secure and Scalable Collaboration for Multi-Agents"**
- https://agentai-bc.github.io/

Key architecture findings:
- Blockchain provides: decentralized governance, immutable audit trails, cryptographic safeguards
- Novel consensus primitives proposed: **Proof-of-Thought (PoT)** and **Proof-of-Compute (PoC)** — relevant to ZK differentiator framing
- Privacy-preserving AI-agent coordination identified as the primary research gap (Sentinel's ZK layer addresses this)

---

## 4. ZKML — Verifiable AI Inference

### Survey (Feb 2025)
**"A Survey of Zero-Knowledge Proof Based Verifiable Machine Learning"**
arxiv: https://arxiv.org/abs/2502.18535

#### Framework Comparison

| Framework | Proof System | Trusted Setup? | Best For |
|-----------|-------------|----------------|---------|
| EZKL | Halo2 | **No** | ONNX models, developer-friendly |
| zkCNN | Custom GKR | No | CNN inference |
| zkDL | zk-SNARK R1CS | Yes (KZG) | General NNs |
| Halo2-based | Halo2 | **No** | Custom circuits |

**EZKL with Halo2 backend = no trusted setup ceremony required.** This is the correct choice for Sentinel.

#### Performance Benchmarks (relevant to Sentinel's drawdown check)
| Circuit | Proof Gen Time | Proof Size |
|---------|---------------|------------|
| Decision tree (23 levels, 1029 nodes) | 250s | 287 KB |
| MobileNet v2 (neural net) | 10.27s | 5,952 bytes |
| VGG16 (full CNN) | 88.3s | 341 KB |

For Sentinel's drawdown check (single integer comparison), expect:
- Proof generation: **< 10 seconds** (far simpler than any of the above)
- Proof size: **< 1 KB** (no matrix multiplications, no activations)
- On-chain verification: **~200k gas** (standard Halo2 verifier contract estimate)

#### Efficiency Optimization
ZEN framework achieves **73.9x savings in R1CS constraints** for convolution kernels — not directly applicable to our simple circuit but relevant if ZK scope expands.

### Paper: Verifiable ML Evaluations with zkSNARKs
**"Verifiable Evaluations of Machine Learning Models Using zkSNARKs"**
Tobin South et al. (Feb 2024)
arxiv: https://arxiv.org/abs/2402.02675

- Proves models with **fixed private weights** achieve stated performance metrics over public inputs
- Critical insight: "benchmark results are impossible to verify without re-performing them on black-box outputs" — exactly the problem Sentinel's ZK layer solves for policy compliance
- Addresses the trust gap: you can claim your agent ran the policy check, but without ZK you can't prove it

### Paper: ZK Proof of Inference (Nov 2025)
**"Zero-Knowledge Proof Based Verifiable Inference of Models"**
arxiv: https://arxiv.org/abs/2511.19902

- Recursively composed zkSNARKs, **no trusted setup**
- Constant-size proofs via Fiat-Shamir heuristic
- Supports: matrix multiplication, normalization, softmax, SiLU activations
- Reference implementation: ZK-DeepSeek (full SNARK-verifiable DeepSeek model)
- Key takeaway: what Sentinel does (prove a comparison) is the simplest possible ZKML circuit — if full LLM inference is provable, a drawdown check absolutely is

### Framework: End-to-End Verifiable AI Pipelines
**"Framework for End-to-End Verifiable AI Pipelines"**
arxiv: https://arxiv.org/html/2503.22573v1

Defines the primitive Sentinel uses: **ZKPoI (Zero-Knowledge Proof of Inference)** — proves "a specific ML model has made a correct inference on a given input."

Six-stage pipeline:
1. Raw dataset verification (ZKPoF)
2. Data extraction & analysis
3. Model training (ZKPoT)
4. Model evaluation
5. **Model inference (ZKPoI) ← Sentinel implements this stage**
6. Machine unlearning (ZKPoU)

**Sentinel implements Stage 5 of the academic pipeline.** This is the exact terminology to use in the README and interviews.

---

## 5. Hybrid RAG for Financial Data

### Benchmark Paper
**"From BM25 to Corrective RAG: Benchmarking Retrieval Strategies for Text-and-Table Documents"**
arxiv: https://arxiv.org/abs/2604.01733

Benchmarked 10 retrieval strategies on a financial QA dataset (23,088 queries, 7,318 documents):

| Strategy | Recall@5 | MRR@3 |
|----------|----------|-------|
| Dense only | 0.587 | — |
| BM25 only | 0.644 | — |
| Hybrid RRF (BM25 + dense) | 0.695 | — |
| **Hybrid + neural reranking** | **0.816** | **0.605** |

**Use hybrid RRF + cross-encoder reranker, not just BM25 + pgvector.**

### Critical Warning: HyDE Limitations for Finance
**"Enhancing Financial RAG with Agentic AI and Multi-HyDE"**
arxiv: https://arxiv.org/abs/2509.16369

**Plain HyDE fails for financial data.** LLMs generating pseudo-documents for financial queries fabricate plausible but numerically incorrect figures, pulling embeddings *away* from correct context. This is a known failure mode.

**Fix:** Use **Multi-HyDE** (multiple hypothetical documents + BM25 fusion) instead of single HyDE. The spec's current `rag_search` tool should implement Multi-HyDE, not plain HyDE.

---

## 6. AI Agent Guardrails and Policy Enforcement

### Industry Standards
**"Agentic AI Safety Playbook 2025"** — https://dextralabs.com/blog/agentic-ai-safety-playbook-guardrails-permissions-auditability/

Key design principles that Sentinel implements:
- **Permissions** = machine-enforceable roles-and-responsibilities contracts → `PolicyGuard.sol`
- **Auditability** = captures exactly what the agent did, why, and how it arrived at decisions → `ActionLog.sol` + IPFS blob
- Pattern: "Policy-as-Code" (Open Policy Agent for off-chain, smart contracts for on-chain)

Regulatory note: EU AI Act (in force August 2024, high-risk obligations from August 2026) requires audit trails for autonomous systems — Sentinel's ActionLog + IPFS design satisfies this requirement.

### OWASP LLM Top 10 (2025) — Applied to Sentinel

| OWASP Risk | Applies to Sentinel | Mitigation |
|-----------|---------------------|------------|
| LLM01: Prompt Injection | **YES** — Researcher node fetches external news | Sanitize retrieved docs before passing to Strategist; don't include raw HTML |
| LLM06: Excessive Agency | **YES** — agent can sign UserOperations | PolicyGuard hard caps + cooldown period |
| LLM09: Misinformation | YES — Strategist generates rationale | Structured output (Pydantic) constrains hallucination scope |

---

## 7. Coinbase AgentKit Reference Implementation

**"AgentKit"** — https://github.com/coinbase/agentkit

The closest production reference to Sentinel. Key architectural parallels:
- CDP Smart Wallet API = gasless transactions via Paymaster (same pattern as Sentinel)
- Framework-agnostic design = Sentinel uses LangGraph but agent core is framework-swappable
- Multi-agent architecture + framework-native guardrails (Q1 2025 update)

Key difference: AgentKit uses CDP's managed infrastructure; Sentinel builds the infrastructure layer itself (Pimlico, custom Paymaster, custom PolicyGuard) — which is the point for demonstrating depth.

---

## Summary: Papers to Cite

| Concept | Paper | arxiv/URL |
|---------|-------|-----------|
| Autonomous agents on blockchain (taxonomy + trust) | Autonomous Agents on Blockchains | https://arxiv.org/abs/2601.04583 |
| AI agents in DeFi (applications + risks) | Ante 2024 DeFi AI Agents | https://www.sciencedirect.com/science/article/pii/S0040162526001460 |
| ZKML survey (framework comparison) | ZKML Survey 2025 | https://arxiv.org/abs/2502.18535 |
| ZK inference proofs | ZK Verifiable Inference | https://arxiv.org/abs/2511.19902 |
| Verifiable ML evaluations | South et al. 2024 | https://arxiv.org/abs/2402.02675 |
| End-to-end verifiable AI pipelines | E2E Verifiable AI | https://arxiv.org/abs/2503.22573 |
| Financial RAG benchmarks | BM25 to Corrective RAG | https://arxiv.org/abs/2604.01733 |
| HyDE failure on financial data | Multi-HyDE 2025 | https://arxiv.org/abs/2509.16369 |
| Multi-agent blockchain security | AgentAI-BC Survey | https://agentai-bc.github.io/ |
