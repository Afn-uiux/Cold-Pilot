# ColdPilot — Production Deployment & Security Checklist

Run through in order. Skip nothing before pointing real traffic at the server.

## 1. Fresh production secrets

- Generate a **new** `ENCRYPTION_KEY` on the server (do not reuse the dev value):
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Generate a new `AUTH_SECRET` the same way.
- Store both copies in a password manager (Bitwarden). **Losing `ENCRYPTION_KEY` makes every user's Gmail/SMTP/Microsoft token undecryptable — every account must reconnect.** It is the single worst failure mode.
- Start Postgres fresh (no dev users) so no re-encryption migration is needed.

## 2. Secret storage on the VPS

- `.env` is gitignored — never commit it.
- Keep `.env` on the server owned by the app user, `chmod 600`.
- Alternative: inject secrets via GitHub Actions secrets at deploy time.
- Optional later upgrade: Doppler / Infisical / Vault. Not required to launch safely.

## 3. Database

- Postgres bound to **localhost / private network only**, never `0.0.0.0`.
- Dedicated app user with least privilege (no superuser), strong password.
- Daily `pg_dump` to an encrypted location off-box, scheduled via cron.
- Enable TLS for the connection if the app connects over a network.

## 4. Server hardening

- Run the app as a **non-root user** under PM2. Never run PM2 as root.
- Firewall (`ufw`): allow only 22, 80, 443.
- SSH: key-only auth, `PasswordAuthentication no`, fail2ban.
- HTTPS via Caddy or Certbot (auto-renew), redirect HTTP → HTTPS.

## 5. App-level settings at go-live

- Set `NEXT_PUBLIC_URL` and `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`.
  **Important:** the one-click unsubscribe link and the open/click tracking pixels
  are built from `NEXT_PUBLIC_URL`. Pointed at localhost, they are unreachable from
  recipients' inboxes (the engine logs a warning for this — see `src/engine/send.ts`).
- Keep 2FA and the admin gating enabled.
- Enable PM2 log rotation so error-path logs don't grow unbounded:
  `pm2 install pm2-logrotate`

## 6. Monitoring

- Uptime check (UptimeRobot, Hetzner status, or similar).
- Alert on PM2 process restart / crash.

## 7. Required env vars

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session/cookie signing |
| `AUTH_URL` | Pin the canonical origin (e.g. `https://usecoldpilot.com`). Prevents Host-header-based redirect confusion; set it in production rather than relying on `trustHost`. |
| `NEXT_PUBLIC_URL` | Public base URL (unsubscribe links, tracking) |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth login + sending |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` | Microsoft OAuth login + sending |
| `CRON_SECRET` | Cron endpoint auth |
| `ENCRYPTION_KEY` | AES-256-GCM key for stored email credentials |
| `REDIS_URL` | Scheduler locks (when moving to multi-instance) |
| `AUTH_MIGRATION_SECRET` | Legacy auth migration |
| `DEEPSEEK_API_KEY` | AI spin/check/write (adds when available) |
| `RESEND_API_KEY` | Transactional email (password reset, etc.) |

## 8. Post-launch ops

- Key rotation procedure: generate a new key, re-encrypt all credential rows with a
  stored key version, restart. (Not built yet — defer until needed.)
- Test the unsubscribe link and tracking pixel end-to-end on the live domain before
  sending real campaigns.
