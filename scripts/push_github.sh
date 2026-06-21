#!/bin/bash
# Push proof-of-credit to GitHub using the provided token.
set -e
cd /root/proof-of-credit
TOKEN=$(cat /tmp/gh_token)
URL="https://x-access-token:${TOKEN}@github.com/tommycet/proof-of-credit.git"
git push "$URL" main 2>&1 | tail -8
