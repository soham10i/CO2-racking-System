# CO2 Footprint Tracker — Documentation Index

| Doc | Contents |
|---|---|
| [01-requirements-srs.md](01-requirements-srs.md) | Vision, baseline analysis of the existing repo, functional + non-functional requirements, user stories, constraints |
| [02-architecture-and-data-model.md](02-architecture-and-data-model.md) | Backend/frontend architecture, calculation engine, PostgreSQL schema, testing, delivery plan |
| [03-api-specification.md](03-api-specification.md) | REST API v1 design |
| [04-security-and-ux.md](04-security-and-ux.md) | Threat model, controls, release checklist; visual/UX design system |
| [05-emission-methodology.md](05-emission-methodology.md) | Calculation math, factor derivations, aggregation formulas, uncertainty, references |
| [06-integrations-sso-email.md](06-integrations-sso-email.md) | What is needed to enable real email delivery, notifications and SSO (SSO deferred) |
| [10-co2-recommender-evidence.md](10-co2-recommender-evidence.md) | Fact-checked research on the biggest CO2 levers, grid timing, behaviour change and recommender design, with references |
| [11-daily-plan-and-calculator-design.md](11-daily-plan-and-calculator-design.md) | Built: CO2 calculator (compare alternatives, yearly footprint) and the daily-plan recommender (API contract, catalog, ranking formula) |
| [09-platform-roadmap.md](09-platform-roadmap.md) | Next: LLM assistant, wearable and automatic data entry, cross-platform mobile/tablet/web apps on the same API, CI/CD pipeline and sprint plan |

## Decisions I made (change any of these)
1. **React + TypeScript** (over Angular), Vite, TanStack Query, Tailwind.
2. **Rebuild** rather than extend the existing static-HTML frontend and tutorial-style backend; keep it as domain reference.
3. **PostgreSQL + Flyway** (MySQL lab constraint no longer applies).
4. **Java 21**, Spring Boot 3.x, modular monolith.
5. Launch region Germany/EU, English UI, rule-based (not ML) recommendations.
6. Emission factors: V9 (2026-11-09) replaced most seed values with verified UBA TREMOD 2024, UBA Strommix 2025, ifeu 2020, DESNZ 2025 and Apple PER values (see [05 §10](05-emission-methodology.md)). V10 added DESNZ 2025, BAFA, Ember and Dell values. Still unverified: jeans, T-shirt, other goods per EUR.

## Open questions for you
1. Is this a course/portfolio project or a product for real users? (changes GDPR, hosting and 2FA depth)
2. Is React fine, or is Angular required by your course/employer?
3. Which regions/languages must v1 support (DE only, EU, worldwide)?
4. Must diet, shopping and waste all ship in v1, or can v1 be transport + energy + dashboard?
5. Do you need an admin role in v1?
6. Hosting target (local/docker only, cloud provider)?
7. Any required emission-factor source (UBA, DEFRA, EPA)?

## Urgent note
`source_code/src/main/resources/application.properties` contains a committed database password. Treat it as compromised and rotate it if it was ever used anywhere real.
