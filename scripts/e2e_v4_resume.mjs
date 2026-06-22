// Resume E2E from deposit — just run apply + draw given the deposit just landed
import { createClient, createAccount, chains } from 'genlayer-js'
import { readFileSync } from 'node:fs'

const DEPLOYER_KEY =
  process.env.DEPLOYER_KEY ||
  '0x3c1f912cbe634d01478615bfda709e7fd753327b0ae34fcf9b33c9b2c0921a07'
const DEMO_KEY =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

const CONTRACT = process.env.CONTRACT ||
  readFileSync('/root/proof-of-credit/deploy/bradbury_address_v4.txt', 'utf8').trim()

const deployer = createAccount(DEPLOYER_KEY)
const demo = createAccount(DEMO_KEY)
const client = createClient({ chain: chains.testnetBradbury, account: deployer })
const demoClient = createClient({ chain: chains.testnetBradbury, account: demo })

async function pollTx(txHash, label, maxWaitSec = 600) {
  const iters = Math.ceil(maxWaitSec / 5)
  for (let i = 0; i < iters; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const r = await client.getTransaction({ hash: txHash }).catch(() => null)
    if (!r) continue
    console.log(`  [${i*5}s] ${label} status=${r.statusName} result=${r.txExecutionResultName} votes=${r.lastRound?.validatorVotesName}`)
    if (r.statusName === 'ACCEPTED' || r.statusName === 'FINALIZED') return r
    if (r.statusName === 'REJECTED') {
      console.log('REJECTED — full receipt:')
      console.log(JSON.stringify(r, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 2000))
      throw new Error(`${label} REJECTED`)
    }
  }
  throw new Error(`${label} TIMEOUT`)
}

// 1. Wait for the deposit to land
const depTx = process.argv[2]
if (depTx) {
  console.log('=== Waiting for deposit tx ===')
  await pollTx(depTx, 'deposit', 300)
}

// 2. Apply
console.log('\n=== 2. Apply (demo) ===')
const applyTx = await demoClient.writeContract({
  account: demo,
  address: CONTRACT,
  functionName: 'apply_for_credit',
  args: [
    85000, 'employed', 4, 100n * 10n ** 18n, 'business', 9600,
    false, false, 0, 'small business inventory financing for Q4 stock purchase',
  ],
})
console.log('  tx:', applyTx)
let appReceipt
try {
  appReceipt = await pollTx(applyTx, 'apply', 900)
} catch (e) {
  console.log('Apply failed:', e.message)
  process.exit(1)
}

// Read application
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
console.log(`App #${mine?.id}: status=${mine?.status} score=${mine?.credit_score} limit=${mine?.max_credit_limit}`)

if (!mine || mine.status !== 'approved') {
  console.log('Not approved — exit.')
  process.exit(0)
}

// 3. Draw
console.log('\n=== 3. Draw 0.005 GEN ===')
const drawAmt = 5n * 10n ** 15n
const drawTx = await demoClient.writeContract({
  account: demo,
  address: CONTRACT,
  functionName: 'draw_loan',
  args: [BigInt(mine.id), drawAmt],
})
try {
  await pollTx(drawTx, 'draw', 600)
} catch (e) {
  console.log('Draw failed:', e.message)
}

// 4. Final state
console.log('\n=== 4. Final state ===')
try {
  const stats = await demoClient.readContract({
    address: CONTRACT,
    functionName: 'get_protocol_stats',
    args: [],
  })
  console.log('Stats:', stats)
} catch (e) { console.log('Stats read failed:', e.message) }

console.log('\n=== E2E COMPLETE ===')
