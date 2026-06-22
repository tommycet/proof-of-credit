# Proof of Credit — AI Undercollateralized Lending on GenLayer

> Submit a credit profile. Multiple GenLayer validators run LLM evaluation in parallel. Reach consensus on a FICO-like score (300-850). Borrow without collateral.

**Live contracts**:
- **Bradbury testnet** (chainId 4221): `0x91D47d9Ea6a943a432eECb6F8f2EbC9b0D79FFBC`
- Studionet (chainId 61999, gas-free): `0xE48AE90997c3060b40678650A668501454feD56a`

The frontend is currently pointed at the Bradbury contract. Set `VITE_POC_NETWORK=studionet` to use the gas-free network.

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

## Live deployment

- **Frontend**: https://proof-of-credit-five.vercel.app (points at Bradbury by default)
- **GitHub**: https://github.com/tommycet/proof-of-credit
- **Bradbury contract**: `0x91D47d9Ea6a943a432eECb6F8f2EbC9b0D79FFBC` (chainId 4221)
- **Studionet contract**: `0xE48AE90997c3060b40678650A668501454feD56a` (chainId 61999, gas-free)
- **Walkthrough video**: see `docs/media/poc-walkthrough.mp4` (or in README on GitHub)

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

<video src="docs/media/poc-walkthrough.mp4" controls width="100%"></video>

## End-to-end flow verified on-chain

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. LENDER DEPOSITS GEN INTO POOL                                    │
│     deposit() — pool_balance increases, total_deposited increments   │
├──────────────────────────────────────────────────────────────────────┤
│  2. BORROWER SUBMITS CREDIT PROFILE                                   │
│     apply_for_credit(...) → 5 LLM validators evaluate in parallel     │
│     Equivalence Principle consensus → 300-850 score + credit line     │
├──────────────────────────────────────────────────────────────────────┤
│  3. BORROWER DRAWS LOAN AGAINST CREDIT LINE                           │
│     draw_loan(app_id, amount) — pool debits, loan status=active       │
├──────────────────────────────────────────────────────────────────────┤
│  4. BORROWER REPAYS                                                    │
│     repay_loan(loan_id) — principal + interest → pool, score +10     │
├──────────────────────────────────────────────────────────────────────┤
│  5. DEFAULT (if past deadline)                                        │
│     liquidate_defaulted_loan(loan_id) — score -50, public liquidation │
└──────────────────────────────────────────────────────────────────────┘
```

## Bradbury testnet notes

This contract was originally developed on GenLayer Studionet (chainId 61999, gas-free). It was then deployed to the real **Bradbury testnet** (chainId 4221) where validators must reach consensus on actual GEN-staked transactions.

### What works on Bradbury

- **Contract deploy** — the bytecode deploys cleanly to Bradbury; a contract on-chain receives and stores state
- **Lender deposits** — `deposit()` accepts value transfers and credits the lender's share (5/5 AGREE on every call)
- **Credit applications** — `apply_for_credit()` calls `gl.eq_principle.prompt_non_comparative` to run LLM consensus on a borrower's profile. The leader LLM produces a score; validators verify the structural validity of the JSON output

### Known consensus behaviour

On bradbury, the LLM credit-scoring step is **non-deterministic** — different validators running their own LLM calls produce different scores for the same profile. The leader's prompt returns a single value but validators compare against their own, which frequently yields 4–5× `DETERMINISTIC_VIOLATION` votes in a single round. The Equivalence Principle then rotates to a new leader for a fresh round, which may or may not converge within 3 rotations.

The repository ships a `proof_of_credit.py` contract that has been demonstrated end-to-end on the gas-free studionet (with deterministic LLM consensus). The same contract bytecode deploys on bradbury, but the LLM consensus on the credit-application step requires a more deterministic model than what is currently available on the testnet validators.

For deterministic-by-design bradbury demos, the included `scripts/test_draw_v3.mjs` shows a minimal `submit()` + `draw()` flow with full state writes that passes 5/5 AGREE on bradbury with no LLM involvement.

## License

MIT
