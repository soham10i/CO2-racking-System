# Architecture and Data Model

## 1. System context
```
 Browser (React + TS SPA)  ──HTTPS──►  Reverse proxy / CDN (TLS, static assets)
                                           │
                                           ▼
                              Spring Boot REST API (stateless, N instances)
                                           │            │
                                           ▼            ▼
                                  PostgreSQL 16      SMTP provider
```
The SPA is served as static files; the API lives on the same site (`/api/v1`) behind the proxy, which keeps cookies first-party and CORS trivial.

## 2. Backend (Spring Boot)

### 2.1 Package structure (modular monolith, package-by-feature)
```
com.co2tracker
├── common        (error model, pagination, clock, security utils, config)
├── auth          (register, login, refresh, verify, reset)
├── user          (account, profile, preferences)
├── activity      (activities CRUD, recurring, import/export)
├── emission      (factors, calculation engine, factor admin)
├── analytics     (daily aggregates, dashboard queries, benchmarks)
├── recommendation(rules, engine, user suggestions, goals)
├── notification  (in-app, email)
└── admin         (users, audit log)
```
Each feature: `web` (controllers + DTO records) → `service` → `repo` (Spring Data JPA) → `domain` (entities). Controllers never expose entities; MapStruct maps entity ↔ DTO. Dependencies point inward; features talk through service interfaces.

### 2.2 Key libraries
Spring Web, Validation (Jakarta), Data JPA, Security, Actuator, springdoc-openapi, Flyway, jjwt (or Spring's resource-server JWT), Bucket4j (rate limit), MapStruct, Lombok-free records for DTOs, Testcontainers, JUnit 5, Mockito, ArchUnit.

### 2.3 Cross-cutting
- **Error model:** RFC 9457 `application/problem+json` with `type, title, status, detail, instance, traceId` and per-field `errors[]` for validation.
- **Identity:** the authenticated principal id comes from the token only; no endpoint accepts `userId` or `email` as a trust input.
- **Transactions:** service-level `@Transactional`; read-only for queries.
- **Time:** `Clock` injected; all instants stored UTC, activity `occurred_on` is a local date in the user's timezone.
- **Idempotency:** `Idempotency-Key` header on `POST /activities` to avoid duplicates on retry.
- **Concurrency:** optimistic locking (`version` column) on mutable entities; `ETag`/`If-Match` on PUT.

### 2.4 Emission calculation engine
```
EmissionResult calculate(ActivityInput in, EmissionFactor ef)
   kg = in.quantity × ef.value × modifiers   (BigDecimal, scale 3, HALF_EVEN)
```
Strategy per category (`TransportCalculator`, `DietCalculator`, `EnergyCalculator`, `ShoppingCalculator`, `WasteCalculator`) selected by `Category`. Modifiers: passengers (÷n), flight class multiplier, radiative-forcing uplift (user toggle, default on, documented), regional grid factor. Factor lookup: `(category, subtype, region, valid_from ≤ date < valid_to)`; falls back from region → country → global.

Illustrative seed factors (**placeholders — verify against UBA/DEFRA/EPA before release**):

| Category / subtype | Unit | kg CO2e per unit |
|---|---|---|
| car_petrol | km | 0.17 |
| car_diesel | km | 0.16 |
| car_ev (DE grid) | km | 0.06 |
| bus | km | 0.10 |
| train_regional | km | 0.04 |
| flight_short_economy | km | 0.15 |
| electricity (DE) | kWh | 0.38 |
| natural_gas | kWh | 0.20 |
| meal_beef | meal | 7.0 |
| meal_vegan | meal | 0.9 |

### 2.5 Analytics
A `daily_emission` table (user_id, date, category, kg) is maintained transactionally on activity create/update/delete (delta update inside the same transaction). Dashboard queries read this table; trend/period aggregation uses `date_trunc`. A nightly reconciliation job recomputes from `activity` to detect drift.

### 2.6 Recommendation engine
`Rule` rows define `code, category, metric (e.g. short_car_trip_share), threshold, message_template, saving_formula`. A scheduled job (and on-demand endpoint with 1 h cache) evaluates rules per user over a rolling window and upserts `user_suggestion`. Savings are estimated with the same calculation engine (what-if), so numbers are consistent with the dashboard.

## 3. Frontend (React + TypeScript)

### 3.1 Stack
Vite, React 18, TypeScript strict, React Router, **TanStack Query** (server state), React Hook Form + Zod (forms/validation), Recharts (charts), Tailwind CSS + Radix UI primitives (accessible components), i18next (ready), Vitest + Testing Library, Playwright, ESLint + Prettier. API types generated from the OpenAPI spec (`openapi-typescript`) so contract drift fails the build.

### 3.2 Structure
```
src/
├── app/          (router, providers, layout, error boundary)
├── api/          (generated types, fetch client w/ refresh handling)
├── features/
│   ├── auth/  onboarding/  activities/  dashboard/
│   ├── recommendations/  goals/  settings/  admin/
├── components/   (ui kit: Button, Card, Modal, DataTable, ChartCard…)
├── hooks/  lib/  styles/
```

### 3.3 Screens
| Route | Screen | Notes |
|---|---|---|
| `/login`, `/register`, `/verify`, `/reset` | Auth | Password strength meter, show/hide password |
| `/onboarding` | 4-step wizard | Region → home → transport → diet/shopping; skippable, resumable |
| `/` | **Dashboard** | KPI cards, trend chart, category donut, top sources, suggestion carousel, goal progress, floating "+ Log" |
| `/log` | Activity log | Table + filters, bulk delete, CSV import/export |
| `/log/new` | Quick-add | Category tabs, smart defaults from profile, live emission preview |
| `/insights` | Recommendations | Ranked cards with saving estimate, adopt/dismiss |
| `/goals` | Goals | Budget rings, streaks |
| `/settings` | Profile, preferences, security, data export/delete | |
| `/admin/*` | Users, factors, rules, audit | Role-guarded |

### 3.4 State and auth handling
Access token is held **in memory only**; refresh token is an httpOnly, Secure, SameSite=Strict cookie scoped to `/api/v1/auth`. The fetch client retries once on 401 via `/auth/refresh` (single-flight). Route guards use role claims for UX only; the server enforces authorization.

## 4. Data model (PostgreSQL)

```
app_user ─1───1─ user_profile
   │1
   ├──* refresh_token
   ├──* verification_token (email verify / password reset)
   ├──* activity ──*─1── emission_factor
   ├──* daily_emission
   ├──* user_suggestion ──*─1── recommendation_rule
   ├──* goal
   ├──* notification
   └──* audit_log
```

| Table | Key columns |
|---|---|
| `app_user` | id UUID PK, email citext UNIQUE, password_hash, role (USER/ADMIN), status (PENDING/ACTIVE/DISABLED), failed_logins, locked_until, created_at, updated_at, version |
| `user_profile` | user_id PK/FK, display_name, country, region, timezone, units, household_size, heating_type, diet_type, commute_mode, car_fuel, car_efficiency, digest_opt_in |
| `emission_factor` | id, category, subtype, unit, kg_co2e_per_unit NUMERIC(14,6), region, source_name, source_url, valid_from, valid_to, version, created_by |
| `activity` | id UUID, user_id FK, category, subtype, quantity NUMERIC(14,3), unit, occurred_on DATE, factor_id FK, kg_co2e NUMERIC(14,3), metadata JSONB (origin, destination, passengers, class…), note, source (MANUAL/IMPORT/RECURRING), created_at, updated_at, version |
| `recurring_rule` | id, user_id, template JSONB, rrule, start_on, end_on, active |
| `daily_emission` | (user_id, day, category) PK, kg_co2e |
| `recommendation_rule` | id, code UNIQUE, category, definition JSONB, message_template, active |
| `user_suggestion` | id, user_id, rule_id, status (NEW/DISMISSED/SNOOZED/ADOPTED), est_saving_kg_year, payload JSONB, created_at |
| `goal` | id, user_id, type (BUDGET/REDUCTION), target_kg, period, start_on, end_on, status |
| `notification` | id, user_id, type, body, read_at, created_at |
| `refresh_token` | id, user_id, token_hash, family_id, expires_at, revoked_at, user_agent, ip_hash |
| `verification_token` | id, user_id, purpose, token_hash, expires_at, used_at |
| `audit_log` | id, actor_id, action, target_type, target_id, ip_hash, at, details JSONB |

Indexes: `activity(user_id, occurred_on DESC)`, `activity(user_id, category, occurred_on)`, `daily_emission(user_id, day)`, `emission_factor(category, subtype, region, valid_from)`.
Constraints: `quantity > 0`, `occurred_on <= current_date` (enforced in service), FK `ON DELETE CASCADE` from user for erasure.

Legacy mapping: `transportco2tracker_data` → `activity` (category TRANSPORT, subtype from `transport_type`, quantity `distance_km`, metadata from other columns); `household_carbon_footprint` → one ENERGY activity per fuel column.

## 5. Environments and deployment
`docker-compose.yml`: `postgres`, `mailhog`, `api`, `web` (nginx). Config via environment variables / Spring profiles (`local`, `test`, `prod`); secrets (DB password, JWT signing key) from env or a secret manager. GitHub Actions pipeline: build → test → scan (Dependabot/OWASP dependency-check, Trivy image scan, gitleaks) → publish images → deploy.

## 6. Testing strategy
| Level | Tooling | Focus |
|---|---|---|
| Unit | JUnit 5, Mockito / Vitest | Calculation engine (table-driven), rules, validators |
| Slice/integration | `@WebMvcTest`, Testcontainers PG | Auth flows, authorization matrix, repository queries, Flyway |
| Contract | OpenAPI diff in CI | No breaking changes unnoticed |
| E2E | Playwright | Register→verify→onboard→log→dashboard; reset password |
| Security | ZAP baseline scan, authz tests per endpoint | IDOR, role checks |
| Non-functional | k6 | Dashboard p95 at 1 000 users, 5 yrs data |
| Accessibility | axe-core in Playwright | WCAG 2.2 AA smoke |

## 7. Delivery plan
| Phase | Content |
|---|---|
| 0 | Repo scaffolding, CI, docker-compose, Flyway baseline, OpenAPI → TS types |
| 1 | Auth + profile + onboarding |
| 2 | Emission factors + engine + activity CRUD (transport, energy) |
| 3 | Diet, shopping, waste, daily aggregates, dashboard |
| 4 | Recommendations, goals, notifications |
| 5 | Admin, import/export, GDPR flows |
| 6 | Hardening: pen-test fixes, load test, a11y audit, docs |
