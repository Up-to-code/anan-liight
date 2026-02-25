#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
TOKEN="${2:-}"
BAD_TOKEN="${3:-wrong-token}"

if [[ -z "$BASE_URL" || -z "$TOKEN" ]]; then
  echo "usage: $0 <base-url> <verify-token> [bad-token]" >&2
  exit 1
fi

CHALLENGE="challenge-$(date +%s)"

echo "[webhook-smoke] valid-token check"
VALID_CODE=$(curl -s -o /tmp/wa-valid.out -w "%{http_code}" \
  "${BASE_URL%/}/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=${CHALLENGE}")

if [[ "$VALID_CODE" != "200" ]]; then
  echo "[webhook-smoke] expected 200, got ${VALID_CODE}" >&2
  cat /tmp/wa-valid.out >&2
  exit 2
fi

VALID_BODY=$(cat /tmp/wa-valid.out)
if [[ "$VALID_BODY" != "$CHALLENGE" ]]; then
  echo "[webhook-smoke] expected challenge echo, got '${VALID_BODY}'" >&2
  exit 3
fi

echo "[webhook-smoke] invalid-token check"
INVALID_CODE=$(curl -s -o /tmp/wa-invalid.out -w "%{http_code}" \
  "${BASE_URL%/}/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${BAD_TOKEN}&hub.challenge=${CHALLENGE}")

if [[ "$INVALID_CODE" != "403" ]]; then
  echo "[webhook-smoke] expected 403, got ${INVALID_CODE}" >&2
  cat /tmp/wa-invalid.out >&2
  exit 4
fi

echo "[webhook-smoke] passed"
