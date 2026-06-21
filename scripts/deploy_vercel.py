"""
Deploy Proof of Credit frontend to Vercel.

Workflow:
  1. Create Vercel project linked to the GitHub repo
  2. Set VITE_POC_CONTRACT_ADDRESS as a persistent build-time env var
  3. Trigger a production deployment via the Vercel CLI
  4. Print the live URL
"""
import json
import os
import subprocess
import sys
import urllib.request

VERCEL_TOKEN = open("/tmp/vercel_token").read().strip()
PROJECT_NAME = "proof-of-credit"
GITHUB_REPO = "tommycet/proof-of-credit"
CONTRACT_ADDR = "0xE48AE90997c3060b40678650A668501454feD56a"
VITE_ENV_KEY = "VITE_POC_CONTRACT_ADDRESS"
VITE_ENV_VALUE = CONTRACT_ADDR

BASE = "https://api.vercel.com"
HEADERS = {
    "Authorization": f"Bearer {VERCEL_TOKEN}",
    "Content-Type": "application/json",
}


def http(method, path, body=None, params=None):
    url = f"{BASE}{path}"
    if params:
        from urllib.parse import urlencode
        url += "?" + urlencode(params)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# 1) Verify token
print("=== STEP 1: verify Vercel token ===")
me = http("GET", "/v2/user")
print(f"  user: {me.get('user', {}).get('email')}")
print(f"  team: {me.get('user', {}).get('defaultTeamId')}")

# 2) Check if project already exists
print("\n=== STEP 2: check for existing project ===")
existing = http("GET", "/v9/projects", params={"limit": 100})
projects = existing.get("projects", [])
project = next((p for p in projects if p.get("name") == PROJECT_NAME), None)

if not project:
    print(f"  Creating project '{PROJECT_NAME}'...")
    body = {
        "name": PROJECT_NAME,
        "framework": None,
        "gitRepository": {"type": "github", "repo": GITHUB_REPO},
    }
    project = http("POST", "/v10/projects", body)
    print(f"  Created: {project.get('id')}")
else:
    print(f"  Found existing: {project.get('id')}")

project_id = project["id"]

# 3) Set the build-time env var
print("\n=== STEP 3: set VITE_POC_CONTRACT_ADDRESS env var ===")
try:
    resp = http("POST", f"/v10/projects/{project_id}/env",
                {"key": VITE_ENV_KEY, "value": VITE_ENV_VALUE,
                 "type": "plain", "target": ["production"]})
    print(f"  Env created: id={resp.get('id')}")
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    if body.get("error", {}).get("code") == "ENV_ALREADY_EXISTS":
        print(f"  Env already exists (skipping)")
    else:
        print(f"  Env error: {body}")

# 4) Trigger production deployment via vercel CLI
print("\n=== STEP 4: deploy via Vercel CLI ===")
env = os.environ.copy()
env["VERCEL_TOKEN"] = VERCEL_TOKEN
# Use the globally-installed vercel binary directly
cmd = ["/root/.hermes/node/bin/vercel", "deploy", "--prod", "--yes",
       "--build-env", f"{VITE_ENV_KEY}={VITE_ENV_VALUE}",
       "--token", VERCEL_TOKEN]
result = subprocess.run(cmd, cwd="/root/proof-of-credit",
                        capture_output=True, text=True, timeout=600, env=env)
print("STDOUT:")
print(result.stdout[-2500:])
if result.stderr:
    print("STDERR:")
    print(result.stderr[-2500:])
print(f"Exit code: {result.returncode}")

# 5) Get the deployment URL
print("\n=== STEP 5: get deployment URL ===")
deployments = http("GET", "/v6/deployments", params={"projectId": project_id, "limit": 3})
for d in deployments.get("deployments", []):
    print(f"  - {d.get('url')} (state: {d.get('state')}, ready: {d.get('readyState')})")

print("\n=== DONE ===")
