import { useEffect, useState } from 'react'
import { formatGEN, shortAddr, timeAgo } from '../services/genlayer'
import { getApplication } from '../services/contract'
import type { CreditApplication } from '../services/contract'
import type { Route } from '../App'

interface Props {
  id: number
  navigate: (r: Route) => void
  onDraw: (appId: number, amount: number) => void
}

export function ApplicationDetail({ id, navigate, onDraw }: Props) {
  const [app, setApp] = useState<CreditApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawAmt, setDrawAmt] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await getApplication(id)
        if (!cancelled) {
          setApp(result)
          if (result && result.max_credit_limit > 0 && !drawAmt) {
            setDrawAmt((result.max_credit_limit / 10 ** 18 / 2).toFixed(2))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div>
        <div className="h-page">
          <div className="h-page-title">Application #{id}</div>
        </div>
        <div className="card skel" style={{ height: 200 }} />
      </div>
    )
  }

  if (!app) {
    return (
      <div>
        <div className="h-page">
          <div className="h-page-title">Application #{id}</div>
        </div>
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">Application not found</div>
          <div className="empty-desc">It may not have been finalized yet, or the ID is invalid.</div>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => navigate({ name: 'applications' })}>← Back to Applications</button>
          </div>
        </div>
      </div>
    )
  }

  // Credit score gauge geometry (300-850 scale → 0-100%)
  const scorePct = Math.max(0, Math.min(100, ((app.credit_score - 300) / 550) * 100))
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (scorePct / 100) * circumference

  const dti = app.annual_income_usd > 0 ? (app.existing_debt_usd / app.annual_income_usd * 100).toFixed(1) : '0'
  const limitGen = app.max_credit_limit / 10 ** 18

  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">Application #{app.id}</div>
          <div className="lbl" style={{ marginTop: 4 }}>
            SUBMITTED {timeAgo(app.timestamp)} BY {shortAddr(app.applicant)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {app.status === 'approved' && <span className="badge badge-ok"><span className="badge-dot" />APPROVED</span>}
          {app.status === 'denied' && <span className="badge badge-err"><span className="badge-dot" />DENIED</span>}
          {app.status === 'pending' && <span className="badge badge-pending"><span className="badge-dot" />PENDING</span>}
        </div>
      </div>

      <div className="cols-1-2">
        {/* Score gauge */}
        <div className="card-elev" style={{ alignSelf: 'start' }}>
          <div className="card-h">
            <div className="card-h-title">Credit Score</div>
            <span className="badge badge-muted">AI CONSENSUS</span>
          </div>

          <div className="score-display" style={{ gridTemplateColumns: '1fr', justifyItems: 'center' }}>
            <div className="score-ring">
              <svg viewBox="0 0 200 200">
                <circle className="score-ring-bg" cx="100" cy="100" r={radius} strokeWidth="10" fill="none" />
                <circle
                  className="score-ring-fg"
                  cx="100" cy="100" r={radius}
                  strokeWidth="10" fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              </svg>
              <div className="score-value">
                <div className="score-num">{app.credit_score}</div>
                <div className="score-out-of">OUT OF 850</div>
              </div>
            </div>
          </div>
          <div className="score-scale">
            {app.credit_score >= 800 ? 'EXCEPTIONAL'
              : app.credit_score >= 740 ? 'VERY GOOD'
              : app.credit_score >= 670 ? 'GOOD'
              : app.credit_score >= 580 ? 'FAIR'
              : 'POOR'}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="score-meta-row">
              <span className="lbl">CREDIT LIMIT</span>
              <span className="mono" style={{ fontSize: 14, color: 'var(--emerald)' }}>
                {app.max_credit_limit > 0 ? formatGEN(BigInt(app.max_credit_limit)) + ' GEN' : '— none —'}
              </span>
            </div>
            <div className="score-meta-row">
              <span className="lbl">INTEREST RATE</span>
              <span className="mono" style={{ fontSize: 14 }}>
                {app.interest_rate_bps > 0 ? (app.interest_rate_bps / 100).toFixed(2) + '% APR' : '—'}
              </span>
            </div>
            <div className="score-meta-row">
              <span className="lbl">MAX UTILIZATION</span>
              <span className="mono" style={{ fontSize: 14 }}>
                {app.max_ltv_bps > 0 ? (app.max_ltv_bps / 100).toFixed(0) + '%' : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: details + draw action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI Reasoning */}
          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">AI Reasoning</div>
              <span className="badge badge-muted">CONSENSUS OUTPUT</span>
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.65, color: 'var(--text-2)' }}>
              {app.reasoning || '(no reasoning provided)'}
            </p>
          </div>

          {/* Profile snapshot */}
          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">Profile Snapshot</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontFamily: 'var(--font-data)', fontSize: 12 }}>
              <Field label="Annual Income" value={`$${app.annual_income_usd.toLocaleString()}`} />
              <Field label="Employment" value={app.employment_status.replace(/_/g, ' ')} />
              <Field label="Years" value={`${app.employment_years}y`} />
              <Field label="Existing Debt" value={`$${app.existing_debt_usd.toLocaleString()}`} />
              <Field label="Debt-to-Income" value={`${dti}%`} />
              <Field label="Bankruptcy" value={app.has_bankruptcy ? 'YES' : 'NO'} tone={app.has_bankruptcy ? 'err' : 'ok'} />
              <Field label="Delinquencies" value={app.has_delinquencies ? 'YES' : 'NO'} tone={app.has_delinquencies ? 'err' : 'ok'} />
              <Field label="Prior Repayments" value={String(app.prior_onchain_repayments)} />
              <Field label="Loan Purpose" value={app.loan_purpose.replace(/_/g, ' ')} />
              <Field label="Requested" value={formatGEN(BigInt(app.loan_amount_requested)) + ' GEN'} />
            </div>
            {app.notes && (
              <>
                <div className="divider" />
                <div>
                  <div className="lbl" style={{ marginBottom: 6 }}>APPLICANT NOTES</div>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {app.notes}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Draw loan */}
          {app.status === 'approved' && (
            <div className="card-elev">
              <div className="card-h">
                <div className="card-h-title">Draw Loan</div>
                <span className="badge badge-ok"><span className="badge-dot" />CREDIT LINE OPEN</span>
              </div>
              <div className="form">
                <div className="field">
                  <label className="field-label">Amount (GEN)</label>
                  <input
                    className="input"
                    type="number"
                    value={drawAmt}
                    onChange={(e) => setDrawAmt(e.target.value)}
                    min={0}
                    max={limitGen}
                    step="0.1"
                  />
                  <div className="field-hint">
                    Available: {limitGen.toLocaleString(undefined, { maximumFractionDigits: 2 })} GEN ·
                    {' '}{app.max_ltv_bps / 100}% max utilization
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const amt = Math.floor(parseFloat(drawAmt || '0') * 10 ** 18)
                      if (amt > 0) onDraw(app.id, amt)
                    }}
                  >
                    Draw {parseFloat(drawAmt || '0').toLocaleString()} GEN →
                  </button>
                  <button className="btn btn-ghost" onClick={() => navigate({ name: 'applications' })}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {app.status === 'denied' && (
            <div className="banner banner-err">
              <span className="banner-icon">!</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Application Denied</div>
                <div style={{ fontFamily: 'var(--font-ui)' }}>
                  Score below approval threshold (580). On-chain credit history
                  has been updated. You may reapply with improved profile.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'err' }) {
  const color = tone === 'err' ? 'var(--rose)' : tone === 'ok' ? 'var(--emerald)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span className="lbl">{label}</span>
      <span style={{ color, fontWeight: 500 }}>{value}</span>
    </div>
  )
}
