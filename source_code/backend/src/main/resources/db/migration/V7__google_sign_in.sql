-- Sign in with Google: accounts may have no password, and are linked to Google by its stable "sub" id.
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE app_user ADD COLUMN google_sub VARCHAR(255);
CREATE UNIQUE INDEX app_user_google_sub_uq ON app_user (google_sub);
