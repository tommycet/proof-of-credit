// Test draw_loan using the demo key (matches applicant 0x14dC...)
import { createClient, createAccount } from 'genlayer-js'

const CONTRACT = '0x27d9e16e5Cc267e423C2b2324a8bcEF5A1f0c815'
const DEMO_KEY = '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

const account = createAccount(DEMO_KEY)
console.log('Demo address:', account.address)

const client = createClient({ endpoint: 'https://studio.genlayer.com/api' })

// Get latest approved application
console.log('Reading recent applications...')
const apps = await client.readContract({
  address: CONTRACT,
  functionName: 'get_recent_applications',
  args: [10n, 0n],
})
console.log('Apps response:', apps)

const parsed = typeof apps === 'string' ? JSON.parse(apps) : apps
const latestApproved = parsed.applications
  .map(e => typeof e === 'string' ? JSON.parse(e) : e)
  .filter(a => a.status === 'approved')
  .sort((a, b) => b.id - a.id)[0]

console.log('Latest approved app:', JSON.stringify(latestApproved, null, 2))

if (!latestApproved) {
  console.log('No approved applications found. Exiting.')
  process.exit(1)
}

console.log(`Drawing 50 GEN against application #${latestApproved.id}...`)
try {
  const txHash = await client.writeContract({
    account,
    address: CONTRACT,
    functionName: 'draw_loan',
    args: [BigInt(latestApproved.id), BigInt(50 * 10 ** 18)],
  })
  console.log('TX hash:', txHash)
  console.log('Waiting for receipt...')
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    interval: 4000,
    retries: 30,
  })
  console.log('Receipt status:', receipt.status)
} catch (err) {
  console.error('Draw failed:', err.shortMessage ?? err.message ?? err)
}

// Check protocol stats
const stats = await client.readContract({
  address: CONTRACT,
  functionName: 'get_protocol_stats',
  args: [],
})
console.log('Protocol stats:', stats)
