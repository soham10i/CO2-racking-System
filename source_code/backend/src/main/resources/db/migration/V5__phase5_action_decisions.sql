-- Phase 5: what the user decided about each what-if action. One row per user and action key; deleting
-- the row (undo) returns the action to the suggestions.

CREATE TABLE action_decision (
    id                  UUID PRIMARY KEY,
    user_id             UUID           NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    action_key          VARCHAR(40)    NOT NULL,
    -- ADOPTED, DISMISSED or SNOOZED
    status              VARCHAR(16)    NOT NULL,
    decided_on          DATE           NOT NULL,
    snoozed_until       DATE,
    -- Captured at adoption: the suggestion's annual saving, and the user's daily kg in the action's scope
    -- over the suggestion window, so realised savings compare like with like.
    expected_annual_kg  NUMERIC(12, 1),
    baseline_kg_per_day NUMERIC(14, 4),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_action_decision UNIQUE (user_id, action_key)
);
