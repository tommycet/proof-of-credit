"""
Walkthrough recorder for Proof of Credit.

Reads walkthrough_plan.mjs (which exports a JS object), runs each stage via
Playwright with record_video_dir, and produces a single .webm then transcodes
to .mp4.
"""
import sys
import time
import json
import asyncio
import re
from pathlib import Path
from playwright.sync_api import sync_playwright


OUT_DIR = Path("/root/proof-of-credit/docs/media")
OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR = Path("/tmp/poc_walkthrough_raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)


def load_plan():
    """Load the Python walkthrough plan directly."""
    sys.path.insert(0, "/root/proof-of-credit/scripts")
    import importlib.util
    spec = importlib.util.spec_from_file_location("walkthrough_plan", "/root/proof-of-credit/scripts/walkthrough_plan.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PLAN


def execute_stage(page, stage, scroll_state):
    """Execute a single stage's actions."""
    if stage.get("scroll_to", {}).get("before"):
        y = stage["scroll_to"]["y"]
        page.evaluate(f"window.scrollTo({{ top: {y}, behavior: '{stage['scroll_to'].get('behavior', 'instant')}' }})")
        time.sleep(0.3)

    for action in stage.get("actions", []):
        if "goto" in action:
            url = action["goto"]
            if not url.startswith("http"):
                url = "http://localhost:5175" + url
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
        elif "click" in action:
            try:
                page.locator(action["click"]).first.click(timeout=8000)
            except Exception as e:
                print(f"  click failed ({action['click']}): {e}")
        elif "fill" in action:
            page.locator(action["fill"]["selector"]).fill(action["fill"]["value"])
        elif "wait" in action:
            time.sleep(action["wait"] / 1000.0)
        elif "scroll" in action:
            s = action["scroll"]
            page.evaluate(f"window.scrollTo({{ top: {s.get('y', 0)}, behavior: '{s.get('behavior', 'instant')}' }})")
        elif "eval" in action:
            try:
                page.evaluate(action["eval"])
            except Exception as e:
                print(f"  eval failed: {e}")

    if stage.get("expected_visible"):
        try:
            page.wait_for_function(
                f"() => document.body.innerText.toUpperCase().includes('{stage['expected_visible'].upper()}')",
                timeout=8000,
            )
            print(f"  ✓ expected_visible: {stage['expected_visible']}")
        except Exception:
            print(f"  ✗ expected_visible MISSING: {stage['expected_visible']}")


def main():
    plan = load_plan()
    print(f"Plan: {plan['goal']}")
    print(f"Stages: {len(plan['stages'])}")
    print(f"Output: {plan['output']}")

    width, height = plan["viewport"]
    fps = plan["fps"]

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            record_video_dir=str(RAW_DIR),
            record_video_size={"width": width, "height": height},
        )
        page = ctx.new_page()

        # Mute all console errors to keep recording clean
        page.on("console", lambda msg: None)
        page.on("pageerror", lambda err: None)

        timeline = []
        stage_start_times = []

        for i, stage in enumerate(plan["stages"]):
            print(f"\n[{i+1}/{len(plan['stages'])}] {stage['id']}: {stage['description']}")
            t0 = time.time()
            try:
                execute_stage(page, stage, {"y": 0})
            except Exception as e:
                print(f"  STAGE ERROR: {e}")
            stage_dur = time.time() - t0
            timeline.append({"id": stage["id"], "duration_sec": round(stage_dur, 2), "speed": stage.get("speed", 1)})
            print(f"  duration: {stage_dur:.2f}s (speed {stage.get('speed', 1)}x)")

        print("\nClosing browser...")
        # Capture the video path before closing the context
        try:
            video_path = page.video.path()
            print(f"  Video path: {video_path}")
        except Exception:
            video_path = None

        ctx.close()
        browser.close()

    # Move the raw .webm to a known location
    raw_webm = None
    for f in RAW_DIR.iterdir():
        if f.suffix == ".webm":
            raw_webm = f
            break

    if not raw_webm:
        print("ERROR: no .webm produced")
        sys.exit(1)

    final_webm = OUT_DIR / "poc-walkthrough.webm"
    final_webm.write_bytes(raw_webm.read_bytes())
    print(f"Saved raw: {final_webm}")

    # Transcode to mp4 (avoid the executor's filtergraph bug)
    final_mp4 = OUT_DIR / "poc-walkthrough.mp4"
    speed_factor = max(t["speed"] for t in timeline)
    # For now, simple transcode at original speed (or apply per-stage if time permits)
    import subprocess
    cmd = [
        "ffmpeg", "-y",
        "-i", str(final_webm),
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black",
        "-movflags", "+faststart",
        "-an",
        str(final_mp4),
    ]
    print("Transcoding:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    print(f"✓ Saved: {final_mp4}")
    print(f"  Size: {final_mp4.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
