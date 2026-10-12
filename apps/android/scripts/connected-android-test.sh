#!/usr/bin/env bash
# The emulator action runs each workflow script line in its own shell, so the
# Gradle invocation and the artifact capture live in this file.
set -u

status=0
chmod +x gradlew
./gradlew connectedDebugAndroidTest --stacktrace \
  -PAPI_BASE_URL="${API_BASE_URL}" \
  -Pandroid.testInstrumentationRunnerArguments.apiBaseUrl="${API_BASE_URL}" || status=$?

mkdir -p "${GITHUB_WORKSPACE}/emulator-artifacts"
adb logcat -d > "${GITHUB_WORKSPACE}/emulator-artifacts/logcat.txt" || true
adb exec-out screencap -p > "${GITHUB_WORKSPACE}/emulator-artifacts/screen.png" || true
exit "${status}"
