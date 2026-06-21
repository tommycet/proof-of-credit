import { formatGEN, useDemoAccount } from '../services/genlayer'
import type { ProtocolStats } from '../services/contract'
import type { Route } from '../App'

interface Props {
  stats: ProtocolStats | null
  onDeposit: () => void
  navigate: (r: Route) => void
}

export function Pool({ stats, onDeposit, navigate }: Props) {
  const account = useDemoAccount()
  const poolBalance = stats?.pool_balance ?? 0
  const totalDeposited = stats?.total_deposited ?? 0
  const totalBorrowed = stats?.total_borrowed ?? 0
  const utilization = stats?.utilization_bps ?? 0
  const reserveRatio = stats?.min_reserve_ratio_bps ?? 0
  const totalInterest = stats?.total_interest_collected ?? 0
  const totalRepaid = stats?.total_repaid ?? 0

  // Simulated lender share for demo account (deterministic based on deposit count)
  // The demo key always deposits 100 GEN; if total deposited is dominated by it, share ≈ 100%
  const simulatedSharePct = totalDeposited > 0 ? Math.min(100, 100 * 10 ** 18 / totalDeposited * 100) : 0
  const simulatedShare = simulatedSharePct
  const simulatedYield = totalInterest * simulatedSharePct / 100

  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">Lending Pool</div>
          <div className="lbl" style={{ marginTop: 4 }}>LIQUIDITY · LENDER YIELD · UTILIZATION</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={onDeposit}>+ Deposit 100 GEN</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-cell">
          <div className="stat-label">Pool Balance</div>
          <div className="stat-value">{formatGEN(BigInt(poolBalance))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta">Available liquidity</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Utilization</div>
          <div className="stat-value">{(utilization / 100).toFixed(1)}%</div>
          <div className="stat-delta">Reserve {(10000 - utilization) / 100}%</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Total Deposited</div>
          <div className="stat-value">{formatGEN(BigInt(totalDeposited))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta">All-time</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Interest Distributed</div>
          <div className="stat-value stat-delta-pos">{formatGEN(BigInt(totalInterest))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta">Paid to lenders pro-rata</div>
        </div>
      </div>

      <div className="cols-1-2">
        {/* Deposit panel */}
        <div className="card-elev">
          <div className="card-h">
            <div className="card-h-title">Become a Lender</div>
            <span className="badge badge-ok"><span className="badge-dot" />EARNING YIELD</span>
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.55 }}>
            Deposit GEN to earn pro-rata share of all interest repayments.
            Withdrawals are subject to a {reserveRatio / 100}% reserve ratio to
            ensure borrower withdrawals are always honoured.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary btn-lg" onClick={onDeposit}>
              Deposit 100 GEN →
            </button>
            <button className="btn btn-ghost" onClick={() => navigate({ name: 'home' })}>
              ← Back to Dashboard
            </button>
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-data)', fontSize: 11 }}>
            <Row label="Min Reserve Ratio" value={`${reserveRatio / 100}%`} />
            <Row label="Your Position" value={formatGEN(BigInt(0)) + ' GEN (demo)'} />
            <Row label="Pool Share" value={`${simulatedShare.toFixed(2)}%`} />
            <Row label="Cumulative Yield" value={formatGEN(BigInt(Math.floor(simulatedYield))) + ' GEN'} />
          </div>
        </div>

        {/* Mechanics */}
        <div className="card-elev">
          <div className="card-h">
            <div className="card-h-title">Pool Mechanics</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-data)', fontSize: 12 }}>
            <Mechanic
              title="Liquidity Provision"
              body="Lenders deposit GEN. Borrowers draw from this pool against AI-evaluated credit lines."
            />
            <Mechanic
              title="Yield Distribution"
              body="All repaid principal + interest flows back to the pool. Each lender receives pro-rata share based on deposit."
            />
            <Mechanic
              title="Reserve Ratio"
              body={`Pool enforces ${reserveRatio / 100}% minimum reserve. Withdrawals exceeding this ratio are rejected to protect borrowers.`}
            />
            <Mechanic
              title="Risk Management"
              body="All credit decisions are made by 5-validator AI consensus. Defaults reduce credit score and are publicly visible on-chain."
            />
            <Mechanic
              title="Default Resolution"
              body="Loans past deadline can be liquidated by anyone. Defaulted borrowers lose 50 credit points and are flagged in subsequent applications."
            />
          </div>
        </div>
      </div>

      <div className="section-h">
        <div className="section-h-title">Pool Composition</div>
        <div className="section-h-meta">PRO RATA · PROOF OF DEPOSIT</div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>METRIC</th>
              <th>VALUE</th>
              <th>SHARE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="lbl">PRINCIPAL OUTSTANDING</td>
              <td className="num mono">{formatGEN(BigInt(totalBorrowed - totalRepaid))} GEN</td>
              <td className="num mono">{totalDeposited > 0 ? ((totalBorrowed / totalDeposited) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td className="lbl">REPAID PRINCIPAL</td>
              <td className="num mono">{formatGEN(BigInt(totalRepaid))} GEN</td>
              <td className="num mono">{totalBorrowed > 0 ? ((totalRepaid / totalBorrowed) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td className="lbl">INTEREST COLLECTED</td>
              <td className="num mono" style={{ color: 'var(--emerald)' }}>{formatGEN(BigInt(totalInterest))} GEN</td>
              <td className="num mono">yield</td>
            </tr>
            <tr>
              <td className="lbl">RESERVES</td>
              <td className="num mono">{formatGEN(BigInt(Math.floor(totalDeposited * reserveRatio / 10000)))} GEN</td>
              <td className="num mono">{reserveRatio / 100}%</td>
            </tr>
            <tr>
              <td className="lbl">AVAILABLE FOR BORROWING</td>
              <td className="num mono" style={{ color: 'var(--emerald)' }}>{formatGEN(BigInt(Math.floor(poolBalance - totalDeposited * reserveRatio / 10000)))} GEN</td>
              <td className="num mono">active</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Mechanic({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
      <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{title}</div>
      <div style={{ color: 'var(--text-2)', fontFamily: 'var(--font-ui)', fontSize: 12, lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span className="lbl">{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
