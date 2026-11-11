# 11 — CO2 calculator and daily plan: design and API contract

Evidence: [10-co2-recommender-evidence.md](10-co2-recommender-evidence.md) (numbers in brackets below refer to its
reference list). Only verified figures are used; everything labelled **assumption** is a design parameter, not a
measured value, and is shown to users as an estimate.

## 1. What gets built

| Piece | What the user sees |
|---|---|
| **CO2 calculator** (`/calculator`) | (a) *Compare*: enter one activity (trip, meal, energy use) and see every alternative in the same category side by side with the saving; nothing is logged. (b) *Yearly footprint*: the existing baseline questionnaire estimate shown against the 2.5 t (2030) 1.5 °C lifestyle target [3]. |
| **Today's plan** (`/plan`, plus a dashboard card) | At most 3 cards for today, each tied to a time slot (morning / midday / evening / any time), with the expected saving as a range, effort, *why now*, the factor source, and an editable "if-then" plan. A 24-hour strip of the German grid's renewable share marks the cleanest window. Accept, done, snooze (until tomorrow), dismiss. |

## 2. Grid signal (verified 2026-11-09)

Fraunhofer ISE **Energy-Charts** API, no key: `GET https://api.energy-charts.info/signal?country=de` returns
`unix_seconds[]`, `share[]` (renewable share of load, %), `signal[]` (−1 red/congestion, 0 red, 1 yellow, 2 green),
`substitute` (true = best guess from history), 15-minute steps for today. Attribution "Energy-Charts, Fraunhofer
ISE" is shown wherever the data appears. Licence: publishing notes at energy-charts.info/publishing-notes.html
(**verify** the exact terms before production; the page needs JavaScript).

Server side only (fixed URL, no user-supplied hosts), 3 s timeout, cached 15 minutes. On failure: `source:
"FALLBACK"`, no points; the plan still works without timing advice. Accounting keeps using the annual factor from the
factor table (UBA 363 g/kWh for 2024 [5]); the signal is used **only** for timing advice [6], [7].

## 3. API contract (all under `/api/v1`, authenticated)

### `GET /grid/signal`
```json
{
  "source": "ENERGY_CHARTS | FALLBACK",
  "substitute": false,
  "points": [{ "at": "2026-11-09T10:00:00Z", "renewableShare": 61.2, "level": "GREEN | YELLOW | RED" }],
  "bestWindow": { "from": "2026-11-09T11:00:00Z", "to": "2026-11-09T14:00:00Z", "avgShare": 64.8 },
  "attribution": "Energy-Charts, Fraunhofer ISE"
}
```
`bestWindow`: the contiguous ≥ 2 h stretch with the highest mean share among points from now on (null if fewer
than 2 h remain or no data). `level` maps signal 2→GREEN, 1→YELLOW, 0/−1→RED.

### `GET /plan/today`
```json
{
  "date": "2026-11-09",
  "cards": [{
    "key": "MEAL_SWAP",
    "category": "DIET",
    "slot": "MORNING | MIDDAY | EVENING | ANYTIME",
    "title": "Make today's beef meal vegetarian",
    "detail": "…",
    "whyNow": "You logged beef 6 times in the last 90 days.",
    "saving": { "lowKg": 2.1, "highKg": 3.0, "per": "TODAY | YEAR" },
    "effort": "LOW | MEDIUM | HIGH",
    "ifThen": "If it is lunchtime, then I choose the vegetarian option.",
    "sources": [{ "label": "UBA / ifeu food factors", "year": "2020" }],
    "status": "NEW | ADOPTED | DONE",
    "score": 0.71
  }],
  "grid": { "...": "same shape as /grid/signal" }
}
```

### `POST /plan/cards/{key}/feedback`
Body `{ "event": "ADOPTED | DONE | SNOOZED | DISMISSED", "ifThen": "optional, ≤ 200 chars" }` → `204`.
Unknown key → 404. Stored in `plan_feedback` (user, action key, category, event, note, created_at).

### `POST /calculator/compare`
Body as the existing estimate request (`category`, `subtype`, `quantity`, optional `passengers`, `occurredOn`).
Response:
```json
{
  "chosen": { "subtype": "CAR_PETROL", "label": "Car (petrol)", "unit": "KM", "kgCo2e": 4.1 },
  "alternatives": [{ "subtype": "TRAIN_REGIONAL", "label": "…", "unit": "KM", "kgCo2e": 1.2, "savingKg": 2.9 }]
}
```
Alternatives = other subtypes in the same category with the **same unit**, sorted by `kgCo2e` ascending, computed
by the same engine as logging.

## 4. Candidate actions (catalog)

Each card's saving comes from the user's own last 90 days of logs and the factor table when possible, otherwise a
population prior. Range: `high` = computed saving, `low` = high × 0.7 (direct rebound ≲ 30 % [12]).

| Key | Shown when | Saving basis | Slot | Effort |
|---|---|---|---|---|
| `COMMUTE_SWAP` | car trips logged | one typical car trip (median logged km) × (car factor − best public/active factor) | MORNING | MEDIUM |
| `MEAL_SWAP` | beef/lamb meals logged | one meal: factor(red meat meal) − factor(vegetarian meal) | MIDDAY | LOW |
| `PLANT_DAY` | no red meat logged, or cold start | one day of meals: (logged mix or omnivore prior) − vegan meal factor × 3 | MIDDAY | MEDIUM |
| `SHIFT_APPLIANCE` | grid data available and a best window today | **assumption** 1 kWh/cycle × annual factor × relative gap between window share and day average; labelled estimate | in window | LOW |
| `EV_CHARGE_WINDOW` | `CAR_EV` logged and best window today | logged EV kWh-equivalent × annual factor × 31 % marginal reduction [6] | in window | LOW |
| `TRAIN_NOT_PLANE` | flights logged in the last 365 days | 0.6 t (medium-haul) to 1.7 t (long-haul) per avoided return flight [1], per YEAR | ANYTIME | HIGH |

## 5. Ranking (implements evidence §5)

$$
score = w_1\,\widehat{I\cdot P} + w_2\,S - w_3\,\widehat{C} + w_4\,X + w_5\,R - F
$$

- $I$ = high saving in kg (yearly-equivalent for comparability), normalised by the largest candidate.
- $P$ (plasticity, **assumption**): LOW effort 0.8, MEDIUM 0.5, HIGH 0.25 — the plasticity concept is from [35];
  per-action values are not verified, so they are parameters.
- $S$ = success prior per category: $\frac{adopt + done + 1}{adopt + done + dismiss + 2}$ (Beta posterior mean;
  deterministic instead of Thompson sampling so results are reproducible).
- $C$ = effort cost: LOW 0, MEDIUM 0.5, HIGH 1.
- $X$ = 1 when the card's slot is still ahead today (or ANYTIME), 0.3 when the slot has passed.
- $R$ = 1 if the user has a matching recent log (personalised), 0.5 for a prior-only card.
- $F$ = fatigue: after the $k$-th dismissal a card is hidden for $3 \cdot 2^{k-1}$ days; snoozed hides until
  tomorrow; DONE today hides it for the rest of today but counts as success.
- Weights (**assumption**, tune later against adoption): $w = (0.45, 0.15, 0.15, 0.15, 0.10)$.
- At most 3 cards, at most one per category (diversity), never more than 3 even if more qualify [33], [34].

Behaviour rules carried into copy (evidence §4): always state the remaining gap, never "you've done your part";
after DONE show the next step; social comparison only praises users below the norm; no push notifications from
this feature (a later setting can add one daily prompt at a user-chosen time [32]).

## 6. Not in scope / needs verification

Heating setpoint savings, per-cycle appliance kWh, bus/rail values from the UBA table, Energy-Charts licence
terms, and the Rasch-model feasibility term (needs an onboarding quiz) — see evidence §8.
