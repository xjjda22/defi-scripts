#!/usr/bin/env bash
# Run npm scripts from package.json for one section.
#
# Usage:
#   bash scripts/healthCheckReport.sh crosschain|analytics|simulation|swap
#   npm run report:crosschain   # (see package.json for the four report:* scripts)
#
# Env:
#   REPORT_TIMEOUT  — seconds per script if `timeout` exists (default: 300)
#   REPORT_OUT      — write report to this file (default: output/health-check-report-<section>-<date>.txt)
#   REPORT_INCLUDE_SWAP — set to 1 to execute swap:* (default: 0 → SKIP)
#   REPORT_INCLUDE_FORK_VALIDATE — set to 1 to run simulate:validate:forks (default: 0 → SKIP)

set -u

usage() {
  echo "Usage: $0 <crosschain|analytics|simulation|swap>" >&2
  exit 2
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

SECTION_RAW="${1:-}"
[[ -z "$SECTION_RAW" ]] && usage
SECTION="$(echo "$SECTION_RAW" | tr '[:upper:]' '[:lower:]')"

case "$SECTION" in
  crosschain | analytics | simulation | swap) ;;
  *) usage ;;
esac

TIMEOUT_SEC="${REPORT_TIMEOUT:-300}"
INCLUDE_SWAP="${REPORT_INCLUDE_SWAP:-0}"
INCLUDE_FORK_VAL="${REPORT_INCLUDE_FORK_VALIDATE:-0}"
OUT="${REPORT_OUT:-$ROOT/output/health-check-report-${SECTION}-$(date +%Y%m%d-%H%M%S).txt}"
mkdir -p "$(dirname "$OUT")"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found" >&2
  exit 1
fi

if command -v timeout >/dev/null 2>&1; then
  run_cmd() { timeout "$TIMEOUT_SEC" "$@"; }
else
  run_cmd() { "$@"; }
fi

ALL_NAMES=()
while IFS= read -r line; do
  ALL_NAMES+=("$line")
done < <(node -e "
  const p = require('./package.json');
  Object.keys(p.scripts).sort().forEach((k) => console.log(k));
")

crosschain=()
analytics=()
simulation=()
swap=()

for n in "${ALL_NAMES[@]}"; do
  [[ "$n" == prettier || "$n" == lint:fix || "$n" =~ ^report: ]] && continue
  if [[ "$n" =~ ^crosschain: ]]; then
    crosschain+=("$n")
  elif [[ "$n" =~ ^analytics: ]]; then
    analytics+=("$n")
  elif [[ "$n" =~ ^simulate: ]] || [[ "$n" =~ ^test:pairs ]]; then
    simulation+=("$n")
  elif [[ "$n" =~ ^swap: ]]; then
    swap+=("$n")
  fi
done

grand_pass=0
grand_fail=0
grand_skip=0
declare -a failed_all

append_fail_tail() {
  local script="$1"
  local tmp="$2"
  {
    echo "--- tail: $script ---"
    tail -n 25 "$tmp"
    echo ""
  } >>"$OUT"
}

run_one() {
  local script="$1"
  local start end dur ec
  start=$(date +%s)
  set +e
  local out_tmp
  out_tmp="$(mktemp)"
  run_cmd npm run "$script" --silent >"$out_tmp" 2>&1
  ec=$?
  set -e
  end=$(date +%s)
  dur=$((end - start))
  if [[ $ec -eq 0 ]]; then
    printf "PASS\t%d\t%s\n" "$dur" "$script" | tee -a "$OUT"
    rm -f "$out_tmp"
    return 0
  fi
  printf "FAIL\t%d\t%s (exit %s)\n" "$dur" "$script" "$ec" | tee -a "$OUT"
  append_fail_tail "$script" "$out_tmp"
  rm -f "$out_tmp"
  return 1
}

run_section() {
  local title="$1"
  shift
  local -a scripts=("$@")
  local sp=0 sf=0 sk=0

  echo "" | tee -a "$OUT"
  echo "========== ${title} ==========" | tee -a "$OUT"
  printf "%-8s\t%s\t%s\n" "STATUS" "SECS" "SCRIPT" | tee -a "$OUT"
  printf "%-8s\t%s\t%s\n" "------" "----" "------" | tee -a "$OUT"

  if ((${#scripts[@]} == 0)); then
    echo "(no scripts in this section)" | tee -a "$OUT"
    echo "Section: PASS 0  FAIL 0  SKIP 0" | tee -a "$OUT"
    return
  fi

  for script in "${scripts[@]}"; do
    if [[ "$title" == "swap" ]] && [[ "$INCLUDE_SWAP" != "1" ]]; then
      printf "SKIP\t-\t%s (set REPORT_INCLUDE_SWAP=1 to run)\n" "$script" | tee -a "$OUT"
      ((sk++)) || true
      continue
    fi
    if [[ "$script" == simulate:validate:forks ]] && [[ "$INCLUDE_FORK_VAL" != "1" ]]; then
      printf "SKIP\t-\t%s (set REPORT_INCLUDE_FORK_VALIDATE=1; needs anvil)\n" "$script" | tee -a "$OUT"
      ((sk++)) || true
      continue
    fi
    if run_one "$script"; then
      ((sp++)) || true
    else
      ((sf++)) || true
      failed_all+=("$script")
    fi
  done

  echo "Section: PASS $sp  FAIL $sf  SKIP $sk" | tee -a "$OUT"
  grand_pass=$((grand_pass + sp))
  grand_fail=$((grand_fail + sf))
  grand_skip=$((grand_skip + sk))
}

{
  echo "health check report — section: ${SECTION} — $(date -Iseconds 2>/dev/null || date)"
  echo "root: $ROOT"
  echo "timeout: ${TIMEOUT_SEC}s per script (if timeout(1) available)"
  echo "swap runs: $INCLUDE_SWAP  |  simulate:validate:forks: $INCLUDE_FORK_VAL"
} | tee "$OUT"

case "$SECTION" in
  crosschain)
    if ((${#crosschain[@]} > 0)); then run_section "crosschain" "${crosschain[@]}"; else run_section "crosschain"; fi
    ;;
  analytics)
    if ((${#analytics[@]} > 0)); then run_section "analytics" "${analytics[@]}"; else run_section "analytics"; fi
    ;;
  simulation)
    if ((${#simulation[@]} > 0)); then run_section "simulation" "${simulation[@]}"; else run_section "simulation"; fi
    ;;
  swap)
    if ((${#swap[@]} > 0)); then run_section "swap" "${swap[@]}"; else run_section "swap"; fi
    ;;
esac

{
  echo ""
  echo "========== overall =========="
  echo "PASS: $grand_pass  FAIL: $grand_fail  SKIP: $grand_skip  TOTAL RUN+SKIP: $((grand_pass + grand_fail + grand_skip))"
  if ((${#failed_all[@]} > 0)); then
    echo "Failed scripts:"
    printf '  %s\n' "${failed_all[@]}"
  fi
  echo "Full log: $OUT"
} | tee -a "$OUT"

exit $((grand_fail > 0 ? 1 : 0))
