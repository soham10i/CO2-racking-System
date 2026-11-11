-- Daily plan (docs/11): every reaction to a plan card is kept as an event, so the per-category success prior
-- and the dismissal fatigue can be recomputed from history at any time.

CREATE TABLE plan_feedback (
    id          UUID PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    action_key  VARCHAR(40)  NOT NULL,
    category    VARCHAR(16)  NOT NULL,
    -- ADOPTED, DONE, SNOOZED or DISMISSED
    event       VARCHAR(16)  NOT NULL,
    -- The user's own if-then plan, when one was given (at most 200 characters)
    note        VARCHAR(200),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX plan_feedback_user_key_idx ON plan_feedback (user_id, action_key, created_at);
