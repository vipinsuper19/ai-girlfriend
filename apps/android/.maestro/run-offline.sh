#!/usr/bin/env bash
# Airplane-mode wrapper for the chat retry flow.
# Toggles the emulator network with adb, not from inside the app.
# Usage: ./run-offline.sh
# Expects adb, maestro, and a debug build already installed (run-all.sh does that).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${DIR}/env.sh"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not on PATH. Start the API 34 emulator before this script." >&2
  exit 1
fi
if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro is not on PATH. Install it from https://get.maestro.mobile.dev" >&2
  exit 1
fi

adb wait-for-device

restore_network() {
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell svc data enable >/dev/null 2>&1 || true
}

network_off() {
  echo "Disabling network with adb (airplane mode)."
  if adb shell cmd connectivity airplane-mode enable; then
    return 0
  fi
  echo "cmd connectivity airplane-mode enable failed; disabling wifi and mobile data." >&2
  adb shell svc wifi disable
  adb shell svc data disable
}

# Host and port of API_BASE_URL. https URLs without a port use 443.
api_endpoint() {
  local rest="${API_BASE_URL#*://}"
  rest="${rest%%/*}"
  if [[ "${rest}" == *:* ]]; then
    API_HOST="${rest%%:*}"
    API_PORT="${rest##*:}"
  else
    API_HOST="${rest}"
    if [[ "${API_BASE_URL}" == https://* ]]; then
      API_PORT=443
    else
      API_PORT=80
    fi
  fi
}

# Airplane mode is off, and either the API host answers or Android has a
# validated network. Ping to 8.8.8.8 is not a signal: runners drop that ICMP
# after airplane mode is off, so a local API at 10.0.2.2 never gets a retry.
emulator_reaches_api() {
  local mode
  mode="$(adb shell settings get global airplane_mode_on 2>/dev/null | tr -d '\r')"
  [[ "${mode}" == "0" ]] || return 1
  if adb shell ping -c 1 -W 2 "${API_HOST}" >/dev/null 2>&1; then
    return 0
  fi
  adb shell dumpsys connectivity 2>/dev/null | grep -q "VALIDATED"
}

network_on() {
  echo "Restoring network with adb."
  adb shell cmd connectivity airplane-mode disable || true
  adb shell svc wifi enable || true
  adb shell svc data enable || true
  api_endpoint
  local attempt hits=0
  for attempt in $(seq 1 30); do
    if emulator_reaches_api; then
      hits=$((hits + 1))
      if [[ "${hits}" -ge 2 ]]; then
        echo "Network is back (${API_HOST}:${API_PORT})."
        return 0
      fi
    else
      hits=0
    fi
    sleep 2
  done
  echo "Emulator could not reach ${API_HOST}:${API_PORT} within 60s." >&2
  adb shell settings get global airplane_mode_on || true
  adb shell ping -c 1 -W 2 "${API_HOST}" || true
  return 1
}

trap restore_network EXIT

echo "======== 05 offline/retry ========"
echo "Maestro artifacts: ${MAESTRO_OUT}"
SHOT=05-offline-retry MAESTRO_REPORT=05-offline-retry-reach maestro_test "${DIR}/offline/05a-reach-chat.yaml"
network_off
status=0
SHOT=05-offline-retry MAESTRO_REPORT=05-offline-retry-offline maestro_test "${DIR}/offline/05b-send-offline.yaml" || status=$?
network_on || status=1
if [[ "${status}" -eq 0 ]]; then
  SHOT=05-offline-retry MAESTRO_REPORT=05-offline-retry-restored maestro_test "${DIR}/offline/05c-retry-online.yaml" || status=$?
fi
exit "${status}"
