# Security Design and Visual/UX Design

## Part A — Security

### A1. Findings in the existing code that the rebuild must fix
| # | Finding | Location | Fix |
|---|---|---|---|
| 1 | `.requestMatchers("/**").permitAll()` makes every route public, so role rules are moot | `SecurityConfig` | Default-deny: `anyRequest().authenticated()`; only an explicit public list |
| 2 | Client supplies `email` in the body to say whose data to read/write (impersonation, IDOR) | `TransportationService`, DTOs | Derive user from the token; never trust identity input |
| 3 | DB `root` user and password in `application.properties` | `application.properties` | Env/secret manager; least-privilege DB user; **rotate the committed password** |
| 4 | CSRF disabled with tokens possibly in localStorage | `SecurityConfig` / JS | Memory-only access token + SameSite cookie for refresh; CSRF protection on cookie endpoints |
| 5 | `ddl-auto=update` | `application.properties` | Flyway, `validate` |
| 6 | Emission factors hardcoded; result computed from client-sent efficiency | `TransportationService` | Factors in DB, server-side calc |
| 7 | No input validation, generic errors | controllers | Bean Validation, problem+json |

### A2. Threat model summary (STRIDE)
| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Credential stuffing | BCrypt/Argon2id, throttling, lockout, breached-password check (k-anonymity), optional TOTP |
| Tampering | Edit another user's activity; forged emission value | Ownership check in every query (`WHERE user_id = :principal`), server-side calc, optimistic locking |
| Repudiation | Admin changes factors | Immutable audit log |
| Information disclosure | Verbose errors, IDOR, user enumeration | 404 for foreign ids, uniform auth/reset responses, no stack traces, PII-free logs |
| Denial of service | Login/calculator abuse | Bucket4j limits (per IP + per account), request size limits, pagination caps, timeouts |
| Elevation of privilege | USER calls admin endpoint | `@PreAuthorize` + URL rules, authorization matrix tests |

### A3. Controls
**Authentication and sessions**
- Passwords: min 12 chars, no composition rules, checked against common/breached lists; hashed with Argon2id (or BCrypt cost ≥ 12).
- Access JWT: 15 min, signed with asymmetric key (RS256/EdDSA) or ≥256-bit HMAC from secret store, claims `sub, role, iat, exp, jti`; algorithm pinned on verify.
- Refresh token: random 256-bit, stored hashed, rotated on use with reuse detection (family revocation), httpOnly + Secure + SameSite=Strict, path-scoped.
- Email verification and reset tokens: random, hashed at rest, single-use, short TTL.

**Authorization**: default deny; roles USER/ADMIN; method security; every repository query for user data scoped by principal; admin cannot read activity data.

**Transport and headers**: TLS 1.2+ with HSTS (preload-ready); `Content-Security-Policy` (default-src 'self', no inline scripts, nonce if needed), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `frame-ancestors 'none'`. CORS: explicit origin allow-list (none needed when same-site).

**Input/output**: Jakarta validation on all DTOs (length, ranges, enums); parameterised queries only (JPA); output encoding by React; CSV import hardened against formula injection (`=,+,-,@` prefixed with `'` on export) and size/row limits; strict content-type checks.

**Data protection**: encryption at rest (managed disk/DB), TLS to DB, backups encrypted; PII minimised (email, display name, country); IP stored only as salted hash; GDPR export/erasure implemented and tested.

**Secrets and supply chain**: no secrets in git (gitleaks pre-commit + CI), dependency scanning (Dependabot, OWASP dependency-check), container scan (Trivy), minimal non-root images, pinned versions, SBOM.

**Monitoring**: audit log (login, failed login bursts, role/factor changes, export/delete), alerting on anomaly thresholds, correlation `traceId`.

### A4. Security acceptance checklist (release gate)
- [ ] Authorization matrix test: every endpoint × {anonymous, user A, user B, admin}
- [ ] ZAP baseline + authenticated scan has no medium/high findings
- [ ] No secrets in repo history (committed DB password rotated)
- [ ] Rate limiting verified on login/forgot/estimate
- [ ] Refresh-token reuse revokes family (automated test)
- [ ] Security headers score A on a header scanner
- [ ] Dependency and image scans clean of high/critical

## Part B — Visual and UX design

### B1. Principles
Calm, optimistic, data-forward. Make the *right action* (logging) the easiest, and make progress visible and rewarding without guilt. Never shame; frame as "here is where you can save".

### B2. Design tokens
| Token | Light | Dark |
|---|---|---|
| Background | `#F6FAF7` | `#0F1A14` |
| Surface | `#FFFFFF` | `#16241C` |
| Primary (leaf green) | `#1F8A5B` | `#4CC38A` |
| Accent (sky) | `#2B7DE9` | `#6FA8FF` |
| Warning (amber) | `#C77700` | `#F2B24C` |
| Danger | `#C62F3E` | `#FF7B86` |
| Text | `#13261C` | `#E8F3EC` |

Category colours are colour-blind safe and paired with icons/patterns: Transport (blue), Energy (amber), Diet (green), Shopping (violet), Waste (grey-brown). All text/background pairs meet 4.5:1 contrast. Typography: Inter (UI), tabular numerals for data. 8-px spacing grid, 12-px card radius, subtle shadows, motion ≤200 ms and disabled under `prefers-reduced-motion`.

### B3. Key screen layouts
**Dashboard (desktop)**
```
┌ Sidebar ┬──────────────────────────────────────────────────────┐
│ Logo    │ Good morning, Alex            [Week|Month|Year] [+Log]│
│ Home    │ ┌Today┐ ┌This week┐ ┌This month┐ ┌Goal ring 72%┐      │
│ Log     │ │3.1kg│ │ 24.0 kg │ │ 96 kg ▼8%│ │             │      │
│ Insights│ └─────┘ └─────────┘ └──────────┘ └─────────────┘      │
│ Goals   │ ┌ Trend (stacked area by category) ─┐ ┌ Donut ─────┐ │
│ Settings│ │                                   │ │ breakdown   │ │
│         │ └───────────────────────────────────┘ └─────────────┘ │
│         │ ┌ Top sources ┐ ┌ Suggestion: "Swap 2 beef meals…" ┐ │
└─────────┴──────────────────────────────────────────────────────┘
```
Mobile: bottom tab bar (Home, Log, Insights, Goals, Me), centred "+" action, cards stack, charts switch to compact variants.

**Quick-add**: category tabs → minimal fields with smart defaults → live preview "≈ 2.04 kg CO2e (≈ 12 km petrol car)" → Save; undo toast after save.

### B3a. Interaction details
- Skeleton loaders, optimistic updates with rollback, inline validation, descriptive empty states with a primary CTA ("Log your first trip").
- Every chart has a "table view" toggle and an accessible summary sentence.
- Tooltips explain factors ("0.17 kg per km, UBA 2024").
- Celebratory micro-feedback on goals and streaks, never blocking.

### B4. Accessibility checklist
Semantic landmarks, focus-visible rings, skip link, labels for all inputs, error summary linked to fields, `aria-live` for toasts, touch targets ≥44 px, zoom to 200 % without loss, axe-core in CI.

### B5. Content and tone
Plain language, metric first with optional imperial, equivalents ("= 4 km by car") for intuition, sources always one click away.
