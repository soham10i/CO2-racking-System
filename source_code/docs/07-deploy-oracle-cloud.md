# 07 — Deploying on Oracle Cloud (Always Free)

Short answer: **yes**. The Always Free tier is enough to host the whole app — database, API, web and backups —
at no cost. The recommended setup runs the existing stack unchanged on one Ampere (ARM) VM and uses
Object Storage for off-site backups and OCI Email Delivery for verification mail.

> Free-tier limits change. The figures below are what Oracle documents for Always Free at the time of writing;
> confirm them on the "Always Free Resources" page of the OCI docs and in your console's *Limits, Quotas and Usage*.

## 1. Which Oracle service stores the data?

| Option | Always Free? | Fit for this app | Verdict |
|---|---|---|---|
| **Ampere A1 VM + PostgreSQL in Docker** (data on the VM's block volume) | Yes — up to 4 OCPU / 24 GB RAM across A1 VMs, 200 GB block storage total | Runs the existing code, migrations and tests unchanged | **Recommended** |
| Autonomous Database (Oracle 19c/23ai) | Yes — 2 instances, 20 GB each | Different SQL dialect: the Flyway migrations, the PG `ON CONFLICT` upsert and the JDBC driver/wallet would all need an Oracle variant; free instances stop after 7 days without activity | Possible later, not worth it now |
| OCI Database with PostgreSQL (managed) | No (paid) | Drop-in, managed backups | Upgrade path if you outgrow the VM |
| **Object Storage** | Yes — 20 GB combined | Not a database; ideal for nightly `pg_dump` files | **Use for backups** |
| **Email Delivery** | Has a free monthly allowance (check current limit) | Plain SMTP on 587, works with the existing mail code | **Use for verification/reset mail** |

## 2. Architecture

```
Internet ──80/443──▶ Caddy (Let's Encrypt HTTPS)
                       └─▶ web  (nginx, React build)
                              └─ /api ─▶ api (Spring Boot, Java 21)
                                            └─▶ postgres 16  ──volume──▶ VM block volume
cron 03:15 ─▶ backup.sh ─ pg_dump ─▶ /var/backups ─▶ OCI Object Storage bucket (lifecycle: 30 days)
api ─SMTP 587 STARTTLS─▶ OCI Email Delivery
```
Files: [`v2/deploy/oracle/`](../v2/deploy/oracle) — `docker-compose.yml`, `Caddyfile`, `.env.example`,
`setup-host.sh`, `backup.sh`, `restore.sh`.

## 3. Step by step

### 3.1 Create the VM (Console)
1. **Compute → Instances → Create instance**.
2. Image: **Canonical Ubuntu 24.04** (or 22.04). Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU / 12 GB is plenty
   (leaves the other half of the free allowance spare). If you see *Out of capacity*, try another availability domain or retry later.
3. Networking: create a new VCN with a **public subnet** and *Assign a public IPv4 address*. Reserve the IP
   (*Networking → Reserved public IPs*) so it survives instance re-creation.
4. Paste your **SSH public key**. Boot volume: 50–100 GB (counts toward the 200 GB).
5. **VCN → Security list** (or an NSG): add ingress rules for TCP **80** and **443** (and UDP 443 for HTTP/3) from `0.0.0.0/0`.
   Keep SSH (22) restricted to your own IP if you can.

> Accounts that stay on the pure *Free Tier* can have **idle** Always Free VMs reclaimed (very low CPU/network/memory use over 7 days).
> Upgrading the account to *Pay As You Go* keeps the free resources free and removes that risk; set a budget alert at $1 if you do.

### 3.2 Domain
Point an **A record** (e.g. `co2.example.com`) at the reserved IP. No domain yet? Use `141-147-1-2.sslip.io`
(your IP with dashes) — Caddy can get a real certificate for it.

### 3.3 Prepare the host
```bash
ssh ubuntu@<public-ip>
git clone <your-repo-url> co2tracker && cd co2tracker/source_code/v2/deploy/oracle
bash setup-host.sh        # Docker, compose, auto security updates, opens 80/443 in the host firewall
exit                      # log in again so the docker group applies
```

### 3.4 Object Storage bucket for backups
1. **Storage → Buckets → Create bucket** `co2tracker-backups`, *Standard* tier, **private** (no public access).
2. Bucket → **Lifecycle policy rules → Create rule**: delete objects older than 30 days (keeps you well under 20 GB).
3. **Identity → your user → Customer secret keys → Generate** — this is the S3-compatible access key / secret pair.
   Better: create a dedicated IAM user + group that may only manage objects in that bucket and generate the key for it.
4. Note the **Object Storage namespace** (*Tenancy details*) and your **region identifier** (e.g. `eu-frankfurt-1`).

### 3.5 Email Delivery
1. **Developer Services → Email Delivery → Email domains → Create**, then add the **SPF** and **DKIM** records it shows to your DNS.
2. **Approved senders → Create** `no-reply@co2.example.com` (must match `APP_MAIL_FROM`).
3. **Identity → your user → SMTP credentials → Generate** (username + password; the password is shown once).
4. SMTP host is `smtp.email.<region>.oci.oraclecloud.com`, port 587 (STARTTLS).
5. Add a DMARC record (`_dmarc` TXT: `v=DMARC1; p=quarantine; rua=mailto:you@example.com`).

### 3.6 Configure and start
```bash
cd ~/co2tracker/source_code/v2/deploy/oracle
cp .env.example .env && chmod 600 .env && nano .env     # fill every value
docker compose --env-file .env up -d --build            # first build on ARM takes a few minutes
docker compose logs -f api                              # wait for "Started Co2TrackerApplication"
```
Open `https://<DOMAIN>`, register, and check the verification mail arrives.

### 3.7 Backups
```bash
./backup.sh                                     # run once by hand, then check the bucket in the Console
crontab -e                                      # add:
15 3 * * * /home/ubuntu/co2tracker/source_code/v2/deploy/oracle/backup.sh >> /var/backups/co2tracker/backup.log 2>&1
```
Also enable **boot/block volume backup policy** (*Block Storage → Boot volumes → Assign backup policy*, e.g. Bronze) —
5 volume backups are included in Always Free.

**Test a restore** before you rely on it: `./restore.sh /var/backups/co2tracker/<file>.dump` (it asks for confirmation and replaces the data).

### 3.8 Updating the app
```bash
cd ~/co2tracker && git pull
cd source_code/v2/deploy/oracle && docker compose --env-file .env up -d --build
```
Flyway applies new migrations on API start. Take a `./backup.sh` first when a release contains a migration.

## 4. What I need from you
| Item | Where it goes |
|---|---|
| Home region of the tenancy (e.g. `eu-frankfurt-1`) | `OCI_REGION`, SMTP host |
| Domain name, or OK to use `sslip.io` | `DOMAIN` |
| Email address for Let's Encrypt notices | `ACME_EMAIL` |
| Sender address + access to the domain's DNS | Email Delivery, `APP_MAIL_FROM` |

Secrets (DB password, JWT secret, SMTP password, customer secret key) go only into `.env` on the VM — never into git or chat.

## 5. Security checklist
- Only Caddy publishes ports; Postgres is reachable only inside the compose network.
- `COOKIE_SECURE=true` and HSTS are set in the production compose/Caddyfile.
- `unattended-upgrades` installs OS security patches; rebuild images monthly (`docker compose build --pull`).
- SSH: key-only (OCI default), ideally restricted by source IP.
- The bucket is private; the backup key can only write objects if you create the dedicated IAM user.
