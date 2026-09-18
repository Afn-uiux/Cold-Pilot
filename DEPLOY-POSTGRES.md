# ColdPilot — Production SQLite→PostgreSQL Cutover Playbook

Safe-Execution runbook for moving **live production** (OVH VPS `vps-40da3e90`,
`ubuntu@40.160.88.93`, PM2 app `coldpilot`) from SQLite to Postgres.

Rules of the road:
- **Every step is read-only or reversible until the final flip.** Nothing here
  touches prod data without an explicit "GO" from the human running it.
- **Take a backup before every mutation.** If a step can fail, back the thing up
  first.
- **Treat the old SQLite as the source of truth until the flip is verified GREEN.**
  Do NOT delete `dev.db` until days after go-live.

---

## Phase 0 — Pre-flight (read-only, safe to rehearse anytime)

1. Confirm current prod state is exactly what we expect:

   ```bash
   ssh -i ~/.ssh/id_ovh_deploy ubuntu@40.160.88.93
   crontab -l | grep backup          # daily backup cron present?
   ls -la /home/ubuntu/db-backups/   # existing daily SQLite backups?
   grep '^DATABASE_URL=' /home/ubuntu/coldpilot/.env   # must be file:./dev.db (SQLite)
   pm2 list                          # coldpilot running
   ```

2. **Make a fresh manual pre-cutover backup of the live SQLite** (do not rely on
   the daily cron; do it now so we have a before-state for THIS cutover):

   ```bash
   cp /home/ubuntu/coldpilot/dev.db /home/ubuntu/coldpilot/dev.db.pre-pg-$(date +%Y%m%d-%H%M%S)
   # verify it opens:
   /usr/bin/node -e "const D=require('/home/ubuntu/coldpilot/node_modules/better-sqlite3');const db=new D('/home/ubuntu/coldpilot/dev.db',{readonly:true});console.log(db.pragma('integrity_check'));db.close()"
   ```

   Note: a plain `cp` is fine here (matches how prod's daily backup script and the
   `dev.db.backup` copy work). If the app is actively writing, prefer the online
   backup API used by `backup-db.cjs`; for the pre-cutover snapshot we recommend:

3. **Use the online-backup API for a consistent snapshot** (safe even while PM2 is
   writing — this is exactly what `/home/ubuntu/coldpilot-backup/backup-db.cjs` does):

   ```bash
   /usr/bin/node -e "
   const D=require('/home/ubuntu/coldpilot/node_modules/better-sqlite3');
   const src=new D('/home/ubuntu/coldpilot/dev.db',{readonly:true});
   src.backup('/home/ubuntu/coldpilot/dev.db.pre-pg-' + new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14) + '.db').then(dest=>{dest.close();src.close();console.log('snapshot done');});
   "
   ```

4. **Rehearse the migration against a COPY of prod's real data** — the
   biggest risk is that prod's data differs from local `dev.db`, and it was never
   migrated before. So before touching the real prod DB:

   ```bash
   # On the box: copy the snapshot aside (read-only source, test target)
   mkdir -p /home/ubuntu/pg-staging
   cp /home/ubuntu/coldpilot/dev.db.pre-pg-* /home/ubuntu/pg-staging/source.db

   # Export the SQLite COPY to JSON (read-only):
   cd /home/ubuntu/coldpilot
   /usr/bin/node scripts/export-sqlite-file.mjs /home/ubuntu/pg-staging/source.db /home/ubuntu/pg-staging/export

   # Provision a throwaway staging Postgres on the box (or local machine):
   #   ... create db coldpilot_stage ...
   #   DATABASE_URL=postgres://...coldpilot_stage npx prisma migrate deploy
   #   DATABASE_URL=postgres://...coldpilot_stage /usr/bin/node scripts/import-postgres.mjs \
   #       -- but import-postgres.mjs reads ./data-export — so run from a copy:
   #   cd /home/ubuntu/pg-staging && DATABASE_URL=... node /home/ubuntu/coldpilot/scripts/import-postgres.mjs
   #   (export-sqlite-file.mjs wrote to /home/ubuntu/pg-staging/export; point import there)

   # Verify GREEN against the staging db:
   /usr/bin/node scripts/verify-migration-file.mjs /home/ubuntu/pg-staging/source.db "postgres://...coldpilot_stage"
   ```

   **Gate: must print GREEN end-to-end against prod's REAL exported data before
   proceeding.** If it does not — STOP, debug, do not go to Phase 2.

---

## Phase 1 — Provision production Postgres

1. Install Postgres 16 on the VPS, bind to localhost only:

   ```bash
   sudo apt-get update && sudo apt-get install -y postgresql-16
   sudo systemctl enable --now postgresql
   sudo pg_isready
   ```

2. Create the app database + least-privilege user (NOT superuser):

   ```sql
   sudo -u postgres psql <<'SQL'
   CREATE USER coldpilot WITH PASSWORD '<STRONG_PASSWORD>';
   CREATE DATABASE coldpilot OWNER coldpilot;
   GRANT ALL PRIVILEGES ON DATABASE coldpilot TO coldpilot;
   SQL
   ```

   - Postgres must listen on `localhost` only — verify `listen_addresses` in
     `postgresql.conf` does NOT include `0.0.0.0` (bind `127.0.0.1`).
   - Apply migrations: `DATABASE_URL=postgres://coldpilot:<pw>@127.0.0.1:5432/coldpilot npx prisma migrate deploy`

---

## Phase 2 — The flip (minimum-downtime window)

Run in order. PM2 stop/start brackets the only moment writes can be lost.

1. **Stop the app** (stops new SQLite writes):
   ```bash
   pm2 stop coldpilot
   ```

2. **Consistent snapshot of the now-quiet SQLite**:
   ```bash
   SNAP=/home/ubuntu/coldpilot/dev.db.pre-pg-$(date +%Y%m%d-%H%M%S).db
   cp /home/ubuntu/coldpilot/dev.db $SNAP
   ls -la $SNAP
   ```

3. **Export** that exact snapshot to JSON:
   ```bash
   cd /home/ubuntu/coldpilot
   /usr/bin/node scripts/export-sqlite-file.mjs $SNAP /home/ubuntu/pg-staging/export-final
   ```

4. **Import into the real Postgres** (run from a temp dir so it reads the right
   export directory, or adjust to point at the final export):
   ```bash
   cd /home/ubuntu/pg-staging
   DATABASE_URL=postgres://coldpilot:<pw>@127.0.0.1:5432/coldpilot \
     /usr/bin/node /home/ubuntu/coldpilot/scripts/import-postgres.mjs
   ```
   (`import-postgres.mjs` reads `./data-export` — ensure the final export lands there,
   or copy it into `/home/ubuntu/coldpilot/data-export` before running. All rows that
   already exist are skipped, so re-running is safe.)

5. **Verify GREEN** (same check used in rehearsal, now against prod data + prod Postgres):
   ```bash
   /usr/bin/node scripts/verify-migration-file.mjs $SNAP "postgres://coldpilot:<pw>@127.0.0.1:5432/coldpilot"
   ```
   **Gate: GREEN required. If MISS rows appear — STOP, keep app stopped, investigate.**

6. **Point the app at Postgres** and start:
   ```bash
   # Edit /home/ubuntu/coldpilot/.env:
   #   DATABASE_URL=postgres://coldpilot:<pw>@127.0.0.1:5432/coldpilot
   # Keep ALL other values identical.

   pm2 restart coldpilot --update-env
   pm2 status
   # Watch logs; app must start without DB errors:
   pm2 logs coldpilot --nostream --lines 200
   ```

7. **Smoke test live**: login, open a campaign, trigger one send. Confirm writes land
   in Postgres, not SQLite.

---

## Phase 3 — Post-cutover (days after)

- Keep `dev.db` + all `.db.pre-pg-*` snapshots untouched for a few days.
- Confirm daily backups now target **Postgres** (`pg_dump`), not SQLite. Update the
  `backup-db.cjs` cron — or replace it with a `pg_dump` job:

  ```bash
  # /etc/cron.d/coldpilot-pg-backup
  0 3 * * * ubuntu pg_dump coldpilot | gzip > /home/ubuntu/db-backups/pg/coldpilot-$(date +\%F).sql.gz
  ```
- Only after a week of clean running: archive/delete the old SQLite `dev.db`.

---

## Rollback (if the flip fails)

The old SQLite is the escape hatch, BUT the app code is Postgres-only
(`src/lib/prisma.ts` uses `PrismaPg`), so "roll back" = revert **code + DB together**:

1. `pm2 stop coldpilot`
2. Restore `.env`: `DATABASE_URL=file:./dev.db` (the untouched `dev.db` is still live).
3. Redeploy the last SQLite-era code commit (or keep a tagged build available for this).
4. `pm2 restart coldpilot`
5. Confirm app boots and reads SQLite. Data written to Postgres during the failed flip
   is discarded/merged manually if needed (compare `verify-migration` output).

**If you did NOT keep a SQLite-era build deployable**: do not start the flip until you
have one. That is the single biggest rollback gap in the current setup. The safest
form: before flipping, tag the current commit and confirm you can deploy that tag.

---

## Decisions locked before starting

- [ ] ENCRYPTION_KEY: reuse the prod key (tokens stay decryptable). Fresh Postgres with
      the same key = no reconnect needed. **Do not** generate a new key unless you want
      every user to reconnect Gmail/SMTP.
- [ ] A SQLite-era build is tagged & deployable for rollback.
- [ ] Staging migration rehearsal passed GREEN on prod's real data.
- [ ] Postgres bound to localhost; least-privilege user; pg_dump cron staged.
- [ ] Enough RAM headroom: shared_buffers ≈ 1GB, max_connections 40–60 recommended.