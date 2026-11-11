-- Phase 6: language, notifications and web push, market-based electricity, households, and the admin
-- factor console's audit columns.

-- 14 German UI: the account's language for the app and its emails.
ALTER TABLE user_profile ADD COLUMN locale VARCHAR(5) DEFAULT 'en' NOT NULL;

-- 15 Notification centre + web push. dedupe_key makes each alert fire once (e.g. one "at risk" per month).
CREATE TABLE notification (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    -- BUDGET_AT_RISK, BUDGET_OVER, WEEKLY_DIGEST, TEMPLATE_BOOKED, HOUSEHOLD
    kind       VARCHAR(24)  NOT NULL,
    title      VARCHAR(120) NOT NULL,
    body       VARCHAR(400) NOT NULL,
    link       VARCHAR(120),
    dedupe_key VARCHAR(80)  NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    read_at    TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_notification_dedupe UNIQUE (user_id, dedupe_key)
);
CREATE INDEX ix_notification_user_created ON notification (user_id, created_at DESC);

CREATE TABLE push_subscription (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    endpoint   VARCHAR(600) NOT NULL UNIQUE,
    p256dh     VARCHAR(120) NOT NULL,
    auth       VARCHAR(40)  NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_push_subscription_user ON push_subscription (user_id);

-- Per-channel opt-in; the weekly digest keeps its existing digest_opt_in flag.
ALTER TABLE user_profile ADD COLUMN notify_budget BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE user_profile ADD COLUMN notify_templates BOOLEAN DEFAULT TRUE NOT NULL;

-- 16 Market-based Scope 2: the supplier's own emission factor from the electricity label (Stromkennzeichnung).
-- NULL means "not set": the market-based figure is then not shown. The location-based figure never changes.
ALTER TABLE user_profile ADD COLUMN supplier_g_per_kwh NUMERIC(7, 1);

-- 17 Households. One household per user, at most 10 members; invites are single-use codes stored as hashes.
CREATE TABLE household (
    id         UUID PRIMARY KEY,
    name       VARCHAR(60) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE household_member (
    user_id      UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    household_id UUID        NOT NULL REFERENCES household (id) ON DELETE CASCADE,
    role         VARCHAR(8)  NOT NULL,
    joined_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_household_member_household ON household_member (household_id);

CREATE TABLE household_invite (
    id           UUID PRIMARY KEY,
    household_id UUID        NOT NULL REFERENCES household (id) ON DELETE CASCADE,
    code_hash    VARCHAR(64) NOT NULL UNIQUE,
    created_by   UUID        NOT NULL,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL
);

-- A shared household entry is split into one copy per member (kg / n each), linked by share_group_id. Only the
-- creator's copy is editable; edits and deletes apply to the whole group. Copies outlive membership changes.
ALTER TABLE activity ADD COLUMN share_group_id UUID;
ALTER TABLE activity ADD COLUMN share_count INTEGER;
ALTER TABLE activity ADD COLUMN shared_by UUID;
ALTER TABLE activity ADD COLUMN share_total_quantity NUMERIC(14, 3);
CREATE INDEX ix_activity_share_group ON activity (share_group_id);

-- 18 admin factor console: who published a factor version, and when (seeded rows stay null).
ALTER TABLE emission_factor ADD COLUMN created_by UUID REFERENCES app_user (id) ON DELETE SET NULL;
ALTER TABLE emission_factor ADD COLUMN created_at TIMESTAMP WITH TIME ZONE;
