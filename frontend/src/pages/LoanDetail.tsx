import { useEffect, useState } from 'react'
import { formatGEN, shortAddr, timeAgo } from '../services/genlayer'
import { getLoan, getApplication } from '../services/contract'
import type { Loan, CreditApplication } from '../services/contract'
import type { Route } from '../App'

interface Props {
  id: number
  navigate: (r: Route) => void
  onRepay: (loanId: number) => void
}

export function LoanDetail({ id, navigate, onRepay }: Props) {
  const [loan, setLoan] = useState<Loan | null>(null)
  const [app, setApp] = useState<CreditApplication | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const l = await getLoan(id)
        if (cancelled) return
        setLoan(l)
        if (l) {
          const a = await getApplication(l.application_id)
          if (!cancelled) setApp(a)
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
          <div className="h-page-title">Loan #{id}</div>
        </div>
        <div className="card skel" style={{ height: 200 }} />
      </div>
    )
  }

  if (!loan) {
    return (
      <div>
        <div className="h-page">
          <div className="h-page-title">Loan #{id}</div>
        </div>
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">Loan not found</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate({ name: 'loans' })}>← Back to Loans</button>
        </div>
      </div>
    )
  }

  const interestOwed = (loan.principal * loan.interest_rate_bps * (Date.now() / 1000 - loan.timestamp)) / (365 * 24 * 3600 * 10000)
  const totalOwed = loan.principal + interestOwed - loan.amount_repaid
  const progressPct = loan.principal > 0 ? Math.min(100, (loan.amount_repaid / loan.principal * 100)) : 0

  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">Loan #{loan.id}</div>
          <div className="lbl" style={{ marginTop: 4 }}>
            FROM APPLICATION #{loan.application_id} · DRAWN {timeAgo(loan.timestamp)} BY {shortAddr(loan.borrower)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {loan.status === 'active' && <span className="badge badge-pending"><span className="badge-dot" />ACTIVE</span>}
          {loan.status === 'repaid' && <span className="badge badge-ok"><span className="badge-dot" />REPAID</span>}
          {loan.status === 'defaulted' && <span className="badge badge-err"><span className="badge-dot" />DEFAULTED</span>}
        </div>
      </div>

      <div className="cols-1-2">
        {/* Position panel */}
        <div className="card-elev">
          <div className="card-h">
            <div className="card-h-title">Position</div>
            <span className="badge badge-muted">LIVE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Principal" value={`${formatGEN(BigInt(loan.principal))} GEN`} big />
            <Field label="Interest Rate" value={`${(loan.interest_rate_bps / 100).toFixed(2)}% APR`} />
            <Field label="Amount Repaid" value={`${formatGEN(BigInt(loan.amount_repaid))} GEN`} />
            <Field label="Interest Accrued" value={`${formatGEN(BigInt(Math.floor(interestOwed)))} GEN`} tone="warn" />
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <div className="lbl" style={{ marginBottom: 4 }}>REPAYMENT PROGRESS</div>
              <div className="progress-bar" style={{ background: 'var(--bg-3)', height: 6 }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'var(--emerald)',
                  width: `${progressPct}%`,
                }} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {progressPct.toFixed(1)}% REPAID
              </div>
            </div>
            <Field label="Total Owed" value={`${formatGEN(BigInt(Math.floor(Math.max(0, totalOwed))))} GEN`} big tone="warn" />
            <Field label="Deadline" value={new Date(loan.deadline * 1000).toLocaleString()} />
          </div>

          {loan.status === 'active' && (
            <>
              <div className="divider" />
              <div>
                <div className="lbl" style={{ marginBottom: 8 }}>REPAY</div>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={() => onRepay(loan.id)}
                >
                  Repay {formatGEN(BigInt(Math.floor(Math.max(0, totalOwed))))} GEN →
                </button>
                <div className="field-hint" style={{ marginTop: 6 }}>
                  On studionet (gas-free) the full outstanding balance will be repaid.
                  On paid testnets the actual GEN sent is used.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Application context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {app && (
            <div className="card-elev">
              <div className="card-h">
                <div className="card-h-title">Originating Application #{app.id}</div>
                <button className="btn btn-ghost" onClick={() => navigate({ name: 'application', id: app.id })}>
                  View →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontFamily: 'var(--font-data)', fontSize: 12 }}>
                <Field label="Credit Score" value={String(app.credit_score)} big />
                <Field label="Rate" value={`${(app.interest_rate_bps / 100).toFixed(2)}%`} />
                <Field label="Max LTV" value={`${(app.max_ltv_bps / 100).toFixed(0)}%`} />
                <Field label="Credit Limit" value={`${formatGEN(BigInt(app.max_credit_limit))} GEN`} />
              </div>
              <div className="divider" />
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                {app.reasoning}
              </p>
            </div>
          )}

          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">Loan Mechanics</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-data)', fontSize: 11 }}>
              <Row label="Type" note="Unsecured undercollateralized" />
              <Row label="Collateral" note="None (AI credit score)" />
              <Row label="Interest model" note="Simple interest" />
              <Row label="Default penalty" note="−50 credit score + liquidation" />
              <Row label="Repayment" note="Full or partial" />
              <Row label="Liquidation" note="Callable by anyone post-deadline" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'ok' | 'warn' | 'err' }) {
  const color = tone === 'warn' ? 'var(--amber)' : tone === 'err' ? 'var(--rose)' : tone === 'ok' ? 'var(--emerald)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
      <span className="lbl">{label}</span>
      <span style={{
        color,
        fontFamily: 'var(--font-data)',
        fontSize: big ? 18 : 12,
        fontWeight: big ? 500 : 400,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  )
}

function Row({ label, note }: { label: string; note: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ color: 'var(--text-3)' }}>{note}</span>
    </div>
  )
}
