/**
 * Typed wrappers around the Proof of Credit contract methods.
 * All read methods return parsed JSON; all write methods return the tx hash.
 */

import { getClient, useDemoAccount } from './genlayer'

export const POC_CONTRACT =
  (import.meta as any).env?.VITE_POC_CONTRACT_ADDRESS ||
  '0xE48AE90997c3060b40678650A668501454feD56a'

export interface CreditApplication {
  id: number
  applicant: string
  annual_income_usd: number
  employment_status: string
  employment_years: number
  loan_amount_requested: number
  loan_purpose: string
  existing_debt_usd: number
  has_bankruptcy: boolean
  has_delinquencies: boolean
  prior_onchain_repayments: number
  notes: string
  timestamp: number
  status: 'pending' | 'approved' | 'denied' | 'expired'
  credit_score: number
  max_credit_limit: number
  interest_rate_bps: number
  max_ltv_bps: number
  reasoning: string
}

export interface Loan {
  id: number
  borrower: string
  application_id: number
  principal: number
  interest_rate_bps: number
  amount_repaid: number
  deadline: number
  timestamp: number
  status: 'active' | 'repaid' | 'defaulted' | 'liquidated'
}

export interface UserProfile {
  address: string
  total_applications: number
  total_approved: number
  total_loans: number
  total_repaid: number
  total_defaulted: number
  lifetime_borrowed: number
  lifetime_repaid: number
  last_credit_score: number
  last_updated: number
}

export interface ProtocolStats {
  pool_balance: number
  total_deposited: number
  total_withdrawn: number
  total_borrowed: number
  total_repaid: number
  total_interest_collected: number
  total_defaults: number
  total_applications: number
  total_loans: number
  utilization_bps: number
  min_reserve_ratio_bps: number
}

export interface LenderPosition {
  address: string
  deposit: number
  share_bps: number
  accrued_interest_share: number
  current_value: number
}

// Helper to safely parse JSON string returns
function asJSON<T>(raw: unknown): T {
  if (typeof raw === 'string') return JSON.parse(raw) as T
  return raw as T
}

function asBigIntArgs(args: Array<number | string | boolean>): Array<unknown> {
  return args.map((a) => {
    if (typeof a === 'number' && Number.isInteger(a)) return BigInt(a)
    if (typeof a === 'string') return a
    if (typeof a === 'boolean') return a
    return a
  })
}

// ============================================================================
// READS
// ============================================================================

export async function getProtocolStats(): Promise<ProtocolStats> {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_protocol_stats',
    args: [],
  })
  return asJSON<ProtocolStats>(r)
}

export async function getApplication(id: number): Promise<CreditApplication | null> {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_application',
    args: [BigInt(id)],
  })
  const parsed = asJSON<CreditApplication & { error?: string }>(r)
  if (parsed?.error === 'not_found') return null
  return parsed
}

export async function getLoan(id: number): Promise<Loan | null> {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_loan',
    args: [BigInt(id)],
  })
  const parsed = asJSON<Loan & { error?: string }>(r)
  if (parsed?.error === 'not_found') return null
  return parsed
}

export async function getUserProfile(address: string): Promise<UserProfile> {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_user_profile',
    args: [address],
  })
  return asJSON<UserProfile>(r)
}

export async function getLenderPosition(address: string): Promise<LenderPosition> {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_lender_position',
    args: [address],
  })
  return asJSON<LenderPosition>(r)
}

export async function getRecentApplications(limit = 20, offset = 0) {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_recent_applications',
    args: [BigInt(limit), BigInt(offset)],
  })
  const parsed = asJSON<{ applications: unknown[]; total: number; offset: number; limit: number }>(r)
  // Contract returns each application as a JSON-encoded string; parse them
  const apps: CreditApplication[] = (parsed.applications ?? []).map((entry) => {
    if (typeof entry === 'string') {
      try { return JSON.parse(entry) as CreditApplication } catch { return null }
    }
    return entry as CreditApplication
  }).filter((x): x is CreditApplication => x !== null)
  return { applications: apps, total: parsed.total, offset: parsed.offset, limit: parsed.limit }
}

export async function getActiveLoans(limit = 20, offset = 0) {
  const c = getClient()
  const r = await c.readContract({
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'get_active_loans',
    args: [BigInt(limit), BigInt(offset)],
  })
  const parsed = asJSON<{ loans: unknown[]; total: number; offset: number; limit: number }>(r)
  const loansList: (Loan & { seconds_to_deadline: number })[] = (parsed.loans ?? []).map((entry) => {
    if (typeof entry === 'string') {
      try { return JSON.parse(entry) as any } catch { return null }
    }
    return entry as any
  }).filter((x): x is (Loan & { seconds_to_deadline: number }) => x !== null)
  return { loans: loansList, total: parsed.total, offset: parsed.offset, limit: parsed.limit }
}

// ============================================================================
// WRITES
// ============================================================================

export interface ApplyForCreditArgs {
  annual_income_usd: number
  employment_status: string
  employment_years: number
  loan_amount_requested: number
  loan_purpose: string
  existing_debt_usd: number
  has_bankruptcy: boolean
  has_delinquencies: boolean
  prior_onchain_repayments: number
  notes: string
}

export async function applyForCredit(args: ApplyForCreditArgs): Promise<string> {
  const account = useDemoAccount()
  const c = getClient(account.address as `0x${string}`)
  return (await c.writeContract({
    account,
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'apply_for_credit',
    args: [
      BigInt(args.annual_income_usd),
      args.employment_status,
      BigInt(args.employment_years),
      BigInt(args.loan_amount_requested),
      args.loan_purpose,
      BigInt(args.existing_debt_usd),
      args.has_bankruptcy,
      args.has_delinquencies,
      BigInt(args.prior_onchain_repayments),
      args.notes,
    ],
  })) as string
}

export async function depositToPool(): Promise<string> {
  const account = useDemoAccount()
  const c = getClient(account.address as `0x${string}`)
  return (await c.writeContract({
    account,
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'deposit',
    args: [],
    value: 100n * 10n ** 18n,  // 100 GEN
  })) as string
}

export async function drawLoan(applicationId: number, amount: number): Promise<string> {
  const account = useDemoAccount()
  const c = getClient(account.address as `0x${string}`)
  return (await c.writeContract({
    account,
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'draw_loan',
    args: [BigInt(applicationId), BigInt(amount)],
  })) as string
}

export async function repayLoan(loanId: number): Promise<string> {
  const account = useDemoAccount()
  const c = getClient(account.address as `0x${string}`)
  return (await c.writeContract({
    account,
    address: POC_CONTRACT as `0x${string}`,
    functionName: 'repay_loan',
    args: [BigInt(loanId)],
    value: 0n,  // studionet: 0 triggers full-repayment fallback
  })) as string
}

// ============================================================================
// UTILITIES
// ============================================================================

export async function waitForTxFinalized(hash: string, timeoutMs = 240_000) {
  const c = getClient()
  try {
    await c.waitForTransactionReceipt({ hash, interval: 2_000, retries: Math.ceil(timeoutMs / 2_000) })
  } catch (e) {
    console.warn('[poc] receipt wait timed out, continuing')
  }
}

export async function pollUntilChanged<T>(
  fetcher: () => Promise<T>,
  compare: (a: T, b: T) => boolean,
  baseline: T,
  timeoutMs = 120_000,
): Promise<T> {
  const start = Date.now()
  let backoff = 1500
  let last: T = baseline
  let lastError: string | null = null
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, backoff))
    try {
      last = await fetcher()
      if (compare(last, baseline)) return last
      backoff = Math.min(backoff * 1.4, 5000)
    } catch (err: any) {
      lastError = err?.shortMessage ?? err?.message ?? String(err)
      backoff = Math.min(backoff * 1.5, 5000)
    }
  }
  throw new Error(
    `Polling timeout after ${(timeoutMs / 1000).toFixed(0)}s. Last value unchanged. Last error: ${lastError ?? 'none'}`,
  )
}
