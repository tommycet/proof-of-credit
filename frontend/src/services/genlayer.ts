/**
 * GenLayer client + wallet integration.
 *
 * Network is controlled by VITE_POC_NETWORK (studionet | bradbury). Defaults to
 * studionet for local demos. bradbury is the real testnet (chainId 4221).
 */

import { createClient, createAccount, chains } from 'genlayer-js'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'

// Contract address — overridable via env, defaults to the most recent deploy
export const POC_CONTRACT_ADDRESS =
  (import.meta as any).env?.VITE_POC_CONTRACT_ADDRESS ||
  '0x7Dc0F27237AEe30Fe5909AD8Bd2d9355B64B1F0C'

// Network selection
const NETWORK = ((import.meta as any).env?.VITE_POC_NETWORK || 'studionet').toLowerCase()
export const POC_NETWORK = NETWORK
export const POC_CHAIN = NETWORK === 'bradbury' ? chains.testnetBradbury : chains.studionet
export const POC_RPC =
  NETWORK === 'bradbury'
    ? 'https://rpc-bradbury.genlayer.com'
    : 'https://rpcstudionet.genlayer.com'

// Fixed demo signer key — same as the well-known lore demo key.
// On studionet this works without a balance because the chain is gas-free.
export const DEMO_PRIVATE_KEY =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

let _client: any = null
let _clientKey: string | null = null

export function getClient(account?: `0x${string}`): any {
  const key = account ?? '__noaccount__'
  if (!_client || _clientKey !== key) {
    _client = createClient({ chain: POC_CHAIN as any, ...(account ? { account } : {}) })
    _clientKey = key
  }
  return _client
}

export function useDemoAccount() {
  return createAccount(DEMO_PRIVATE_KEY as `0x${string}`)
}

export function useRandomDemoAccount() {
  return createAccount(generatePrivateKey())
}

// Format wei → GEN for display
export function formatGEN(wei: bigint | number | string, decimals = 2): string {
  const w = typeof wei === 'bigint' ? wei : BigInt(wei ?? 0)
  const whole = w / 10n ** 18n
  const frac = w % 10n ** 18n
  const fracStr = frac.toString().padStart(18, '0').slice(0, decimals)
  return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fracStr}`
}

// Shorten address for display
export function shortAddr(addr: string | undefined, chars = 4): string {
  if (!addr) return '—'
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`
}

// Format timestamp → relative
export function timeAgo(ts: number | bigint): string {
  const t = Number(ts)
  const diff = Math.floor(Date.now() / 1000 - t)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Time until deadline
export function timeUntil(ts: number | bigint): string {
  const t = Number(ts)
  const diff = t - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'past due'
  if (diff < 3600) return `${Math.floor(diff / 60)}m remaining`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h remaining`
  return `${Math.floor(diff / 86400)}d remaining`
}
