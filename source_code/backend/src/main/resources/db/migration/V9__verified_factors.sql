-- Verified factors (research + independent re-check on 2026-11-09). History is kept: replaced lines are closed
-- (valid_to is exclusive) and new versions start the same day; existing activities keep their factor_id.
-- Germany-specific values are added as region 'DE' lines, so the global fallbacks stay for other regions.
-- Not verified yet and left unchanged: MOTORBIKE, FLIGHT_LONG, DISTRICT_HEATING, global ELECTRICITY, LAPTOP,
-- JEANS, TSHIRT, OTHER_GOODS, MEAL_LAMB (ifeu has no lamb row).

UPDATE emission_factor SET valid_to = DATE '2026-11-09'
WHERE valid_to IS NULL AND (
       (category = 'ENERGY' AND subtype IN ('ELECTRICITY') AND region = 'DE')
    OR (category = 'ENERGY' AND subtype IN ('NATURAL_GAS', 'HEATING_OIL') AND region IS NULL)
    OR (category = 'TRANSPORT' AND subtype = 'CAR_EV' AND region = 'DE')
    OR (category = 'WASTE' AND region IS NULL)
    OR (category = 'SHOPPING' AND subtype = 'SMARTPHONE' AND region IS NULL));

INSERT INTO emission_factor
    (id, category, subtype, label, unit, kg_co2e_per_unit, region, source_name, source_url, shareable, max_quantity,
     valid_from, valid_to, version, method_note)
VALUES
-- Transport, Germany: UBA TREMOD 6.71B, reference year 2024, g CO2e/pkm incl. energy supply chain and occupancy.
    ('00000000-0000-4000-8000-000000000901', 'TRANSPORT', 'CAR_PETROL', 'Car (petrol)', 'KM', 0.165000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     TRUE, 2000, DATE '2026-11-09', NULL, 1, 'Row "davon Benzin-Pkw" 165 g/pkm; well-to-wheel, 1.4 persons/car'),
    ('00000000-0000-4000-8000-000000000902', 'TRANSPORT', 'CAR_DIESEL', 'Car (diesel)', 'KM', 0.175000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     TRUE, 2000, DATE '2026-11-09', NULL, 1, 'Row "davon Diesel-Pkw" 175 g/pkm; well-to-wheel'),
    ('00000000-0000-4000-8000-000000000903', 'TRANSPORT', 'CAR_HYBRID', 'Car (hybrid)', 'KM', 0.111000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     TRUE, 2000, DATE '2026-11-09', NULL, 1, 'Row "davon Hybrid-Pkw" 111 g/pkm; well-to-wheel'),
    ('00000000-0000-4000-8000-000000000904', 'TRANSPORT', 'CAR_EV', 'Car (electric)', 'KM', 0.070000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     TRUE, 2000, DATE '2026-11-09', NULL, 3, 'Row "davon Elektro-Pkw" 70 g/pkm; German grid mix incl. upstream'),
    ('00000000-0000-4000-8000-000000000905', 'TRANSPORT', 'BUS', 'Bus', 'KM', 0.090000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     FALSE, 2000, DATE '2026-11-09', NULL, 1, 'Row "Linienbus, Nahverkehr" 90 g/pkm (coach: 30); incl. upstream'),
    ('00000000-0000-4000-8000-000000000906', 'TRANSPORT', 'TRAM_SUBWAY', 'Tram / subway', 'KM', 0.042000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     FALSE, 500, DATE '2026-11-09', NULL, 1, 'Row "Straßen-, Stadt- und U-Bahn" 42 g/pkm; German grid incl. upstream'),
    ('00000000-0000-4000-8000-000000000907', 'TRANSPORT', 'TRAIN_REGIONAL', 'Regional train', 'KM', 0.044000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     FALSE, 3000, DATE '2026-11-09', NULL, 1, 'Row "Eisenbahn, Nahverkehr" 44 g/pkm; German grid incl. upstream'),
    ('00000000-0000-4000-8000-000000000908', 'TRANSPORT', 'TRAIN_LONG', 'Long-distance train', 'KM', 0.026000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     FALSE, 5000, DATE '2026-11-09', NULL, 1, 'Row "Eisenbahn, Fernverkehr" 26 g/pkm; average grid, not the operator green tariff'),
    ('00000000-0000-4000-8000-000000000909', 'TRANSPORT', 'FLIGHT_SHORT', 'Flight (short-haul)', 'KM', 0.290000, 'DE',
     'UBA TREMOD 6.71B (10/2025), Personenverkehr 2024', 'https://www.umweltbundesamt.de/system/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf',
     FALSE, 4000, DATE '2026-11-09', NULL, 1, 'Row "Flugzeug, Inland" 290 g/pkm incl. non-CO2 effects (EWF 1.5)'),
-- Energy
    ('00000000-0000-4000-8000-000000000910', 'ENERGY', 'ELECTRICITY', 'Electricity (Germany)', 'KWH', 0.352000, 'DE',
     'UBA Climate Change 16/2026, Strommix 1990-2025, Tabelle 3', 'https://www.umweltbundesamt.de/system/files/medien/11850/publikationen/2026-03/16_2026_CC.pdf',
     FALSE, 100000, DATE '2026-11-09', NULL, 3, '2025 estimate, CO2e of consumption without upstream (with upstream: 406 g)'),
    ('00000000-0000-4000-8000-000000000911', 'ENERGY', 'NATURAL_GAS', 'Natural gas', 'KWH', 0.183000, NULL,
     'UBA Climate Change 16/2026, Anhang Tabelle 8', 'https://www.umweltbundesamt.de/system/files/medien/11850/publikationen/2026-03/16_2026_CC.pdf',
     FALSE, 100000, DATE '2026-11-09', NULL, 3, '56,352 kg CO2/TJ = 0.2029 kg/kWh (Hi); / 1.11 (Hs/Hi, assumed) = 0.183 per billed kWh (Hs); combustion only'),
    ('00000000-0000-4000-8000-000000000912', 'ENERGY', 'HEATING_OIL', 'Heating oil', 'LITRE', 2.650000, NULL,
     'UBA Climate Change 16/2026, Anhang Tabelle 8 (Heizöl leicht)', 'https://www.umweltbundesamt.de/system/files/medien/11850/publikationen/2026-03/16_2026_CC.pdf',
     FALSE, 20000, DATE '2026-11-09', NULL, 3, '74,020 kg CO2/TJ x 35.8 MJ/L (assumed heating value) = 2.650 kg/L; combustion only'),
-- Diet, Germany: ifeu 2020 (base year 2019, cradle to supermarket checkout); meal = 0.100 kg x EF + 0.5 kg sides.
    ('00000000-0000-4000-8000-000000000913', 'DIET', 'MEAL_BEEF', 'Meal with beef', 'MEAL', 1.860000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 3', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Rindfleisch, Durchschnitt 13.6 kg/kg: 0.1 x 13.6 + 0.5'),
    ('00000000-0000-4000-8000-000000000914', 'DIET', 'MEAL_PORK', 'Meal with pork', 'MEAL', 0.960000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 3', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Schweinefleisch, Durchschnitt 4.6 kg/kg: 0.1 x 4.6 + 0.5'),
    ('00000000-0000-4000-8000-000000000915', 'DIET', 'MEAL_POULTRY', 'Meal with poultry', 'MEAL', 1.050000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 3', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Hähnchen, Durchschnitt 5.5 kg/kg: 0.1 x 5.5 + 0.5'),
    ('00000000-0000-4000-8000-000000000916', 'DIET', 'MEAL_FISH', 'Meal with fish', 'MEAL', 1.010000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 3', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Fisch, Aquakultur 5.1 kg/kg (matches the farmed-fish line): 0.1 x 5.1 + 0.5'),
    ('00000000-0000-4000-8000-000000000917', 'DIET', 'MEAL_VEGETARIAN', 'Vegetarian meal', 'MEAL', 0.935000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 2', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Assumed 50/50 egg (3.0) and cheese (5.7) = 4.35 kg/kg: 0.1 x 4.35 + 0.5'),
    ('00000000-0000-4000-8000-000000000918', 'DIET', 'MEAL_VEGAN', 'Vegan meal', 'MEAL', 0.600000, 'DE',
     'ifeu 2020, Ökologische Fußabdrücke von Lebensmitteln, Tabelle 3', 'https://www.ifeu.de/fileadmin/uploads/Reinhardt-Gaertner-Wagner-2020-Oekologische-Fu%C3%9Fabdruecke-von-Lebensmitteln-und-Gerichten-in-Deutschland-ifeu-2020.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 1, 'Tofu 1.0 kg/kg: 0.1 x 1.0 + 0.5'),
-- Waste: DESNZ 2025, household residual waste (disposal only, cut-off: no avoided-burden credit).
    ('00000000-0000-4000-8000-000000000919', 'WASTE', 'LANDFILL', 'Mixed waste to landfill', 'KG', 0.497000, NULL,
     'DESNZ GHG conversion factors 2025, Waste disposal', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 500, DATE '2026-11-09', NULL, 2, 'Household residual waste, landfill 497.24 kg/t (untreated landfill is banned in DE since 2005)'),
    ('00000000-0000-4000-8000-000000000920', 'WASTE', 'INCINERATION', 'Mixed waste incinerated', 'KG', 0.004690, NULL,
     'DESNZ GHG conversion factors 2025, Waste disposal', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 500, DATE '2026-11-09', NULL, 2, 'Household residual waste, energy recovery 4.69 kg/t: transport only, combustion counted to the power sector'),
    ('00000000-0000-4000-8000-000000000921', 'WASTE', 'RECYCLING', 'Recycling', 'KG', 0.004690, NULL,
     'DESNZ GHG conversion factors 2025, Waste disposal', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 500, DATE '2026-11-09', NULL, 2, 'Mixed paper and board, closed loop 4.69 kg/t: collection and transport only'),
    ('00000000-0000-4000-8000-000000000922', 'WASTE', 'COMPOST', 'Composting', 'KG', 0.008980, NULL,
     'DESNZ GHG conversion factors 2025, Waste disposal', 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
     FALSE, 500, DATE '2026-11-09', NULL, 2, 'Mixed food and garden waste, composting 8.98 kg/t'),
-- Shopping
    ('00000000-0000-4000-8000-000000000923', 'SHOPPING', 'SMARTPHONE', 'Smartphone', 'ITEM', 55.000000, NULL,
     'Apple iPhone 17 Product Environmental Report (09/2025)', 'https://www.apple.com/environment/pdf/products/iphone/iPhone_17_PER_Sept2025.pdf',
     FALSE, 10, DATE '2026-11-09', NULL, 2, 'Life cycle, 256 GB model 55 kg CO2e; one current model, indicative for phones in general');
