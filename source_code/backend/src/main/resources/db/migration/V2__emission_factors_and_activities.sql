CREATE TABLE emission_factor (
    id               UUID PRIMARY KEY,
    category         VARCHAR(16)  NOT NULL,
    subtype          VARCHAR(32)  NOT NULL,
    label            VARCHAR(80)  NOT NULL,
    unit             VARCHAR(16)  NOT NULL,
    kg_co2e_per_unit NUMERIC(14, 6) NOT NULL CHECK (kg_co2e_per_unit >= 0),
    region           VARCHAR(16),
    source_name      VARCHAR(120) NOT NULL,
    source_url       VARCHAR(300),
    shareable        BOOLEAN      NOT NULL,
    max_quantity     NUMERIC(14, 3) NOT NULL CHECK (max_quantity > 0),
    valid_from       DATE         NOT NULL,
    valid_to         DATE,
    version          INTEGER      NOT NULL
);
CREATE INDEX idx_emission_factor_lookup ON emission_factor (category, subtype, region, valid_from);

CREATE TABLE activity (
    id          UUID PRIMARY KEY,
    user_id     UUID           NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    category    VARCHAR(16)    NOT NULL,
    subtype     VARCHAR(32)    NOT NULL,
    quantity    NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
    unit        VARCHAR(16)    NOT NULL,
    occurred_on DATE           NOT NULL,
    passengers  INTEGER        NOT NULL DEFAULT 1 CHECK (passengers BETWEEN 1 AND 9),
    note        VARCHAR(200),
    factor_id   UUID           NOT NULL REFERENCES emission_factor (id),
    kg_co2e     NUMERIC(14, 3) NOT NULL CHECK (kg_co2e >= 0),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    version     BIGINT         NOT NULL DEFAULT 0
);
CREATE INDEX idx_activity_user_date ON activity (user_id, occurred_on DESC);
CREATE INDEX idx_activity_user_category_date ON activity (user_id, category, occurred_on);

-- PLACEHOLDER VALUES: illustrative magnitudes only. Replace with figures verified against
-- UBA / DEFRA / EPA (and record the exact publication in source_name/source_url) before release.
-- Factor ids are fixed so tests and docs can refer to them.
INSERT INTO emission_factor
    (id, category, subtype, label, unit, kg_co2e_per_unit, region, source_name, source_url, shareable, max_quantity, valid_from, valid_to, version)
VALUES
    ('00000000-0000-4000-8000-000000000101', 'TRANSPORT', 'CAR_PETROL',      'Car (petrol)',           'KM',    0.170000, NULL, 'Placeholder - unverified', NULL, TRUE,  2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000102', 'TRANSPORT', 'CAR_DIESEL',      'Car (diesel)',           'KM',    0.160000, NULL, 'Placeholder - unverified', NULL, TRUE,  2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000103', 'TRANSPORT', 'CAR_HYBRID',      'Car (hybrid)',           'KM',    0.110000, NULL, 'Placeholder - unverified', NULL, TRUE,  2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000104', 'TRANSPORT', 'CAR_EV',          'Car (electric)',         'KM',    0.060000, NULL, 'Placeholder - unverified', NULL, TRUE,  2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000105', 'TRANSPORT', 'MOTORBIKE',       'Motorbike',              'KM',    0.110000, NULL, 'Placeholder - unverified', NULL, FALSE, 2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000106', 'TRANSPORT', 'BUS',             'Bus',                    'KM',    0.100000, NULL, 'Placeholder - unverified', NULL, FALSE, 2000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000107', 'TRANSPORT', 'TRAIN_REGIONAL',  'Regional train',         'KM',    0.040000, NULL, 'Placeholder - unverified', NULL, FALSE, 3000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000108', 'TRANSPORT', 'TRAIN_LONG',      'Long-distance train',    'KM',    0.030000, NULL, 'Placeholder - unverified', NULL, FALSE, 5000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000109', 'TRANSPORT', 'TRAM_SUBWAY',     'Tram / subway',          'KM',    0.030000, NULL, 'Placeholder - unverified', NULL, FALSE, 500,    DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-00000000010a', 'TRANSPORT', 'FLIGHT_SHORT',    'Flight (short-haul)',    'KM',    0.150000, NULL, 'Placeholder - unverified', NULL, FALSE, 4000,   DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-00000000010b', 'TRANSPORT', 'FLIGHT_LONG',     'Flight (long-haul)',     'KM',    0.140000, NULL, 'Placeholder - unverified', NULL, FALSE, 20000,  DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-00000000010c', 'TRANSPORT', 'BIKE_WALK',       'Bike / walking',         'KM',    0.000000, NULL, 'Placeholder - unverified', NULL, FALSE, 500,    DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000201', 'ENERGY',    'ELECTRICITY',     'Electricity (global avg)', 'KWH', 0.450000, NULL, 'Placeholder - unverified', NULL, FALSE, 100000, DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000202', 'ENERGY',    'ELECTRICITY',     'Electricity (Germany)',  'KWH',   0.380000, 'DE', 'Placeholder - unverified', NULL, FALSE, 100000, DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000203', 'ENERGY',    'NATURAL_GAS',     'Natural gas',            'KWH',   0.200000, NULL, 'Placeholder - unverified', NULL, FALSE, 100000, DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000204', 'ENERGY',    'HEATING_OIL',     'Heating oil',            'LITRE', 2.680000, NULL, 'Placeholder - unverified', NULL, FALSE, 20000,  DATE '2024-01-01', NULL, 1),
    ('00000000-0000-4000-8000-000000000205', 'ENERGY',    'DISTRICT_HEATING','District heating',       'KWH',   0.180000, NULL, 'Placeholder - unverified', NULL, FALSE, 100000, DATE '2024-01-01', NULL, 1);
