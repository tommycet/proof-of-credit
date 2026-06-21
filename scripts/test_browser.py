"""Quick page-render test using Playwright. Captures console errors + screenshot."""
import sys
from playwright.sync_api import sync_playwright


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text[:300]}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda err: errors.append(f"PAGEERR: {str(err)[:300]}"))
        page.goto("http://localhost:5174/", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(8000)  # Give React + RPC polling time to mount and load
        body_text = page.evaluate("document.body.innerText || ''")
        page.screenshot(path="/tmp/poc_home.png", full_page=False)
        browser.close()

    print(f"BODY TEXT LEN: {len(body_text)}")
    print("--- ERRORS ---")
    for e in errors[:10]:
        print(e)
    print("--- BODY SNIPPET (first 600) ---")
    print(body_text[:600])
    if not body_text.strip():
        print("EMPTY PAGE — RENDERING FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
