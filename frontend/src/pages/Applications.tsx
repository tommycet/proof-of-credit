import { formatGEN, timeAgo } from '../services/genlayer'
import type { CreditApplication } from '../services/contract'
import type { Route } from '../App'

interface Props {
  apps: CreditApplication[]
  navigate: (r: Route) => void
}

export function Applications({ apps, navigate }: Props) {
  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">All Credit Applications</div>
          <div className="lbl" style={{ marginTop: 4 }}>{apps.length} APPLICATIONS · ON-CHAIN REGISTRY</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate({ name: 'apply' })}>+ New Application</button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">No applications yet</div>
          <div className="empty-desc">The first credit application submitted will appear here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>APPLICANT</th>
                <th>INCOME</th>
                <th>EMP</th>
                <th>YEARS</th>
                <th>DTI</th>
                <th>PURPOSE</th>
                <th>AMOUNT</th>
                <th>SCORE</th>
                <th>LIMIT</th>
                <th>RATE</th>
                <th>STATUS</th>
                <th>WHEN</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const dti = a.annual_income_usd > 0
                  ? ((a.existing_debt_usd / a.annual_income_usd) * 100).toFixed(0) + '%'
                  : '—'
                return (
                  <tr key={a.id} className="clickable" onClick={() => navigate({ name: 'application', id: a.id })}>
                    <td className="mono">#{a.id}</td>
                    <td className="mono">{a.applicant.slice(0, 6)}…{a.applicant.slice(-4)}</td>
                    <td className="num mono">${a.annual_income_usd.toLocaleString()}</td>
                    <td className="mono">{a.employment_status.replace(/_/g, ' ')}</td>
                    <td className="num mono">{a.employment_years}y</td>
                    <td className="mono">{dti}</td>
                    <td className="mono">{a.loan_purpose.replace(/_/g, ' ')}</td>
                    <td className="num mono">{formatGEN(BigInt(a.loan_amount_requested))}</td>
                    <td className="mono"><strong style={{ fontSize: 13 }}>{a.credit_score}</strong></td>
                    <td className="num mono">{a.max_credit_limit > 0 ? formatGEN(BigInt(a.max_credit_limit)) : '—'}</td>
                    <td className="mono">{a.interest_rate_bps > 0 ? (a.interest_rate_bps / 100).toFixed(2) + '%' : '—'}</td>
                    <td>
                      {a.status === 'approved' && <span className="badge badge-ok"><span className="badge-dot" />APPROVED</span>}
                      {a.status === 'denied' && <span className="badge badge-err"><span className="badge-dot" />DENIED</span>}
                      {a.status === 'pending' && <span className="badge badge-pending"><span className="badge-dot" />PENDING</span>}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-3)' }}>{timeAgo(a.timestamp)}</td>
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
