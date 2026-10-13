#!/usr/bin/env bash
# Start Postgres-backed API for the emulator CI job.
# The caller sets the environment. This script refuses model API keys so the
# process cannot call Gemini or OpenAI. JWT values here are not secrets.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

port="${PORT:-3001}"
log="${API_LOG:-/tmp/emulator-api.log}"
pid_file="${API_PID_FILE:-/tmp/emulator-api.pid}"
mkdir -p "$(dirname "${log}")" "$(dirname "${pid_file}")"

if [[ "${LLM_PROVIDER:-}" != "mock" ]]; then
  echo "LLM_PROVIDER=mock is required so this process does not call a model API." >&2
  exit 1
fi
if [[ "${MODERATION_PROVIDER:-}" != "local" ]]; then
  echo "MODERATION_PROVIDER=local is required so this process does not call a moderator API." >&2
  exit 1
fi
if [[ -n "${GEMINI_API_KEY:-}" || -n "${OPENAI_API_KEY:-}" ]]; then
  echo "Refusing to start with GEMINI_API_KEY or OPENAI_API_KEY set." >&2
  exit 1
fi

pnpm exec prisma db migrate --no-interactive

# nest build emits decorator metadata. tsx does not, and Nest then sees
# constructor parameter types as undefined.
pnpm run build

setsid node dist/main.js >"${log}" 2>&1 < /dev/null &
pid=$!
echo "${pid}" > "${pid_file}"

deadline=$((SECONDS + 90))
while (( SECONDS < deadline )); do
  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "API process exited before it was healthy." >&2
    cat "${log}" >&2 || true
    exit 1
  fi
  code="$(curl -sS -o /tmp/emulator-health-body -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/health" || true)"
  if [[ "${code}" == "200" ]]; then
    echo "API healthy at http://127.0.0.1:${port}/health"
    exit 0
  fi
  sleep 2
done

echo "API health did not return 200 within 90s." >&2
cat "${log}" >&2 || true
exit 1
