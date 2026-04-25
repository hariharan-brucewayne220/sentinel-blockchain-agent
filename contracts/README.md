# Sentinel Contracts

ERC-4337 smart contract suite for the Sentinel verifiable AI portfolio agent, deployed on Base Sepolia.

## Contracts

| Contract | Description |
|---|---|
| `SentinelAccount.sol` | UUPS upgradeable ERC-4337 smart account. Calls PolicyGuard before executing any swap and emits an ActionLog event with the IPFS reasoning CID. |
| `PolicyGuard.sol` | Enforces 5 on-chain rules: max trade size (USD), daily drawdown limit, cooldown period, token whitelist, and max slippage. Uses Chainlink price feeds. |
| `ActionLog.sol` | Append-only audit log. Emits `ActionExecuted` with the IPFS CID — indexed by the subgraph. |
| `SentinelPaymaster.sol` | ERC-4337 paymaster that sponsors gas for registered SentinelAccount addresses. |
| `PolicyVerifier.sol` | ZK verifier for the drawdown check (placeholder — replace with EZKL output). |

## Deployed Addresses (Base Sepolia)

| Contract | Address |
|---|---|
| SentinelAccount (proxy) | `0x287326DDFf84973f9D23e6495cc9d727F14f7F34` |
| SentinelAccount (impl) | `0x6297e4A4066FD502D714898407002Ec6ac82f4DC` |
| PolicyGuard | `0xC0375319E7623041875ee485D84A652Da2A36B73` |
| ActionLog | `0x0868A14343fA9A5F12ACdCc716e9f072ec0C0bb4` |
| SentinelPaymaster | `0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

## Commands

```bash
forge build                    # compile
forge test                     # run all tests (target: >90% coverage)
forge test --fuzz-runs 10000   # invariant/fuzz suite
forge coverage                 # coverage report

# Deploy to Base Sepolia
PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org --broadcast
```

## Policy Rules

| Rule | Default |
|---|---|
| Max trade size | $10,000 USD |
| Daily drawdown | $1,000 USD |
| Cooldown | 5 minutes per token pair |
| Token whitelist | Configured by owner |
| Max slippage | 50 bps (0.5%) |
