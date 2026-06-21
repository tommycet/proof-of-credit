"""Capture a screenshot of the production deployment."""
from playwright.sync_api import sync_playwright

URL = "https://proof-of-credit-five.vercel.app/"

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))

    page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(10000)
    page.screenshot(path="/tmp/poc_live.png", full_page=False)

    # Verify it rendered
    body = page.evaluate("document.body.innerText")
    print(f"Body length: {len(body)}")
    print(f"Errors: {errs}")
    print("Snippet:")
    print(body[:300])

    browser.close()
