# CO2 Tracker v2 (rebuild)

Spring Boot 3 / Java 21 API + React 18 / TypeScript SPA. Design docs: [docs](docs/00-README.md).

## Status
| Phase | Scope | State |
|---|---|---|
| 0 | Scaffolding, Flyway, Docker, tests | done |
| 1 | Register/verify/login/refresh/logout, password reset/change, profile, onboarding, account deletion | done |
| 2 | Emission factors (versioned, regional with global fallback), server-side calculation engine, activity CRUD + estimate for transport and energy, dashboard totals, log/form UI | done |
| 3 | Diet/shopping/waste categories, derived & cited factors (V3), strategy-based calculation engine, `daily_emission` read model fed by domain events, trend/compare/benchmark endpoints, Insights (interactive line + comparison charts) and Methodology pages, React Query data layer | done |
| 3.1 | Apple system-app theme with glass material (light/dark, reduced-transparency fallback); Oracle Cloud deployment kit in `deploy/oracle` | done (not yet deployed) |
| 4 | Quick-add templates, "log again", recurring entries (daily/weekdays/weekly/monthly, hourly catch-up job); monthly CO2 budget with progress ring; weekly digest email (Monday 08:00 local, opt-in); onboarding baseline questionnaire (annual estimate); what-if reductions from the user's own data (V4) | done |
| 5 | Admin factor console, German i18n, web push notifications, household sharing, daily plan & calculator, year-in-review | done |
| 6 | Nexus AI Assistant (Nous Research Hermes Agent on Inception Labs Mercury), adaptive user memory, Playwright E2E & CI pipeline | done |

## Run everything (Docker)
```bash
cp .env.example .env   # then edit DB_PASSWORD and JWT_SECRET
docker compose up --build
```
App http://localhost:8081 · emails (verification/reset links) http://localhost:8025

## Develop
```bash
# API (needs JDK 21 + Postgres; or run only `postgres mailhog` from compose)
cd backend && DB_PASSWORD=... JWT_SECRET=... COOKIE_SECURE=false mvn spring-boot:run
# Web (proxies /api to :8080)
cd frontend && npm install && npm run dev      # http://localhost:5173
```
Tests: `cd backend && mvn test` (H2, no Docker needed) · `cd frontend && npm test`.

## Known limitations / next steps
- **Factor quality is mixed.** Cars, electricity, gas, heating oil and meals are derived from cited sources ([methodology](docs/05-emission-methodology.md)); bus, rail, flights, bike, shopping and waste are still indicative placeholders (`source_name` says so). Verify them against the current DESNZ/UBA tables via a new Flyway migration before showing numbers to real users.
- `POST /calculator/estimate` requires login for now (the spec makes it public); open it up once per-IP rate limiting exists.
- Activities have no `Idempotency-Key`, CSV import/export or recurring rules yet; updates use a `version` field in the body rather than `If-Match`.
- `daily_emission` is updated synchronously in the activity transaction; if the factor table is ever edited retroactively, a rebuild job (truncate + backfill as in V3) is needed.
- Real email delivery and SSO need provider details — see [06-integrations-sso-email.md](docs/06-integrations-sso-email.md).
- Login throttling is per-account lockout only; per-IP rate limiting (Bucket4j) is still to do.
- Concurrent refresh from two tabs at the same instant can trip reuse detection and sign the user out; a short grace window is a planned refinement.
- API types are hand-written; generate them from OpenAPI once the surface grows.
- No admin endpoints yet (the `/api/v1/admin/**` rule is in place and tested as ADMIN-only).
- Covered: Playwright E2E (`npm run e2e`), WCAG 2.1 AA accessibility auditing, Lighthouse CI budgets, GitHub Actions CI workflow.
