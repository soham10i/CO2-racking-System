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
| GET `/me/export` | U/A | JSON download (`Content-Disposition: attachment`): account, budget, baseline answers, all activities, templates and action decisions. Format `co2-tracker-export/1` |
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
| POST `/activities/import` | U | JSON `{csv, dryRun}` (≤ 1 MB, ≤ 5000 rows). Columns matched by header; `date, category, subtype, quantity` required. Every row is checked like the log form; rows matching an existing entry (date, type, amount) are `DUPLICATE` and skipped. Returns counts and per-row `READY\|DUPLICATE\|ERROR\|IMPORTED`. 422 `csv_empty`, `csv_too_large`, `csv_missing_column` |
| GET `/activities/export` | U | CSV (`date, category, subtype, label, quantity, unit, passengers, kg_co2e, factor_source, note`); text starting with `= + - @` is prefixed with `'` against spreadsheet formula injection. The file re-imports as is |
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

## Suggestion lifecycle (Phase 5)
| Method & path | Access | Description |
|---|---|---|
| PUT `/insights/actions/{key}/decision` | U | `{status: ADOPTED\|DISMISSED\|SNOOZED, snoozeDays?}` (snooze 1–365, default 30). Adopting stores the expected saving and the current rate; 422 `action_not_applicable` if the action no longer applies. 404 for an unknown key |
| DELETE `/insights/actions/{key}/decision` | U | Undo: the action returns to the suggestions |

Both return the same body as `GET /insights/actions`: `{windowDays, from, to, actions, commitments, hidden}`. A commitment carries `expectedAnnualKg`, and `realisedAnnualKg` once 7 days have passed (omitted before; see methodology §4.8). Hidden lists dismissed and still-snoozed actions so they can be restored.

## Notifications (Phase 6)
| Method & path | Access | Description |
|---|---|---|
| GET `/notifications` | U | Newest first, with the unread count |
| POST `/notifications/{id}/read` · POST `/notifications/read-all` | U | Mark as read (204) |
| GET · PUT `/notifications/settings` | U | `{budget, templates, digest}` switches (PUT fields are optional); the response adds `pushAvailable`, `vapidPublicKey` and `pushDevices`. Kinds: `BUDGET_AT_RISK`, `BUDGET_OVER`, `WEEKLY_DIGEST`, `TEMPLATE_BOOKED`, `HOUSEHOLD` |
| POST · DELETE `/notifications/push-subscriptions` | U | Store or remove this browser's push subscription; the endpoint host must be a known push service |

## Electricity, location and market based (Phase 6)
| Method & path | Access | Description |
|---|---|---|
| GET `/insights/scope2?from&to` | U | Defaults to this calendar year up to today. `{from, to, kwh, locationKg, locationGPerKwh?, supplierGPerKwh?, marketKg?}`; fields left out when unknown |
| PUT `/insights/scope2/supplier` | U | `{gramsPerKwh: 0–2000 \| null}`; null clears it |

## Household (Phase 6)
| Method & path | Access | Description |
|---|---|---|
| GET `/household` | U | `{id, name, members[], ...}`, or 204 if not in one |
| POST `/household` · PATCH `/household` | U | Create `{name}` (409 if already in one) · rename (owner) |
| POST `/household/invites` | U | Single-use code, valid 7 days; 422 `household_full` at 10 members |
| POST `/household/join` | U | `{code}`, case and dashes ignored |
| POST `/household/leave` | U | 204; shared entries stay in everyone's log |

`POST /activities` takes `shareWithHousehold: true` for ENERGY and WASTE (422 `share_not_applicable`, `no_household`, `quantity_too_small`). Every member's copy carries `share: {count, totalQuantity, editable}`. Only the creator may PUT or DELETE (403 `shared_read_only`), and changes apply to every copy.

## Meter import (Phase 6)
POST `/activities/import/meter` `{csv (≤ 1 MB), subtype: ELECTRICITY | NATURAL_GAS | DISTRICT_HEATING, dryRun}` returns the same body as `/activities/import`. 422 `meter_format` (no date column, no kWh column, m³ data), `invalid_subtype`, `csv_too_large` (> 5000 days).

## Administration (ADMIN only)
| Method & path | Description |
|---|---|
| GET `/admin/users`, GET `/admin/users/{id}` | Search/filter; no activity data |
| PATCH `/admin/users/{id}` | `{status?, role?}` |
| GET `/admin/factors` | Every factor version, newest first within each line, with `current` |
| POST `/admin/factors/{id}/preview` | `{kgCo2ePerUnit, validFrom, sourceName, sourceUrl (https), methodNote?}` → old and new value, `changePercent`, `nextVersion`, `entriesFromValidFrom` |
| POST `/admin/factors/{id}/versions` | Publishes (201). 422 `not_current` if `{id}` is already closed, `invalid_valid_from` unless after the current start and ≤ 366 days ahead. Admin role comes from `APP_ADMIN_EMAILS` at sign-in |
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
