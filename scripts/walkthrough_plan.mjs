/**
 * Walkthrough plan for Proof of Credit.
 *
 * Records the dApp as a real user would use it:
 *   1. Dashboard (live stats from on-chain)
 *   2. Deposit into the lending pool
 *   3. Apply for credit (form fill + submit)
 *   4. View the AI-consensus-approved application (score, reasoning, profile)
 *   5. Draw a loan against the credit line
 *   6. View active loan in the Loans page
 *   7. Repay the loan
 *   8. View updated credit profile
 *
 * Per-stage speed regions compress consensus waits while keeping all flows visible.
 */
const plan = {
  goal: "Walk through the Proof of Credit dApp end-to-end",
  target_url: "http://localhost:5175/",
  viewport: [1440, 900],
  fps: 25,

  output: {
    format: "mp4",
    size: "original",
    quality: "high",
  },

  stages: [
    {
      id: "home_overview",
      description: "Dashboard with live protocol stats and recent applications",
      actions: [
        { goto: "/" },
        { wait: 6000 },  // Let the page hydrate and pull initial data
      ],
      expected_visible: "PROOF OF CREDIT",
      scroll_to: { y: 0, behavior: "instant", before: true },
    },

    {
      id: "scroll_dashboard",
      description: "Scroll through dashboard showing recent applications and active loans",
      actions: [
        { scroll: { y: 700, behavior: "smooth" } },
        { wait: 2200 },
        { scroll: { y: 1300, behavior: "smooth" } },
        { wait: 2200 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 1500 },
      ],
      expected_visible: "RECENT APPLICATIONS",
    },

    {
      id: "navigate_to_pool",
      description: "Navigate to Lending Pool page and view deposit panel",
      actions: [
        { click: "nav .nav-item:has-text('Lending Pool')" },
        { wait: 3500 },
        { scroll: { y: 0, behavior: "instant", before: true } },
      ],
      expected_visible: "LENDING POOL",
    },

    {
      id: "deposit_100_gen",
      description: "Deposit 100 GEN into the lending pool",
      actions: [
        { click: "button:has-text('Deposit 100 GEN')" },
        { wait: 8000 },  // Wait for tx confirmation
      ],
      expected_visible: "DEPOSIT",
    },

    {
      id: "scroll_pool",
      description: "Scroll through pool mechanics",
      actions: [
        { scroll: { y: 600, behavior: "smooth" } },
        { wait: 2000 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 1500 },
      ],
    },

    {
      id: "navigate_to_apply",
      description: "Navigate to Apply for Credit page",
      actions: [
        { click: "nav .nav-item:has-text('Apply for Credit')" },
        { wait: 3500 },
        { scroll: { y: 0, behavior: "instant", before: true } },
      ],
      expected_visible: "BORROWER PROFILE",
    },

    {
      id: "fill_form",
      description: "Pre-filled credit application form",
      actions: [
        { scroll: { y: 400, behavior: "smooth" } },
        { wait: 1500 },
        { scroll: { y: 800, behavior: "smooth" } },
        { wait: 1500 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 1500 },
      ],
      expected_visible: "LOAN AMOUNT",
    },

    {
      id: "submit_to_consensus",
      description: "Submit to AI consensus — wait for validators to reach agreement",
      speed: 6,
      actions: [
        { scroll: { y: 0, behavior: "instant", before: true } },
        { click: "button:has-text('Submit to AI Consensus')" },
        { wait: 30000 },  // studionet consensus ~30-90s, speed 6 compresses to ~5s
      ],
      expected_visible: "CONSORT",
    },

    {
      id: "application_detail",
      description: "View approved application with credit score gauge and AI reasoning",
      actions: [
        { wait: 3000 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 2000 },
        { scroll: { y: 500, behavior: "smooth" } },
        { wait: 2000 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 2000 },
      ],
      expected_visible: "AI REASONING",
    },

    {
      id: "draw_loan",
      description: "Draw a loan against the approved credit line",
      actions: [
        { scroll: { y: 0, behavior: "instant", before: true } },
        { wait: 1500 },
        { scroll: { y: 800, behavior: "smooth" } },
        { wait: 1500 },
        // Adjust draw amount
        { eval: `() => { const inputs = document.querySelectorAll('input[type="number"]'); const last = inputs[inputs.length - 1]; if (last) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(last, '50'); last.dispatchEvent(new Event('input', { bubbles: true })); } return 'ok'; }` },
        { wait: 1000 },
      ],
      expected_visible: "CREDIT LINE OPEN",
    },

    {
      id: "wait_draw_consensus",
      description: "Wait for draw loan consensus",
      speed: 4,
      actions: [
        { click: "button.btn-primary:has-text('Draw')" },
        { wait: 25000 },
      ],
    },

    {
      id: "loans_page",
      description: "View the active loan in the marketplace",
      actions: [
        { click: "nav .nav-item:has-text('Active Loans')" },
        { wait: 4000 },
        { scroll: { y: 0, behavior: "instant", before: true } },
      ],
      expected_visible: "ACTIVE LOANS",
    },

    {
      id: "profile_page",
      description: "View updated credit profile showing lifetime activity",
      actions: [
        { click: "nav .nav-item:has-text('Credit Profile')" },
        { wait: 4000 },
        { scroll: { y: 0, behavior: "instant", before: true } },
        { scroll: { y: 400, behavior: "smooth" } },
        { wait: 2500 },
        { scroll: { y: 0, behavior: "smooth" } },
        { wait: 1500 },
      ],
      expected_visible: "CREDIT PROFILE",
    },
  ],
}

export default plan
