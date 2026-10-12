#!/usr/bin/env bash
# Shared defaults for run-all.sh and run-offline.sh. Source this file; do not execute it.
# QA_PASSWORD is a synthetic password the flows type when they create a throwaway account.
# It is not a real credential. Override it if you want; do not point it at a person's account.

: "${API_BASE_URL:=https://ai-girlfriend-tnu3.onrender.com/api/v1/}"
: "${QA_PASSWORD:=Maestro123}"
: "${COMPANION_NAME:=Mae}"

maestro_test() {
  maestro test \
    -e "API_BASE_URL=${API_BASE_URL}" \
    -e "QA_PASSWORD=${QA_PASSWORD}" \
    -e "COMPANION_NAME=${COMPANION_NAME}" \
    "$@"
}
