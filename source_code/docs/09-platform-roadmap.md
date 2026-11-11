# Platform roadmap: assistant, automatic entry, mobile and tablet apps (Phase 7+)

Phases 1–6 built a web app (also a PWA) on one REST API. This plan covers three asks:

1. An **LLM assistant** that logs from plain language and answers questions about the user's own data.
2. **Automatic data entry** from wearables and phones. Example: a walk recorded by a smart band becomes a log entry without typing.
3. **Native apps for phone and tablet** next to the web app, all on the **same backend API**, with a CI/CD pipeline and a sprint plan.

The rules from the earlier phases still apply:
- Numbers come from the API, with sources cited. No client and no LLM ever computes an emission figure.
- WCAG AA.
- No trackers and no personal data in URLs.
- Secrets live only in `.env` and CI secrets.

Lines marked **verify** depend on third-party terms, prices or API status that change often. Check them against the vendor's current docs before you build.

---

## 1. LLM assistant

### 1.1 What it is for
| Use | Example | Value |
|---|---|---|
| **Natural-language logging** | "Drove 12 km to work, had a beef burger for lunch" | Two draft entries (car 12 km, beef meal) shown as cards with the server's estimate. The user taps **Save** or edits them. |
| **Questions about own data** | "Why was October higher than September?" | An answer built only from API results (trend, breakdown, biggest entries), with links to the entries and factor sources. |
| **Methodology help** | "Why is a flight counted with a multiplier?" | An answer grounded in `05-emission-methodology.md`, quoting the section. |
| **Coaching** | "What is the easiest thing to cut this month?" | Reuses `/insights/actions` (what-if, adopt, snooze); the LLM only explains and ranks what the API returned. |
| **Bill and receipt reading** (later) | Photo of an electricity bill | Extracts kWh and the period, then hands them to the meter import's dry run. |

The current quick-log bar (local parser) stays the first, offline, free path. The assistant is the fallback for sentences the parser can't read, and the home of the Q&A.

### 1.2 Architecture
```
Web / mobile ──► POST /api/v1/assistant/messages (SSE stream)
                        │
                 AssistantService (Spring)
                        │  Messages API with tool use
                        ▼
                 Claude model ──tool calls──► AssistantTools (Java)
                                               ├─ estimate_activity  → ActivityService.check   (no write)
                                               ├─ propose_activity   → returns a draft card     (no write)
                                               ├─ get_summary / get_trend / get_breakdown
                                               ├─ get_actions        → /insights/actions
                                               ├─ search_factors     → factor list with sources
                                               └─ get_methodology    → section text by id
```
- **The LLM never writes.** `propose_activity` only returns a draft. The client shows it as a card, and saving goes through the normal `POST /activities` with the user's tap. That keeps one validation path, Undo and the audit trail.
- **Every number comes from a tool.** The system prompt tells the model that figures not returned by a tool must not appear. A post-check rejects answers whose numbers match nothing in the tool results and asks the model again.
- **Tool inputs are checked like API input** (same bean validation). Tool results are data. User notes inside them are marked as untrusted, which defends against prompt injection through entry notes.
- **Streaming** over Server-Sent Events, so text appears as it's written. Cards are separate events.
- **Language:** the reply follows the user's UI locale (en/de).

### 1.3 Model and cost controls
- Use the official **Anthropic Java SDK** from the Spring backend. The key goes in `.env` (`ANTHROPIC_API_KEY`), never in the client.
- **Default:** `claude-haiku-5-5` for parsing and short answers. **Escalation:** `claude-sonnet-5-5` for multi-step "why" questions. Both are configurable.
- **Prompt caching** for the system prompt, tool definitions and methodology excerpts. These are static and make up most of each request.
- **Per-user limits:** for example 30 messages a day and a monthly token budget per user, enforced in the backend (the same pattern as the existing rate limiter). Past the limit, the UI falls back to the local parser.
- **Cost:** estimate from current list prices × expected messages before launch (**verify** pricing on the Anthropic pricing page). Log input, output and cached tokens per request (no message text) to watch spend.

### 1.4 Privacy (GDPR)
- **Opt-in.** Settings → Assistant, with a plain explanation of what is sent.
- **What is sent:** the user's message and tool results only. No email, no name and no other users' data. Household data is limited to the user's own copies.
- **Retention:** conversations are kept 30 days in our database, so the user can scroll back, then deleted. A "Delete chat history" button is included. The JSON export includes them.
- **Legal:** a data processing agreement with the provider, and the provider's retention and training terms for API data (**verify** current commercial terms and the EU data-residency options). The privacy notice must list the assistant as a processor.

### 1.5 Quality
- **Evaluation set:** about 200 German and English logging sentences with the expected draft entries, plus about 50 Q&A prompts with the expected tool calls.
- **CI check:** runs nightly against a stub that returns fixed tool results. It checks two things: the right tools were called, and no number appears that isn't in a tool result.
- **Release gate:** at least 95% of logging sentences produce the right category, subtype and quantity, and no unsupported numbers appear in any answer.

---

## 2. Automatic data entry

### 2.1 Where data can come from
| Source | What it gives | How we read it | Notes |
|---|---|---|---|
| **Android Health Connect** | Exercise sessions (walking, running, cycling) with start and end time and distance; steps | On the device, in the native app, with per-type user permission | The hub most Android bands write to. Google Fit APIs are being retired in favour of Health Connect (**verify** the timeline). |
| **Apple HealthKit** | Workouts (walk, run, cycle) with distance and route; steps | On the device only, in the iOS app (no server API); background delivery for new workouts | Needs the native iOS app. Apple's review requires a clear health-data purpose and privacy text. |
| **Smart bands** (e.g. Xiaomi Mi Band / Smart Band, Amazfit, Huawei) | Walks and rides recorded by the band | Through the vendor's phone app syncing to Health Connect or Apple Health (Mi Fitness, Zepp, Huawei Health, …) | No direct band API is needed. Sync support differs by model and app version (**verify** per band). |
| **Fitbit** | Activities, distance | Server-side OAuth 2.0 with the Fitbit Web API | Being folded into Google's platforms (**verify** API status). |
| **Garmin** | Activities with distance and type | Garmin Connect developer programme (Health/Activity API, push to our webhook) | Needs approval as a partner (**verify**). |
| **Strava** | Activities, including the "commute" flag | OAuth 2.0 and webhook subscription | Its commute flag is useful for the "trip instead of car" question. |
| **Phone motion** (Android Activity Recognition, iOS Core Motion) | In car, on bike, walking, plus time | On the device | Battery-friendly. It gives trip *suggestions* only: no reliable distance without GPS. |
| **Smart meters / utilities** | kWh per day | Done (CSV import, item 19). Later, provider APIs. | — |
| **Open banking (PSD2)** | Fuel and flight purchases as spend | A licensed aggregator | High sensitivity. Only later, opt-in, spend-based factors. |

### 2.2 The walk example, end to end
1. The user walks 3.2 km. The band records it, and the vendor app syncs it to Health Connect (Android) or Apple Health (iOS).
2. Our app has read permission for exercise sessions. A background task (WorkManager on Android, HealthKit background delivery on iOS) finds the new session.
3. The app posts it to the backend:
   ```json
   POST /api/v1/integrations/health/sync
   { "source": "HEALTH_CONNECT", "items": [
     { "externalId": "hc:7f3e…", "type": "WALKING", "start": "2026-11-02T07:41:00+01:00",
       "end": "2026-11-02T08:20:00+01:00", "distanceKm": 3.2 } ] }
   ```
4. The server maps it with fixed rules: WALKING or CYCLING becomes `TRANSPORT / BIKE_WALK`, the quantity is the distance in km, and the date is the local day of `start`. It is deduplicated on `(user, source, externalId)`, so re-syncs and two sources never double-count.
5. By default the item lands in an **inbox** ("We saw a 3.2 km walk this morning. Add it?"). Users who turn on **Auto-log** for a type get the entry booked straight away, with a notification and Undo.
6. **Optional "instead of" question:** "Did this walk replace a car trip?" If yes, the entry records the avoided distance, and Insights can show "avoided ≈ x kg" from the user's car factor. It is shown separately and never subtracted from the footprint (same rule as market-based electricity). Leisure walks don't count as avoided trips unless the user says so.

Walking is about 0 kg CO2e, so the value of logging it is the full picture of travel (share of trips without a car), streaks and the avoided-trip estimate, not a bigger number.

### 2.3 Backend changes
- New module `integration`:
  - Table `external_item(id, user_id, source, external_id, kind, payload_hash, received_at, activity_id NULL, status INBOX|BOOKED|IGNORED)` with a unique index on `(user_id, source, external_id)`.
  - Table `integration_link(user_id, source, scopes, auto_log_types, connected_at, token_ref)` for the cloud sources. OAuth tokens are encrypted at rest with a key from `.env`.
  - `POST /integrations/health/sync` (from devices), `GET /integrations/inbox`, `POST /integrations/inbox/{id}/book|ignore`, OAuth connect and callback for Strava, Fitbit and Garmin, plus webhook endpoints that verify the provider signatures.
- The mapping table (source type → category and subtype) is in code with tests, not in the LLM.
- **Consent and deletion:** disconnecting deletes tokens and inbox items. Booked entries stay (they are the user's log) unless the user also chooses "delete imported entries".

---

## 3. Cross-platform apps on the same API

### 3.1 Options
| Option | Code reuse from today's React app | Native access (HealthKit, Health Connect, push, widgets) | Native feel | Effort for one developer |
|---|---|---|---|---|
| **PWA only** (today) | 100% | Limited: no HealthKit or Health Connect; web push on iOS only for home-screen apps (**verify** iOS limits) | Good | None |
| **Capacitor** (wrap the existing app) | ~90% (all UI, hooks, i18n, API client) | Through plugins or our own small Swift/Kotlin plugins | Good. The UI is already mobile-first, with a tab bar, sheets and safe areas. | **Low** |
| **React Native / Expo** | Logic only (API client, types, zod, i18n, query hooks); UI rewritten | Mature community modules for HealthKit and Health Connect | Best | High |
| **Flutter** | None (Dart) | Good | Very good | Very high |
| **Kotlin Multiplatform + SwiftUI** | None | Best | Best | Very high |

### 3.2 Recommendation
**Capacitor first, with a decision gate.**
- **Why:**
  - One codebase serves web, phone and tablet.
  - The UI is already built for touch: bottom tabs, a raised "+", swipe rows, bottom sheets and reduced motion.
  - The hard native parts are small and isolated: reading workouts, native push, secure token storage.
  - If a community plugin isn't good enough, we write a thin plugin ourselves: Kotlin for Health Connect, Swift for HealthKit.
- **Gate (end of sprint 6):** if any of these is true, move the mobile UI to Expo and keep the shared `core` package:
  - scrolling or chart performance on mid-range Android is poor,
  - App Store review pushes back on a web-view app,
  - widgets or watch apps become a must.

**Tablet:**
- **Layout:** the same app, with a two-pane layout at ≥ 768 px: the log list beside the form, and the dashboard plus insights side by side. The sidebar layout already exists for desktop widths.
- **Testing:** test on iPad split view and on Android foldables.

### 3.3 Shared code layout
```
source_code/
  backend/                 Spring Boot (unchanged API, versioned /api/v1)
  packages/core/           TypeScript: generated API client + types (from OpenAPI), zod schemas,
                           TanStack Query hooks, i18n dictionaries, formatting
  frontend/                web (Vite) — imports @co2/core
  mobile/                  Capacitor project: ios/, android/, native plugins, app config — reuses frontend build
```
- **Contract:** springdoc already publishes OpenAPI at `/api/v1/docs`. CI generates the TypeScript client with `openapi-typescript` and fails if the generated code changes without a commit. A breaking-change check (`oasdiff` against `main`) blocks removed fields and endpoints, because installed apps lag behind and old versions stay in use for months.

### 3.4 Backend changes for native clients
- **Auth:** today the refresh token is an httpOnly cookie, which suits the browser. Native apps instead:
  - get the refresh token in the login body when they send `client: "mobile"`,
  - store it in the Keychain or Keystore (secure storage plugin),
  - call `POST /auth/refresh` with it in the body.
  Refresh-token rotation and reuse detection stay as they are. CORS allows the Capacitor origins (`capacitor://localhost`, `https://localhost`).
- **Push:**
  - Add FCM (Android) and APNs (iOS) senders next to the existing web-push sender behind the same `NotificationService`.
  - Device tokens go in `push_subscription` with a `platform` column.
- **App version header** `X-App-Version`. The API can answer `426` with a "please update" message for versions that are too old.
- **Deep links:** for verification and password-reset emails (universal links and app links), with the web as fallback.

---

## 4. CI/CD pipeline

```
push / PR ─► backend: mvn test ─┐
          ─► core: typecheck, unit tests, OpenAPI client up to date, oasdiff vs main
          ─► web: typecheck, vitest, build ─┤
                                            ├─► e2e: docker compose + Playwright (desktop, phone, tablet) + axe + Lighthouse
          ─► mobile-android: Gradle build, unit tests (ubuntu)
          ─► mobile-ios: xcodebuild, unit tests (macOS runner)
merge to main ─► build & push images to GHCR (api, web) with SBOM + Trivy scan
             ─► deploy to staging (Oracle VM: compose pull, Flyway runs at start) ─► smoke tests
             ─► Android: Fastlane → Play internal testing · iOS: Fastlane → TestFlight
tag vX.Y.Z  ─► manual approval ─► production deploy (same images) ─► store promotion (staged rollout)
```
- **Already built (item 20):** `.github/workflows/ci.yml` covers the backend, web and e2e rows.
- **Secrets:** signing keys, the App Store Connect API key, the Play service account, `ANTHROPIC_API_KEY` and VAPID/FCM/APNs keys live in GitHub environments (`staging`, `production`) with required reviewers. None are in the repo.
- **Database:** Flyway migrations are additive only (expand, then contract over two releases), so an older mobile version keeps working while the new backend is live.
- **Rollback:** redeploy the previous image tag. Store builds use staged rollouts and can be halted.
- **Web hot-fixes:** the web app updates on deploy. Native shells load the bundled web build. Capacitor live updates (Appflow, Capgo and similar) can ship JS-only fixes within store rules (**verify** current store policies).

---

## 5. Sprint plan

Two-week sprints, one developer, about eight working days of build time a sprint. Each sprint ends with green CI, docs updated and a staging deploy.

| Sprint | Goal | Deliverables | Done when |
|---|---|---|---|
| **0** (1 week) | Foundations | `packages/core` with the generated OpenAPI client; oasdiff check; image build to GHCR; staging environment and deploy job | Web runs on `core`; merges deploy to staging automatically |
| **1** | Assistant backend | `assistant` module, Claude tool use, read-only tools, `propose_activity`, rate limits, token logging, opt-in setting; stubbed eval harness | The eval set runs in CI; no unsupported numbers |
| **2** | Assistant in the web app | Chat panel (streamed), draft cards → normal save with Undo, quick-log fallback to the assistant, German replies, history and delete | 95% of logging evals pass; axe clean |
| **3** | Mobile shell | Capacitor iOS and Android projects, mobile token flow, secure storage, deep links, icons and splash, offline queue on device | Sign in, log and sync offline on both platforms in internal builds |
| **4** | Native push and store pipeline | FCM and APNs senders, device tokens, Fastlane lanes, TestFlight and Play internal testing from CI | A budget alert arrives as a native push; builds ship from CI |
| **5** | Health ingestion backend | `integration` module, `/integrations/health/sync`, dedupe, mapping rules, inbox, auto-log setting, notification on auto-log | Re-syncing the same items books nothing twice (tests) |
| **6** | Android Health Connect | Native read of exercise sessions and distance, permissions UI, background sync, inbox screen; **decision gate** for Capacitor vs Expo | A walk from a band, synced through the vendor app, shows up in the inbox within 15 minutes |
| **7** | iOS HealthKit and tablet layout | HealthKit read with background delivery; two-pane tablet layouts; iPad and foldable e2e project | The same walk test passes on iOS; tablet e2e and axe pass |
| **8** | Cloud wearables and "instead of" | Strava OAuth and webhook (then Fitbit; Garmin once approved), the avoided-trip question and its separate Insights figure, methodology section | A Strava commute books once even if Health Connect has it too |
| **9** | Hardening and launch | Privacy labels and the Data safety form, health-data purpose strings, store listings in en/de, load test, pen-test checklist from doc 04, staged rollout | Apps approved; production on tagged images; rollback rehearsed |

**Optional later:** bill photo reading (assistant and meter dry run), home-screen widgets, a watch complication, open banking, and the rest of the German translation (the parts still in English are listed in doc 08).

### Risks
| Risk | Mitigation |
|---|---|
| Store review rejects a web-view app | Native push, health integration and offline work give real native value. The Expo fallback is planned at the sprint 6 gate. |
| Health data rules (Apple, Google, GDPR art. 9 for special-category data) | Read only what the feature needs (workouts and distance, no heart rate). Explicit consent, a data protection impact assessment, and deletion on disconnect. |
| LLM cost or wrong numbers | Tool-only numbers, a post-check, per-user budgets, evals in CI, and the local parser as fallback. |
| Vendor API changes (Fitbit, Google Fit, Garmin) | Health Connect and HealthKit as the primary paths; cloud sources are optional add-ons. |
| Old app versions after API changes | oasdiff gate, expand/contract migrations, the `426` minimum-version response. |
