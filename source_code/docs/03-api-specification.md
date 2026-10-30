# REST API Specification (v1)

Base path `/api/v1` · JSON (`application/json`) · errors `application/problem+json` · auth `Authorization: Bearer <access token>` except where marked **public**. The authoritative contract is the generated OpenAPI document at `/api/v1/docs` (springdoc); this file is the design baseline.

## Conventions
- IDs are UUIDs. Timestamps ISO-8601 UTC. Dates `YYYY-MM-DD`. Emissions in kg CO2e.
- Pagination: `?page=0&size=20&sort=occurredOn,desc` → `{ content[], page, size, totalElements, totalPages }` (size ≤ 100).
- Access to another user's resource returns **404**.
- Validation failure → `422` with `errors:[{field, code, message}]`.
- Rate limit headers: `X-RateLimit-Remaining`, `Retry-After` on `429`.
- Roles: **U** = USER, **A** = ADMIN.

## Authentication
| Method & path | Access | Description |
|---|---|---|
| POST `/auth/register` | public | `{email, password, displayName}` → 202; sends verification email |
| POST `/auth/verify-email` | public | `{token}` → 204 |
| POST `/auth/login` | public | `{email, password}` → `{accessToken, expiresIn, user}`; sets refresh cookie |
| POST `/auth/refresh` | cookie | Rotates refresh token → new access token; reuse of an old token revokes the family |
| POST `/auth/logout` | U/A | Revokes current refresh token, clears cookie → 204 |
| POST `/auth/logout-all` | U/A | Revokes all sessions → 204 |
| POST `/auth/forgot-password` | public | `{email}` → always 202 |
| POST `/auth/reset-password` | public | `{token, newPassword}` → 204; revokes all sessions |
| POST `/auth/change-password` | U/A | `{currentPassword, newPassword}` → 204 |

## Account and profile
| Method & path | Access | Description |
|---|---|---|
| GET `/me` | U/A | Account + profile |
| PUT `/me/profile` | U/A | Replace lifestyle profile (see schema below) |
| PATCH `/me/preferences` | U/A | Units, timezone, digest |
| POST `/me/email-change` | U/A | `{newEmail, password}` → 202, verification sent |
| GET `/me/export` | U/A | Async job → `202` + `Location`; download JSON/CSV zip |
| DELETE `/me` | U/A | `{password}` → 204; erases account and data |

Profile schema:
```json
{
  "country": "DE", "region": "BY", "timezone": "Europe/Berlin", "units": "METRIC",
  "householdSize": 2, "heatingType": "NATURAL_GAS",
  "dietType": "OMNIVORE", "commuteMode": "CAR",
  "car": { "fuel": "PETROL", "gPerKm": 150 },
  "shoppingHabit": "MODERATE"
}
```

## Activities
| Method & path | Access | Description |
|---|---|---|
| POST `/activities` | U | Create; optional `Idempotency-Key` |
| GET `/activities` | U | List; filters `from, to, category, subtype, q` |
| GET `/activities/{id}` | U | One |
| PUT `/activities/{id}` | U | Replace (`If-Match` ETag) |
| DELETE `/activities/{id}` | U | 204 |
| POST `/activities/bulk-delete` | U | `{ids:[…]}` |
| POST `/activities/import` | U | multipart CSV; `?dryRun=true` returns preview + row errors |
| GET `/activities/export` | U | CSV |
| GET/POST `/recurring-activities`, PUT/DELETE `/recurring-activities/{id}` | U | Recurring rules |

Create request (server computes the result):
```json
{
  "category": "TRANSPORT", "subtype": "CAR_PETROL",
  "quantity": 12, "unit": "KM", "occurredOn": "2026-10-29",
  "metadata": { "passengers": 1 }, "note": "Commute"
}
```
Response `201`:
```json
{
  "id": "6f1c…", "category": "TRANSPORT", "subtype": "CAR_PETROL",
  "quantity": 12, "unit": "KM", "occurredOn": "2026-10-29",
  "kgCo2e": 2.04,
  "factor": { "id": "…", "value": 0.17, "unit": "KM", "source": "UBA 2024", "version": 3 },
  "createdAt": "…", "version": 0
}
```

## Calculator
| Method & path | Access | Description |
|---|---|---|
| POST `/calculator/estimate` | public (rate-limited) | Same body as create; returns `kgCo2e` and factor, stores nothing |
| GET `/emission-factors` | U/A | Active factors for pickers (`?category=`) |

## Dashboard and analytics
| Method & path | Access | Description |
|---|---|---|
| GET `/dashboard/summary?period=month&date=2026-10-30` | U | Totals, previous-period delta, daily average |
| GET `/dashboard/breakdown?from&to` | U | `[{category, kgCo2e, share}]` |
| GET `/dashboard/trend?from&to&granularity=day|week|month` | U | `[{bucket, kgCo2e, byCategory{}}]` |
| GET `/dashboard/top-sources?from&to&limit=5` | U | Largest subtypes |
| GET `/dashboard/benchmarks` | U | User vs. national average vs. target, with source |

## Templates, budget, baseline and what-if (Phase 4)
| Method & path | Access | Description |
|---|---|---|
| GET/POST `/templates`, PUT/DELETE `/templates/{id}` | U | Saved entries (max 50). `recurrence`: `NONE\|DAILY\|WEEKDAYS\|WEEKLY\|MONTHLY` with `startsOn`; PUT needs `version` (409 `stale_version`). Deleting keeps booked entries |
| POST `/templates/{id}/log` | U | Book the template; optional `{occurredOn}` (default today). 201 with the activity |
| GET `/goals` · PUT `/goals` | U | Month budget status; PUT `{monthlyBudgetKg}` (1–100000, `null` = default) |
| GET `/baseline` | U | Saved questionnaire estimate, or 204 |
| POST `/baseline/estimate` · PUT `/baseline` | U | Preview or save the annual estimate (saving completes onboarding) |
| POST `/onboarding/skip` | U | Complete onboarding without a baseline (204) |
| GET `/insights/actions` | U | What-if reductions from the user's own entries, `annualSavingKg` desc |

Recurring templates are booked by an hourly job (catch-up at most 31 days). The weekly digest is sent on the user's local Monday from 08:00 when `digestOptIn` is set.

*Planned:* `/suggestions` lifecycle (dismiss/snooze/adopt) and in-app `/notifications`.

## Administration (ADMIN only)
| Method & path | Description |
|---|---|
| GET `/admin/users`, GET `/admin/users/{id}` | Search/filter; no activity data |
| PATCH `/admin/users/{id}` | `{status?, role?}` |
| GET/POST `/admin/emission-factors`; PUT `/admin/emission-factors/{id}` creates a new version | |
| GET/POST/PUT `/admin/recommendation-rules` | |
| GET `/admin/audit-log` | Filter by actor/action/date |

## Operations
`GET /actuator/health/liveness`, `/readiness` (public, minimal); `/actuator/prometheus` internal network only.

## Error codes
`400 malformed` · `401 unauthenticated` · `403 forbidden role` · `404 not found / not yours` · `409 conflict (duplicate email, stale version)` · `412 precondition (ETag)` · `422 validation` · `429 throttled` · `500 unexpected (traceId only, no stack)`.

## Mapping from the legacy API
| Legacy | New |
|---|---|
| `POST /auth/signup`, `/auth/signin` | `/auth/register`, `/auth/login` |
| `GET/PUT /user/get-profile`, `update-profile` | `/me`, `/me/profile` |
| `/calculator/transportation/**` | `/activities` (category TRANSPORT) |
| `/calculator/household/**` | `/activities` (category ENERGY) |
| `/auth/forgot-password`, `reset-password` | Same, hardened |
