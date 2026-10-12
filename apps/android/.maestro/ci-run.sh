#!/usr/bin/env bash
# CI entry for the emulator job.
# run-all.sh writes apps/android/.maestro/out/ and handles flow 08.
# A non-zero exit is a real failure, except flows 04 and 09, which are allowed
# to fail (chat reply quota, and Firebase user deletion). Every other flow must pass.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${PATH}:${HOME}/.maestro/bin"

artifacts="${GITHUB_WORKSPACE:-/tmp}/emulator-artifacts"
mkdir -p "${artifacts}"
# run-all.sh writes this itself, including PASS/FAIL lines. Flow 08 does not
# make the script exit non-zero. Any other failure does.
log="${DIR}/out/run-all.log"

# A cold API 34 emulator ANRs Pixel Launcher and leaves that dialog over the
# app, so Maestro never sees welcome_get_started. Tap Wait while it is in front.
dismiss_anr_dialogs() {
  while true; do
    focus="$(adb shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus || true)"
    case "${focus}" in
      *"Not Responding"*)
        echo "Dismissing ANR dialog: ${focus}"
        # Wait is the lower button on a pixel_6 ANR dialog (1080x2400).
        adb shell input tap 540 1359 || true
        sleep 2
        ;;
    esac
    sleep 2
  done
}

dismiss_anr_dialogs &
anr_pid=$!

set +e
"${DIR}/run-all.sh"
run_status=$?
set -e

kill "${anr_pid}" 2>/dev/null || true
wait "${anr_pid}" 2>/dev/null || true

adb logcat -d > "${artifacts}/logcat.txt" || true

summary="${artifacts}/flow-results.md"
set +e
python3 - "${log}" "${summary}" <<'PY'
import pathlib, sys
log = pathlib.Path(sys.argv[1]).read_text(errors="replace") if pathlib.Path(sys.argv[1]).exists() else ""
out = pathlib.Path(sys.argv[2])
lines = log.splitlines()
passed = {line[5:] for line in lines if line.startswith("PASS ")}
failed = {line[5:] for line in lines if line.startswith("FAIL ")}
known_08 = any(line.startswith("KNOWN FAILURE 08-privacy-terms") for line in lines)
unexpected_08 = any("08-privacy-terms unexpectedly passed" in line for line in lines)
recorded = []
seen = False
for line in lines:
    if line == "Failed flows:":
        seen = True
        continue
    if seen:
        if line.startswith("  "):
            recorded.append(line[2:])
        elif line.strip():
            break

required = [
    "01 age gate",
    "02 sign up, log out, log in",
    "03 companion wizard",
    "05 offline/retry",
    "06 composer cap",
    "07 report message",
]
allowed = ["04 chat stream", "09 delete account"]
rows = []
blockers = []

def cell(name):
    if name in passed and name not in failed:
        return "PASS"
    if name in failed:
        return "FAIL"
    return "MISSING"

for name in ["01 age gate", "02 sign up, log out, log in", "03 companion wizard"]:
    status = cell(name)
    rows.append((name, status, ""))
    if status != "PASS":
        blockers.append(name)
rows.append(("04 chat stream", cell("04 chat stream"), "allowed"))
if cell("04 chat stream") == "MISSING":
    blockers.append("04 chat stream")
for name in ["05 offline/retry", "06 composer cap", "07 report message"]:
    status = cell(name)
    rows.append((name, status, ""))
    if status != "PASS":
        blockers.append(name)
if known_08 and not unexpected_08:
    rows.append(("08 privacy and terms", "KNOWN FAILURE", "expected, handled by run-all.sh"))
elif unexpected_08:
    rows.append(("08 privacy and terms", "FAIL", "unexpected pass"))
    blockers.append("08 privacy and terms")
else:
    rows.append(("08 privacy and terms", "MISSING", ""))
    blockers.append("08 privacy and terms")
rows.append(("09 delete account", cell("09 delete account"), "allowed"))
if cell("09 delete account") == "MISSING":
    blockers.append("09 delete account")

allowed_set = set(allowed)
extra = [name for name in recorded if name not in allowed_set]
if extra:
    blockers.extend(extra)
if not seen and any(name in failed for name in required + allowed):
    blockers.append("run-all did not print Failed flows")

text = ["# Maestro flow results", "", "| Flow | Result | Note |", "| --- | --- | --- |"]
for name, status, note in rows:
    text.append(f"| {name} | {status} | {note} |")
text.append("")
if blockers:
    text.append("Blocking failures:")
    text.extend(f"- {item}" for item in dict.fromkeys(blockers))
else:
    text.append("No blocking failures. Flows 04 and 09 may fail. Flow 08 is the expected known failure.")
text.append("")
out.write_text("\n".join(text) + "\n")
print("\n".join(text))
sys.exit(1 if blockers else 0)
PY
classify=$?
set -e

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "${summary}" >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ "${classify}" -ne 0 ]]; then
  exit 1
fi
if [[ "${run_status}" -ne 0 ]]; then
  # run-all exits 1 when 04, 09, or both fail. Classification already allowed those.
  echo "run-all.sh exited ${run_status}; remaining failures are allowed."
fi
exit 0
