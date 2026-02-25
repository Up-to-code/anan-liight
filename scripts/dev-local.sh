#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="dev"
ENV_FILE=""
DRY_RUN="false"

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
    *)
      shift
      ;;
  esac
done

if [[ "$PROFILE" != "dev" && "$PROFILE" != "prod" ]]; then
  echo "[anan-liight/dev-local] invalid profile: $PROFILE (expected dev|prod)" >&2
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
  echo "[anan-liight/dev-local] env file not found: $ENV_FILE" >&2
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

load_env_file "$ENV_FILE"

if [[ "$PROFILE" == "prod" ]]; then
  export ANAN_LIIGHT_PROFILE="liight-local-prod"
else
  export ANAN_LIIGHT_PROFILE="liight-local-dev"
fi

echo "[anan-liight/dev-local] profile=$PROFILE env_file=$ENV_FILE"
cd "$ROOT_DIR"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[anan-liight/dev-local] dry-run: npm run dev"
  exit 0
fi
exec npm run dev
