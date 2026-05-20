# panel — ops

operator runbook. single-host single-tenant. systemd-user on `panel.goku.codes`.

## service

```bash
systemctl --user status panel
systemctl --user restart panel
journalctl --user -u panel -n 50 --no-pager
journalctl --user -u panel -f
```

env lives in `~/.config/systemd/user/panel.service.d/override.conf`. required:

- `PANEL_SIGNING_SECRET` — HMAC secret. rotate by editing override + restart.
- `PANEL_SITE_KEYS` — comma-separated operator keys.
- `PANEL_DB_PATH` — sqlite path. default `~/panel/data/panel.db`.

optional CORS allowlist per non-demo key:
`PANEL_KEY_ORIGINS_<UPPER_KEY>=https://a.com,https://b.com`

## health

```bash
curl -s https://panel.goku.codes/api/health | jq
```

returns 200 + `{status:'ok', db_ok:true, uptime_s, units, judgments, version}` when healthy. 503 if sqlite down.

## backup

hourly `sqlite3 .backup` via `panel-backup.timer` → `~/panel/data/backups/panel-<UTC>.db`. retention 7 days. `latest.db` symlink always points to newest.

```bash
systemctl --user list-timers panel-backup.timer --no-pager
systemctl --user start panel-backup.service     # force a backup now
ls -lh ~/panel/data/backups | tail -10
```

restore: stop panel, `cp data/backups/latest.db data/panel.db`, restart panel.

## logs

structured JSON-line access log at `~/panel/logs/access.log`. each line: `ts, method, path, status, ms, site_key, ip, rl{scope,limit,remaining,ok}`.

logrotate config (drop into `~/.config/logrotate/panel.conf` and run via cron or a systemd-user timer):

```
/home/ubuntu/panel/logs/access.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

cron entry: `15 0 * * * /usr/sbin/logrotate --state $HOME/.config/logrotate/state $HOME/.config/logrotate/panel.conf`

## rate limits

- per-IP: 60/min
- per-site-key: 600/min

both enforced application-side (token bucket, persisted to sqlite every 5s for crash recovery). exceeded → 429 with `Retry-After` and `X-RateLimit-*` headers.

nginx-level rate limiting is intentionally NOT layered on top yet — keep it observable at one layer until we see real traffic patterns.

## kuma monitoring

status page lives at `https://status.goku.codes`. add a monitor:

1. ssh to oracle box → http://status.goku.codes:3001 (or wherever Kuma listens — check `goku-codes-host-ops` skill)
2. **+ Add New Monitor** → type **HTTP(s) - JSON Query**
3. config:
   - name: `panel`
   - URL: `https://panel.goku.codes/api/health`
   - interval: 60s
   - method: GET
   - JSON Query: `$.status`
   - Expected value: `ok`
4. notification: tie to whatever channel `goku.codes` already uses.
5. save → it should go green within 60s.

**manual fallback** (if Kuma isn't running): `*/2 * * * * curl -fsS https://panel.goku.codes/api/health > /dev/null || echo "panel down at $(date)" | mail -s "panel alert" admin@goku.codes`

## attestation tokens

format: `pnl_v1.<b64u(payload)>.<b64u(hmac)>`. payload includes `jti` (judgment id) and `exp` (issue+10min).

- expired tokens → `/api/verify` returns `{ok:false, error:'expired'}`
- replayed tokens (jti already consumed) → 409 `{ok:false, error:'replay'}`
- consumed jtis stored in `jti_consumed` table, GC'd hourly for entries past `exp + 60s`.

rotate `PANEL_SIGNING_SECRET` to invalidate all in-flight tokens.

## graceful shutdown

`SIGTERM`/`SIGINT` → checkpoint WAL → close sqlite → 200ms drain → `process.exit(0)`. visible in journalctl as `{"evt":"shutdown","sig":"SIGTERM","db":"closed",...}`.

if the service is killed with `SIGKILL` the WAL will replay on next boot — no data loss, brief checkpoint cost.

## scaling path (when you outgrow this box)

1. **postgres migration**: same schema, swap better-sqlite3 for `pg`. all writes are already transactional. budget: ~1 day. trigger: >50 judgments/sec sustained, or DB >2GB.
2. **read replicas**: only after postgres. mostly for stats/dashboard reads.
3. **dedicated rate-limit store** (redis): only when running >1 panel instance.

do NOT attempt postgres before k8s/multi-region — wrong abstraction at this stage.

## env rotation

`PANEL_SIGNING_SECRET` rotation invalidates all outstanding tokens. operators must re-issue. low-risk because tokens are 10-min lived anyway. process:

```bash
NEW=$(openssl rand -hex 32)
# edit ~/.config/systemd/user/panel.service.d/override.conf
# replace PANEL_SIGNING_SECRET=...
systemctl --user daemon-reload
systemctl --user restart panel
```

`PANEL_SITE_KEYS` rotation: add new key first, give operators a grace window, then remove old. no client-side invalidation needed.
