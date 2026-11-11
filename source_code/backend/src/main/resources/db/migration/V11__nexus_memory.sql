-- Nexus assistant: stored conversations, per-answer ratings and a short per-user memory.
CREATE TABLE nexus_conversation (
    id          UUID PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    title       VARCHAR(120) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX nexus_conversation_user_idx ON nexus_conversation (user_id, updated_at);

CREATE TABLE nexus_message (
    id               UUID PRIMARY KEY,
    conversation_id  UUID          NOT NULL REFERENCES nexus_conversation (id) ON DELETE CASCADE,
    -- user or assistant
    role             VARCHAR(16)   NOT NULL,
    content          VARCHAR(8000) NOT NULL,
    -- assistant turns only: 1 = helpful, -1 = not helpful, NULL = unrated
    rating           SMALLINT,
    rating_note      VARCHAR(300),
    model            VARCHAR(64),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX nexus_message_conv_idx ON nexus_message (conversation_id, created_at);
CREATE INDEX nexus_message_rating_idx ON nexus_message (rating, created_at);

-- What Nexus should remember about the user (preferences, goals, constraints). Written by Nexus from chats,
-- readable, editable and erasable by the user. Never free-form chat logs.
CREATE TABLE nexus_memory (
    user_id     UUID PRIMARY KEY REFERENCES app_user (id) ON DELETE CASCADE,
    notes       VARCHAR(1500) NOT NULL,
    auto_update BOOLEAN       NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
