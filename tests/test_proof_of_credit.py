"""
Unit tests for Proof of Credit contract using mock-genlayer pattern.

The real `genlayer` package only exists inside GenVM. These tests mock the
module so the contract can be imported and exercised locally. See
~/.hermes/skills/software-development/genlayer-dapp-development/SKILL.md for
the canonical pattern.
"""
import sys
import os
import json
import types
from unittest.mock import MagicMock


def _install_genlayer_mock():
    """Insert a fake `genlayer` module so the contract can import cleanly."""
    mock_module = types.ModuleType("genlayer")

    # Sized-int subclasses
    class _Uint(int):
        def __new__(cls, v):
            return super().__new__(cls, int(v))

    for name in ("u256", "u64", "u32", "bigint", "i256"):
        setattr(mock_module, name, _Uint)

    mock_module.Address = str

    # TreeMap used as type annotation (TreeMap[K, V]) AND as a factory.
    # Make it both a class (subscriptable) and instantiable.
    class _TreeMap(dict):
        def __class_getitem__(cls, params):
            return cls
        def __init__(self, *a, **kw):
            super().__init__()
    mock_module.TreeMap = _TreeMap

    # DynArray used as type annotation (DynArray[T])
    class _DynArray(list):
        def __class_getitem__(cls, params):
            return cls
    mock_module.DynArray = _DynArray

    # Contract base class
    class _Contract:
        pass
    mock_module.Contract = _Contract

    # allow_storage decorator (no-op)
    mock_module.allow_storage = lambda cls: cls

    # gl submodule
    mock_gl = types.ModuleType("genlayer.gl")
    mock_gl.Contract = _Contract

    # Decorators
    def _noop(fn):
        return fn

    mock_public = MagicMock()
    mock_public.write = _noop
    mock_public.write.payable = _noop
    mock_public.view = _noop
    mock_gl.public = mock_public

    # Message context
    mock_gl.message = MagicMock()
    mock_gl.message.value = 0
    mock_gl.message.sender_address = "0xTEST_APPLICANT"

    # nondet / eq_principle
    mock_gl.nondet = MagicMock()
    mock_gl.nondet.web.render.return_value = "page text"
    mock_gl.nondet.web.get.return_value = MagicMock(body=b"text")
    # Default LLM response — overridden per-test via side_effect
    mock_gl.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720,
        "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200,
        "max_ltv_bps": 6000,
        "reasoning": "Strong applicant with stable employment and low DTI.",
    })

    mock_gl.eq_principle = MagicMock()
    # The equivalence principle must call through to the function (so the
    # contract's LLM code actually executes) — side_effect not return_value
    mock_gl.eq_principle.prompt_non_comparative.side_effect = lambda fn, **kw: fn()
    mock_gl.eq_principle.strict_eq.side_effect = lambda fn, **kw: fn()

    # emit_transfer — emit the transfer event
    mock_gl.emit_transfer = MagicMock()

    mock_module.gl = mock_gl

    sys.modules["genlayer"] = mock_module
    sys.modules["genlayer.gl"] = mock_gl

    # Expose for test access
    global _MOCK_GL
    _MOCK_GL = mock_gl


def _reset_mocks():
    """Reset mutable mock state between tests."""
    _MOCK_GL.nondet.exec_prompt.reset_mock()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720,
        "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200,
        "max_ltv_bps": 6000,
        "reasoning": "Strong applicant.",
    })
    _MOCK_GL.eq_principle.prompt_non_comparative.side_effect = lambda fn, **kw: fn()
    _MOCK_GL.message.sender_address = "0xTEST_APPLICANT"
    _MOCK_GL.message.value = 10000 * 10**18  # 10000 GEN deposit for tests


_MOCK_GL = None


def _load_contract():
    """Import (or reload) the contract module and construct an instance."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "contracts"))
    # Force fresh import so __init__ runs again
    for mod in list(sys.modules.keys()):
        if mod == "proof_of_credit":
            del sys.modules[mod]
    import proof_of_credit
    instance = proof_of_credit.ProofOfCredit()
    # Manually init TreeMaps + dataclass fields (mock doesn't auto-init)
    instance.applications = {}
    instance.loans = {}
    instance.user_profiles = {}
    instance.lender_deposits = {}
    instance.lender_deposit_share = {}
    return instance, proof_of_credit


# ============================================================================
# Install mock + load contract at module import time
# ============================================================================
_install_genlayer_mock()
contract_module = None


def setup_module(_):
    global contract_module
    _install_genlayer_mock()
    _, contract_module = _load_contract()


def teardown_module(_):
    pass


# ============================================================================
# Tests
# ============================================================================

def test_init_zeros_scalars():
    """__init__ sets all scalar storage to zero. TreeMaps auto-init in GenVM."""
    inst, mod = _load_contract()
    assert int(inst.pool_balance) == 0
    assert int(inst.total_deposited) == 0
    assert int(inst.application_count) == 0
    assert int(inst.loan_count) == 0


def test_apply_for_credit_approved_path():
    """Approved credit: score >= 580, limit > 0, rate in valid range."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 740,
        "max_credit_limit_wei": 10 * 10**21,
        "interest_rate_bps": 900,
        "max_ltv_bps": 6500,
        "reasoning": "Excellent credit profile.",
    })

    app_id = inst.apply_for_credit(
        annual_income_usd=120000,
        employment_status="employed",
        employment_years=8,
        loan_amount_requested=2 * 10**21,
        loan_purpose="home_improvement",
        existing_debt_usd=15000,
        has_bankruptcy=False,
        has_delinquencies=False,
        prior_onchain_repayments=3,
        notes="Stable employment, looking to renovate kitchen.",
    )
    assert app_id == 1
    assert int(inst.application_count) == 1

    app = inst.applications[1]
    assert int(app.credit_score) == 740
    assert str(app.status) == "approved"
    assert int(app.max_credit_limit) == 10 * 10**21
    assert int(app.interest_rate_bps) == 900
    assert int(app.max_ltv_bps) == 6500


def test_apply_for_credit_denied_path():
    """Denied credit: score < 580, limit zeroed, rate zeroed."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 520,
        "max_credit_limit_wei": 1 * 10**21,
        "interest_rate_bps": 2400,
        "max_ltv_bps": 3000,
        "reasoning": "High DTI, recent delinquencies, prior defaults.",
    })

    app_id = inst.apply_for_credit(
        annual_income_usd=35000,
        employment_status="self_employed",
        employment_years=1,
        loan_amount_requested=15 * 10**21,
        loan_purpose="business",
        existing_debt_usd=25000,
        has_bankruptcy=True,
        has_delinquencies=True,
        prior_onchain_repayments=0,
        notes="",
    )
    app = inst.applications[app_id]
    assert str(app.status) == "denied"
    assert int(app.max_credit_limit) == 0
    assert int(app.interest_rate_bps) == 0


def test_apply_validation_errors():
    """Invalid inputs must raise before LLM call."""
    _reset_mocks()
    inst, mod = _load_contract()

    try:
        inst.apply_for_credit(
            annual_income_usd=-100,
            employment_status="employed",
            employment_years=2,
            loan_amount_requested=10**21,
            loan_purpose="other",
            existing_debt_usd=0,
            has_bankruptcy=False,
            has_delinquencies=False,
            prior_onchain_repayments=0,
            notes="",
        )
        assert False, "expected Exception"
    except Exception as e:
        assert "income" in str(e).lower()


def test_apply_invalid_employment_status():
    _reset_mocks()
    inst, mod = _load_contract()
    try:
        inst.apply_for_credit(
            annual_income_usd=100000,
            employment_status="freelance",  # invalid
            employment_years=5,
            loan_amount_requested=10**21,
            loan_purpose="other",
            existing_debt_usd=0,
            has_bankruptcy=False,
            has_delinquencies=False,
            prior_onchain_repayments=0,
            notes="",
        )
        assert False, "expected Exception"
    except Exception as e:
        assert "employment" in str(e).lower()


def test_apply_handles_markdown_fences():
    """LLM may wrap JSON in markdown fences — parser must extract."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = (
        '```json\n{"credit_score": 700, "max_credit_limit_wei": 3e21, '
        '"interest_rate_bps": 1100, "max_ltv_bps": 5500, "reasoning": "Solid."}\n```'
    )
    app_id = inst.apply_for_credit(
        annual_income_usd=80000,
        employment_status="employed",
        employment_years=5,
        loan_amount_requested=10**21,
        loan_purpose="education",
        existing_debt_usd=10000,
        has_bankruptcy=False,
        has_delinquencies=False,
        prior_onchain_repayments=1,
        notes="",
    )
    app = inst.applications[app_id]
    assert int(app.credit_score) == 700


def test_apply_handles_garbage_response():
    """If LLM returns garbage, parse falls back to safe default (denied)."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = "I cannot evaluate this request."

    app_id = inst.apply_for_credit(
        annual_income_usd=50000,
        employment_status="employed",
        employment_years=3,
        loan_amount_requested=5 * 10**21,
        loan_purpose="other",
        existing_debt_usd=5000,
        has_bankruptcy=False,
        has_delinquencies=False,
        prior_onchain_repayments=0,
        notes="",
    )
    app = inst.applications[app_id]
    # garbage response -> invalid JSON -> safe default (300 score, 0 limit)
    assert int(app.credit_score) == mod.MIN_CREDIT_SCORE


def test_apply_clamps_out_of_range_score():
    """LLM response with score > 850 must be clamped."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 950,
        "max_credit_limit_wei": 10**22,
        "interest_rate_bps": 100,
        "max_ltv_bps": 9500,
        "reasoning": "Over the top.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=200000,
        employment_status="employed",
        employment_years=10,
        loan_amount_requested=10**22,
        loan_purpose="business",
        existing_debt_usd=0,
        has_bankruptcy=False,
        has_delinquencies=False,
        prior_onchain_repayments=10,
        notes="",
    )
    app = inst.applications[app_id]
    assert int(app.credit_score) == 850  # clamped to MAX
    assert int(app.max_ltv_bps) == mod.MAX_UTILIZATION_BPS  # clamped to 8000


def test_deposit_increases_pool():
    """Deposit increases pool_balance + total_deposited."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.message.sender_address = "0xLENDER_1"

    # studionet: gl.message.value is 0; we fall back to default 1 GEN
    new_dep = inst.deposit()
    assert int(inst.pool_balance) > 0
    assert int(inst.total_deposited) > 0
    assert new_dep == int(inst.pool_balance)


def test_withdraw_returns_funds():
    """Withdraw decreases pool_balance."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.message.sender_address = "0xLENDER_1"
    inst.deposit()
    pool_before = int(inst.pool_balance)

    # Withdraw 1000 wei (well within reserve)
    _MOCK_GL.message.value = 1000  # doesn't matter for non-payable
    remaining = inst.withdraw(1000)
    assert int(inst.pool_balance) == pool_before - 1000


def test_withdraw_below_reserve_fails():
    """Withdrawal must respect min reserve ratio."""
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.message.sender_address = "0xLENDER_1"
    inst.deposit()
    # Try to withdraw almost everything
    try:
        inst.withdraw(int(inst.pool_balance) - 100)
        assert False, "expected Exception"
    except Exception as e:
        assert "reserve" in str(e).lower() or "withdrawal" in str(e).lower()


def test_withdraw_more_than_deposit_fails():
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.message.sender_address = "0xLENDER"
    inst.deposit()
    try:
        inst.withdraw(10**30)
        assert False, "expected Exception"
    except Exception as e:
        assert "insufficient" in str(e).lower() or "deposit" in str(e).lower()


def test_draw_loan_happy_path():
    """Draw against approved application: loan created, pool debited."""
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xBORROWER_1"
    _MOCK_GL.message.sender_address = applicant
    # Seed pool
    _MOCK_GL.message.sender_address = "0xLENDER"
    inst.deposit()
    _MOCK_GL.message.sender_address = applicant
    # Apply + auto-approve
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720,
        "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200,
        "max_ltv_bps": 6000,
        "reasoning": "Good.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=100000,
        employment_status="employed",
        employment_years=6,
        loan_amount_requested=3 * 10**21,
        loan_purpose="home_improvement",
        existing_debt_usd=10000,
        has_bankruptcy=False,
        has_delinquencies=False,
        prior_onchain_repayments=2,
        notes="",
    )

    # Draw
    pool_before = int(inst.pool_balance)
    loan_id = inst.draw_loan(app_id, 2 * 10**21)
    assert int(inst.loan_count) == 1
    loan = inst.loans[loan_id]
    assert str(loan.status) == "active"
    assert int(loan.principal) == 2 * 10**21
    assert int(loan.interest_rate_bps) == 1200
    assert int(inst.pool_balance) == pool_before - 2 * 10**21
    assert int(inst.total_borrowed) == 2 * 10**21


def test_draw_loan_only_by_applicant():
    """Only the application applicant can draw their own loan."""
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xBORROWER_1"
    other = "0xBORROWER_2"
    _MOCK_GL.message.sender_address = applicant
    inst.deposit()  # Seed pool
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720,
        "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200,
        "max_ltv_bps": 6000,
        "reasoning": "Good.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=100000, employment_status="employed",
        employment_years=6, loan_amount_requested=3 * 10**21,
        loan_purpose="home_improvement", existing_debt_usd=10000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=2, notes="",
    )
    _MOCK_GL.message.sender_address = other
    try:
        inst.draw_loan(app_id, 1 * 10**21)
        assert False, "expected Exception"
    except Exception as e:
        assert "applicant" in str(e).lower() or "borrower" in str(e).lower()


def test_draw_loan_exceeds_credit_limit():
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xB"
    _MOCK_GL.message.sender_address = applicant
    inst.deposit()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720,
        "max_credit_limit_wei": 2 * 10**21,
        "interest_rate_bps": 1200,
        "max_ltv_bps": 6000,
        "reasoning": "Ok.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=80000, employment_status="employed",
        employment_years=4, loan_amount_requested=10**21,
        loan_purpose="other", existing_debt_usd=5000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=0, notes="",
    )
    try:
        inst.draw_loan(app_id, 5 * 10**21)
        assert False, "expected Exception"
    except Exception as e:
        assert "limit" in str(e).lower()


def test_repay_loan_full():
    """Full repayment marks loan repaid, updates profile."""
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xB"
    _MOCK_GL.message.sender_address = applicant
    inst.deposit()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720, "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200, "max_ltv_bps": 6000, "reasoning": "Good.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=100000, employment_status="employed",
        employment_years=6, loan_amount_requested=3 * 10**21,
        loan_purpose="home_improvement", existing_debt_usd=10000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=2, notes="",
    )
    loan_id = inst.draw_loan(app_id, 2 * 10**21)

    score_before = int(inst.user_profiles[applicant].last_credit_score)
    repaid_before = int(inst.user_profiles[applicant].total_repaid)

    repaid = inst.repay_loan(loan_id)
    loan = inst.loans[loan_id]
    assert str(loan.status) == "repaid"
    profile_after = inst.user_profiles[applicant]
    assert int(profile_after.total_repaid) == repaid_before + 1
    assert int(profile_after.last_credit_score) >= score_before  # score didn't decrease


def test_repay_loan_partial():
    """Partial repayment leaves loan active."""
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xB"
    _MOCK_GL.message.sender_address = applicant
    inst.deposit()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720, "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200, "max_ltv_bps": 6000, "reasoning": "Good.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=100000, employment_status="employed",
        employment_years=6, loan_amount_requested=3 * 10**21,
        loan_purpose="home_improvement", existing_debt_usd=10000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=2, notes="",
    )
    loan_id = inst.draw_loan(app_id, 2 * 10**21)
    # Force partial repayment by setting message.value to half
    _MOCK_GL.message.value = 10**21  # half of principal
    repaid = inst.repay_loan(loan_id)
    loan = inst.loans[loan_id]
    assert str(loan.status) == "active"  # still active


def test_liquidate_after_deadline():
    """Liquidation after deadline marks loan defaulted, tanks score."""
    _reset_mocks()
    inst, mod = _load_contract()
    applicant = "0xB"
    _MOCK_GL.message.sender_address = applicant
    inst.deposit()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 720, "max_credit_limit_wei": 5 * 10**21,
        "interest_rate_bps": 1200, "max_ltv_bps": 6000, "reasoning": "Good.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=100000, employment_status="employed",
        employment_years=6, loan_amount_requested=3 * 10**21,
        loan_purpose="home_improvement", existing_debt_usd=10000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=2, notes="",
    )
    loan_id = inst.draw_loan(app_id, 2 * 10**21)

    # Force the deadline into the past
    inst.loans[loan_id].deadline = mod.u256(1)  # epoch 1 — way past

    result = inst.liquidate_defaulted_loan(loan_id)
    assert result == "liquidated"
    loan = inst.loans[loan_id]
    assert str(loan.status) == "defaulted"
    assert int(inst.total_defaults) == 1


def test_get_application_json():
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 700, "max_credit_limit_wei": 3 * 10**21,
        "interest_rate_bps": 1100, "max_ltv_bps": 5500, "reasoning": "OK",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=80000, employment_status="employed",
        employment_years=4, loan_amount_requested=10**21,
        loan_purpose="other", existing_debt_usd=5000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=0, notes="",
    )
    raw = inst.get_application(app_id)
    data = json.loads(raw)
    assert data["id"] == app_id
    assert data["credit_score"] == 700
    assert data["status"] == "approved"


def test_get_application_not_found():
    _reset_mocks()
    inst, mod = _load_contract()
    raw = inst.get_application(999)
    data = json.loads(raw)
    assert "error" in data


def test_get_protocol_stats():
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.message.sender_address = "0xLENDER"
    inst.deposit()
    raw = inst.get_protocol_stats()
    data = json.loads(raw)
    assert "pool_balance" in data
    assert "total_deposited" in data
    assert "min_reserve_ratio_bps" in data


def test_get_recent_applications_paginated():
    _reset_mocks()
    inst, mod = _load_contract()
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 700, "max_credit_limit_wei": 3 * 10**21,
        "interest_rate_bps": 1100, "max_ltv_bps": 5500, "reasoning": "OK",
    })
    # Create 3 applications
    for i in range(3):
        _MOCK_GL.message.sender_address = f"0xUSER_{i}"
        inst.apply_for_credit(
            annual_income_usd=80000, employment_status="employed",
            employment_years=4, loan_amount_requested=10**21,
            loan_purpose="other", existing_debt_usd=5000,
            has_bankruptcy=False, has_delinquencies=False,
            prior_onchain_repayments=0, notes="",
        )
    raw = inst.get_recent_applications(10, 0)
    data = json.loads(raw)
    assert data["total"] == 3
    assert len(data["applications"]) == 3


def test_get_user_profile_creates_zero():
    _reset_mocks()
    inst, mod = _load_contract()
    raw = inst.get_user_profile("0xUNKNOWN")
    data = json.loads(raw)
    assert data["total_applications"] == 0
    assert data["last_credit_score"] == 0


def test_compute_interest_basic():
    inst, mod = _load_contract()
    # 1 GEN @ 10% APR for 1 year = ~0.1 GEN interest
    interest = inst._compute_interest(
        principal=10**18,
        rate_bps=1000,    # 10%
        start_ts=0,
        end_ts=365 * 24 * 3600,   # 1 year
    )
    assert abs(interest - 10**17) < 10**15  # ~0.1 GEN


def test_compute_interest_zero_for_zero_time():
    inst, mod = _load_contract()
    interest = inst._compute_interest(10**18, 1000, 100, 100)
    assert interest == 0


def test_protocol_stats_after_full_lifecycle():
    """End-to-end: lender deposits, borrower applies, draws, repays, stats reflect."""
    _reset_mocks()
    inst, mod = _load_contract()

    # 1. Lender seeds pool
    _MOCK_GL.message.sender_address = "0xLENDER"
    inst.deposit()
    pool_after_deposit = int(inst.pool_balance)

    # 2. Borrower applies (approved)
    _MOCK_GL.message.sender_address = "0xBORROWER"
    _MOCK_GL.nondet.exec_prompt.return_value = json.dumps({
        "credit_score": 750, "max_credit_limit_wei": 4 * 10**21,
        "interest_rate_bps": 900, "max_ltv_bps": 6500, "reasoning": "Strong.",
    })
    app_id = inst.apply_for_credit(
        annual_income_usd=120000, employment_status="employed",
        employment_years=10, loan_amount_requested=2 * 10**21,
        loan_purpose="home_improvement", existing_debt_usd=10000,
        has_bankruptcy=False, has_delinquencies=False,
        prior_onchain_repayments=5, notes="",
    )

    # 3. Draw loan
    loan_id = inst.draw_loan(app_id, int(2 * 10**21))

    # 4. Repay fully
    inst.repay_loan(loan_id)

    # 5. Check stats
    stats = json.loads(inst.get_protocol_stats())
    assert stats["total_applications"] == 1
    assert stats["total_loans"] == 1
    assert stats["total_borrowed"] >= 2 * 10**21
    assert stats["total_repaid"] >= 2 * 10**21
    assert stats["total_defaults"] == 0
    assert stats["pool_balance"] >= pool_after_deposit  # pool recovered + interest
