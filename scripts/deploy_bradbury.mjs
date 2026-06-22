// Deploy Proof of Credit to bradbury. Poll until ACCEPTED, write the address.
import { createClient, createAccount, chains } from 'genlayer-js'
import { readFileSync, writeFileSync } from 'node:fs'

const DEPLOYER_KEY =
  process.env.DEPLOYER_KEY ||
  '0x3c1f912cbe634d01478615bfda709e7fd753327b0ae34fcf9b33c9b2c0921a07'
const deployer = createAccount(DEPLOYER_KEY)
console.log('Deployer:', deployer.address)

const client = createClient({ chain: chains.testnetBradbury, account: deployer })
const bal = await client.getBalance({ address: deployer.address })
console.log('Balance (GEN):', Number(bal) / 1e18)

const code = readFileSync('/root/proof-of-credit/contracts/proof_of_credit.py', 'utf8')

console.log('Deploying (bradbury consensus 2-8 min)...')
const txHash = await client.deployContract({
  account: deployer,
  code,
  args: [deployer.address],
})
console.log('Deploy tx:', txHash)

let receipt
let contractAddress
for (let i = 0; i < 90; i++) {
  await new Promise(r => setTimeout(r, 6000))
  try {
    receipt = await client.getTransaction({ hash: txHash })
  } catch (e) {
    console.log(`  [${i*6}s] poll err: ${e.shortMessage ?? e.message}`)
    continue
  }
  const s = receipt?.statusName
  const r = receipt?.txExecutionResultName
  const votes = receipt?.lastRound?.validatorVotesName
  console.log(`  [${i*6}s] status=${s} result=${r} votes=${votes}`)
  if (receipt?.statusName === 'ACCEPTED' || receipt?.statusName === 'FINALIZED') {
    contractAddress =
      receipt.contractAddress ??
      receipt.to ??
      receipt.recipient ??  // bradbury uses 'recipient' for the deployed address
      receipt.data?.to
    break
  }
  if (s === 'REJECTED') {
    console.log('REJECTED. Full receipt:')
    console.log(JSON.stringify(receipt, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
    process.exit(1)
  }
}

if (!contractAddress) {
  // Try the receipt method too
  const txr = await client.getTransactionReceipt({ hash: txHash }).catch(() => null)
  contractAddress = txr?.contractAddress ?? txr?.to
}
if (!contractAddress) {
  console.error('No contractAddress in receipt. Saving full receipt for inspection.')
  writeFileSync('/root/proof-of-credit/deploy/receipt.json', JSON.stringify(receipt, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
  process.exit(1)
}

console.log('\nContract deployed at:', contractAddress)

// Persist
const ENV_PATH = '/root/proof-of-credit/frontend/.env'
let env = readFileSync(ENV_PATH, 'utf8')
env = env.replace(/VITE_POC_CONTRACT_ADDRESS=.*/g, `VITE_POC_CONTRACT_ADDRESS=${contractAddress}`)
env = env.replace(/VITE_POC_NETWORK=.*/g, 'VITE_POC_NETWORK=bradbury')
if (!env.includes('VITE_POC_NETWORK')) env += '\nVITE_POC_NETWORK=bradbury'
if (!env.includes('VITE_POC_CONTRACT_ADDRESS'))
  env = `VITE_POC_CONTRACT_ADDRESS=${contractAddress}\n` + env
writeFileSync(ENV_PATH, env)
writeFileSync('/root/proof-of-credit/deploy/bradbury_address.txt', contractAddress)
console.log('Wrote', ENV_PATH, 'and deploy/bradbury_address.txt')
