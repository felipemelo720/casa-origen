#!/usr/bin/env bash
#
# Pull-based deploy for Casa Origen.
#
# GitHub cannot reach this container (private network, no port forward), so
# the deploy runs the other way around: this box asks GitHub whether main
# moved and whether CI went green, and only then rebuilds.
#
# Invoked by the systemd timer `casaorigen-deploy.timer`. Safe to run by hand.
#
#   DRY_RUN=1 scripts/deploy.sh   # report what it would do, change nothing
#
set -Eeuo pipefail

REPO_DIR=/var/www/casa-origen
BRANCH=main
PM2_APP=casaorigen
HEALTH_URL=http://127.0.0.1:3006/
GITHUB_REPO=felipemelo720/casa-origen
LOCK_FILE=/var/lock/casaorigen-deploy.lock
MIN_FREE_MB=2048
DRY_RUN=${DRY_RUN:-0}

# The deploy pulls new code, which can include this very file. Bash reads a
# running script lazily by byte offset, so rewriting it mid-run corrupts the
# rest of the execution. Run from a private copy instead.
if [[ ${DEPLOY_SELF_COPY:-} == '' ]]; then
  self_copy=$(mktemp /tmp/casaorigen-deploy.XXXXXX.sh)
  cp "$0" "$self_copy"
  chmod +x "$self_copy"
  DEPLOY_SELF_COPY="$self_copy" exec "$self_copy" "$@"
fi
trap 'rm -f "$DEPLOY_SELF_COPY"' EXIT

log() { printf '%s deploy: %s\n' "$(date -Is)" "$*"; }
die() {
  log "ABORT: $*"
  exit 1
}

# Two deploys at once would fight over .next and pm2.
exec 9>"$LOCK_FILE"
flock -n 9 || die 'another deploy is already running'

cd "$REPO_DIR"

# --- 1. Is there anything to deploy? ---------------------------------------

git fetch --quiet origin "$BRANCH"

local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")

if [[ $local_sha == "$remote_sha" ]]; then
  log "already at ${local_sha:0:7}, nothing to do"
  exit 0
fi

if [[ -n $(git status --porcelain) ]]; then
  die 'working tree is dirty — refusing to pull over local changes'
fi

log "main moved: ${local_sha:0:7} -> ${remote_sha:0:7}"

# --- 2. Did CI pass for that exact commit? ---------------------------------
#
# Fail closed: anything other than an explicit success (CI still running, API
# unreachable, malformed answer) means "do not deploy". The next timer tick
# retries, so a slow CI run costs a few minutes, never a bad deploy.

check_json=$(curl --silent --show-error --max-time 20 \
  -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$GITHUB_REPO/commits/$remote_sha/check-runs") ||
  die 'could not reach the GitHub API'

read -r total completed successful <<<"$(
  printf '%s' "$check_json" | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk));
    process.stdin.on("end", () => {
      let runs;
      try {
        runs = JSON.parse(raw).check_runs;
      } catch {
        process.stdout.write("0 0 0\n");
        return;
      }
      if (!Array.isArray(runs)) {
        process.stdout.write("0 0 0\n");
        return;
      }
      const completed = runs.filter((run) => run.status === "completed");
      const successful = completed.filter((run) => run.conclusion === "success");
      process.stdout.write(`${runs.length} ${completed.length} ${successful.length}\n`);
    });
  '
)"

[[ $total -gt 0 ]] || die "no CI run reported for ${remote_sha:0:7} yet"
[[ $total -eq $completed ]] || die "CI still running for ${remote_sha:0:7} ($completed/$total done)"
[[ $completed -eq $successful ]] || die "CI failed for ${remote_sha:0:7} ($successful/$total green)"

log "CI green ($successful/$total checks)"

# --- 3. Room to build? -----------------------------------------------------

free_mb=$(df --output=avail -m / | tail -1 | tr -d ' ')
[[ $free_mb -ge $MIN_FREE_MB ]] ||
  die "only ${free_mb}MB free on /, need ${MIN_FREE_MB}MB to build"

if [[ $DRY_RUN == '1' ]]; then
  log "DRY_RUN: would deploy ${remote_sha:0:7}"
  exit 0
fi

# --- 4. Deploy -------------------------------------------------------------
#
# Rollback restores both halves: the previous commit AND the build it
# produced. Restoring only .next would leave a compiled bundle from one commit
# next to the node_modules of another.

rolled_back=0
rollback() {
  [[ $rolled_back == 1 ]] && return
  rolled_back=1
  log "ROLLBACK to ${local_sha:0:7}"
  git reset --hard --quiet "$local_sha" || log 'rollback: git reset failed'
  npm ci --silent || log 'rollback: npm ci failed'
  rm -rf .next
  [[ -d .next.prev ]] && mv .next.prev .next
  pm2 start "$PM2_APP" >/dev/null || log 'rollback: pm2 start failed'
  log 'rolled back — production is serving the previous release'
}
trap 'rollback; rm -f "$DEPLOY_SELF_COPY"' ERR

git pull --quiet --ff-only origin "$BRANCH"
npm ci --silent

# Schema changes are the one irreversible step here: `migrate deploy` never
# rolls back, so a rollback returns the code but leaves the new columns in
# place. Additive migrations survive that; a destructive one does not.
npx prisma migrate deploy

# Stopping first is mandatory: `next build` overwrites .next underneath a live
# `next start`, which then serves 404 chunks as text/plain.
pm2 stop "$PM2_APP" >/dev/null
rm -rf .next.prev
[[ -d .next ]] && mv .next .next.prev
npm run build
pm2 start "$PM2_APP" >/dev/null

# --- 5. Prove it actually serves -------------------------------------------

healthy=0
for attempt in {1..15}; do
  code=$(curl --silent --output /dev/null --max-time 5 --write-out '%{http_code}' "$HEALTH_URL" || true)
  if [[ $code == '200' ]]; then
    healthy=1
    log "health check OK after ${attempt} attempt(s)"
    break
  fi
  sleep 2
done

if [[ $healthy != 1 ]]; then
  log "health check failed (last HTTP code: ${code:-none})"
  pm2 stop "$PM2_APP" >/dev/null || true
  rollback
  exit 1
fi

trap 'rm -f "$DEPLOY_SELF_COPY"' ERR
rm -rf .next.prev
log "deployed ${remote_sha:0:7} — $(git log -1 --pretty=%s)"
