import { useState, useEffect, useCallback } from 'react'
import { POC_CONTRACT_ADDRESS, POC_NETWORK, shortAddr, formatGEN } from './services/genlayer'
import { WalletProvider, useWallet } from './services/wallet'
import { WalletButton } from './components/WalletButton'
import {
  getProtocolStats,
  getRecentApplications,
  getActiveLoans,
  applyForCredit,
  depositToPool,
  drawLoan,
  repayLoan,
  waitForTxFinalized,
  pollUntilChanged,
  type CreditApplication,
  type Loan,
  type ProtocolStats,
} from './services/contract'
import { Home } from './pages/Home'
import { Apply } from './pages/Apply'
import { Applications } from './pages/Applications'
import { ApplicationDetail } from './pages/ApplicationDetail'
import { Loans } from './pages/Loans'
import { LoanDetail } from './pages/LoanDetail'
import { Pool } from './pages/Pool'
import { Profile } from './pages/Profile'

export type Route =
  | { name: 'home' }
  | { name: 'apply' }
  | { name: 'applications' }
  | { name: 'application'; id: number }
  | { name: 'loans' }
  | { name: 'loan'; id: number }
  | { name: 'pool' }
  | { name: 'profile' }

export interface ToastMsg {
  id: number
  type: 'info' | 'success' | 'error'
  text: string
}

export default function App() {
  return (
    <WalletProvider>
      <AppInner />
    </WalletProvider>
  )
}

function AppInner() {
  const { wallet, account } = useWallet()
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [stats, setStats] = useState<ProtocolStats | null>(null)
  const [apps, setApps] = useState<CreditApplication[]>([])
  const [loans, setLoans] = useState<(Loan & { seconds_to_deadline: number })[]>([])
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const showToast = useCallback((type: ToastMsg['type'], text: string) => {
    setToast({ id: Date.now(), type, text })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5500)
    return () => clearTimeout(t)
  }, [toast])

  // Poll stats + lists on a 6s interval
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [s, a, l] = await Promise.all([
          getProtocolStats(),
          getRecentApplications(20, 0),
          getActiveLoans(20, 0),
        ])
        if (!cancelled) {
          setStats(s)
          setApps(a.applications ?? [])
          setLoans(l.loans ?? [])
        }
      } catch (err: any) {
        // Silent — studionet is intermittent
        console.warn('[poc] refresh failed', err?.shortMessage ?? err?.message ?? err)
      }
    }
    load()
    const id = setInterval(load, 6000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshKey])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const navigate = useCallback((r: Route) => {
    setRoute(r)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  // ============================================================
  // Action handlers (writes)
  // ============================================================

  const handleApply = useCallback(
    async (args: Parameters<typeof applyForCredit>[0]): Promise<{ ok: true; id: number } | { ok: false; err: string }> => {
      if (!wallet) {
        showToast('error', 'Connect a wallet before applying.')
        return { ok: false, err: 'no_wallet' }
      }
      if (wallet.readOnly) {
        showToast('error', 'Demo wallet cannot sign on bradbury. Connect MetaMask or import a funded key.')
        return { ok: false, err: 'read_only' }
      }
      try {
        showToast('info', 'Submitting application to AI consensus...')
        const txHash = await applyForCredit(args, account ?? undefined)
        showToast('info', 'Application submitted. Waiting for consensus...')
        await waitForTxFinalized(txHash, 240_000)
        // Poll for new application id (counter increments)
        const baseline = stats?.total_applications ?? 0
        try {
          await pollUntilChanged(
            () => getProtocolStats(),
            (a, b) => a.total_applications > b.total_applications,
            { ...stats!, total_applications: baseline } as ProtocolStats,
            120_000,
          )
        } catch (pollErr: any) {
          console.warn('[poc] poll failed, but tx succeeded', pollErr)
        }
        const newId = baseline + 1
        showToast('success', `Application #${newId} submitted. AI evaluation complete.`)
        refresh()
        return { ok: true, id: newId }
      } catch (err: any) {
        const msg = err?.shortMessage ?? err?.message ?? String(err)
        showToast('error', `Application failed: ${msg}`)
        return { ok: false, err: msg }
      }
    },
    [stats, refresh, showToast, wallet],
  )

  const handleDeposit = useCallback(async () => {
    if (!wallet) {
      showToast('error', 'Connect a wallet before depositing.')
      return
    }
    if (wallet.readOnly) {
      showToast('error', 'Demo wallet cannot deposit on bradbury.')
      return
    }
    try {
      showToast('info', 'Depositing 100 GEN into pool...')
      const txHash = await depositToPool(account ?? undefined)
      await waitForTxFinalized(txHash, 60_000)
      try {
        const baseline = stats?.pool_balance ?? 0
        await pollUntilChanged(
          () => getProtocolStats(),
          (a, b) => a.pool_balance > b.pool_balance,
          { ...stats!, pool_balance: baseline } as ProtocolStats,
          60_000,
        )
      } catch {}
      showToast('success', 'Deposit confirmed. You are now earning yield.')
      refresh()
    } catch (err: any) {
      showToast('error', `Deposit failed: ${err?.shortMessage ?? err?.message ?? err}`)
    }
  }, [stats, refresh, showToast, wallet])

  const handleDraw = useCallback(
    async (appId: number, amount: number) => {
      if (!wallet || wallet.readOnly) {
        showToast('error', 'Connect a funded wallet to draw a loan.')
        return
      }
      try {
        showToast('info', `Drawing ${formatGEN(BigInt(amount))} GEN...`)
        const txHash = await drawLoan(appId, amount, account ?? undefined)
        await waitForTxFinalized(txHash, 60_000)
        try {
          const baseline = stats?.total_loans ?? 0
          await pollUntilChanged(
            () => getProtocolStats(),
            (a, b) => a.total_loans > b.total_loans,
            { ...stats!, total_loans: baseline } as ProtocolStats,
            60_000,
          )
        } catch {}
        showToast('success', 'Loan drawn. Funds transferred to your wallet.')
        refresh()
      } catch (err: any) {
        showToast('error', `Draw failed: ${err?.shortMessage ?? err?.message ?? err}`)
      }
    },
    [stats, refresh, showToast, wallet],
  )

  const handleRepay = useCallback(
    async (loanId: number) => {
      if (!wallet || wallet.readOnly) {
        showToast('error', 'Connect a funded wallet to repay.')
        return
      }
      try {
        showToast('info', 'Repaying loan...')
        const txHash = await repayLoan(loanId, account ?? undefined)
        await waitForTxFinalized(txHash, 60_000)
        showToast('success', 'Loan repaid. Credit history updated.')
        refresh()
      } catch (err: any) {
        showToast('error', `Repay failed: ${err?.shortMessage ?? err?.message ?? err}`)
      }
    },
    [refresh, showToast, wallet],
  )

  // ============================================================
  // Render
  // ============================================================

  const renderPage = () => {
    switch (route.name) {
      case 'home':
        return <Home stats={stats} apps={apps} loans={loans} navigate={navigate} onDeposit={handleDeposit} />
      case 'apply':
        return <Apply onSubmit={handleApply} navigate={navigate} />
      case 'applications':
        return <Applications apps={apps} navigate={navigate} />
      case 'application':
        return <ApplicationDetail id={route.id} navigate={navigate} onDraw={handleDraw} />
      case 'loans':
        return <Loans loans={loans} navigate={navigate} />
      case 'loan':
        return <LoanDetail id={route.id} navigate={navigate} onRepay={handleRepay} />
      case 'pool':
        return <Pool stats={stats} onDeposit={handleDeposit} navigate={navigate} />
      case 'profile':
        return <Profile navigate={navigate} />
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">P/C</div>
          <span className="brand-name">PROOF OF CREDIT</span>
          <span className="brand-tag">/ AI UNDERCOLLATERALIZED LENDING</span>
        </div>
        <div className="topbar-right">
          <div className="network-badge">
            <span className="network-dot" />
            {POC_NETWORK === 'bradbury' ? 'BRADBURY TESTNET · 4221' : 'STUDIONET · 61999'}
          </div>
          <WalletButton />
        </div>
      </header>

      <div className="main">
        <nav className="nav">
          <div className="nav-section-label">PROTOCOL</div>
          <div className={`nav-item ${route.name === 'home' ? 'active' : ''}`} onClick={() => navigate({ name: 'home' })}>
            <span className="nav-icon">▦</span> Dashboard
          </div>
          <div className={`nav-item ${route.name === 'pool' ? 'active' : ''}`} onClick={() => navigate({ name: 'pool' })}>
            <span className="nav-icon">≡</span> Lending Pool
          </div>
          <div className="nav-section-label">BORROW</div>
          <div className={`nav-item ${route.name === 'apply' ? 'active' : ''}`} onClick={() => navigate({ name: 'apply' })}>
            <span className="nav-icon">+</span> Apply for Credit
          </div>
          <div className={`nav-item ${route.name === 'applications' ? 'active' : ''}`} onClick={() => navigate({ name: 'applications' })}>
            <span className="nav-icon">≡</span> Applications
          </div>
          <div className={`nav-item ${route.name === 'loans' ? 'active' : ''}`} onClick={() => navigate({ name: 'loans' })}>
            <span className="nav-icon">⟶</span> Active Loans
          </div>
          <div className="nav-section-label">YOU</div>
          <div className={`nav-item ${route.name === 'profile' ? 'active' : ''}`} onClick={() => navigate({ name: 'profile' })}>
            <span className="nav-icon">◉</span> Credit Profile
          </div>
        </nav>

        <main className="content">
          {renderPage()}
        </main>
      </div>

      <footer className="footer">
        <div>PROOF OF CREDIT · {POC_CONTRACT_ADDRESS.slice(0, 6)}…{POC_CONTRACT_ADDRESS.slice(-4)} · {POC_NETWORK === 'bradbury' ? 'BRADBURY' : 'STUDIONET'}</div>
        <div className="footer-links">
          <a href="https://docs.genlayer.com" target="_blank" rel="noopener noreferrer">GENLAYER DOCS</a>
          <a href={`https://genlayer-explorer.vercel.app/address/${POC_CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">EXPLORER</a>
          <a href="https://github.com/genlayerlabs" target="_blank" rel="noopener noreferrer">SOURCE</a>
        </div>
      </footer>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 60,
          right: 24,
          zIndex: 100,
          minWidth: 320,
          maxWidth: 460,
        }}>
          <div className={`banner ${toast.type === 'error' ? 'banner-err' : toast.type === 'info' ? '' : 'banner-warn'}`}>
            <span className="banner-icon">{toast.type === 'error' ? '!' : toast.type === 'success' ? '✓' : '◌'}</span>
            <span style={{ flex: 1 }}>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  )
}
