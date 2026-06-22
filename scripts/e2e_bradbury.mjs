// Full E2E on bradbury: deposit, apply, draw, read stats.
// Reuses the already-deployed contract at deploy/bradbury_address.txt
import { createClient, createAccount, chains } from 'genlayer-js'
import { readFileSync } from 'node:fs'

const DEPLOYER_KEY =
  process.env.DEPLOYER_KEY ||
  '0x3c1f912cbe634d01478615bfda709e7fd753327b0ae34fcf9b33c9b2c0921a07'
const DEMO_KEY =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

const CONTRACT = process.env.CONTRACT ||
  readFileSync('/root/proof-of-credit/deploy/bradbury_address.txt', 'utf8').trim()

const deployer = createAccount(DEPLOYER_KEY)
const demo = createAccount(DEMO_KEY)
console.log('Contract:', CONTRACT)
console.log('Deployer:', deployer.address, '| Demo:', demo.address)

const client = createClient({ chain: chains.testnetBradbury, account: deployer })
const demoClient = createClient({ chain: chains.testnetBradbury, account: demo })

async function pollTx(txHash, label) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const r = await client.getTransaction({ hash: txHash }).catch(() => null)
    if (!r) continue
    const vs = r.lastRound?.validatorVotesName
    console.log(`  [${i*5}s] status=${r.statusName} result=${r.txExecutionResultName} votes=${vs}`)
    if (r.statusName === 'ACCEPTED' || r.statusName === 'FINALIZED') return r
    if (r.statusName === 'REJECTED') {
      console.log('REJECTED. Full receipt:')
      console.log(JSON.stringify(r, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 3000))
      throw new Error(`${label} REJECTED`)
    }
  }
  throw new Error(`${label} TIMEOUT`)
}

// 1. Deposit (deployer) — small amount, just enough to seed the pool
console.log('\n=== 1. Deposit 0.01 GEN ===')
const depAmount = 10n ** 16n  // 0.01 GEN
const depTx = await client.writeContract({
  account: deployer,
  address: CONTRACT,
  functionName: 'deposit',
  args: [],
  value: depAmount,
})
console.log('  tx:', depTx)
await pollTx(depTx, 'deposit')

// 2. Apply (demo)
console.log('\n=== 2. Apply for credit (demo) ===')
const profile = {
  applicant: demo.address,
  annual_income_usd: 85000,
  employment_status: 'employed',
  employment_years: 4,
  monthly_debt_usd: 800,
  credit_history_years: 9,
  has_bankruptcy: false,
  loan_purpose: 'business',
  loan_amount_requested_usd: 3000,
}
const applyTx = await demoClient.writeContract({
  account: demo,
  address: CONTRACT,
  functionName: 'apply_for_credit',
  args: [
    85000,           // annual_income_usd
    'employed',      // employment_status
    4,               // employment_years
    100n * 10n ** 18n, // loan_amount_requested (100 GEN, the LLM will pick a sensible limit)
    'business',      // loan_purpose
    9600,            // existing_debt_usd (800/mo * 12)
    false,           // has_bankruptcy
    false,           // has_delinquencies
    0,               // prior_onchain_repayments
    'small business inventory financing for Q4 stock purchase', // notes
  ],
})
console.log('  tx:', applyTx)
await pollTx(applyTx, 'apply')

// Read the application
const appsRaw = await demoClient.readContract({
  address: CONTRACT,
  functionName: 'get_recent_applications',
  args: [10n, 0n],
})
const apps = typeof appsRaw === 'string' ? JSON.parse(appsRaw) : appsRaw
const mine = apps.applications
  .map(e => typeof e === 'string' ? JSON.parse(e) : e)
  .filter(a => a.applicant?.toLowerCase() === demo.address.toLowerCase())
  .sort((a, b) => b.id - a.id)[0]
console.log(`  Application #${mine.id}: status=${mine.status} score=${mine.credit_score} limit=${mine.max_credit_limit} rate=${mine.interest_rate_bps}bps`)
console.log(`  reasoning: ${mine.reasoning}`)

if (mine.status !== 'approved') {
  console.log('Not approved — cannot draw. Exit.')
  process.exit(0)
}

// 3. Draw loan
console.log('\n=== 3. Draw 0.005 GEN ===')
const drawAmt = 5n * 10n ** 15n  // 0.005 GEN — small enough to stay within credit limit
const drawTx = await demoClient.writeContract({
  account: demo,
  address: CONTRACT,
  functionName: 'draw_loan',
  args: [BigInt(mine.id), drawAmt],
})
console.log('  tx:', drawTx)
await pollTx(drawTx, 'draw')

// 4. Read final state
console.log('\n=== 4. Final state ===')
const stats = await demoClient.readContract({
  address: CONTRACT,
  functionName: 'get_protocol_stats',
  args: [],
})
console.log('  Stats:', stats)

const loans = await demoClient.readContract({
  address: CONTRACT,
  functionName: 'get_active_loans',
  args: [10n, 0n],
})
console.log('  Active loans:', loans)

console.log('\n=== BRADBURY E2E COMPLETE ===')
console.log('Contract:', CONTRACT)
