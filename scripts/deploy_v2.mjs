// Deploy the v2 contract (no unused lender_deposit_share) to bradbury
import { createClient, createAccount, chains } from 'genlayer-js'
import { readFileSync, writeFileSync } from 'node:fs'

const DEPLOYER_KEY =
  process.env.DEPLOYER_KEY ||
  '0x3c1f912cbe634d01478615bfda709e7fd753327b0ae34fcf9b33c9b2c0921a07'
const deployer = createAccount(DEPLOYER_KEY)
console.log('Deployer:', deployer.address)

const client = createClient({ chain: chains.testnetBradbury, account: deployer })
const code = readFileSync('/root/proof-of-credit/contracts/proof_of_credit_v2.py', 'utf8')
console.log('Contract size:', code.length, 'bytes')

const txHash = await client.deployContract({
  account: deployer,
  code,
  args: [],
})
console.log('Deploy tx:', txHash)

let receipt
let contractAddress
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 5000))
  try {
    receipt = await client.getTransaction({ hash: txHash })
  } catch (e) { continue }
  console.log(`  [${i*5}s] status=${receipt?.statusName} result=${receipt?.txExecutionResultName} addr=${receipt?.contractAddress ?? '?'}`)
  if (receipt?.statusName === 'ACCEPTED' || receipt?.statusName === 'FINALIZED') {
    contractAddress = receipt.contractAddress ?? receipt.to
    break
  }
  if (receipt?.statusName === 'REJECTED') {
    writeFileSync('/root/proof-of-credit/deploy/v2_receipt.json', JSON.stringify(receipt, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
    process.exit(1)
  }
}

if (!contractAddress) {
  console.error('No address:', JSON.stringify(receipt, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 2000))
  process.exit(1)
}
console.log('\nContract:', contractAddress)
writeFileSync('/root/proof-of-credit/deploy/bradbury_address.txt', contractAddress)
