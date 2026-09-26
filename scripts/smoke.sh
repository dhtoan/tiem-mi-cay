#!/usr/bin/env bash
set -euo pipefail

BASE="http://127.0.0.1:8787"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
COOKIE="$TMP/cookies.txt"
SMOKE_USER="ci_$(date +%s)_$RANDOM"
SMOKE_PASS="CiSmokePass123!"

json_field() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);let v=o;for(const k of process.argv[1].split("."))v=v?.[k];if(v===undefined)process.exit(2);process.stdout.write(String(v))})' "$1"
}

echo "[1/8] health"
HEALTH="$(curl -fsS "$BASE/api/health")"
test "$(printf '%s' "$HEALTH" | json_field ok)" = "true"

echo "[2/8] public game"
curl -fsS "$BASE/" -o "$TMP/index.html"
grep -q 'Tiệm Mì Cay' "$TMP/index.html"

echo "[3/8] register"
REG_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({username:process.argv[1],password:process.argv[2],displayName:"CI Test"}))' "$SMOKE_USER" "$SMOKE_PASS")"
REG="$(curl -fsS -c "$COOKIE" -H 'content-type: application/json' --data-binary "$REG_PAYLOAD" "$BASE/api/auth/register")"
test "$(printf '%s' "$REG" | json_field ok)" = "true"

echo "[4/8] session"
ME="$(curl -fsS -b "$COOKIE" "$BASE/api/auth/me")"
test "$(printf '%s' "$ME" | json_field user.username)" = "$SMOKE_USER"

echo "[5/8] cloud save write/read"
SAVE='MC2|eyJ2IjoxLCJjaSI6InNtb2tlIn0=|smoke'
PUT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({save:process.argv[1],revision:0,clientUpdatedAt:1}))' "$SAVE")"
PUT="$(curl -fsS -b "$COOKIE" -H 'content-type: application/json' -X PUT --data-binary "$PUT_PAYLOAD" "$BASE/api/save")"
test "$(printf '%s' "$PUT" | json_field revision)" = "1"
GET="$(curl -fsS -b "$COOKIE" "$BASE/api/save")"
test "$(printf '%s' "$GET" | json_field revision)" = "1"
test "$(printf '%s' "$GET" | json_field save)" = "$SAVE"

echo "[6/8] conflict protection"
CONFLICT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({save:process.argv[1],revision:0}))' "$SAVE")"
CODE="$(curl -sS -o "$TMP/conflict.json" -w '%{http_code}' -b "$COOKIE" -H 'content-type: application/json' -X PUT --data-binary "$CONFLICT_PAYLOAD" "$BASE/api/save")"
test "$CODE" = "409"

echo "[7/8] existing game APIs"
PID="cismoke12"
curl -fsS "$BASE/api/lb?id=$PID" >/dev/null
curl -fsS "$BASE/api/chal?id=$PID" >/dev/null
curl -fsS "$BASE/api/prank?id=$PID" >/dev/null

echo "[8/8] logout"
OUT="$(curl -fsS -b "$COOKIE" -c "$COOKIE" -H 'content-type: application/json' --data-binary '{}' "$BASE/api/auth/logout")"
test "$(printf '%s' "$OUT" | json_field ok)" = "true"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/auth/me")"
test "$CODE" = "401"

echo "Smoke tests passed."
