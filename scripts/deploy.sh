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

# A blocking condition (dirty tree, diverged histories) survives across timer
# ticks, so an unthrottled `die_loud` sends the same alert every five minutes —
# 288 a day until a human clears it, which is how a channel gets muted. The
# state file remembers which message was last sent and when; the same message
# stays quiet until the repeat window expires. Lives outside /var/lock, which
# is tmpfs and would forget across a reboot.
ALERT_STATE_FILE=/var/lib/casaorigen/deploy-alert.state
ALERT_REPEAT_SEC=21600 # 6 h

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

# Telegram, best effort. Credentials come from the environment or, failing
# that, from `.env.production` — same `sed` trick used for DATABASE_URL below,
# because that file has unquoted values with spaces and `source` would try to
# execute them.
#
# Never fails the deploy: a notification that cannot be sent is a worse
# outcome than a deploy that dies because Telegram was down.
notify() {
  local token="${TELEGRAM_BOT_TOKEN:-}" chat="${TELEGRAM_CHAT_ID:-}"

  if [[ -z $token || -z $chat ]] && [[ -f $REPO_DIR/.env.production ]]; then
    token=${token:-$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' "$REPO_DIR/.env.production" | head -1)}
    chat=${chat:-$(sed -n 's/^TELEGRAM_CHAT_ID=//p' "$REPO_DIR/.env.production" | head -1)}
  fi

  [[ -n $token && -n $chat ]] || return 0

  curl --silent --output /dev/null --max-time 10 \
    -X POST "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=$*" || log 'notify: telegram unreachable'
}

die() {
  log "ABORT: $*"
  exit 1
}

# `die` for the cases that need a human: a dirty tree, diverged histories, no
# disk. Plain `die` stays silent on purpose — "CI still running" fires on every
# timer tick, and an alert that cries wolf every five minutes gets muted.
die_loud() {
  local msg="$*" key now last_key='' last_at=0

  key=$(printf '%s' "$msg" | cksum | cut -d' ' -f1)
  now=$(date +%s)

  if [[ -r $ALERT_STATE_FILE ]]; then
    read -r last_key last_at <"$ALERT_STATE_FILE" || true
  fi
  [[ $last_at =~ ^[0-9]+$ ]] || last_at=0

  if [[ $key == "$last_key" ]] && ((now - last_at < ALERT_REPEAT_SEC)); then
    log "alert throttled ($(((ALERT_REPEAT_SEC - (now - last_at)) / 60))m to go): $msg"
  else
    notify "🚨 Casa Origen — deploy detenido: $msg"
    # A hand-run DRY_RUN must not consume the real alert's quota.
    if [[ $DRY_RUN != 1 ]]; then
      mkdir -p "$(dirname "$ALERT_STATE_FILE")"
      printf '%s %s\n' "$key" "$now" >"$ALERT_STATE_FILE"
    fi
  fi

  die "$msg"
}

# Silence alone is indistinguishable from a dead monitor, so the recovery is
# announced once — but only if something was actually blocked.
alert_resolved() {
  [[ -e $ALERT_STATE_FILE ]] || return 0
  rm -f "$ALERT_STATE_FILE"
  notify "✅ Casa Origen — deploy desbloqueado, el chequeo vuelve a correr limpio."
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
  alert_resolved
  exit 0
fi

if [[ -n $(git status --porcelain) ]]; then
  die_loud 'working tree is dirty — refusing to pull over local changes'
fi

# Different is not the same as behind. A commit made on this box and never
# pushed leaves HEAD *ahead* of the remote, and the old `!=` test read that as
# "main moved": the pull then reported "already up to date" and the script
# rebuilt its way to the exact tree it started from. Worse, once the histories
# diverge, `pull --ff-only` fails halfway through a deploy.
#
# Requiring a strict fast-forward also keeps step 2 honest: after the pull HEAD
# is exactly $remote_sha, which is the commit whose CI result was checked.
if ! git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
  die_loud "local ${local_sha:0:7} is not an ancestor of origin/$BRANCH (${remote_sha:0:7}) — histories diverged, refusing to deploy"
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
  die_loud "only ${free_mb}MB free on /, need ${MIN_FREE_MB}MB to build"

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
  npm ci --include=dev --silent || log 'rollback: npm ci failed'

  # Only touch .next when there is something to put back. Most of the steps
  # that can fail — the pull, the install, the migration — run *before*
  # .next.prev exists, and at that point .next is still the build that is
  # serving traffic. Deleting it there took production down on 2026-08-08:
  # the log said "serving the previous release" while the directory was gone
  # and pm2 was crash-looping.
  if [[ -d .next.prev ]]; then
    rm -rf .next
    mv .next.prev .next
    log 'rollback: restored the previous build'
  else
    log 'rollback: no previous build to restore — leaving .next as it is'
  fi

  pm2 start "$PM2_APP" >/dev/null || log 'rollback: pm2 start failed'

  # Claim nothing that has not been checked. The old wording — "production is
  # serving the previous release" — was printed unconditionally, including the
  # run where .next had just been deleted and the site was down.
  local code=''
  for _ in {1..10}; do
    code=$(curl --silent --output /dev/null --max-time 5 --write-out '%{http_code}' "$HEALTH_URL" || true)
    [[ $code == '200' ]] && break
    sleep 2
  done
  if [[ $code == '200' ]]; then
    log "rolled back to ${local_sha:0:7} — health check OK"
    notify "⚠️ Casa Origen — deploy de ${remote_sha:0:7} falló. Rollback a ${local_sha:0:7} OK, el sitio responde."
  else
    log "ROLLED BACK BUT STILL DOWN (HTTP ${code:-none}) — needs a human"
    notify "🔥 Casa Origen — CAÍDO. Rollback a ${local_sha:0:7} hecho y el sitio NO responde (HTTP ${code:-none}). Revisar ya: journalctl -u casaorigen-deploy.service"
  fi
}
trap 'rollback; rm -f "$DEPLOY_SELF_COPY"' ERR

git pull --quiet --ff-only origin "$BRANCH"

# `--include=dev` is not optional here. The systemd unit exports
# NODE_ENV=production, which makes npm skip devDependencies — but it still
# runs the `prepare` script, and `prepare` is `husky`, a devDependency. The
# install then dies with `husky: not found` (exit 127). `next build` needs
# the dev tree anyway, so ask for it explicitly instead of depending on
# whatever NODE_ENV the caller happens to have.
npm ci --include=dev --silent

# The Prisma CLI only auto-loads `.env`, and this project keeps its secrets in
# `.env.production` — which Next reads by itself, so `next build` was never
# affected and the gap stayed invisible. Under systemd the migration died with
# P1012 "Environment variable not found: DATABASE_URL".
#
# Read the one variable instead of sourcing the file: `.env.production` holds
# at least one unquoted value with a space in it, so `source` would try to run
# the second word as a command and take the deploy down with it.
if [[ -z ${DATABASE_URL:-} ]]; then
  DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' "$REPO_DIR/.env.production" | head -1)
  [[ -n $DATABASE_URL ]] || die 'no DATABASE_URL in .env.production — cannot migrate'
  export DATABASE_URL
fi

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
# Quietly, not via alert_resolved: the line below already says it recovered.
rm -f "$ALERT_STATE_FILE"
notify "✅ Casa Origen — desplegado ${remote_sha:0:7}: $(git log -1 --pretty=%s)"
