#!/usr/bin/env bash
# Shared defaults for run-all.sh and run-offline.sh. Source this file; do not execute it.
# QA_PASSWORD is a synthetic password the flows type when they create a throwaway account.
# It is not a real credential. Override it if you want; do not point it at a person's account.

: "${API_BASE_URL:=https://ai-girlfriend-tnu3.onrender.com/api/v1/}"
: "${QA_PASSWORD:=Maestro123}"
: "${COMPANION_NAME:=Mae}"

_env_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${MAESTRO_OUT:=${_env_dir}/out}"

# Copy takeScreenshot PNGs out of Maestro's timestamped tree into out/screenshots/.
# Names are NN-flow-step.png, so later flows do not overwrite earlier ones.
collect_screenshots() {
  local dest="${MAESTRO_OUT}/screenshots"
  mkdir -p "${dest}"
  local found=0
  local file
  while IFS= read -r -d '' file; do
    cp -f "${file}" "${dest}/$(basename "${file}")"
    found=1
  done < <(find "${MAESTRO_OUT}/maestro" -path '*/takeScreenshot/*.png' -type f -print0 2>/dev/null || true)
  if [[ "${found}" -eq 1 ]]; then
    echo "Screenshots collected in ${dest}"
  fi
}

# SHOT is the NN-flow prefix (01-age-gate). Flows pass it to takeScreenshot.
# MAESTRO_REPORT names the junit file and the console log. It defaults to SHOT.
maestro_test() {
  if [[ -z "${SHOT:-}" ]]; then
    echo "SHOT is not set. Example: SHOT=01-age-gate maestro_test flow.yaml" >&2
    return 1
  fi
  local report="${MAESTRO_REPORT:-${SHOT}}"
  mkdir -p "${MAESTRO_OUT}/logs" "${MAESTRO_OUT}/reports" "${MAESTRO_OUT}/maestro" "${MAESTRO_OUT}/screenshots"
  set +e
  maestro test \
    --test-output-dir "${MAESTRO_OUT}/maestro" \
    --debug-output "${MAESTRO_OUT}/maestro" \
    --format junit \
    --output "${MAESTRO_OUT}/reports/${report}.xml" \
    -e "SHOT=${SHOT}" \
    -e "API_BASE_URL=${API_BASE_URL}" \
    -e "QA_PASSWORD=${QA_PASSWORD}" \
    -e "COMPANION_NAME=${COMPANION_NAME}" \
    "$@" 2>&1 | tee "${MAESTRO_OUT}/logs/${report}.log"
  local status=${PIPESTATUS[0]}
  set -e
  collect_screenshots || true
  return "${status}"
}
