-- Phase 4: saved templates (optionally recurring), a monthly CO2 budget, the onboarding baseline and
-- the weekly digest's send marker.

CREATE TABLE activity_template (
    id          UUID PRIMARY KEY,
    user_id     UUID           NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name        VARCHAR(60)    NOT NULL,
    category    VARCHAR(16)    NOT NULL,
    subtype     VARCHAR(32)    NOT NULL,
    quantity    NUMERIC(14, 3) NOT NULL,
    passengers  INTEGER        NOT NULL DEFAULT 1,
    note        VARCHAR(200),
    -- NONE (one-tap quick add only), DAILY, WEEKDAYS, WEEKLY or MONTHLY
    recurrence  VARCHAR(16)    NOT NULL,
    starts_on   DATE,
    -- The next date the recurring job books; NULL for NONE. Never later than one period ahead.
    next_run_on DATE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    version     BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX ix_activity_template_user ON activity_template (user_id);
CREATE INDEX ix_activity_template_due ON activity_template (next_run_on);

-- NULL budget means "use the default" (the 2030 lifestyle target / 12).
ALTER TABLE user_profile ADD COLUMN monthly_budget_kg NUMERIC(10, 1);
-- The onboarding questionnaire's answers as JSON; the estimate is recomputed from current factors.
ALTER TABLE user_profile ADD COLUMN baseline_answers VARCHAR(2000);
ALTER TABLE user_profile ADD COLUMN baseline_at TIMESTAMP WITH TIME ZONE;
-- The user's local date the last weekly digest went out, so an hourly job sends at most one per week.
ALTER TABLE user_profile ADD COLUMN digest_sent_on DATE;
