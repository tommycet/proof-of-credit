"""Full end-to-end browser test: navigate through apply → submit → view application."""
import sys
import time
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
        page.wait_for_timeout(6000)
        page.screenshot(path="/tmp/poc_01_home.png", full_page=False)

        print("Step 2: Click 'Apply for Credit' button in hero")
        # Find the APPLY FOR CREDIT button (primary, in hero)
        apply_btn = page.locator("button:has-text('Apply for Credit')").first
        apply_btn.click()
        page.wait_for_timeout(3500)
        page.screenshot(path="/tmp/poc_02_apply_form.png", full_page=False)
        print(f"  URL: {page.url}")
        body_text = page.evaluate("document.body.innerText || ''")
        assert "Borrower Profile" in body_text or "BORROWER PROFILE" in body_text, "apply form not visible"
        print("  ✓ Apply form is visible")

        print("Step 3: Fill the form")
        # Form is pre-filled with good defaults. Just click submit.
        print("Step 4: Submit application to AI consensus")
        submit_btn = page.locator("button:has-text('Submit to AI Consensus')").first
        submit_btn.click()
        print("  Waiting for tx + consensus...")
        # Wait up to 120 seconds for navigation to ApplicationDetail (consensus complete)
        try:
            page.wait_for_url("**/application/**", timeout=180_000)
            print(f"  Navigated to: {page.url}")
        except Exception as e:
            print(f"  Navigation timeout: {e}")
            page.screenshot(path="/tmp/poc_03_after_submit.png", full_page=False)
            body_text = page.evaluate("document.body.innerText || ''")
            print("BODY:", body_text[:500])
            print("ERRORS:", errors[:5])
            sys.exit(1)
        page.wait_for_timeout(8000)
        page.screenshot(path="/tmp/poc_04_application_detail.png", full_page=False)

        body_text = page.evaluate("document.body.innerText || ''")
        print(f"Body length after apply: {len(body_text)}")

        print("Step 5: Back to dashboard to see updated state")
        page.locator("nav .nav-item:has-text('Dashboard')").first.click()
        page.wait_for_timeout(4000)
        page.screenshot(path="/tmp/poc_05_dashboard.png", full_page=False)

        print("Step 6: Visit Pool page")
        page.locator("nav .nav-item:has-text('Lending Pool')").first.click()
        page.wait_for_timeout(3000)
        page.screenshot(path="/tmp/poc_06_pool.png", full_page=False)

        browser.close()

    print()
    print("--- CONSOLE ERRORS ---")
    for e in errors[:10]:
        print(e)
    if not errors:
        print("(none)")


if __name__ == "__main__":
    main()
