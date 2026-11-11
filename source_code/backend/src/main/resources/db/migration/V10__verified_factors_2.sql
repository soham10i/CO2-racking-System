-- Second verification round (2026-11-09). Same rules as V9: close the old line, start a new version.
-- Still unverified and unchanged: JEANS (Levi's 2015 PDF unreachable), TSHIRT (only a cotton-shirt LCA found),
-- OTHER_GOODS per EUR (no primary spend factor found).

UPDATE emission_factor SET valid_to = DATE '2026-11-09'
WHERE valid_to IS NULL AND region IS NULL AND (
       (category = 'TRANSPORT' AND subtype IN ('MOTORBIKE', 'FLIGHT_LONG'))
    OR (category = 'ENERGY' AND subtype = 'ELECTRICITY')
    OR (category = 'DIET' AND subtype = 'MEAL_LAMB')
    OR (category = 'SHOPPING' AND subtype = 'LAPTOP'));

INSERT INTO emission_factor
    (id, category, subtype, label, unit, kg_co2e_per_unit, region, source_name, source_url, shareable, max_quantity,
     valid_from, valid_to, version, method_note)
VALUES
    ('00000000-0000-4000-8000-000000001001', 'TRANSPORT', 'MOTORBIKE', 'Motorbike', 'KM', 0.114000, NULL,
     'DESNZ GHG conversion factors 2025, Passenger vehicles, Motorbike average', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 2000, DATE '2026-11-09', NULL, 2, 'ID 4_302_3080_4_1: 0.11367 kg CO2e/km, tank-to-wheel, 1 rider (WTT +0.030 excluded)'),
    ('00000000-0000-4000-8000-000000001002', 'TRANSPORT', 'FLIGHT_LONG', 'Flight (long-haul)', 'KM', 0.153000, NULL,
     'DESNZ GHG conversion factors 2025, Business travel air, long-haul with RF', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 20000, DATE '2026-11-09', NULL, 2, 'ID 21_316_3168_11_1: 0.15282 per pkm, average passenger, incl. radiative forcing (without RF 0.090; WTT excluded)'),
    ('00000000-0000-4000-8000-000000001003', 'ENERGY', 'DISTRICT_HEATING', 'District heating (Germany)', 'KWH', 0.280000, 'DE',
     'BAFA Infoblatt CO2-Faktoren (EEW) v3.1, 08/2024, Tabelle 2', 'https://www.bafa.de/SharedDocs/Downloads/DE/Energie/eew_infoblatt_co2_faktoren_2024.pdf?__blob=publicationFile',
     FALSE, 100000, DATE '2026-11-09', NULL, 1, 'Nah-/Fernwärme 0.280 t CO2/MWh: generic default; local networks differ widely'),
    ('00000000-0000-4000-8000-000000001004', 'ENERGY', 'ELECTRICITY', 'Electricity (global avg)', 'KWH', 0.473000, NULL,
     'Ember Yearly Electricity Data (global), World 2024', 'https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv',
     FALSE, 100000, DATE '2026-11-09', NULL, 3, 'World 2024 total generation 473.04 g CO2e/kWh (life cycle; 2025: 460)'),
    ('00000000-0000-4000-8000-000000001005', 'DIET', 'MEAL_LAMB', 'Meal with lamb', 'MEAL', 4.472000, NULL,
     'Poore & Nemecek 2018 via Our World in Data', 'https://ourworldindata.org/grapher/ghg-per-kg-poore.csv',
     FALSE, 10, DATE '2026-11-09', NULL, 2, 'Lamb & mutton 39.72 kg/kg (global mean): 0.1 x 39.72 + 0.5'),
    ('00000000-0000-4000-8000-000000001006', 'SHOPPING', 'LAPTOP', 'Laptop', 'ITEM', 253.000000, NULL,
     'Dell Latitude 5440 Product Carbon Footprint (PAIA), 02/2023', 'https://cdn.iceshop.nl/objects/mmo_110478059_1701772404_325_998574.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 2, 'Life cycle mean 290 kg minus ~37.7 kg use phase (electricity is logged separately); one model, indicative');
