#!/usr/bin/env bash
# Puts a 7100-character draft in the open composer, then checks the cap.
# Maestro types through a driver call that is killed after 120 seconds.
# Five hundred characters already miss that deadline, so this script writes
# the draft into the debug app and asks it to apply the text in one step.
# Usage: ./run-composer-cap.sh
# Expects adb, maestro, and a debug build already installed (run-all.sh does that).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${DIR}/env.sh"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not on PATH. Start the API 34 emulator before this script." >&2
  exit 1
fi

SHOT="${SHOT:-06-composer-limit}"
MAESTRO_REPORT=06-composer-open maestro_test "${DIR}/flows/06a-open-composer.yaml"

draft="${MAESTRO_OUT}/draft-7100.txt"
python3 -c 'open("'"${draft}"'", "w").write("a" * 7100)'
adb shell run-as com.dhama.mybase rm -f files/maestro-draft.txt files/maestro-draft-ok
adb shell run-as com.dhama.mybase sh -c 'cat > files/maestro-draft.txt' < "${draft}"
adb shell am broadcast \
  -a com.dhama.mybase.DEBUG_CHAT_DRAFT \
  -n com.dhama.mybase/.debug.DebugDraftReceiver

applied=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  applied="$(adb shell run-as com.dhama.mybase cat files/maestro-draft-ok 2>/dev/null | tr -d '\r' || true)"
  if [[ "${applied}" == "7100" ]]; then
    echo "Composer draft applied (7100 characters)."
    break
  fi
  sleep 1
done
if [[ "${applied}" != "7100" ]]; then
  echo "Composer draft was not applied (got '${applied}')." >&2
  exit 1
fi

MAESTRO_REPORT=06-composer-limit maestro_test "${DIR}/flows/06-composer-limit.yaml"
