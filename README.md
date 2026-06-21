# Proof of Credit — AI Undercollateralized Lending on GenLayer

> Submit a credit profile. Multiple GenLayer validators run LLM evaluation in parallel. Reach consensus on a FICO-like score (300-850). Borrow without collateral.

**Live contract** (GenLayer Studionet): `0xE48AE90997c3060b40678650A668501454feD56a`
**Chain**: GenLayer Studionet (chainId 61999)

## What this is

**Proof of Credit** is an AI-powered undercollateralized lending protocol that solves DeFi's over-collateralization problem.

Traditional DeFi lending requires $150 of collateral to borrow $100. Proof of Credit uses GenLayer's LLM-validator consensus to evaluate borrower creditworthiness on-chain. No credit bureau. No oracle. No collateral. Just an AI-consensus credit score that determines the borrower's line of credit.

### How it works

1. **Borrower submits credit profile** — annual income, employment, loan purpose, debt-to-income ratio, prior on-chain repayment history
2. **5 GenLayer validators run LLM evaluation in parallel** — each independently scores the borrower 300-850 (FICO-like scale)
3. **Equivalence Principle reaches consensus** — validators verify the leader's output is well-formed; the contract deterministically selects the score
4. **Smart contract mints a credit line** — credit limit, APR, max utilization derived from the consensus score
5. **Borrower draws from the pool** — no collateral, just the credit line
6. **Repayment updates credit history** — successful repay bumps score +10, default tanks it -50

### What makes this GenLayer-native

This protocol is the canonical example of GenLayer's value: **subjective, non-deterministic financial decisions that cannot be made by deterministic smart contracts but CAN be made trustworthy through multi-validator consensus**. Credit assessment is inherently subjective — different underwriters would give different scores for the same profile. Traditional blockchain can't do this. GenLayer's Intelligent Contracts + LLM consensus can.

## Repository structure

```
proof-of-credit/
├── contracts/
│   └── proof_of_credit.py       # GenVM intelligent contract (Python)
├── frontend/                     # Vite + React + TypeScript SPA
│   └── src/
│       ├── pages/                # 8 pages
│       ├── services/             # genlayer-js + contract wrappers
│       └── styles/               # lab-instrument CSS
├── tests/
│   └── test_proof_of_credit.py   # 26 unit tests (mock-genlayer pattern)
├── scripts/                      # Deployment + walkthrough recorder
└── docs/media/                   # Walkthrough video
```

## Quickstart

```bash
# 1. Run tests (mock-genlayer)
pip install pytest
python3 -m pytest tests/

# 2. Build + run frontend
cd frontend
npm install
npm run dev   # http://localhost:5175
```

## On-chain verification

```bash
# Get protocol stats
genlayer call 0xE48AE90997c3060b40678650A668501454feD56a get_protocol_stats \
  --rpc https://studio.genlayer.com/api

# Get latest application
genlayer call 0xE48AE90997c3060b40678650A668501454feD56a get_application \
  --args 1 \
  --rpc https://studio.genlayer.com/api
```

## Live walkthrough

See `docs/media/poc-walkthrough.mp4` for a complete walkthrough recording (Dashboard → Deposit → Apply → AI Consensus → Credit Score → Draw Loan → Profile).

## License

MIT
