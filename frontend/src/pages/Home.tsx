import { formatGEN, timeAgo } from '../services/genlayer'
import type { ProtocolStats, CreditApplication, Loan } from '../services/contract'
import type { Route } from '../App'

interface Props {
  stats: ProtocolStats | null
  apps: CreditApplication[]
  loans: (Loan & { seconds_to_deadline: number })[]
  navigate: (r: Route) => void
  onDeposit: () => void
}

export function Home({ stats, apps, loans, navigate, onDeposit }: Props) {
  const totalApps = stats?.total_applications ?? 0
  const approvedApps = apps.filter((a) => a.status === 'approved').length
  const activeLoans = stats?.total_loans ?? 0
  const repaidLoans = loans.filter((l) => l.status === 'repaid').length
  const poolBalance = stats?.pool_balance ?? 0
  const utilization = stats?.utilization_bps ?? 0
  const defaults = stats?.total_defaults ?? 0

  return (
    <div>
      <div className="hero">
        <div>
          <div className="hero-eyebrow">GENLAYER INTELLIGENT CONTRACT</div>
          <h1 className="hero-title">
            Undercollateralized lending,<br />
            decided by <em>AI consensus</em>.
          </h1>
          <p className="hero-desc">
            Submit a credit profile. Multiple GenLayer validators run an LLM
            evaluation in parallel and reach consensus on a FICO-like score
            (300–850). Approved borrowers receive an on-chain credit line they
            can draw from — without posting collateral.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'apply' })}>
              Apply for Credit →
            </button>
            <button className="btn btn-lg" onClick={() => navigate({ name: 'pool' })}>
              View Lending Pool
            </button>
          </div>
        </div>

        <div className="hero-instrument">
          <div className="hero-instrument-h">
            <div className="hero-instrument-title">Protocol Telemetry</div>
            <span className="badge badge-ok"><span className="badge-dot" />LIVE</span>
          </div>
          <div className="gauge-grid">
            <div className="gauge">
              <div className="gauge-l">POOL BALANCE</div>
              <div className="gauge-v">{formatGEN(BigInt(poolBalance))}</div>
              <div className="lbl" style={{ marginTop: 4 }}>GEN</div>
            </div>
            <div className="gauge">
              <div className="gauge-l">UTILIZATION</div>
              <div className="gauge-v">{(utilization / 100).toFixed(1)}%</div>
              <div className="lbl" style={{ marginTop: 4 }}>RESERVE {(10000 - utilization) / 100}%</div>
            </div>
            <div className="gauge">
              <div className="gauge-l">APPLICATIONS</div>
              <div className="gauge-v">{totalApps}</div>
              <div className="lbl" style={{ marginTop: 4 }}>{approvedApps} APPROVED</div>
            </div>
            <div className="gauge">
              <div className="gauge-l">ACTIVE LOANS</div>
              <div className="gauge-v">{activeLoans}</div>
              <div className="lbl" style={{ marginTop: 4 }}>{defaults} DEFAULTED</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-cell">
          <div className="stat-label">Total Deposited</div>
          <div className="stat-value">{formatGEN(BigInt(stats?.total_deposited ?? 0))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta">From {(stats?.total_deposited ?? 0) > 0 ? 'lenders' : '—'}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Total Borrowed</div>
          <div className="stat-value">{formatGEN(BigInt(stats?.total_borrowed ?? 0))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta">{activeLoans} active positions</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Total Repaid</div>
          <div className="stat-value">{formatGEN(BigInt(stats?.total_repaid ?? 0))} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>GEN</span></div>
          <div className="stat-delta stat-delta-pos">+{formatGEN(BigInt(stats?.total_interest_collected ?? 0))} interest</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Defaults</div>
          <div className="stat-value">{defaults}</div>
          <div className="stat-delta">{totalApps > 0 ? ((defaults / Math.max(totalApps, 1)) * 100).toFixed(1) : '0.0'}% rate</div>
        </div>
      </div>

      {/* Recent applications */}
      <div className="section-h">
        <div className="section-h-title">Recent Applications</div>
        <div className="section-h-meta">{apps.length} ON-CHAIN</div>
      </div>

      {apps.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">No applications yet</div>
          <div className="empty-desc">
            Be the first. Submit a credit profile and have it evaluated by the
            AI consensus network in &lt;60 seconds.
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate({ name: 'apply' })}>
              Apply for Credit →
            </button>
          </div>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>APPLICANT</th>
              <th>INCOME</th>
              <th>PURPOSE</th>
              <th>SCORE</th>
              <th>LIMIT (GEN)</th>
              <th>RATE</th>
              <th>STATUS</th>
              <th>WHEN</th>
            </tr>
          </thead>
          <tbody>
            {apps.slice(0, 10).map((a) => (
              <tr key={a.id} className="clickable" onClick={() => navigate({ name: 'application', id: a.id })}>
                <td className="mono">#{a.id}</td>
                <td className="mono">{(a.applicant || '0x??????').slice(0, 8)}…{(a.applicant || '????????').slice(-4)}</td>
                <td className="num mono">${(a.annual_income_usd ?? 0).toLocaleString()}</td>
                <td className="mono">{(a.loan_purpose || '').replace(/_/g, ' ')}</td>
                <td className="mono"><strong>{a.credit_score ?? 0}</strong></td>
                <td className="num mono">{a.max_credit_limit > 0 ? formatGEN(BigInt(a.max_credit_limit)) : '—'}</td>
                <td className="mono">{a.interest_rate_bps > 0 ? (a.interest_rate_bps / 100).toFixed(2) + '%' : '—'}</td>
                <td>
                  {a.status === 'approved' && <span className="badge badge-ok"><span className="badge-dot" />APPROVED</span>}
                  {a.status === 'denied' && <span className="badge badge-err"><span className="badge-dot" />DENIED</span>}
                  {a.status === 'pending' && <span className="badge badge-pending"><span className="badge-dot" />PENDING</span>}
                </td>
                <td className="mono" style={{ color: 'var(--text-3)' }}>{timeAgo(a.timestamp ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Active loans */}
      <div className="section-h">
        <div className="section-h-title">Active Loans</div>
        <div className="section-h-meta">{loans.length} ON-CHAIN</div>
      </div>

      {loans.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">No active loans</div>
          <div className="empty-desc">Approved credit applications can draw loans here.</div>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>BORROWER</th>
              <th>PRINCIPAL</th>
              <th>RATE</th>
              <th>REPAID</th>
              <th>STATUS</th>
              <th>DEADLINE</th>
            </tr>
          </thead>
          <tbody>
            {loans.slice(0, 10).map((l) => (
              <tr key={l.id} className="clickable" onClick={() => navigate({ name: 'loan', id: l.id })}>
                <td className="mono">#{l.id}</td>
                <td className="mono">{l.borrower.slice(0, 8)}…{l.borrower.slice(-4)}</td>
                <td className="num mono">{formatGEN(BigInt(l.principal))} GEN</td>
                <td className="mono">{(l.interest_rate_bps / 100).toFixed(2)}%</td>
                <td className="num mono">{formatGEN(BigInt(l.amount_repaid))} GEN</td>
                <td>
                  {l.status === 'active' && <span className="badge badge-pending"><span className="badge-dot" />ACTIVE</span>}
                  {l.status === 'repaid' && <span className="badge badge-ok"><span className="badge-dot" />REPAID</span>}
                  {l.status === 'defaulted' && <span className="badge badge-err"><span className="badge-dot" />DEFAULTED</span>}
                </td>
                <td className="mono" style={{ color: 'var(--text-3)' }}>{l.seconds_to_deadline > 0 ? `${Math.floor(l.seconds_to_deadline / 86400)}d left` : 'past due'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
