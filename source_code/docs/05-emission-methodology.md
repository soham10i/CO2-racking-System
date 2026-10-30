# Emission Calculation Methodology

This document explains every number the app produces: the formula, how factors are chosen, how each factor is derived, how totals and comparisons are aggregated, and which published sources back them. The live factor table (`GET /api/v1/emission-factors`, and the in-app **Methodology** page) shows the exact value, version and source used for each calculation.

> **Release gate.** Values marked *derived* are computed below from published IPCC defaults plus a stated assumption (for example fuel consumption). Values marked *indicative* are order-of-magnitude placeholders. Before real users see numbers, check every factor against the edition of the source cited in its row, and change it with a new Flyway migration that adds a new version. Never edit a version in place.

## 1. Accounting framework

| Choice | Decision | Basis |
|---|---|---|
| Method | Activity data × emission factor (IPCC "Tier 1" approach) | IPCC 2006 Guidelines, Vol. 1 Ch. 1; GHG Protocol Corporate Standard |
| Unit of result | kg CO2-equivalent (CO2e) | IPCC AR6 WG1 |
| Gas aggregation | GWP100 from IPCC AR6: CO2 = 1, CH4 (fossil) = 29.8, CH4 (non-fossil) = 27.0, N2O = 273 | IPCC AR6 WG1 Ch. 7, Table 7.15 |
| Electricity | Location-based (average grid intensity of the user's country) | GHG Protocol Scope 2 Guidance (2015) |
| Perspective | Consumption by the individual: travel, home energy, food, purchases and waste | ISO 14067 / ISO 14040-44 life-cycle thinking |

### 1.1 Converting gases to CO2e
For a factor reported per gas:

$$
EF_{\mathrm{CO_2e}} = m_{\mathrm{CO_2}} \cdot 1 + m_{\mathrm{CH_4}} \cdot \mathrm{GWP}_{\mathrm{CH_4}} + m_{\mathrm{N_2O}} \cdot \mathrm{GWP}_{\mathrm{N_2O}}
$$

Example: 1 kg CH4 from a landfill (non-fossil) counts as 27.0 kg CO2e. 1 kg N2O from fertiliser counts as 273 kg CO2e.

## 2. The calculation engine

### 2.1 Formula
For one activity *i*:

$$
E_i = \frac{Q_i \times EF(c_i, s_i, r, d_i)}{n_i}
$$

| Symbol | Meaning |
|---|---|
| $Q_i$ | quantity entered (km, kWh, litres, meals, items, kg), Q > 0 and ≤ the factor's plausibility maximum |
| $EF$ | kg CO2e per unit for category *c*, subtype *s*, user region *r*, valid on date *d* |
| $n_i$ | people sharing the emission (car passengers, 1–9); always 1 for non-shareable factors |

The server alone computes E. The client sends only the inputs (category, subtype, quantity, date, passengers). It never sends a result or a factor.

**Arithmetic:** `BigDecimal` throughout. The product Q × EF is exact. Division by *n* keeps 6 decimals. The final result is rounded to 3 decimals (gram precision) with **round-half-even** (banker's rounding), which avoids a systematic upward bias when many values are summed.

Worked example: 12 km by petrol car with 2 people (EF = 0.169 kg/km):

$$
12 \times 0.169 = 2.028\ \text{kg} \quad\Rightarrow\quad \frac{2.028}{2} = 1.014\ \text{kg CO}_2\text{e per person}
$$

### 2.2 Factor selection
Candidates are factors with the same category and subtype where `valid_from ≤ d < valid_to` (an open `valid_to` means current) and the region is either the user's country or global (`NULL`). Among the candidates:

1. A region match beats a global factor.
2. A later `valid_from` beats an earlier one.
3. A higher `version` beats a lower one.

The chosen factor id is stored with the activity. A later factor change therefore never rewrites history, and every stored figure can be audited back to its exact factor.

### 2.3 Strategy per category
`EmissionEngine` dispatches to a `CategoryCalculator` per category (Strategy pattern):

| Calculator | Categories | Rules |
|---|---|---|
| `TransportCalculator` | TRANSPORT | Passenger sharing on shareable factors (cars); rejects passengers on public transport, because those factors are already per passenger-km |
| `StandardCalculator` | ENERGY, DIET, SHOPPING, WASTE | Plain Q × EF; passengers not applicable |

New modifiers (flight class, household share of a bill) are added by extending one strategy, without touching the others.

## 3. Factor derivations

### 3.1 Cars (tank-to-wheel, *derived*)
From the fuel's energy content and its IPCC default carbon factor:

$$
\begin{aligned}
EF_{\text{litre}} &= \rho\ [\text{kg/L}] \times NCV\ [\text{MJ/kg}] \times EF_{\mathrm{CO_2}}\ [\text{kg/MJ}] \\
EF_{\text{km}} &= \frac{\text{consumption}\ [\text{L}/100\ \text{km}]}{100} \times EF_{\text{litre}}
\end{aligned}
$$

| Fuel | ρ (kg/L) | NCV (MJ/kg) | EF_CO2 (kg/TJ) | kg CO2/L | Assumed L/100 km | **kg CO2/km** |
|---|---|---|---|---|---|---|
| Petrol | 0.745 | 44.3 | 69 300 | 0.745 × 44.3 × 0.0693 = **2.287** | 7.4 | **0.169** |
| Diesel | 0.840 | 43.0 | 74 100 | 0.840 × 43.0 × 0.0741 = **2.677** | 6.0 | **0.161** |
| Full hybrid (petrol) | 0.745 | 44.3 | 69 300 | 2.287 | 4.8 | **0.110** |

NCV and EF_CO2 come from the IPCC 2006 Guidelines, Vol. 2, Ch. 1, Tables 1.2 and 1.4. Density is a typical value for EN 228 petrol and EN 590 diesel. Consumption figures are real-world fleet assumptions: real-world use is above the WLTP test cycle.

**Excluded, and documented as a known under-estimate:**
- Upstream "well-to-tank" emissions (extraction, refining, distribution). The UK DESNZ conversion factors list these separately, and they add roughly a fifth to a quarter on top.
- Exhaust CH4 and N2O, which are about 1% of CO2e for modern cars.
- Vehicle manufacture.

### 3.2 Electric car (*derived*)
$$
\begin{aligned}
EF_{\text{EV}} &= \text{consumption}_{\text{plug}}\ [\text{kWh/km}] \times EF_{\text{grid}}(\text{region}) \\
&= 0.18 \times 0.380 = 0.068\ \text{kg/km (DE)}, \qquad 0.18 \times 0.480 = 0.086\ \text{kg/km (global)}
\end{aligned}
$$
The 18 kWh/100 km at the plug includes charging losses. Because the grid factor is regional, the EV factor exists in a German and a global variant.

### 3.3 Electricity (location-based)
$$
E = \text{kWh} \times EF_{\text{grid}}(\text{country})
$$
| Region | EF (kg CO2/kWh) | Source |
|---|---|---|
| DE | 0.380 | Umweltbundesamt (UBA), annual report on the specific emissions of the German electricity mix (provisional 2023 value, direct CO2) |
| Global | 0.480 | Ember, *Global Electricity Review 2024* (2023 world average) |

Including upstream fuel chains and the other gases raises the German value. UBA publishes both variants, so the table must state which one is used.

### 3.4 Natural gas (*derived*)
$$
56\,100\ \tfrac{\text{kg CO}_2}{\text{TJ}} = 56.1\ \tfrac{\text{g}}{\text{MJ}} \times 3.6\ \tfrac{\text{MJ}}{\text{kWh}} = 0.2020\ \tfrac{\text{kg CO}_2}{\text{kWh}}\ \text{(net calorific value)}
$$
German and UK gas bills state kWh on the **gross** calorific value (Brennwert). For natural gas, GCV/NCV ≈ 1.11:
$$
\frac{0.2020}{1.11} = 0.182\ \text{kg CO}_2\ \text{per billed kWh}
$$

### 3.5 Heating oil (*derived*)
$$
0.845\ \tfrac{\text{kg}}{\text{L}} \times 43.0\ \tfrac{\text{MJ}}{\text{kg}} \times 0.0741\ \tfrac{\text{kg}}{\text{MJ}} = 2.692\ \tfrac{\text{kg CO}_2}{\text{L}}
$$
Based on the IPCC "gas/diesel oil" default (Table 1.4).

### 3.6 Public transport and flights (*indicative*)
These are per passenger-km and already divided by average occupancy, so passengers are not applicable. Replace them with the current UK DESNZ conversion factors or UBA TREMOD per-pkm values.

Flights also have non-CO2 effects: contrails, contrail cirrus and NOx. Lee et al. (2021) estimate that these make up roughly two-thirds of aviation's net effective radiative forcing. How that becomes a per-km multiplier depends on the climate metric (an ERF ratio is not the same as a GWP100 ratio). This is why DESNZ publishes separate "with RF" factors. The app should use the "with RF" variant and state the multiplier.

### 3.7 Food (*derived from Poore & Nemecek 2018*)
A meal is modelled as a main protein portion plus a fixed allowance for sides:

$$
EF_{\text{meal}} = m_{\text{portion}} \times EF_{\text{food}} + EF_{\text{sides}}, \qquad m_{\text{portion}} = 0.100\ \text{kg},\quad EF_{\text{sides}} = 0.5\ \text{kg CO}_2\text{e}
$$

| Meal | Main ingredient | EF_food (kg CO2e/kg, global mean) | **EF_meal** |
|---|---|---|---|
| Beef | beef (beef herd) | 99.48 | 0.1 × 99.48 + 0.5 = **10.448** |
| Lamb | lamb & mutton | 39.72 | **4.472** |
| Pork | pig meat | 12.31 | **1.731** |
| Fish | farmed fish | 13.63 | **1.863** |
| Poultry | poultry meat | 9.87 | **1.487** |
| Vegetarian | eggs | 4.67 | **0.967** |
| Vegan | tofu | 3.16 | **0.816** |

EF_food is the global mean from Poore & Nemecek (2018), *Science* 360:987–992. It covers land-use change, farm, feed, processing, transport, packaging and retail, and excludes home cooking and household waste. The 0.5 kg allowance for sides is a stated assumption (for example rice plus vegetables), not a published figure. The spread between producers is large: the paper's 10th–90th percentile range for beef spans several-fold. A meal figure is therefore a central estimate, not a measurement.

### 3.8 Purchases (*indicative*)
Item-based figures from manufacturer product life-cycle assessments (ISO 14040/44): smartphone ≈ 70, laptop ≈ 300, T-shirt ≈ 7 and jeans ≈ 33 kg CO2e per item. There is also a spend-based fallback in kg CO2e per EUR for "other goods", the approach used by environmentally extended input-output models such as EXIOBASE. Both depend heavily on the product and must be checked before release.

### 3.9 Waste (*indicative*)
$$
E = m_{\text{waste}}\ [\text{kg}] \times EF_{\text{route}}
$$
Landfill emissions are methane from decaying organic carbon, modelled with the IPCC first-order decay method (IPCC 2006 Vol. 5). Recycling and composting factors cover collection and processing only, with no avoided-burden credit. The values are of the magnitude published in the US EPA WARM model and the UK DESNZ waste factors.

## 4. Aggregation and analytics math

### 4.1 Daily projection
`daily_emission(user, day, category)` holds Σ E_i for that user, day and category. It is kept in step inside the same database transaction as the activity change, by applying signed deltas:

| Change | Delta applied |
|---|---|
| Create | +E at (day, category) |
| Delete | −E at (day, category) |
| Update | −E_old at (day_old, category_old), then +E_new at (day_new, category_new) |

Because the deltas are exact decimals, the projection equals `SUM(activity.kg_co2e)` for every key. An automated test checks this invariant.

### 4.2 Periods
| Period | Range ending on date D |
|---|---|
| Today | [D, D] |
| Week | ISO week starting Monday: [Monday ≤ D, D] |
| Month / Year | [first day of the month or year, D] |
| Month-to-date comparison | [first of last month, same day-of-month last month, capped at that month's length] |

### 4.3 Trend buckets
For granularity DAY, WEEK (ISO, Monday start) or MONTH, every bucket between `from` and `to` is returned. Empty buckets get 0, so line charts never interpolate across missing data. Ranges are capped (DAY ≤ 366 days, otherwise ≤ 3 years) so that responses stay bounded.

### 4.4 Period comparison
For a selected range [a, b] of length L = b − a + 1 days, the previous period is [a − L, a − 1]. For each category:

$$
\begin{aligned}
\Delta\% &= \frac{\text{current} - \text{previous}}{\text{previous}} \times 100 \qquad (\text{undefined when previous} = 0) \\
\text{share}\,\% &= \frac{\text{category}_{\text{current}}}{\text{total}_{\text{current}}} \times 100
\end{aligned}
$$

### 4.5 Annualised footprint and benchmarks
$$
\begin{aligned}
\text{window} &= \big[\max(\text{first logged day},\ \text{today} - 364),\ \text{today}\big], \qquad N = \lvert\text{window}\rvert \\
T_{\text{year}}\ [\text{t}] &= \frac{\sum_{\text{window}} E_i}{N} \times \frac{365}{1000}
\end{aligned}
$$
If N < 7, no annual figure is shown, because there is too little data to extrapolate.

| Benchmark | t CO2e per person per year | Source |
|---|---|---|
| Germany average | ≈ 10.3 | UBA CO2 calculator average (consumption-based, includes public services) |
| World average | ≈ 4.7 | Global Carbon Budget 2023 (fossil CO2 per capita, territorial) |
| 1.5 °C lifestyle target 2030 | 2.5 | IGES / Aalto / D-mat (2019), *1.5-Degree Lifestyles* |

**Caveat shown in the UI:** the app covers only part of a footprint. It leaves out public infrastructure, services, and anything the user does not log. National averages also use different system boundaries. The comparison is a guide, not a like-for-like audit.

### 4.6 Monthly budget
The default budget is the 1.5 °C lifestyle target for 2030 (table above) spread evenly over the year; users can set their own.
$$
\begin{aligned}
B_{\text{default}} &= \frac{2.5\ \text{t} \times 1000}{12} \approx 208.3\ \text{kg CO}_2\text{e per month} \\
\hat{E}_{\text{month}} &= E_{\text{MTD}} \times \frac{D}{d}
\end{aligned}
$$
$E_{\text{MTD}}$ is the month-to-date total, $d$ the days elapsed (today included) and $D$ the days in the month, all in the user's time zone. Status: **over** when $E_{\text{MTD}} > B$, **at risk** when $\hat{E}_{\text{month}} > B$, otherwise **on track**.

### 4.7 Baseline questionnaire (annual estimate)
Every line uses the same factors as logged entries (country-specific where available, valid today):
$$
E_{\text{year}} = \sum_k \frac{Q_k \times EF_k}{h_k}, \qquad h_k = \begin{cases} \text{household size} & \text{home energy, waste} \\ 1 & \text{otherwise} \end{cases}
$$
with weekly answers × 52, a return flight = 2 legs of 1,000 km (short-haul) or 7,000 km (long-haul), "other meat or fish" = mean of the pork, poultry and fish meal factors, the remaining main meals (of 14 a week) as vegetarian or vegan, clothing = the T-shirt factor, and general waste = landfill. Electric and heat-pump heating are counted as electricity; district, wood and other heating are not estimated yet. The assumptions are returned with every estimate and shown in the UI.

### 4.8 What-if reductions
Suggestions are computed only from the user's own entries in a window of $N = \text{clamp}(\text{days tracked}, 7, 90)$ days:
$$
S_{\text{year}} = \frac{365}{N} \sum_{i \in \text{window, matching}} s \cdot Q_i \left(\frac{EF_i}{n_i} - \frac{EF_{\text{alt}}}{n_{\text{alt}}}\right)
$$
$s$ is the share swapped, $EF_{\text{alt}}$ the alternative's current factor, and $n$ the passenger divisor (only for shareable modes). Swaps: car → regional train ($s = 0.25$), combustion car → EV, short-haul flight → long-distance train, beef/lamb → vegetarian ($s = 0.5$), beef/lamb → poultry, landfill → recycling ($s = 0.5$); plus 10% less home energy ($S = 0.1 \times$ logged energy, annualised). Savings under 1 kg a year are hidden; the rest are sorted by size.

## 5. Uncertainty and limitations
- Factor uncertainty dominates: food and purchases ±50% or more, fuels ±5%, grid electricity ±10% (year and method).
- User-entered quantities (distance, meal type) carry their own error.
- Excluded for now: well-to-tank fuel emissions, vehicle and infrastructure manufacture, aviation class multipliers, market-based electricity (green tariffs), avoided-burden credits for recycling.
- Rounding: values are stored to the gram, and the UI shows 0.1 kg (or 3 decimals below 0.1 kg).

## 6. References
1. IPCC (2006). *2006 IPCC Guidelines for National Greenhouse Gas Inventories*. Vol. 2 *Energy*, Ch. 1, Tables 1.2 and 1.4; Vol. 5 *Waste*, Ch. 3 (first-order decay). IGES, Japan.
2. Forster, P. et al. (2021). The Earth's energy budget, climate feedbacks and climate sensitivity. In *Climate Change 2021: The Physical Science Basis*, IPCC AR6 WG1, Ch. 7, Table 7.15. Cambridge University Press.
3. World Resources Institute & WBCSD. *GHG Protocol Corporate Accounting and Reporting Standard* (rev. 2004) and *GHG Protocol Scope 2 Guidance* (2015).
4. Poore, J. & Nemecek, T. (2018). Reducing food's environmental impacts through producers and consumers. *Science* 360(6392), 987–992. doi:10.1126/science.aaq0216
5. Lee, D. S. et al. (2021). The contribution of global aviation to anthropogenic climate forcing for 2000 to 2018. *Atmospheric Environment* 244, 117834. doi:10.1016/j.atmosenv.2020.117834
6. UK Department for Energy Security and Net Zero (DESNZ). *Greenhouse gas reporting: conversion factors* (published annually; use the latest edition).
7. Umweltbundesamt. *Entwicklung der spezifischen Treibhausgas-Emissionen des deutschen Strommix* (Climate Change series, annual edition), and UBA TREMOD transport emission data.
8. Ember (2024). *Global Electricity Review 2024*.
9. Friedlingstein, P. et al. (2023). Global Carbon Budget 2023. *Earth System Science Data* 15, 5301–5369. doi:10.5194/essd-15-5301-2023
10. IGES, Aalto University & D-mat (2019). *1.5-Degree Lifestyles: Targets and Options for Reducing Lifestyle Carbon Footprints*. Technical Report.
11. US EPA. *Waste Reduction Model (WARM)*, current version documentation.
12. ISO 14040:2006 / ISO 14044:2006 (life-cycle assessment) and ISO 14067:2018 (carbon footprint of products).
