-- Phase 3: derived factor versions, diet/shopping/waste factors, and the daily_emission read model.
-- Derivations are documented in docs/05-emission-methodology.md; every value must be checked against the
-- cited edition before release. Old versions are closed, never edited, so stored activities stay auditable.

ALTER TABLE emission_factor ADD COLUMN method_note VARCHAR(300);

UPDATE emission_factor
SET method_note = 'Indicative per passenger-km placeholder; replace with DESNZ or UBA TREMOD values'
WHERE category = 'TRANSPORT' AND method_note IS NULL;
UPDATE emission_factor
SET method_note = 'Indicative placeholder'
WHERE method_note IS NULL;

-- Close version 1 of every factor that has a derived replacement.
UPDATE emission_factor SET valid_to = DATE '2026-01-01'
WHERE id IN ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102',
             '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104',
             '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202',
             '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204');

INSERT INTO emission_factor
    (id, category, subtype, label, unit, kg_co2e_per_unit, region, source_name, source_url, shareable, max_quantity,
     valid_from, valid_to, version, method_note)
VALUES
    ('00000000-0000-4000-8000-000000000301', 'TRANSPORT', 'CAR_PETROL', 'Car (petrol)', 'KM', 0.169000, NULL,
     'IPCC 2006 GL Vol.2 Ch.1 (derived)', 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html', TRUE, 2000,
     DATE '2026-01-01', NULL, 2, '7.4 L/100 km x 2.287 kg CO2/L (0.745 kg/L x 44.3 MJ/kg x 69.3 g/MJ); tank-to-wheel'),
    ('00000000-0000-4000-8000-000000000302', 'TRANSPORT', 'CAR_DIESEL', 'Car (diesel)', 'KM', 0.161000, NULL,
     'IPCC 2006 GL Vol.2 Ch.1 (derived)', 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html', TRUE, 2000,
     DATE '2026-01-01', NULL, 2, '6.0 L/100 km x 2.677 kg CO2/L (0.840 kg/L x 43.0 MJ/kg x 74.1 g/MJ); tank-to-wheel'),
    ('00000000-0000-4000-8000-000000000303', 'TRANSPORT', 'CAR_HYBRID', 'Car (hybrid)', 'KM', 0.110000, NULL,
     'IPCC 2006 GL Vol.2 Ch.1 (derived)', 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html', TRUE, 2000,
     DATE '2026-01-01', NULL, 2, '4.8 L/100 km petrol x 2.287 kg CO2/L; tank-to-wheel'),
    ('00000000-0000-4000-8000-000000000304', 'TRANSPORT', 'CAR_EV', 'Car (electric)', 'KM', 0.086000, NULL,
     'Ember Global Electricity Review 2024 (derived)', 'https://ember-energy.org/latest-insights/global-electricity-review-2024/',
     TRUE, 2000, DATE '2026-01-01', NULL, 2, '0.18 kWh/km at the plug x 0.480 kg CO2/kWh world grid average'),
    ('00000000-0000-4000-8000-000000000305', 'TRANSPORT', 'CAR_EV', 'Car (electric)', 'KM', 0.068000, 'DE',
     'UBA Strommix 2023 provisional (derived)', 'https://www.umweltbundesamt.de/publikationen', TRUE, 2000,
     DATE '2026-01-01', NULL, 2, '0.18 kWh/km at the plug x 0.380 kg CO2/kWh German grid'),
    ('00000000-0000-4000-8000-000000000306', 'ENERGY', 'ELECTRICITY', 'Electricity (global avg)', 'KWH', 0.480000, NULL,
     'Ember Global Electricity Review 2024', 'https://ember-energy.org/latest-insights/global-electricity-review-2024/',
     FALSE, 100000, DATE '2026-01-01', NULL, 2, 'Location-based world average grid intensity, 2023'),
    ('00000000-0000-4000-8000-000000000307', 'ENERGY', 'ELECTRICITY', 'Electricity (Germany)', 'KWH', 0.380000, 'DE',
     'UBA Strommix 2023 provisional', 'https://www.umweltbundesamt.de/publikationen', FALSE, 100000,
     DATE '2026-01-01', NULL, 2, 'Location-based German mix, direct CO2 (verify edition)'),
    ('00000000-0000-4000-8000-000000000308', 'ENERGY', 'NATURAL_GAS', 'Natural gas', 'KWH', 0.182000, NULL,
     'IPCC 2006 GL Vol.2 Ch.1 (derived)', 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html', FALSE, 100000,
     DATE '2026-01-01', NULL, 2, '56.1 g/MJ x 3.6 = 0.202 kg/kWh (net) / 1.11 for gross-CV billed kWh'),
    ('00000000-0000-4000-8000-000000000309', 'ENERGY', 'HEATING_OIL', 'Heating oil', 'LITRE', 2.692000, NULL,
     'IPCC 2006 GL Vol.2 Ch.1 (derived)', 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/vol2.html', FALSE, 20000,
     DATE '2026-01-01', NULL, 2, '0.845 kg/L x 43.0 MJ/kg x 74.1 g/MJ (gas/diesel oil default)'),

    -- Diet: 0.1 kg main protein x Poore & Nemecek (2018) global mean + 0.5 kg CO2e sides allowance (assumption).
    ('00000000-0000-4000-8000-000000000401', 'DIET', 'MEAL_BEEF', 'Meal with beef', 'MEAL', 10.448000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg x 99.48 kg CO2e/kg (beef herd) + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000402', 'DIET', 'MEAL_LAMB', 'Meal with lamb', 'MEAL', 4.472000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg x 39.72 kg CO2e/kg + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000403', 'DIET', 'MEAL_PORK', 'Meal with pork', 'MEAL', 1.731000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg x 12.31 kg CO2e/kg + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000404', 'DIET', 'MEAL_POULTRY', 'Meal with poultry', 'MEAL', 1.487000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg x 9.87 kg CO2e/kg + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000405', 'DIET', 'MEAL_FISH', 'Meal with farmed fish', 'MEAL', 1.863000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg x 13.63 kg CO2e/kg + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000406', 'DIET', 'MEAL_VEGETARIAN', 'Vegetarian meal', 'MEAL', 0.967000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg eggs x 4.67 kg CO2e/kg + 0.5 sides'),
    ('00000000-0000-4000-8000-000000000407', 'DIET', 'MEAL_VEGAN', 'Vegan meal', 'MEAL', 0.816000, NULL,
     'Poore & Nemecek 2018, Science 360:987 (derived)', 'https://doi.org/10.1126/science.aaq0216', FALSE, 10,
     DATE '2024-01-01', NULL, 1, '0.1 kg tofu x 3.16 kg CO2e/kg + 0.5 sides'),

    -- Shopping: indicative cradle-to-gate product footprints and a spend-based fallback.
    ('00000000-0000-4000-8000-000000000501', 'SHOPPING', 'SMARTPHONE', 'Smartphone', 'ITEM', 70.000000, NULL,
     'Manufacturer product LCAs (indicative)', NULL, FALSE, 10, DATE '2024-01-01', NULL, 1,
     'Indicative ISO 14040/44 product footprint; varies widely by model'),
    ('00000000-0000-4000-8000-000000000502', 'SHOPPING', 'LAPTOP', 'Laptop', 'ITEM', 300.000000, NULL,
     'Manufacturer product LCAs (indicative)', NULL, FALSE, 10, DATE '2024-01-01', NULL, 1,
     'Indicative ISO 14040/44 product footprint; varies widely by model'),
    ('00000000-0000-4000-8000-000000000503', 'SHOPPING', 'TSHIRT', 'T-shirt (cotton)', 'ITEM', 7.000000, NULL,
     'Apparel LCAs (indicative)', NULL, FALSE, 50, DATE '2024-01-01', NULL, 1, 'Indicative cradle-to-gate'),
    ('00000000-0000-4000-8000-000000000504', 'SHOPPING', 'JEANS', 'Jeans', 'ITEM', 33.400000, NULL,
     'Levi Strauss & Co. product LCA 2015 (indicative)', NULL, FALSE, 20, DATE '2024-01-01', NULL, 1,
     'Full life cycle of one pair of 501 jeans, incl. consumer care'),
    ('00000000-0000-4000-8000-000000000505', 'SHOPPING', 'OTHER_GOODS', 'Other goods (per EUR spent)', 'EUR',
     0.400000, NULL, 'EE-MRIO average, e.g. EXIOBASE (indicative)', NULL, FALSE, 10000, DATE '2024-01-01', NULL, 1,
     'Spend-based average for manufactured goods; very uncertain'),

    -- Waste: per kg of household waste by route, magnitude of DESNZ / US EPA WARM factors (indicative).
    ('00000000-0000-4000-8000-000000000601', 'WASTE', 'LANDFILL', 'Mixed waste to landfill', 'KG', 0.500000, NULL,
     'IPCC 2006 GL Vol.5 / DESNZ waste factors (indicative)', 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
     FALSE, 500, DATE '2024-01-01', NULL, 1, 'Landfill methane from first-order decay of organic carbon'),
    ('00000000-0000-4000-8000-000000000602', 'WASTE', 'INCINERATION', 'Mixed waste incinerated', 'KG', 0.021000, NULL,
     'DESNZ waste factors (indicative)', 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
     FALSE, 500, DATE '2024-01-01', NULL, 1, 'Collection only; combustion is reported under energy in DESNZ'),
    ('00000000-0000-4000-8000-000000000603', 'WASTE', 'RECYCLING', 'Recycling', 'KG', 0.021000, NULL,
     'DESNZ waste factors (indicative)', 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
     FALSE, 500, DATE '2024-01-01', NULL, 1, 'Collection and processing; no avoided-burden credit'),
    ('00000000-0000-4000-8000-000000000604', 'WASTE', 'COMPOST', 'Composting', 'KG', 0.009000, NULL,
     'DESNZ waste factors (indicative)', 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
     FALSE, 500, DATE '2024-01-01', NULL, 1, 'Collection and composting process emissions');

-- Read model: per user, day and category totals, kept in step with activity by signed deltas in the same
-- transaction (see DailyEmissionProjection). Summing it equals summing activity.kg_co2e for every key.
CREATE TABLE daily_emission (
    user_id     UUID           NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    occurred_on DATE           NOT NULL,
    category    VARCHAR(16)    NOT NULL,
    kg_co2e     NUMERIC(16, 3) NOT NULL,
    PRIMARY KEY (user_id, occurred_on, category)
);

INSERT INTO daily_emission (user_id, occurred_on, category, kg_co2e)
SELECT user_id, occurred_on, category, SUM(kg_co2e)
FROM activity
GROUP BY user_id, occurred_on, category;
