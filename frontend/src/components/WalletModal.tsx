/**
 * Wallet connection modal.
 *
 * Three primary connection options (MetaMask / Import / Generate) plus the
 * demo fallback. Each option shows what it does, what it costs, and what
 * data is stored where.
 */

import { useState } from 'react'
import type { Hex } from 'viem'
import { useWallet } from '../services/wallet'
import { POC_NETWORK } from '../services/genlayer'

export function WalletModal({ onClose }: { onClose: () => void }) {
  const {
    connectMetaMask,
    importPrivateKey,
    generateWallet,
    useDemoWallet,
    hasMetaMask,
    isConnecting,
    connectError,
    wallet,
  } = useWallet()

  const [pkInput, setPkInput] = useState('')
  const [generated, setGenerated] = useState<{ address: Hex; privateKey: Hex } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleMetaMask() {
    try {
      await connectMetaMask()
      onClose()
    } catch {
      // connectError is set in the hook
    }
  }

  function handleImport() {
    setImportError(null)
    try {
      importPrivateKey(pkInput as Hex)
      setPkInput('')
      onClose()
    } catch (err: any) {
      setImportError(err?.message ?? 'Invalid private key')
    }
  }

  function handleGenerate() {
    const w = generateWallet()
    setGenerated(w)
    // Don't close — show the generated key so the user can save it
  }

  function handleDemo() {
    useDemoWallet()
    onClose()
  }

  async function copyKey(pk: Hex) {
    try {
      await navigator.clipboard.writeText(pk)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Connect Wallet</div>
            <div className="modal-sub">
              Network: {POC_NETWORK === 'bradbury' ? 'BRADBURY TESTNET · 4221' : 'STUDIONET · 61999'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {wallet && (
          <div className="modal-section modal-current">
            <div className="modal-current-label">CURRENTLY CONNECTED</div>
            <div className="modal-current-row">
              <span className={`wallet-badge wallet-badge-${wallet.kind}`}>{wallet.badge}</span>
              <span>{wallet.label}</span>
              <span className="modal-current-addr">{wallet.address}</span>
            </div>
          </div>
        )}

        {/* MetaMask */}
        <div className="modal-section">
          <button
            className="wallet-option"
            onClick={handleMetaMask}
            disabled={isConnecting}
          >
            <div className="wallet-option-icon">◆</div>
            <div className="wallet-option-body">
              <div className="wallet-option-title">
                MetaMask {hasMetaMask ? '' : '(not detected)'}
              </div>
              <div className="wallet-option-desc">
                Connect the MetaMask extension. {POC_NETWORK === 'bradbury' && (
                  <>We'll switch your wallet to the <b>GenLayer Bradbury</b> network (chainId 4221).</>
                )}
              </div>
            </div>
            <div className="wallet-option-go">→</div>
          </button>
          {connectError && <div className="modal-error">{connectError}</div>}
        </div>

        {/* Import private key */}
        <div className="modal-section">
          <div className="wallet-option wallet-option-static">
            <div className="wallet-option-icon">⌬</div>
            <div className="wallet-option-body">
              <div className="wallet-option-title">Import Private Key</div>
              <div className="wallet-option-desc">
                Paste a 64-char hex private key. Stored in localStorage on this device only.
                Use only on testnet — never import a key that holds real value.
              </div>
              <input
                className="wallet-option-input"
                type="password"
                placeholder="0x… (64 hex chars)"
                value={pkInput}
                onChange={(e) => setPkInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                spellCheck={false}
                autoComplete="off"
              />
              {importError && <div className="modal-error">{importError}</div>}
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleImport}
            disabled={!pkInput.trim()}
          >
            IMPORT
          </button>
        </div>

        {/* Generate */}
        <div className="modal-section">
          <div className="wallet-option wallet-option-static">
            <div className="wallet-option-icon">⊕</div>
            <div className="wallet-option-body">
              <div className="wallet-option-title">Generate Test Wallet</div>
              <div className="wallet-option-desc">
                Create a brand-new random key. Save the address + private key below before
                sending real transactions — keys are stored in localStorage but you should
                back them up. Fund via the bradbury faucet before signing.
              </div>
              {generated && (
                <div className="generated-block">
                  <div className="generated-row">
                    <span className="generated-lbl">ADDRESS</span>
                    <span className="generated-val">{generated.address}</span>
                  </div>
                  <div className="generated-row">
                    <span className="generated-lbl">PRIVATE KEY</span>
                    <span className="generated-val generated-pk">{generated.privateKey}</span>
                  </div>
                  <div className="generated-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => copyKey(generated.privateKey)}>
                      {copied ? 'COPIED ✓' : 'COPY KEY'}
                    </button>
                    <button className="btn btn-primary btn-xs" onClick={() => { setGenerated(null); onClose() }}>
                      I'VE SAVED IT — USE THIS WALLET
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!generated && (
            <button className="btn btn-primary btn-sm" onClick={handleGenerate}>
              GENERATE
            </button>
          )}
        </div>

        {/* Demo */}
        <div className="modal-section modal-demo">
          <div className="wallet-option wallet-option-static">
            <div className="wallet-option-icon">◇</div>
            <div className="wallet-option-body">
              <div className="wallet-option-title">Demo Wallet</div>
              <div className="wallet-option-desc">
                Hardcoded read-only signer.{' '}
                {POC_NETWORK === 'bradbury'
                  ? <>On bradbury it has no balance, so writes will revert — useful for browsing.</>
                  : <>On studionet it can submit transactions (gas-free chain).</>}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleDemo}>
            USE DEMO
          </button>
        </div>

        <div className="modal-foot">
          <div className="modal-foot-l">
            Keys are stored in your browser only. We never send them anywhere.
          </div>
        </div>
      </div>
    </div>
  )
}