import { useState } from 'react'
import type { Route } from '../App'
import type { ApplyForCreditArgs } from '../services/contract'

interface Props {
  onSubmit: (args: ApplyForCreditArgs) => Promise<{ ok: true; id: number } | { ok: false; err: string }>
  navigate: (r: Route) => void
}

export function Apply({ onSubmit, navigate }: Props) {
  const [income, setIncome] = useState('120000')
  const [empStatus, setEmpStatus] = useState('employed')
  const [empYears, setEmpYears] = useState('7')
  const [loanAmt, setLoanAmt] = useState('2000')  // in GEN
  const [purpose, setPurpose] = useState('home_improvement')
  const [existingDebt, setExistingDebt] = useState('15000')
  const [bankruptcy, setBankruptcy] = useState(false)
  const [delinquencies, setDelinquencies] = useState(false)
  const [priorRepay, setPriorRepay] = useState('0')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'submit' | 'consensus' | 'landed'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setStep('submit')
    const result = await onSubmit({
      annual_income_usd: parseInt(income || '0'),
      employment_status: empStatus,
      employment_years: parseInt(empYears || '0'),
      loan_amount_requested: Math.floor(parseFloat(loanAmt || '0') * 10 ** 18),
      loan_purpose: purpose,
      existing_debt_usd: parseInt(existingDebt || '0'),
      has_bankruptcy: bankruptcy,
      has_delinquencies: delinquencies,
      prior_onchain_repayments: parseInt(priorRepay || '0'),
      notes,
    })
    setSubmitting(false)
    if (result.ok === true) {
      setStep('landed')
      navigate({ name: 'application', id: result.id })
    } else {
      setError(result.err)
      setStep('idle')
    }
  }

  const loanAmtWei = Math.floor(parseFloat(loanAmt || '0') * 10 ** 18)
  const debtToIncome = parseInt(income || '0') > 0 ? (parseInt(existingDebt || '0') / parseInt(income || '0') * 100).toFixed(1) : '0'

  return (
    <div>
      <div className="h-page">
        <div className="h-page-title">Apply for Credit</div>
        <div className="h-page-sub">SUBMIT PROFILE → AI CONSENSUS → CREDIT LINE</div>
      </div>

      <div className="cols-2-1">
        <form className="card-elev" onSubmit={handleSubmit}>
          <div className="card-h">
            <div className="card-h-title">Borrower Profile</div>
            <span className="badge badge-muted">FORM #001</span>
          </div>

          <div className="form">
            <div className="form-grid">
              <div className="field">
                <label className="field-label">Annual Income (USD)</label>
                <input className="input" type="number" value={income} onChange={(e) => setIncome(e.target.value)} min={0} />
                <div className="field-hint">Gross household income</div>
              </div>
              <div className="field">
                <label className="field-label">Employment Status</label>
                <select className="select" value={empStatus} onChange={(e) => setEmpStatus(e.target.value)}>
                  <option value="employed">Employed (W-2)</option>
                  <option value="self_employed">Self-employed / 1099</option>
                  <option value="unemployed">Unemployed</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label">Years Employed</label>
                <input className="input" type="number" value={empYears} onChange={(e) => setEmpYears(e.target.value)} min={0} max={70} />
              </div>
              <div className="field">
                <label className="field-label">Loan Amount (GEN)</label>
                <input className="input" type="number" value={loanAmt} onChange={(e) => setLoanAmt(e.target.value)} min={0} step="0.1" />
                <div className="field-hint">{(parseFloat(loanAmt || '0')).toLocaleString()} GEN · {loanAmtWei.toLocaleString()} wei</div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label">Loan Purpose</label>
                <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  <option value="home_improvement">Home improvement</option>
                  <option value="debt_consolidation">Debt consolidation</option>
                  <option value="business">Business</option>
                  <option value="education">Education</option>
                  <option value="medical">Medical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Existing Debt (USD)</label>
                <input className="input" type="number" value={existingDebt} onChange={(e) => setExistingDebt(e.target.value)} min={0} />
                <div className="field-hint">DTI: {debtToIncome}% (target &lt;43%)</div>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label">Prior On-Chain Repayments</label>
                <input className="input" type="number" value={priorRepay} onChange={(e) => setPriorRepay(e.target.value)} min={0} />
                <div className="field-hint">Successful prior loans on Proof of Credit</div>
              </div>
              <div className="field" style={{ justifyContent: 'space-between' }}>
                <label className="checkbox" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={bankruptcy} onChange={(e) => setBankruptcy(e.target.checked)} />
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 12 }}>Has prior bankruptcy</span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={delinquencies} onChange={(e) => setDelinquencies(e.target.checked)} />
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 12 }}>Recent delinquencies</span>
                </label>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Additional Context (Optional)</label>
              <textarea
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Co-applicant income, collateral not reflected in profile, business traction metrics..."
                maxLength={2000}
              />
              <div className="field-hint">{notes.length} / 2000 chars</div>
            </div>

            {error && (
              <div className="banner banner-err">
                <span className="banner-icon">!</span>
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit to AI Consensus →'}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate({ name: 'home' })} disabled={submitting}>
                Cancel
              </button>
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">Evaluation Process</div>
            </div>
            <div className="stepper">
              <div className={`step ${step === 'submit' || step === 'consensus' || step === 'landed' ? 'step-done' : step === 'idle' ? '' : 'step-active'}`}>
                <div className="step-icon">1</div>
                <div className="step-text">Submit to chain</div>
              </div>
              <div className={`step ${step === 'landed' ? 'step-done' : step === 'consensus' ? 'step-active' : ''}`}>
                <div className="step-icon">2</div>
                <div className="step-text">5 validators run LLM in parallel</div>
              </div>
              <div className={`step ${step === 'landed' ? 'step-done' : step === 'consensus' ? 'step-active' : ''}`}>
                <div className="step-icon">3</div>
                <div className="step-text">Equivalence Principle consensus</div>
              </div>
              <div className={`step ${step === 'landed' ? 'step-done' : ''}`}>
                <div className="step-icon">4</div>
                <div className="step-text">Credit line written on-chain</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="lbl" style={{ marginBottom: 4 }}>CONSENSUS ETA</div>
              <div className="mono" style={{ fontSize: 13 }}>~30–90 seconds on studionet</div>
            </div>
          </div>

          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">What Gets Evaluated</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-data)', fontSize: 11 }}>
              <Row label="Income vs. loan amount" note="debt service coverage" />
              <Row label="Employment stability" note="status × years" />
              <Row label="Debt-to-income ratio" note="target ≤43%" />
              <Row label="Bankruptcy / delinquencies" note="major negative" />
              <Row label="Prior on-chain history" note="verifiable behavior" />
              <Row label="Loan purpose" note="risk-adjusted" />
            </div>
          </div>

          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">Scoring Scale</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-data)', fontSize: 11 }}>
              <Range lo={800} hi={850} label="Exceptional" rate="2–5%" tone="ok" />
              <Range lo={740} hi={799} label="Very Good" rate="5–8%" tone="ok" />
              <Range lo={670} hi={739} label="Good" rate="8–14%" tone="ok" />
              <Range lo={580} hi={669} label="Fair" rate="14–24%" tone="warn" />
              <Range lo={300} hi={579} label="Poor" rate="— denied —" tone="err" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, note }: { label: string; note: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span style={{ color: 'var(--text)' }}>{label}</span>
      <span style={{ color: 'var(--text-3)' }}>{note}</span>
    </div>
  )
}

function Range({ lo, hi, label, rate, tone }: { lo: number; hi: number; label: string; rate: string; tone: 'ok' | 'warn' | 'err' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
      <span style={{ color: 'var(--text-2)' }}>{lo}–{hi} <span style={{ color: 'var(--text-3)' }}>· {label}</span></span>
      <span style={{
        color: tone === 'ok' ? 'var(--emerald)' : tone === 'warn' ? 'var(--amber)' : 'var(--rose)',
        fontWeight: 500,
      }}>{rate}</span>
    </div>
  )
}
