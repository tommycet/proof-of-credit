import { formatGEN } from '../services/genlayer'
import type { Loan } from '../services/contract'
import type { Route } from '../App'

interface Props {
  loans: (Loan & { seconds_to_deadline: number })[]
  navigate: (r: Route) => void
}

export function Loans({ loans, navigate }: Props) {
  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">Active Loans</div>
          <div className="lbl" style={{ marginTop: 4 }}>{loans.length} ACTIVE LOANS · ON-CHAIN</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => navigate({ name: 'apply' })}>+ New Application</button>
        </div>
      </div>

      {loans.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">No active loans</div>
          <div className="empty-desc">Approved borrowers can draw loans here. Apply first.</div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate({ name: 'apply' })}>Apply for Credit →</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>BORROWER</th>
                <th>APP</th>
                <th>PRINCIPAL</th>
                <th>RATE</th>
                <th>REPAID</th>
                <th>PROGRESS</th>
                <th>DEADLINE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => {
                const progress = l.principal > 0 ? (l.amount_repaid / l.principal * 100) : 0
                return (
                  <tr key={l.id} className="clickable" onClick={() => navigate({ name: 'loan', id: l.id })}>
                    <td className="mono">#{l.id}</td>
                    <td className="mono">{l.borrower.slice(0, 6)}…{l.borrower.slice(-4)}</td>
                    <td className="mono">#{l.application_id}</td>
                    <td className="num mono">{formatGEN(BigInt(l.principal))} GEN</td>
                    <td className="mono">{(l.interest_rate_bps / 100).toFixed(2)}%</td>
                    <td className="num mono">{formatGEN(BigInt(l.amount_repaid))} GEN</td>
                    <td>
                      <div style={{ width: 100 }}>
                        <div className="progress-bar" style={{ background: 'var(--bg-3)' }}>
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'var(--emerald)',
                            width: `${Math.min(100, progress)}%`,
                            transition: 'width 300ms',
                          }} />
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                          {progress.toFixed(0)}%
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ color: 'var(--text-3)' }}>
                      {l.seconds_to_deadline > 0 ? `${Math.floor(l.seconds_to_deadline / 86400)}d ${Math.floor((l.seconds_to_deadline % 86400) / 3600)}h` : 'past due'}
                    </td>
                    <td>
                      {l.status === 'active' && <span className="badge badge-pending"><span className="badge-dot" />ACTIVE</span>}
                      {l.status === 'repaid' && <span className="badge badge-ok"><span className="badge-dot" />REPAID</span>}
                      {l.status === 'defaulted' && <span className="badge badge-err"><span className="badge-dot" />DEFAULTED</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
