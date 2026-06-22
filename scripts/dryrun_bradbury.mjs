// Dry-run Proof of Credit contract methods on bradbury via simulateWriteContract.
// Catches Python tracebacks BEFORE we burn GEN on consensus.
import { createClient, createAccount, chains } from 'genlayer-js'
import { readFileSync } from 'node:fs'

const DEPLOYER_KEY =
  process.env.DEPLOYER_KEY ||
  '0x3c1f912cbe634d01478615bfda709e7fd753327b0ae34fcf9b33c9b2c0921a07'
const DEMO_KEY =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

// Use the most recent deployed contract on bradbury (0x7Dc0... is studionet, we need the new bradbury one)
// For dry-run purposes, we just need ANY deployed contract on bradbury with the same code.
// But simulateWriteContract doesn't need an existing contract - it runs the code in a sandbox.
// However the SDK might require a valid address; let's check by trying without one first.

const client = createClient({ chain: chains.testnetBradbury })
const deployer = createAccount(DEPLOYER_KEY)
const demo = createAccount(DEMO_KEY)

const code = readFileSync('/root/proof-of-credit/contracts/proof_of_credit.py', 'utf8')

// The simplest test: deploy first (dry-run), see if it succeeds.
console.log('=== simulateWriteContract on DEPLOY (not enough info) ===')
console.log('Skipping deploy simulate - going straight to method sim.')

const profile = {
  applicant: demo.address,
  annual_income_usd: 85000,
  employment_status: 'full-time software engineer',
  employment_years: 4,
  monthly_debt_usd: 800,
  credit_history_years: 9,
  has_bankruptcy: false,
  loan_purpose: 'small business inventory financing',
  loan_amount_requested_usd: 3000,
}

console.log('\n=== Test 1: simulateWriteContract for deposit (no address) ===')
// We don't have a deployed contract yet. We need to deploy first via the real consensus path
// to get a contract address, THEN we can simulate. So the dry-run pattern requires a real
// deployment first.
//
// Alternative: we can use the existing bradbury address from a prior deploy.
// If none exists, just run the real deploy with short polling and see if it accepts.

console.log('No bradbury contract yet — going straight to real deploy via deploy_bradbury.mjs')
console.log('Use the main script.')
