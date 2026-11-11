# CO2 Footprint Tracker — Software Requirements Specification (SRS)

Version 0.1 (draft) · 2026-10-30 · Status: for review

## 1. Introduction

### 1.1 Purpose
Define what the rebuilt CO2 Footprint Tracker must do. It is the single source for the Spring Boot REST API and the React + TypeScript frontend. The architecture, data model, API and security details live in the companion documents (02–04).

### 1.2 Product vision
Environmentally conscious individuals log daily activities across **mobility, diet, household energy and consumer behaviour**, see their emissions visualised by category and time, and receive personalised suggestions to reduce them. Unlike one-off calculators, the product is a *continuous* tracker that shows trends and progress.

### 1.3 Baseline (what exists today)
Findings from the repository (student project, WS24/25 Team 2):

| Area | Current state | Gap vs. vision |
|---|---|---|
| Backend | Spring Boot 3.2.1, Java 17, JWT, MySQL, JPA | Package `com.twd.SpringSecurityJWT` from a tutorial; no layering/validation/error model |
| Features | Auth, profile, password reset, transport (car/flight/bike) and household calculators | **No diet, shopping/consumer, daily logging, dashboard, suggestions, goals** |
| Frontend | Static HTML/CSS/JS served by Spring | No SPA, no charts, no state management, no types |
| Security | JWT + BCrypt | `/**` is `permitAll`; CSRF off; user identified by email in request body (impersonation/IDOR risk); DB root credentials in `application.properties`; hardcoded emission factors; no rate limiting |
| Data | Calculator results stored per record | Emission factors embedded in code, not versioned or sourced |

Decision: treat the existing code as a reference for domain knowledge, and **rebuild** the system with the structure below. Existing endpoints are not kept for compatibility (Section 9).

### 1.4 Stakeholders and users
| Persona | Description | Needs |
|---|---|---|
| **Eco-Individual (USER)** | Primary user, motivated, non-technical | Fast logging (<30 s/entry), clear charts, actionable advice |
| **Administrator (ADMIN)** | Product owner/operator | Manage users, emission factors, suggestion rules; view system health |
| **Data steward** (role of ADMIN) | Keeps emission factors accurate | Versioned, sourced factors; audit trail |

### 1.5 Scope
In scope (v1): web application (responsive), REST API, PostgreSQL storage, English UI (i18n-ready).
Out of scope (v1): native mobile apps, social/community features, carbon offset purchasing, IoT/bank-card integrations, company/team accounts (listed as roadmap in §10).

## 2. Definitions
CO2e = CO2 equivalent (kg). Emission factor (EF) = kg CO2e per unit of activity. Activity = a logged event with quantity, unit, date and category.

## 3. Functional requirements
Priority: **M** must (v1), **S** should (v1 if time), **C** could (later).

### 3.1 Accounts and authentication (AUTH)
| ID | Requirement | Pri |
|---|---|---|
| AUTH-1 | Register with email, password, display name; email must be unique and verified by emailed link before first login | M |
| AUTH-2 | Login returns a short-lived access token (15 min) and a rotating refresh token (7 days) | M |
| AUTH-3 | Logout revokes the refresh token; "log out everywhere" revokes all | M |
| AUTH-4 | Forgot/reset password via single-use, expiring (30 min) email token; response never reveals whether the email exists | M |
| AUTH-5 | Change password (requires current password) and change email (re-verification) | M |
| AUTH-6 | Account lockout / throttling after repeated failures | M |
| AUTH-7 | Delete account and all personal data; export personal data as JSON/CSV (GDPR) | M |
| AUTH-8 | Optional TOTP two-factor authentication | C |

### 3.2 Lifestyle profile (PROF)
| ID | Requirement | Pri |
|---|---|---|
| PROF-1 | Onboarding wizard captures: country/region (selects grid factor), household size, home heating type, primary commute mode, car (fuel type, efficiency), diet type (vegan … high-meat), shopping habits | M |
| PROF-2 | Profile is editable at any time; changes apply to future calculations only (history is not rewritten) | M |
| PROF-3 | Preferences: units (metric/imperial), timezone, weekly email digest on/off | S |

### 3.3 Activity logging (LOG)
Categories and sub-types:
- **Transport**: car (distance, fuel/EV, passengers), motorbike, bike/walk (0), bus, train, tram/metro, flight (origin, destination or distance, class, round trip, radiative forcing toggle)
- **Diet**: meal log by meal type (beef, pork, poultry, fish, dairy, vegetarian, vegan) or by food item and weight
- **Household energy**: electricity kWh, natural gas, heating oil, LPG, wood pellets, district heating; billing-period entries are spread over their days
- **Shopping/consumer**: clothing, electronics, furniture, other goods by spend (EUR) or item count; second-hand flag
- **Waste**: general waste, recycling, composting by weight

| ID | Requirement | Pri |
|---|---|---|
| LOG-1 | Create, read, update, delete an activity; every activity belongs to exactly one user and is only visible to that user | M |
| LOG-2 | Emissions computed **server-side** from activity quantity × applicable emission factor; client never submits the result | M |
| LOG-3 | The EF id and version used are stored with the activity so results are reproducible | M |
| LOG-4 | Quick-add: duplicate a previous entry; "usual commute" one-tap from the profile | M |
| LOG-5 | Recurring activities (e.g. weekday commute) generate entries on a schedule; user can edit or skip occurrences | S |
| LOG-6 | Backdated entries allowed up to 2 years; future dates rejected | M |
| LOG-7 | List with filters (date range, category), sorting and pagination | M |
| LOG-8 | CSV import (with preview and error report) and CSV export | S |
| LOG-9 | Distance helper for flights from IATA airport codes (great-circle distance) | S |

### 3.4 Emission calculation (CALC)
| ID | Requirement | Pri |
|---|---|---|
| CALC-1 | Factors stored in the database with category, unit, value, region, source name, source URL, valid-from/valid-to, version | M |
| CALC-2 | Calculation is a pure, unit-tested function; results in kg CO2e, rounded to 3 decimals, stored as `NUMERIC` (no floating-point money-style drift) | M |
| CALC-3 | Stateless "what-if" calculator endpoint (no persistence, usable without logging in) | S |
| CALC-4 | Admin can add a new factor version; old versions stay for historical entries | M |
| CALC-5 | Calculation assumptions are visible in the UI ("how was this calculated?") | M |

### 3.5 Analysis dashboard (DASH)
| ID | Requirement | Pri |
|---|---|---|
| DASH-1 | Summary cards: today, this week, this month, year-to-date total kg CO2e, with delta versus previous period | M |
| DASH-2 | Category breakdown (donut/bar) for a selectable period (week/month/year/custom) | M |
| DASH-3 | Trend line/bar over time with day/week/month granularity | M |
| DASH-4 | Comparison against benchmarks (national average, 2030 target of ~2.3 t/yr per person) clearly labelled with source | S |
| DASH-5 | Top emission sources ("biggest contributors") | M |
| DASH-6 | Empty/loading/error states for every widget; charts have text alternatives and a data-table view | M |
| DASH-7 | Dashboard queries return in <500 ms p95 for a user with 5 years of data (pre-aggregated daily totals) | M |

### 3.6 Recommendations (REC)
| ID | Requirement | Pri |
|---|---|---|
| REC-1 | Rule-based engine analyses the last 30/90 days and produces ranked suggestions with estimated annual saving (kg CO2e) | M |
| REC-2 | Example rules: car trips <5 km → walk/bike; high red-meat share → swap N meals/week; electricity above regional average → efficiency tips/green tariff; frequent short-haul flights → rail alternative | M |
| REC-3 | Users can dismiss, snooze or "adopt" a suggestion; adopted suggestions become goals tracked on the dashboard | S |
| REC-4 | Rules are data-driven (admin-editable thresholds and text), not hardcoded | S |

### 3.7 Goals and progress (GOAL)
| ID | Requirement | Pri |
|---|---|---|
| GOAL-1 | Set a reduction goal (e.g. −15 % vs. last month, or a monthly budget in kg) | S |
| GOAL-2 | Progress bar and streaks; notification when 80 % / 100 % of budget reached | S |
| GOAL-3 | Achievement badges for milestones | C |

### 3.8 Notifications (NOTE)
In-app notification centre (M for verification/reset emails, S for digest and goal alerts); weekly email summary (S).

### 3.9 Administration (ADM)
| ID | Requirement | Pri |
|---|---|---|
| ADM-1 | List/search users, disable/enable, change role; admins cannot see users' activity details | M |
| ADM-2 | CRUD emission factors with versioning and source citation | M |
| ADM-3 | CRUD recommendation rules | S |
| ADM-4 | Audit log of admin and security-relevant actions | M |
| ADM-5 | Aggregate, anonymised usage statistics | C |

## 4. Non-functional requirements

### 4.1 Performance and scalability
- API p95 latency <300 ms for CRUD, <500 ms for dashboard aggregates at 1 000 concurrent users (see 02 §7 for the load-test plan).
- Frontend: Largest Contentful Paint <2.5 s on 4G, initial JS bundle <250 kB gzip (route-based code splitting).
- Stateless API nodes so they scale horizontally; DB is the only stateful tier.

### 4.2 Security (details in 04)
OWASP ASVS Level 2 as the target; OWASP Top 10 mitigations are explicit acceptance criteria. All data encrypted in transit (TLS 1.2+) and at rest; secrets never in source control.

### 4.3 Privacy and compliance
GDPR: lawful basis (contract), data minimisation, export and erasure (AUTH-7), privacy policy, cookie-free by default (no third-party trackers), data-processing records. Retention: inactive accounts are flagged after 24 months.

### 4.4 Reliability and data integrity
- Availability target 99.5 %; daily DB backups, 30-day retention, restore tested quarterly.
- Emission math reproducible (LOG-3); schema changes only through Flyway migrations.

### 4.5 Usability and accessibility
WCAG 2.2 AA; keyboard navigable; colour is never the only signal; respects `prefers-reduced-motion` and `prefers-color-scheme`. Responsive from 360 px to desktop. Logging an activity takes ≤3 interactions from the dashboard.

### 4.6 Maintainability and quality
- Backend: layered architecture, ≥80 % line coverage on services and the calculation engine, integration tests with Testcontainers.
- Frontend: strict TypeScript, ESLint, component tests (Vitest + Testing Library), end-to-end tests (Playwright) for critical flows.
- CI on every pull request: build, test, lint, dependency and secret scanning.
- API documented via OpenAPI 3 generated from code.

### 4.7 Observability
Structured JSON logs with request id, health/readiness endpoints, Prometheus metrics, no personal data in logs.

### 4.8 Compatibility
Latest two versions of Chrome, Edge, Firefox, Safari; iOS Safari and Android Chrome.

## 5. Constraints and technology decisions
| Decision | Choice | Rationale |
|---|---|---|
| Backend | Java 21 LTS, Spring Boot 3.x, Maven | Requirement; Java 17 baseline in repo is upgraded |
| Frontend | React 18 + TypeScript (strict), Vite | Requirement lets us pick Angular or React; React has the stronger charting/data-fetching ecosystem (TanStack Query, Recharts) |
| Database | PostgreSQL 16 (+ H2/Testcontainers for tests) | Original constraint (no MySQL in lab) no longer applies; Postgres gives `NUMERIC`, partial indexes, JSONB |
| Migrations | Flyway | Replaces `ddl-auto=update` |
| Auth | Spring Security 6, JWT access token + refresh token in httpOnly cookie | See 04 |
| Deployment | Docker images, docker-compose for local; any container host for prod | |

## 6. User stories with acceptance criteria (key examples)
1. **Log a car trip.** *Given* a logged-in user, *when* they enter 12 km by petrol car for today, *then* the entry is saved, emissions = 12 × petrol-car EF kg, and the dashboard "today" card updates without a page reload.
2. **See where emissions come from.** *Given* 30 days of data, *when* the user opens the dashboard, *then* a category breakdown sums to the period total and the top 3 sources are listed.
3. **Receive advice.** *Given* >25 % of emissions from beef meals, *when* recommendations are generated, *then* a "swap beef meals" suggestion appears with an estimated annual saving.
4. **Isolation.** *Given* two users, *when* user A requests user B's activity id, *then* the API returns 404 (not 403) and nothing leaks.
5. **Reset password.** *Given* an unknown email, *when* reset is requested, *then* the response is identical to the known-email response.

## 7. Use cases (summary)
UC-1 Register & verify · UC-2 Configure lifestyle profile · UC-3 Log activity · UC-4 View dashboard · UC-5 Receive & act on suggestion · UC-6 Set goal · UC-7 Export/delete data · UC-8 Admin manages emission factors · UC-9 Admin manages users. (Existing diagrams in `/Design` cover UC-1…UC-5 and should be updated.)

## 8. Assumptions
1. Launch region is Germany/EU (EUR, kg, kWh); grid and national benchmark factors are region-selectable.
2. Emission factors come from public sources (UBA, DEFRA/DESNZ, EPA, Poore & Nemecek for food); seed values in the repo are **placeholders that must be verified before release**.
3. Email delivery uses SMTP (MailHog locally, a transactional provider in prod).
4. Single-tenant, individual accounts only.

## 9. Migration from the existing system
No production data is assumed. A one-off script may import `transportco2tracker_data` and `household_carbon_footprint` rows into `activity` (mapping documented in 02 §4) if the team wants to keep demo data.

## 10. Roadmap (post-v1)
Mobile app/PWA offline logging, community challenges, receipt/bank import, offset marketplace, team/company accounts, public API tokens, localisation (DE).

## 11. Open questions for the product owner
See `00-README.md` — answers can change scope and priorities.
