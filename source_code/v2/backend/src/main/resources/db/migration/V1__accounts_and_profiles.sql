CREATE TABLE app_user (
    id            UUID PRIMARY KEY,
    email         VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(16)  NOT NULL,
    status        VARCHAR(16)  NOT NULL,
    failed_logins INTEGER      NOT NULL DEFAULT 0,
    locked_until  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    version       BIGINT       NOT NULL DEFAULT 0
);

CREATE TABLE user_profile (
    user_id              UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    display_name         VARCHAR(80)  NOT NULL,
    country              VARCHAR(2),
    region               VARCHAR(16),
    timezone             VARCHAR(64)  NOT NULL,
    units                VARCHAR(16)  NOT NULL,
    household_size       INTEGER,
    heating_type         VARCHAR(24),
    diet_type            VARCHAR(24),
    commute_mode         VARCHAR(24),
    car_fuel             VARCHAR(16),
    car_g_per_km         INTEGER,
    shopping_habit       VARCHAR(16),
    digest_opt_in        BOOLEAN      NOT NULL,
    onboarding_completed BOOLEAN      NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE refresh_token (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,
    family_id  UUID         NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_refresh_token_user ON refresh_token (user_id);
CREATE INDEX idx_refresh_token_family ON refresh_token (family_id);

CREATE TABLE verification_token (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    purpose    VARCHAR(24)  NOT NULL,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_verification_token_user ON verification_token (user_id);
