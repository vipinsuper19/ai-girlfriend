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

# Debug builds type yyyy-MM-dd, so the flows do not use the locale-sensitive picker.
adb wait-for-device
echo "Waiting for sys.boot_completed"
boot_deadline=$((SECONDS + 120))
while (( SECONDS < boot_deadline )); do
  boot="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  if [[ "${boot}" == "1" ]]; then
    break
  fi
  sleep 2
done
echo "boot_completed=${boot:-}"
adb shell input keyevent 82
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# A cold API 34 emulator ANRs Pixel Launcher and leaves that dialog over the
# app, so Maestro never sees welcome_get_started. Stop the launcher, and if
# the dialog is already up, tap Close app (pixel_6, 1080x2400).
adb shell am force-stop com.google.android.apps.nexuslauncher >/dev/null 2>&1 || true
adb shell pm disable-user --user 0 com.google.android.apps.nexuslauncher >/dev/null 2>&1 || true
echo "Window focus before flows:"
adb shell dumpsys window | grep -m1 mCurrentFocus || true

dismiss_anr_dialogs() {
  while true; do
    if adb shell dumpsys window 2>/dev/null | grep -q "responding"; then
      echo "Dismissing ANR dialog"
      # Close app is the upper button. This dialog is the launcher, not the app.
      adb shell input tap 540 1233 || true
      sleep 2
    fi
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
    "08 privacy and terms",
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
status = cell("08 privacy and terms")
rows.append(("08 privacy and terms", status, ""))
if status != "PASS":
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
    text.append("No blocking failures. Flows 04 and 09 may fail.")
text.append("")
out.write_text("\n".join(text) + "\n")
print("\n".join(text))
sys.exit(1 if blockers else 0)
PY
classify=$?
set -e

shots="${DIR}/out/screenshots"
set +e
python3 - "${shots}" "${summary}" <<'PY'
import pathlib, sys
folder = pathlib.Path(sys.argv[1])
summary = pathlib.Path(sys.argv[2])
pngs = sorted(folder.glob("*.png")) if folder.is_dir() else []
lines = ["", "## Screenshots", ""]
if not pngs:
    lines.append("No PNGs in out/screenshots.")
    bad = True
else:
    sizes = [(path.stat().st_size, path.name) for path in pngs]
    unique = {size for size, _name in sizes}
    lines.append(f"{len(pngs)} files, {len(unique)} distinct sizes.")
    for size, name in sizes:
        lines.append(f"- {size} bytes: {name}")
    black = len(unique) == 1 and next(iter(unique)) <= 10000
    if black:
        lines.append("Screenshots look like the same black frame.")
        bad = True
    else:
        lines.append("Screenshots differ in size, so they are not one black frame.")
        bad = False
text = "\n".join(lines) + "\n"
print(text)
summary.parent.mkdir(parents=True, exist_ok=True)
with summary.open("a") as handle:
    handle.write(text)
sys.exit(1 if bad else 0)
PY
shots_status=$?
set -e

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "${summary}" >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ "${classify}" -ne 0 || "${shots_status}" -ne 0 ]]; then
  exit 1
fi
if [[ "${run_status}" -ne 0 ]]; then
  # run-all exits 1 when 04, 09, or both fail. Classification already allowed those.
  echo "run-all.sh exited ${run_status}; remaining failures are allowed."
fi
exit 0
