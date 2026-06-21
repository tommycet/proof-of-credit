#!/bin/bash
# Deploy Proof of Credit contract to studionet
set -e
cd /root/proof-of-credit
POC_PASSWORD=***
/tmp/poc_password)
export POC_PASSWORD
echo "Deploying proof_of_credit.py to studionet..."
echo "$POC_PASSWORD" | timeout 300 genlayer deploy \
    --contract contracts/proof_of_credit.py \
    --rpc https://studio.genlayer.com/api 2>&1 | tee /tmp/poc_deploy.log
