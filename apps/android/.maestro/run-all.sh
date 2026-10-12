#!/usr/bin/env bash
# Build the debug APK against API_BASE_URL and run the Maestro flows on a booted emulator.
# See FLOWS.md for preconditions, the known Privacy/Terms failure, and the emulator job.
#
#   API_BASE_URL=https://ai-girlfriend-tnu3.onrender.com/api/v1/ ./run-all.sh
#   SKIP_BUILD=1 ./run-all.sh          # APK already installed
#   ANDROID_SERIAL=emulator-5554 ./run-all.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(cd "${DIR}/.." && pwd)"
# shellcheck disable=SC1091
source "${DIR}/env.sh"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not on PATH." >&2
  exit 1
fi
if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro is not on PATH. Install it from https://get.maestro.mobile.dev" >&2
  exit 1
fi

adb wait-for-device
adb shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true

locale="$(adb shell getprop persist.sys.locale 2>/dev/null | tr -d '\r')"
echo "Device locale: ${locale:-unknown}. Date entry expects en-US."
echo "API_BASE_URL=${API_BASE_URL}"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "Assembling debug with -PAPI_BASE_URL_DEBUG (no secrets are written into the repo)."
  (
    cd "${ANDROID_DIR}"
    ./gradlew assembleDebug -PAPI_BASE_URL_DEBUG="${API_BASE_URL}"
  )
  adb install -r "${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
fi

failures=()

run_named() {
  local name="$1"
  shift
  echo "======== ${name} ========"
  if "$@"; then
    echo "PASS ${name}"
  else
    echo "FAIL ${name}"
    failures+=("${name}")
  fi
}

run_named "01 age gate" maestro_test "${DIR}/flows/01-age-gate.yaml"
run_named "02 sign up, log out, log in" maestro_test "${DIR}/flows/02-signup-logout-login.yaml"
run_named "03 companion wizard" maestro_test "${DIR}/flows/03-companion-wizard.yaml"
run_named "04 chat stream" maestro_test "${DIR}/flows/04-chat-stream.yaml"
run_named "05 offline/retry" "${DIR}/run-offline.sh"
run_named "06 composer cap" maestro_test "${DIR}/flows/06-composer-limit.yaml"
run_named "07 report message" maestro_test "${DIR}/flows/07-report-message.yaml"

echo "======== 08 privacy and terms (known failure) ========"
if maestro_test "${DIR}/flows/08-privacy-terms.yaml"; then
  echo "FAIL 08-privacy-terms unexpectedly passed."
  echo "WelcomeScreen Terms and Privacy only log. If they now open pages, drop the known-failure mark in run-all.sh and FLOWS.md."
  failures+=("08-privacy-terms unexpectedly passed")
else
  echo "KNOWN FAILURE 08-privacy-terms (expected). Terms and Privacy only call Log.d and do not open pages."
fi

run_named "09 delete account" maestro_test "${DIR}/flows/09-delete-account.yaml"

if [[ "${#failures[@]}" -gt 0 ]]; then
  echo "Failed flows:"
  printf '  %s\n' "${failures[@]}"
  exit 1
fi

echo "All flows passed. 08-privacy-terms failed as expected."
