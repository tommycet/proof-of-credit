/**
 * Topbar wallet pill.
 *
 * Shows current wallet (badge + short address + balance) when connected.
 * When not connected, shows a "CONNECT WALLET" button that opens the modal.
 * When connected, clicking the pill toggles a small menu with the full
 * address, balance, network, and a disconnect button.
 */

import { useState, useRef, useEffect } from 'react'
import { useWallet } from '../services/wallet'
import { WalletModal } from './WalletModal'

export function WalletButton() {
  const { wallet, balanceGEN, disconnect, hasMetaMask } = useWallet()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  if (!wallet) {
    return (
      <>
        <button
          className="wallet-connect-btn"
          onClick={() => setShowModal(true)}
          title="Connect a wallet to interact with Proof of Credit"
        >
          <span className="dot dot-amber" />
          CONNECT WALLET
        </button>
        {showModal && <WalletModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  const shortAddr = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`

  return (
    <>
      <div className="wallet-pill-wrap" ref={menuRef}>
        <button
          className={`wallet-pill wallet-pill-${wallet.kind}${wallet.readOnly ? ' wallet-pill-ro' : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
          title={`${wallet.label} · ${wallet.address} · ${balanceGEN}`}
        >
          <span className={`wallet-badge wallet-badge-${wallet.kind}`}>{wallet.badge}</span>
          <span className="wallet-addr">{shortAddr}</span>
          <span className="wallet-bal">{balanceGEN}</span>
          <span className="wallet-caret">▾</span>
        </button>
        {menuOpen && (
          <div className="wallet-menu">
            <div className="wallet-menu-row wallet-menu-label">
              <span>{wallet.label.toUpperCase()}</span>
              {wallet.readOnly && <span className="wallet-menu-warn">READ-ONLY</span>}
            </div>
            <div className="wallet-menu-row wallet-menu-addr" title={wallet.address}>
              {wallet.address}
            </div>
            <div className="wallet-menu-row wallet-menu-bal">
              <span className="wallet-menu-lbl">BALANCE</span>
              <span>{balanceGEN}</span>
            </div>
            {wallet.readOnly && (
              <div className="wallet-menu-warn-text">
                Demo wallet has no balance on bradbury. Connect MetaMask or import a funded
                private key to make transactions.
              </div>
            )}
            <div className="wallet-menu-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => { setMenuOpen(false); setShowModal(true) }}>
                SWITCH
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => { setMenuOpen(false); disconnect() }}>
                DISCONNECT
              </button>
            </div>
          </div>
        )}
      </div>
      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </>
  )
}