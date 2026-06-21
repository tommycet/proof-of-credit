import { useEffect, useState } from 'react'
import { formatGEN, useDemoAccount } from '../services/genlayer'
import { getUserProfile } from '../services/contract'
import type { UserProfile } from '../services/contract'
import type { Route } from '../App'

interface Props {
  navigate: (r: Route) => void
}

export function Profile({ navigate }: Props) {
  const account = useDemoAccount()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const p = await getUserProfile(account.address)
        if (!cancelled) setProfile(p)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
  }, [account.address])

  if (loading) {
    return (
      <div>
        <div className="h-page">
          <div className="h-page-title">Credit Profile</div>
        </div>
        <div className="card skel" style={{ height: 200 }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div>
        <div className="h-page">
          <div className="h-page-title">Credit Profile</div>
        </div>
        <div className="empty">
          <div className="empty-icon">∅</div>
          <div className="empty-title">No profile</div>
        </div>
      </div>
    )
  }

  const scorePct = Math.max(0, Math.min(100, ((profile.last_credit_score - 300) / 550) * 100))
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (scorePct / 100) * circumference

  return (
    <div>
      <div className="h-page">
        <div>
          <div className="h-page-title">Your Credit Profile</div>
          <div className="lbl" style={{ marginTop: 4 }}>{account.address}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate({ name: 'apply' })}>+ Apply for Credit</button>
        </div>
      </div>

      <div className="cols-1-2">
        {/* Score gauge */}
        <div className="card-elev" style={{ alignSelf: 'start' }}>
          <div className="card-h">
            <div className="card-h-title">Current Credit Score</div>
            <span className="badge badge-muted">LIVE</span>
          </div>
          <div style={{ display: 'grid', placeItems: 'center', padding: '20px 0' }}>
            <div className="score-ring" style={{ width: 180, height: 180 }}>
              <svg viewBox="0 0 200 200">
                <circle className="score-ring-bg" cx="100" cy="100" r={radius} strokeWidth="10" fill="none" />
                <circle
                  className="score-ring-fg"
                  cx="100" cy="100" r={radius}
                  strokeWidth="10" fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="score-value">
                <div className="score-num" style={{ fontSize: 40 }}>{profile.last_credit_score || '—'}</div>
                <div className="score-out-of">OUT OF 850</div>
              </div>
            </div>
          </div>
          <div className="score-scale">
            {profile.last_credit_score >= 800 ? 'EXCEPTIONAL'
              : profile.last_credit_score >= 740 ? 'VERY GOOD'
              : profile.last_credit_score >= 670 ? 'GOOD'
              : profile.last_credit_score >= 580 ? 'FAIR'
              : profile.last_credit_score > 0 ? 'POOR'
              : 'NO HISTORY'}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Stat label="Total Applications" value={String(profile.total_applications)} />
            <Stat label="Approved" value={String(profile.total_approved)} tone={profile.total_approved > 0 ? 'ok' : undefined} />
            <Stat label="Loans Drawn" value={String(profile.total_loans)} />
            <Stat label="Loans Repaid" value={String(profile.total_repaid)} tone={profile.total_repaid > 0 ? 'ok' : undefined} />
            <Stat label="Defaults" value={String(profile.total_defaulted)} tone={profile.total_defaulted > 0 ? 'err' : undefined} />
          </div>
        </div>

        {/* Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">Lifetime Activity</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Stat label="Total Borrowed" value={`${formatGEN(BigInt(profile.lifetime_borrowed))} GEN`} big />
              <Stat label="Total Repaid" value={`${formatGEN(BigInt(profile.lifetime_repaid))} GEN`} big tone="ok" />
              <Stat label="Net Outstanding" value={`${formatGEN(BigInt(profile.lifetime_borrowed - profile.lifetime_repaid))} GEN`} big />
            </div>
          </div>

          <div className="card-elev">
            <div className="card-h">
              <div className="card-h-title">How Your Score Evolves</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Step icon="+" title="Apply & Get Approved" body="Successful application with strong profile" delta="+0" />
              <Step icon="+" title="Draw a Loan" body="Credit line used to borrow GEN" delta="+0" />
              <Step icon="+" title="Repay On Time" body="Loan repaid in full before deadline" delta="+10 pts" tone="ok" />
              <Step icon="−" title="Default" body="Loan past deadline, liquidated" delta="−50 pts" tone="err" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'ok' | 'err' }) {
  const color = tone === 'ok' ? 'var(--emerald)' : tone === 'err' ? 'var(--rose)' : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
      <span className="lbl">{label}</span>
      <span style={{ color, fontFamily: 'var(--font-data)', fontSize: big ? 16 : 13, fontWeight: big ? 500 : 400 }}>{value}</span>
    </div>
  )
}

function Step({ icon, title, body, delta, tone }: { icon: string; title: string; body: string; delta: string; tone?: 'ok' | 'err' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
      <div style={{
        width: 24, height: 24, display: 'grid', placeItems: 'center',
        background: tone === 'err' ? 'rgba(244, 63, 94, 0.1)' : tone === 'ok' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-2)',
        color: tone === 'err' ? 'var(--rose)' : tone === 'ok' ? 'var(--emerald)' : 'var(--text-2)',
        borderRadius: 2,
        fontFamily: 'var(--font-data)', fontSize: 13, fontWeight: 600,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text)', fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 500 }}>{title}</div>
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-ui)', fontSize: 11, marginTop: 2 }}>{body}</div>
      </div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 11,
        color: tone === 'err' ? 'var(--rose)' : tone === 'ok' ? 'var(--emerald)' : 'var(--text-3)',
        fontWeight: 600,
      }}>{delta}</div>
    </div>
  )
}
