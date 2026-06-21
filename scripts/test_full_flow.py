"""Full end-to-end browser test: home → apply → submit → view application → draw loan → repay."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5175"


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text[:300]}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"PAGEERR: {str(err)[:300]}"))

        print("Step 1: Navigate to homepage")
        page.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(7000)
        page.screenshot(path="/tmp/poc_full_01_home.png", full_page=False)

        print("Step 2: Click 'Deposit 100 GEN' from the Lending Pool page")
        page.locator("nav .nav-item:has-text('Lending Pool')").first.click()
        page.wait_for_timeout(3000)
        page.screenshot(path="/tmp/poc_full_02_pool.png", full_page=False)
        # Click deposit button (hero)
        page.locator("button:has-text('Deposit 100 GEN')").first.click()
        print("  Waiting for deposit confirmation...")
        # Wait for toast to clear / pool balance to update
        page.wait_for_timeout(25000)
        page.screenshot(path="/tmp/poc_full_03_after_deposit.png", full_page=False)

        print("Step 3: Back to home, then apply for credit")
        page.locator("nav .nav-item:has-text('Dashboard')").first.click()
        page.wait_for_timeout(2500)
        page.locator("button:has-text('Apply for Credit')").first.click()
        page.wait_for_timeout(2500)
        page.screenshot(path="/tmp/poc_full_04_apply_form.png", full_page=False)

        print("Step 4: Submit application")
        page.locator("button:has-text('Submit to AI Consensus')").first.click()
        print("  Waiting for consensus...")
        # Use DOM-based detection (app uses React state routing, not URL)
        try:
            page.wait_for_function(
                "() => document.body.innerText.includes('CREDIT SCORE') && "
                "(document.body.innerText.match(/Application #\\d+/) || []).length > 0",
                timeout=180_000,
            )
            print(f"  Application detail visible (URL: {page.url})")
        except Exception as e:
            print(f"  Navigation timeout: {e}")
            page.screenshot(path="/tmp/poc_full_05_timeout.png", full_page=False)
            print("Body:", page.evaluate("document.body.innerText")[:300])
            print("Errors:", errors[:3])
            sys.exit(1)
        page.wait_for_timeout(8000)
        page.screenshot(path="/tmp/poc_full_06_app_detail.png", full_page=False)
        body = page.evaluate("document.body.innerText")
        print("App detail body len:", len(body))

        print("Step 5: Draw loan from application page")
        # Look for the "Draw X GEN" button (filled emerald)
        # First, set amount to something small to stay within pool limits
        amt_input = page.locator("input[type='number']").last
        if amt_input.count() > 0:
            amt_input.fill("50")
            page.wait_for_timeout(500)
        draw_btn = page.locator("button.btn-primary:has-text('Draw')").first
        if draw_btn.count() > 0:
            draw_btn.click()
            print("  Loan draw submitted, waiting for loan to appear...")
            # Wait for total_loans to increment (poll every 5s for up to 120s)
            for i in range(24):
                page.wait_for_timeout(5000)
                # Navigate to dashboard to refresh stats
                page.locator("nav .nav-item:has-text('Dashboard')").first.click()
                page.wait_for_timeout(2000)
                # Go back to application page
                # (just check active loans count from main page stats)
                if "ACTIVE LOANS" in page.evaluate("document.body.innerText"):
                    body_text = page.evaluate("document.body.innerText")
                    import re
                    m = re.search(r"ACTIVE LOANS\s+(\d+)", body_text)
                    if m and int(m.group(1)) > 0:
                        print(f"  Loan drawn! Active loans: {m.group(1)}")
                        break
            page.screenshot(path="/tmp/poc_full_07_after_draw.png", full_page=False)
        else:
            print("  No Draw button visible")

        print("Step 6: Visit Loans page")
        page.locator("nav .nav-item:has-text('Active Loans')").first.click()
        page.wait_for_timeout(4000)
        page.screenshot(path="/tmp/poc_full_08_loans.png", full_page=False)

        print("Step 7: Repay loan")
        # Click on the first loan row
        first_loan = page.locator("tr.clickable").first
        if first_loan.count() > 0:
            first_loan.click()
            page.wait_for_timeout(3000)
            page.screenshot(path="/tmp/poc_full_09_loan_detail.png", full_page=False)
            repay_btn = page.locator("button:has-text('Repay')").first
            if repay_btn.count() > 0:
                repay_btn.click()
                print("  Repay submitted, waiting...")
                page.wait_for_timeout(25000)
                page.screenshot(path="/tmp/poc_full_10_after_repay.png", full_page=False)

        print("Step 8: Profile page")
        page.locator("nav .nav-item:has-text('Credit Profile')").first.click()
        page.wait_for_timeout(4000)
        page.screenshot(path="/tmp/poc_full_11_profile.png", full_page=False)

        browser.close()

    print()
    print("--- CONSOLE ERRORS ---")
    for e in errors[:10]:
        print(e)
    if not errors:
        print("(none)")


if __name__ == "__main__":
    main()
