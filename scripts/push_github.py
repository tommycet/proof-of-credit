"""
Push proof-of-credit to GitHub using the user-provided token.

Token is loaded from /tmp/gh_token (already written there).
"""
import subprocess
import sys

token_path = "/tmp/gh_token"
with open(token_path) as f:
    token = f.read().strip()

print(f"Token length: {len(token)}, starts: {token[:4]}...")

# Verify token works
import urllib.request
req = urllib.request.Request("https://api.github.com/user",
                            headers={"Authorization": f"token {token}",
                                     "Accept": "application/vnd.github+json"})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        import json
        user = json.loads(resp.read())
        print(f"Authenticated as: {user.get('login')}")
except Exception as e:
    print(f"Auth check failed: {e}")
    sys.exit(1)

# Build the authenticated URL and push
repo = "tommycet/proof-of-credit"
url = f"https://x-access-token:{token}@github.com/{repo}.git"

result = subprocess.run(
    ["git", "push", url, "main"],
    cwd="/root/proof-of-credit",
    capture_output=True,
    text=True,
    timeout=180,
)
print("STDOUT:", result.stdout[-1000:] if result.stdout else "")
print("STDERR:", result.stderr[-1000:] if result.stderr else "")
print(f"Exit code: {result.returncode}")
