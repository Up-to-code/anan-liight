#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="dev"
ENV_FILE=""
DRY_RUN="false"
RUN_FULL_TEST="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-dev}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --with-whatsapp-gate)
      RUN_FULL_TEST="true"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [[ "$PROFILE" != "dev" && "$PROFILE" != "prod" ]]; then
  echo "[apply-spacetimedb] invalid profile: $PROFILE (expected dev|prod)" >&2
  exit 1
fi

if [[ -z "$ENV_FILE" ]]; then
  if [[ "$PROFILE" == "prod" ]]; then
    ENV_FILE="$ROOT_DIR/.env.production.local"
  else
    ENV_FILE="$ROOT_DIR/.env.local"
  fi
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[apply-spacetimedb] env file not found: $ENV_FILE" >&2
  exit 1
fi

load_env_file() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$file"
}

run_cmd() {
  echo "[apply-spacetimedb] $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

extract_env() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | sed "s/^${key}=//" || true)"
  if [[ -n "$value" ]]; then
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    echo "$value"
    return
  fi
  echo "$fallback"
}

smoke_check() {
  local app_host app_port base_url
  app_host="$(extract_env APP_HOST "127.0.0.1")"
  app_port="$(extract_env APP_PORT "4020")"
  if [[ "$app_host" == "0.0.0.0" ]]; then
    app_host="127.0.0.1"
  fi
  base_url="http://${app_host}:${app_port}"

  echo "[apply-spacetimedb] starting runtime for smoke checks at ${base_url}"
  bash "$ROOT_DIR/scripts/dev-local.sh" --profile "$PROFILE" --env-file "$ENV_FILE" > /tmp/anan-liight-smoke.log 2>&1 &
  local app_pid=$!

  cleanup() {
    if kill -0 "$app_pid" >/dev/null 2>&1; then
      kill "$app_pid" >/dev/null 2>&1 || true
      wait "$app_pid" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT

  local ready="false"
  for _ in {1..40}; do
    if curl -fsS "${base_url}/health/live" >/dev/null 2>&1; then
      ready="true"
      break
    fi
    sleep 0.5
  done

  if [[ "$ready" != "true" ]]; then
    echo "[apply-spacetimedb] runtime did not become ready; see /tmp/anan-liight-smoke.log" >&2
    return 1
  fi

  run_cmd curl -fsS "${base_url}/health/live"
  run_cmd curl -fsS "${base_url}/health/ready"

  run_cmd curl -fsS -X POST "${base_url}/api/chat" \
    -H "content-type: application/json" \
    --data '{"userId":"anon-staging-smoke","message":"staging smoke check"}'

  cleanup
  trap - EXIT
}

main() {
  cd "$ROOT_DIR"
  load_env_file "$ENV_FILE"

  run_cmd bun scripts/spacetime-preflight.ts --profile "$PROFILE" --env-file "$ENV_FILE"
  run_cmd npm run lint
  run_cmd npm run typecheck
  run_cmd npm run db:bootstrap

  if [[ "$DRY_RUN" != "true" ]]; then
    smoke_check
  else
    echo "[apply-spacetimedb] dry-run: skipping smoke checks"
  fi

  if [[ "$RUN_FULL_TEST" == "true" ]]; then
    run_cmd npm run test:whatsapp:full:dev
  fi

  echo "[apply-spacetimedb] completed"
}

main
