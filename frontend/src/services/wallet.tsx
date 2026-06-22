/**
 * Wallet abstraction for Proof of Credit.
 *
 * Supports four connection modes:
 *   - metamask   : EIP-1193 provider (window.ethereum) — signs via MetaMask
 *   - pk         : User-supplied private key — stored in localStorage
 *   - generated  : Random key generated client-side — stored in localStorage
 *   - demo       : Hardcoded DEMO_PRIVATE_KEY (studionet only — no balance needed)
 *
 * The selected wallet is persisted across reloads in localStorage under
 * POC_WALLET_KEY. The signer is exposed as a viem `Account` so genlayer-js
 * can route writes through it identically regardless of source.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createAccount, generatePrivateKey } from 'genlayer-js'
import type { Hex, EIP1193Provider } from 'viem'
import {
  privateKeyToAccount,
  toAccount,
  type Account,
  type Address,
} from 'viem/accounts'

import { POC_NETWORK, POC_CHAIN, POC_RPC } from './genlayer'

export type WalletKind = 'metamask' | 'pk' | 'generated' | 'demo'

export interface WalletInfo {
  kind: WalletKind
  address: Address
  /** short human label, e.g. "MetaMask" / "Imported" / "Generated #a3f…" / "Demo" */
  label: string
  /** A short prefix shown in the pill (max 6 chars), e.g. "META", "KEY", "GEN", "DEMO" */
  badge: string
  /** True if this wallet has no signing authority (demo on bradbury will fail) */
  readOnly?: boolean
}

const STORAGE_KEY = 'POC_WALLET'

// Hardcoded demo signer — same as the well-known lore demo key. Works on studionet
// because that chain is gas-free. On bradbury this wallet has no balance, so
// write calls will revert; the UI shows this as "demo (read-only)".
const DEMO_PRIVATE_KEY =
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356'

// Bradbury chain config for MetaMask `wallet_addEthereumChain`
const BRADBURY_CHAIN_ID_HEX = '0x1081' // 4221
const BRADBURY_RPC = 'https://rpc-bradbury.genlayer.com'

function readStored(): WalletKind | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { kind?: WalletKind }
    return parsed.kind ?? null
  } catch {
    return null
  }
}

function writeStored(kind: WalletKind | null) {
  try {
    if (kind) localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind }))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore quota errors */
  }
}

interface StoredKey {
  kind: 'pk' | 'generated'
  privateKey: Hex
}
const STORED_KEY = 'POC_WALLET_KEY'

function readStoredKey(): StoredKey | null {
  try {
    const raw = localStorage.getItem(STORED_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredKey
  } catch {
    return null
  }
}

function writeStoredKey(k: StoredKey | null) {
  try {
    if (k) localStorage.setItem(STORED_KEY, JSON.stringify(k))
    else localStorage.removeItem(STORED_KEY)
  } catch {
    /* ignore */
  }
}

// ============================================================================
// MetaMask account wrapper
// ============================================================================

/**
 * Build a viem `Account` that signs via an EIP-1193 provider (MetaMask).
 * Used by genlayer-js when the provider doesn't directly accept an Account.
 */
function metamaskAccount(provider: EIP1193Provider, address: Address): Account {
  return toAccount({
    address,
    async signMessage({ message }) {
      const msg = typeof message === 'string' ? message : (message as { raw: Hex }).raw
      return provider.request({
        method: 'personal_sign',
        params: [msg, address],
      }) as Promise<Hex>
    },
    async signTransaction(transaction) {
      // For GenLayer consensus writes we don't need raw signed tx —
      // genlayer-js wraps provider for the actual `eth_sendTransaction`.
      return provider.request({
        method: 'eth_signTransaction',
        params: [transaction, address],
      }) as Promise<Hex>
    },
    async signTypedData(typedData) {
      return provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      }) as Promise<Hex>
    },
  })
}

// ============================================================================
// EIP-1193 detection
// ============================================================================

declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      isMetaMask?: boolean
      providers?: Array<EIP1193Provider & { isMetaMask?: boolean }>
    }
  }
}

export function detectMetaMask(): (EIP1193Provider & { isMetaMask?: boolean }) | null {
  if (typeof window === 'undefined') return null
  if (window.ethereum?.isMetaMask) return window.ethereum
  // Some wallets inject under .providers[]
  const fromList = window.ethereum?.providers?.find((p) => p.isMetaMask)
  if (fromList) return fromList
  return null
}

// ============================================================================
// Context
// ============================================================================

interface WalletContextValue {
  wallet: WalletInfo | null
  account: Account | null
  /** Signer suitable for genlayer-js createClient — falls back to address-only when read-only */
  signer: Account | Address | null

  /** Connect to MetaMask, prompts user, switches to bradbury */
  connectMetaMask(): Promise<void>
  /** Import an existing private key */
  importPrivateKey(pk: Hex): void
  /** Generate a brand-new wallet, persists to localStorage */
  generateWallet(): { address: Address; privateKey: Hex }
  /** Switch back to the demo wallet */
  useDemoWallet(): void
  /** Forget the wallet */
  disconnect(): void
  /** Refresh balance for the current wallet */
  refreshBalance(): Promise<void>
  balanceGEN: string
  hasMetaMask: boolean
  isConnecting: boolean
  connectError: string | null
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [signer, setSigner] = useState<Account | Address | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [balanceGEN, setBalanceGEN] = useState<string>('—')

  const hasMetaMask = useMemo(() => !!detectMetaMask(), [])

  // ---- Restore from storage on mount ----
  useEffect(() => {
    const stored = readStored()
    if (!stored) return
    try {
      if (stored === 'demo') {
        activateDemo()
      } else if (stored === 'pk' || stored === 'generated') {
        const k = readStoredKey()
        if (k) activateStoredKey(k.kind, k.privateKey)
      }
      // MetaMask can't be auto-restored without user interaction — user must click again.
    } catch (err: any) {
      console.warn('[wallet] failed to restore', err?.message ?? err)
      writeStored(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Listen to MetaMask account/chain changes ----
  useEffect(() => {
    const mm = detectMetaMask()
    if (!mm) return
    const onAccountsChanged = (accounts: Address[]) => {
      if (wallet?.kind !== 'metamask') return
      if (accounts.length === 0) {
        disconnect()
      } else {
        activateMetaMaskAccount(mm, accounts[0])
      }
    }
    const onChainChanged = () => {
      // Force a reload so the genlayer-js client picks up the new chain.
      // (Chain-aware client instances are cached; safest to restart.)
      window.location.reload()
    }
    mm.on?.('accountsChanged', onAccountsChanged)
    mm.on?.('chainChanged', onChainChanged)
    return () => {
      mm.removeListener?.('accountsChanged', onAccountsChanged)
      mm.removeListener?.('chainChanged', onChainChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.kind])

  // ---- Activation helpers ----

  function activateDemo() {
    const a = createAccount(DEMO_PRIVATE_KEY as Hex)
    const addr = a.address as Address
    setAccount(a)
    setSigner(a)
    setWallet({
      kind: 'demo',
      address: addr,
      label: 'Demo',
      badge: 'DEMO',
      readOnly: POC_NETWORK === 'bradbury',
    })
    writeStored('demo')
  }

  function activateStoredKey(kind: 'pk' | 'generated', pk: Hex) {
    const a = privateKeyToAccount(pk)
    setAccount(a)
    setSigner(a)
    setWallet({
      kind,
      address: a.address,
      label: kind === 'pk' ? 'Imported' : 'Generated',
      badge: kind === 'pk' ? 'IMPORT' : 'GENERATED',
    })
    writeStoredKey({ kind, privateKey: pk })
    writeStored(kind)
  }

  function activateMetaMaskAccount(mm: EIP1193Provider & { isMetaMask?: boolean }, address: Address) {
    const acct = metamaskAccount(mm, address)
    setAccount(acct)
    // Pass both provider (so genlayer-js can use it) AND the account wrapper.
    // genlayer-js prefers provider when present.
    setSigner(acct)
    setWallet({
      kind: 'metamask',
      address,
      label: 'MetaMask',
      badge: 'METAMASK',
    })
    writeStored('metamask')
  }

  // ---- Balance refresh ----

  const refreshBalance = useCallback(async () => {
    if (!wallet) {
      setBalanceGEN('—')
      return
    }
    try {
      const res = await fetch(POC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [wallet.address, 'latest'],
        }),
      })
      const json = await res.json()
      const hex = json?.result ?? '0x0'
      const wei = BigInt(hex)
      const whole = wei / 10n ** 18n
      const frac = wei % 10n ** 18n
      const fracStr = frac.toString().padStart(18, '0').slice(0, 4)
      setBalanceGEN(`${whole.toString()}.${fracStr} GEN`)
    } catch {
      setBalanceGEN('—')
    }
  }, [wallet])

  useEffect(() => {
    refreshBalance()
    const id = setInterval(refreshBalance, 15_000)
    return () => clearInterval(id)
  }, [refreshBalance])

  // ---- Public actions ----

  async function connectMetaMask() {
    setConnectError(null)
    setIsConnecting(true)
    try {
      const mm = detectMetaMask()
      if (!mm) {
        throw new Error(
          'No EIP-1193 wallet detected. Install MetaMask or use Import Key / Generate Wallet.',
        )
      }
      const accounts = (await mm.request({ method: 'eth_requestAccounts', params: [] })) as Address[]
      if (!accounts.length) throw new Error('Wallet returned no accounts.')
      const addr = accounts[0]

      // Switch to bradbury (or add the chain if missing) when on bradbury network.
      if (POC_NETWORK === 'bradbury') {
        try {
          await mm.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
          })
        } catch (switchErr: any) {
          if (switchErr?.code === 4902 || /Unrecognized chain/i.test(String(switchErr?.message))) {
            await mm.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: BRADBURY_CHAIN_ID_HEX,
                  chainName: 'GenLayer Bradbury',
                  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
                  rpcUrls: [BRADBURY_RPC],
                  blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
                },
              ],
            })
          } else if (switchErr?.code === 4001) {
            throw new Error('Chain switch was rejected in MetaMask.')
          } else {
            // Some RPCs reject switchEthereumChain outright; let genlayer-js use
            // its own configured endpoint. We continue.
            console.warn('[wallet] chain switch warning', switchErr)
          }
        }
      }

      activateMetaMaskAccount(mm, addr)
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? String(err)
      setConnectError(msg)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }

  function importPrivateKey(pk: Hex) {
    const clean = pk.trim().toLowerCase()
    const norm = clean.startsWith('0x') ? clean : `0x${clean}`
    if (!/^0x[0-9a-f]{64}$/.test(norm)) {
      throw new Error('Private key must be 64 hex characters (with or without 0x prefix).')
    }
    activateStoredKey('pk', norm as Hex)
  }

  function generateWallet() {
    const pk = generatePrivateKey() as Hex
    activateStoredKey('generated', pk)
    return { address: privateKeyToAccount(pk).address, privateKey: pk }
  }

  function useDemoWallet() {
    activateDemo()
  }

  function disconnect() {
    setWallet(null)
    setAccount(null)
    setSigner(null)
    setBalanceGEN('—')
    writeStored(null)
    writeStoredKey(null)
  }

  const value: WalletContextValue = {
    wallet,
    account,
    signer,
    connectMetaMask,
    importPrivateKey,
    generateWallet,
    useDemoWallet,
    disconnect,
    refreshBalance,
    balanceGEN,
    hasMetaMask,
    isConnecting,
    connectError,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}