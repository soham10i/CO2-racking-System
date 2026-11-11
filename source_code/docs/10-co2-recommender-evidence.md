# Evidence Base: CO2 Calculator and Daily-Schedule Recommender (Germany/EU)

> Scope: individual users, mainly in Germany and the EU. The main text uses only claims whose verification status was "confirmed" or "corrected"; corrected values replace the originals. Everything else is in Section 8. Units are given exactly as the sources state them. "Global" and "Germany" figures are labelled separately.

---

## 1. Summary of what matters most

**Largest individual levers, ordered by verified per-person potential (t CO2e/cap/yr)**

| Rank | Lever | Verified value | Region | Source |
|---|---|---|---|---|
| 1 | Living car-free | median 2.0 (range 0.6–3.6) [1]; mean 2.4 [2] | Global meta-review [1]; developed countries [2] | [1], [2] |
| 2 | Switching to a battery-electric vehicle | mean and median 2.0 (range −1.9 to 5.4) [1] | Global | [1] |
| 3 | Avoiding one long-haul return flight | median 1.7, mean 1.9 (range 0.7–4.5) [1]; 1.6 per transatlantic round trip [2] | Global / developed countries | [1], [2] |
| 4 | Vegan diet | mean 0.9 [1] | Global | [1] |
| 4 | Plant-based diet | 0.8 [2] | Developed countries | [2] |
| 5 | Avoiding one medium-haul return flight | median 0.6 [1] | Global | [1] |

Points to keep in mind:
- **The BEV saving depends on the grid.** Its range includes negative values [1]. In Germany it should be tied to the grid factor in Section 6.
- **The median for the vegan diet is reported inconsistently.** The abstract gives 0.8 and the body text gives 0.9 [1]. Use about 0.9 and note the discrepancy.
- **The car-free figure in [2] is an upper bound.** It assumes car travel is replaced by zero-emission walking or cycling.
- **The top 10 options in [1] add up to about 9.2 t/cap/yr.** The authors call this a crude estimate, so do not add savings together naively.
- **Target lines (global, not specific to Germany):**
  - about 2.8 t CO2e/cap by 2030, consistent with 1.5 °C, assuming 8.5 billion people [1];
  - 2.5 t (2030), 1.4 t (2040) and 0.7 t (2050) CO2e/cap [3].
- **Demand-side measures could cut global GHG emissions in end-use sectors by 40–70% by 2050** compared with baseline scenarios [4]. Individual choice depends on the infrastructure available locally [4].
- **Small actions are often over-promoted.** Recycling and changing light bulbs save far less than the levers above [2].

---

## 2. Daily-schedule levers

### 2a. Optimising by time of day (grid timing)

- **Annual average factor for Germany (consumption mix):**

  | Year | g CO2/kWh |
  |---|---|
  | 2022 | 433 |
  | 2023 | 386 |
  | 2024 (estimate) | 363 |

  These are direct CO2 emissions from generation, without upstream emissions [5]. Use them for footprint accounting, not for timing decisions.
- **Shifting EV charging is the strongest verified timing lever.** In an hourly marginal-emission-factor (MEF) study for Germany, moving EV charging to cleaner hours cut the marginal emission factor by about **31% on average**. This is a 5-year average for one example charging scenario [6]. Show it as a relative range, not as a precise kg figure.
- **Use two factors in the data model.** Footprint accounting uses the average factor [5]. Shift recommendations use a marginal factor or a time-resolved proxy [6]. Hourly German factors do differ from the annual average [7], but the size of that deviation is not verified (see Section 8).
- **Shiftable household appliances (washing machine, dishwasher, dryer).** No verified German per-cycle savings exist. Estimate them as kWh per cycle × the intensity difference between hours, and label the result as an estimate.

### 2b. Optimising by choice (mode, meal, setpoint)

**Mode (Germany, 2024, per passenger-km, including the energy supply chain, excluding vehicle production and infrastructure)** [8]:

| Car type | g CO2e/pkm |
|---|---|
| Average car (occupancy 1.4) | 164 |
| Petrol | 165 |
| Diesel | 175 |
| Hybrid | 111 |
| BEV | 70 |

Bus and rail values still need to be read from the same table (Section 8).

**Meal (Germany, ifeu for UBA)** [9]:
- Beef 13.6 kg CO2e/kg
- Organic beef 21.7 kg CO2e/kg
- Organic minced beef 15.1 kg CO2e/kg

The global mean for beef from beef herds is 99.48 kg CO2e/kg, and 33.3 kg CO2e/kg for beef from dairy herds [10]. These global figures use different system boundaries, so do not mix them with the German values.

**Annual diet lever:** a vegan diet saves about 0.9 t/yr [1]. Dividing by about 1,095 meals a year to get a per-meal figure is the app's own derivation, not a number from the source.

**Digital activities are a low priority.** Streaming uses about 0.077 kWh per hour and emits 36 g CO2/h at the 2019 global electricity mix [11]. At 363 g/kWh this is about 28 g/h in Germany (derived). Do not over-emphasise it.

**Rebound:** direct rebound for household heating, cooling and personal transport is generally below about 30% [12]. Discount projected savings accordingly.

---

## 3. Free grid-carbon-intensity data for Germany

**No data source passed verification in this run.** Every API claim (Energy-Charts endpoints and licence, ENTSO-E token process, Electricity Maps tiers, the UK Carbon Intensity API as a reference design) is listed in Section 8.

Recommended design until the APIs are verified:
1. **Offline fallback, verified:** the UBA annual factor of 363 g CO2/kWh (2024) [5], stored with its year and source and updated every year.
2. **Time-resolved signal, unverified:** the candidate is Fraunhofer ISE Energy-Charts (renewable-share signal). Check the endpoint, the licence and the rate limits against `https://api.energy-charts.info/openapi.json` before building against it.
3. **Cache on the server** and show the user which signal type is in use (average or marginal proxy), because the two can disagree [6], [7].

---

## 4. Behaviour-change design rules

1. **Feedback beats information alone.** Information campaigns increase knowledge but rarely change behaviour. Frequent feedback and combinations of interventions work better [13].
2. **Expect small effects and give feedback in real time.**
   - The feedback meta-analysis found r = 0.071 (range −0.08 to 0.48) across 42 studies and about 256,500 participants [14]. Real-time computerised feedback worked best and bill-style summaries worst [14].
   - r is an effect size, not a percentage saving.
   - Typical reported savings are about 5–12%, and some cases showed increased consumption [15].
3. **Pair a modest goal with tailored feedback.** Combining tailored information, a 5% goal and tailored feedback saved 5.1% in intervention households, while the control group rose 0.7%. The study covered 189 households over 5 months; long-term persistence was not shown [16].
4. **Frame social comparisons carefully.**
   - Neighbour comparisons cut electricity use by about 2.0% on average, with larger effects for heavy users [17].
   - Low users who only see the descriptive norm increase their use (a "boomerang" effect). An approving message prevents this [18].
   - Show comparisons mainly to users above the norm, and praise users below it.
   - Social-norm cues in a recommender interface changed *which* measures people chose, not *how many* [19].
5. **Repeat prompts and plan for decay.**
   - Early reports produced a pattern of action followed by backsliding.
   - After reports stopped, effects decayed about 10–20% per year.
   - Monthly reports saved 0.5 percentage points more than quarterly reports [20].
6. **Use implementation intentions.** "If X, then Y" plans have a medium-to-large effect on reaching goals (d = 0.65; 94 studies, 8,461 participants) [21]. Turn each accepted recommendation into a dated, cue-bound plan.
7. **Anchor recommendations to stable daily cues.** About 43% of daily behaviours are habitual: done almost daily, in the same context. This comes from diary studies of US students [22].
8. **Habit programmes should last about 2 months, with forgiving streaks.** The median time to automaticity was 66 days (range 18–254), and missing a single day did not harm habit formation [23].
9. **Use life-change windows.** Among recent movers, environmental concern was more strongly linked to less car commuting. This is a correlational finding, not an intervention effect [24]. Offer bigger switches (commute mode, ticket) after a move or a new job.
10. **Defaults are strong; nudges are moderate and contested.**
    - A green-tariff default in a German field experiment raised green contracts about tenfold [25]. The exact percentages are low confidence.
    - The nudging meta-analysis found d = 0.43 overall [26]. A bias-corrected re-analysis contests this [27].
    - Pre-select low-CO2 options, keep opting out easy, and A/B test.
11. **Keep gamification light and reward real reductions.** Effects are mostly positive but mixed and depend on context [28].
12. **Guard against licensing and single-action bias.**
    - Moral licensing: d = 0.31 [29].
    - Spillover onto later behaviour is about zero (d+ = −0.03), while intentions show a small positive spillover (d+ = 0.17) [30].
    - People tend to stop after taking one action [31].
    - Design responses: no "you've done your part" messages, no suggested treats, always show the remaining gap, and offer the next step right after an action is completed.
13. **Notification budget:** batching notifications about three times a day improved well-being [32]. Limit the app to 1–3 pushes a day at times the user chooses.
14. **Avoid choice overload with 1–3 active cards.** The jam study found 30% bought with 6 options vs 3% with 24 [33], but the meta-analytic mean effect is about zero, with moderators [34]. Treat the limit as a heuristic.

---

## 5. Recommender algorithm

**Features per (user u, action a, time slot t):**
- impact (kg CO2e per year, German factors from Section 6)
- plasticity (likelihood of adoption)
- effort and cost (EUR)
- context fit (time slot, today's log, grid signal)
- category preference
- adopt, dismiss and snooze history

**Score:**

$$
score(u,a,t) = w_1\,\widehat{I_a P_a} + w_2\,S(u,a) - w_3\,\widehat{C_a} + w_4\,X(a,t) + w_5\,R(u,c_a) - F(u,a)
$$

| Term | Meaning | Evidence |
|---|---|---|
| $\widehat{I_a P_a}$ | Normalised impact × plasticity. Rank by realistic, not technical, potential. | [35] (plasticity concept, US; units are MtC, multiply by 44/12 for CO2); impact priors from [1], [2], [8], [9] |
| $S(u,a)$ | Feasibility / probability of success. Proposed form: Rasch logistic $S=\frac{1}{1+e^{-(\theta_u-\delta_a)}}$ | Design choice; the Rasch-recommender sources are unverified (Section 8). Fits the ability-matching principle and the "next step" ladder [31]. |
| $\widehat{C_a}$ | Normalised effort and cost | Design choice |
| $X(a,t)$ | Context fit: pre-filter by time slot (commute, meals, evenings); boost electricity tasks in cleaner hours | Timing evidence [6]; cue anchoring [22]; prompts sent right before the cue [21] |
| $R(u,c)$ | Learned category preference: Beta(adopt+1, dismiss+ignore+1) posterior per (user, category), shrunk toward global counts, Thompson-sampled | The exploration/exploitation idea is supported by contextual-bandit evidence (12.5% click lift for LinUCB vs a context-free bandit) [36]. The Thompson-sampling source itself is unverified. |
| $F(u,a)$ | Fatigue: suppress for $N_k = N_0 \cdot 2^{k}$ days after the k-th dismissal; hide snoozed actions until the snooze ends | Decay and repetition effects [20]; notification batching [32] |

**Ranking and diversity:** apply an MMR-style penalty per category and show the top 3 [33], [34].

**Weights:** w1–w5 have no empirical source. Set them by hand, then tune them against the adoption rate.

**Cold start:**
- Begin from population priors (impact from [1], [2]; German factors from [8], [9]).
- Run a short onboarding quiz to estimate θ.
- Default the low-CO2 option where it is reasonable [25].

**Explanation template for each card:**
- kg CO2e saved, shown as a range
- effort level
- why the card is shown now (time or grid trigger)
- source and year of the factor
- optional social-proof line, which changes which measures users choose but not how many [19]

**Feedback events to store:** shown, clicked, adopted, dismissed, snoozed, completed_verified.

**Evaluation:** measure adoption and verified reduction, not clicks [14], [16].

---

## 6. Emission factor table

| Activity | Value | Unit | Source | Year | Confidence |
|---|---|---|---|---|---|
| Electricity, DE consumption mix | 363 | g CO2/kWh (direct, no upstream) | UBA [5] | 2024 (estimate) | high |
| Electricity, DE | 386 / 433 | g CO2/kWh | UBA [5] | 2023 / 2022 | high |
| Car, average, occupancy 1.4 | 164 | g CO2e/pkm | UBA TREMOD 6.71B [8] | 2024 | high |
| Car, petrol | 165 | g CO2e/pkm | UBA [8] | 2024 | medium (column alignment to confirm) |
| Car, diesel | 175 | g CO2e/pkm | UBA [8] | 2024 | high |
| Car, hybrid | 111 | g CO2e/pkm | UBA [8] | 2024 | medium |
| Car, BEV (DE grid) | 70 | g CO2e/pkm | UBA [8] | 2024 | high |
| Beef, DE average | 13.6 | kg CO2e/kg | ifeu for UBA [9] | 2020 | medium (from secondary summaries) |
| Beef, organic, DE | 21.7 (minced 15.1) | kg CO2e/kg | ifeu [9] | 2020 | medium |
| Beef from beef herds, global mean | 99.48 | kg CO2e/kg | Poore & Nemecek [10] | 2018 | medium |
| Beef from dairy herds, global mean | 33.3 | kg CO2e/kg | [10] | 2018 | medium |
| Video streaming | 0.077 kWh/h; 36 g CO2/h (global mix) | per hour | IEA, Kamiya [11] | 2020 (2019 data) | medium |
| Video streaming, DE (derived) | ≈28 | g CO2/h | 0.077 × 363 | derived | medium |

Factors for a per-vehicle-km car, adjusted to the user's own occupancy:

$$
EF_{pkm}(n) = \frac{164 \times 1.4}{n}\ \text{g CO2e/pkm}
$$

This is a derivation for the app, not a value published by UBA.

---

## 7. Calculator design notes

**Inputs**
- Transport: mode, drive type, distance, occupancy; flights by route class.
- Diet: pattern or meals.
- Household: electricity kWh or appliance use; heating setpoint (once the factors are verified).
- Digital: streaming hours.

**Outputs**
- Annual t CO2e by category.
- Comparison against the targets: 2.5 t (2030) [3] or 2.8 t (2030) [1].
- Top three levers, from Section 5.

**Uncertainty**
- Show ranges from [1] (for example car-free 0.6–3.6 t).
- Flag factors that depend on the grid (BEV can be negative [1]).
- Label every factor with its scope: direct only (electricity [5]) or including the energy chain (transport [8]).
- Never mix the German [9] and global [10] food factors in one total.
- Apply a rebound discount (direct rebound ≲30% [12]) to projected savings.
- Show the source and year of every factor. Version the factor set and refresh it each year (check for a UBA value for 2025).

---

## 8. Needs verification

**Electricity and timing**
- UBA 353 g/kWh (2024) and 379 g/kWh (2023) revised series. The page checked gives 363 and 386 instead.
- Preliminary 344 g/kWh for 2025.
- Kono, Ostermeyer, Wallbaum 2017 (DOI 10.1007/s11367-017-1277-z): the paper is confirmed, but the deviation of +22% to −34% from the annual average is not.
- Huber et al. (KIT): smart charging saves 1–10%, and peak hours have the lowest MEF. The year is uncertain.
- Massiani & Weinmann 2012: coordinated charging cuts emissions by less than 4%.
- Seckinger & Radgen 2021: dynamic AEF/MEF for Germany to 2050.
- Imperial College: +313% difference between MEF and AEF (India).

**Grid data APIs and other online sources**
- Energy-Charts API: endpoints (/signal, /v2/signal, /public_power …), traffic-light coding, whether a g/kWh endpoint exists, CC BY 4.0 licence, rate limits.
- ENTSO-E: free API, token requested by email to transparency@entsoe.eu.
- Electricity Maps: 14-day trial only, 130+ zones.
- UK Carbon Intensity API design: no auth, CC BY 4.0, 30-minute periods, 48-hour forecast.
- Klinge Jacobsen & Juul 2015 Danish hourly profiles.
- Climate Analytics page for Germany: 378 Mt CO2e (the URL returned 404). Also the KSG target of −65% by 2030.

**1.5-Degree Lifestyles**
- Exact 2.5–3.2 / 0.7–1.4 range bounds and the claim of about 30 options from the 2019 IGES/Aalto/D-mat report.

**Recommender sources**
- Starke, Willemsen, Snijders RecSys 2017: Rasch matching, 209 participants.
- Starke thesis: 79-item Rasch scale.
- Himeur et al. 2021 survey.
- Adomavicius & Tuzhilin 2011 context-aware recommender taxonomy and DOI.
- Chapelle & Li 2011 Thompson sampling.
- Tintarev & Masthoff 2007 seven explanation aims.
- Fogg 2009 behaviour model.
- Kaptein et al. 2012 adaptive persuasion and habituation.
- Ivanova 2020 "car-free mean 2.0" as worded in the recsys packet. The median of 2.0 is confirmed.

**Behaviour claims to check against full text**
- Allcott & Rogers 35–55% decay between reports.
- Exact uptake percentages in Ebeling & Lotz (about 69% vs about 7%).
- Per-action plasticity values in Dietz 2009 Table 1, for example weatherisation about 90%.

**Emission factors**
- UBA 2024 values for bus, tram/U-Bahn, regional and long-distance rail, and domestic flights.
- DB CO2Kompass values.
- Emission weighting factor of 1.5 for domestic-flight non-CO2 effects.
- 238 g/pkm for domestic flights (Statista).
- ifeu values for cheese (5.7 kg CO2e/kg), milk and oat milk.
- Washing-machine kWh per cycle at different temperatures.
- 6% heating saving per °C and the UBA room-temperature recommendations.
- Natural-gas factor per kWh.
- Dryer, dishwasher, shower, kettle and standby factors.

---

## 9. References

1. Ivanova D., Barrett J., Wiedenhofer D., Macura B., Callaghan M., Creutzig F. "Quantifying the potential for climate change mitigation of consumption options." *Environ. Res. Lett.* 15:093001, 2020. https://doi.org/10.1088/1748-9326/ab8589
2. Wynes S., Nicholas K.A. "The climate mitigation gap: education and government recommendations miss the most effective individual actions." *Environ. Res. Lett.* 12:074024, 2017. https://doi.org/10.1088/1748-9326/aa7541
3. Hot or Cool Institute. "1.5-Degree Lifestyles: Towards a Fair Consumption Space for All." 2021. https://hotorcool.org/1-5-degree-lifestyles/
4. IPCC AR6 WGIII. *Climate Change 2022: Mitigation of Climate Change*, Ch. 5 and SPM C.10. 2022. https://www.ipcc.ch/report/ar6/wg3/chapter/chapter-5/
5. Umweltbundesamt. "CO2-Emissionen pro Kilowattstunde Strom 2024." 2025. https://www.umweltbundesamt.de/themen/co2-emissionen-pro-kilowattstunde-strom-2024
6. Ben Amor, Sgarciu, Batz-Lineiro, Müsgens. "Hourly marginal emission factors for Germany." arXiv:2412.17379, 2024. https://arxiv.org/abs/2412.17379
7. Kono J., Ostermeyer Y., Wallbaum H. "The trends of hourly carbon emission factors in Germany and investigation on relevant consumption patterns for its application." *Int J LCA*, 2017. https://doi.org/10.1007/s11367-017-1277-z
8. Umweltbundesamt. "Vergleich der durchschnittlichen Emissionen einzelner Verkehrsmittel im Personenverkehr in Deutschland – Bezugsjahr 2024" (TREMOD 6.71B). 2025. https://www.umweltbundesamt.de/sites/default/files/medien/366/bilder/dateien/vtv_2024_pv_tab_pdf.pdf
9. Reinhardt G., Gärtner S., Wagner T. (ifeu) for UBA. "Ökologische Fußabdrücke von Lebensmitteln und Gerichten in Deutschland." 2020. https://umweltbundesamt.de/sites/default/files/medien/6232/dokumente/ifeu_2020_oekologische-fussabdruecke-von-lebensmitteln.pdf
10. Poore J., Nemecek T. "Reducing food's environmental impacts through producers and consumers." *Science* 360:987–992, 2018. https://doi.org/10.1126/science.aaq0216
11. Kamiya G. (IEA). "The carbon footprint of streaming video: fact-checking the headlines." 2020. https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines ; Carbon Brief factcheck: https://www.carbonbrief.org/factcheck-what-is-the-carbon-footprint-of-streaming-video-on-netflix
12. Sorrell S. / UKERC. "The Rebound Effect: an assessment of the evidence for economy-wide energy savings from improved energy efficiency." 2007. https://ukerc.ac.uk/publications/the-rebound-effect-an-assessment-of-the-evidence-for-economy-wide-energy-savings-from-improved-energy-efficiency/
13. Abrahamse W., Steg L., Vlek C., Rothengatter T. "A review of intervention studies aimed at household energy conservation." *J. Environ. Psychol.* 25, 2005. https://doi.org/10.1016/j.jenvp.2005.08.002
14. Karlin B., Zinger J.F., Ford R. "The effects of feedback on energy conservation: A meta-analysis." *Psychol. Bull.* 141(6):1205–1227, 2015. https://doi.org/10.1037/a0039650
15. Fischer C. "Feedback on household electricity consumption: a tool for saving energy?" *Energy Efficiency* 1:79–104, 2008. https://doi.org/10.1007/s12053-008-9009-7
16. Abrahamse W., Steg L., Vlek C., Rothengatter T. "The effect of tailored information, goal setting, and tailored feedback on household energy use…" *J. Environ. Psychol.* 27(4):265–276, 2007. https://doi.org/10.1016/j.jenvp.2007.04.004
17. Allcott H. "Social norms and energy conservation." *J. Public Econ.* 95, 2011. https://doi.org/10.1016/j.jpubeco.2011.03.003
18. Schultz P.W., Nolan J., Cialdini R., Goldstein N., Griskevicius V. "The constructive, destructive, and reconstructive power of social norms." *Psychol. Sci.* 18(5), 2007. https://doi.org/10.1111/j.1467-9280.2007.01917.x
19. Starke A., Willemsen M., Snijders C. "Promoting Energy-Efficient Behavior by Depicting Social Norms in a Recommender Interface." *ACM TiiS* 11(3–4), Art. 30, 2021. https://doi.org/10.1145/3460005
20. Allcott H., Rogers T. "The Short-Run and Long-Run Effects of Behavioral Interventions: Experimental Evidence from Energy Conservation." *AER* 104(10):3003–37, 2014. https://doi.org/10.1257/aer.104.10.3003
21. Gollwitzer P.M., Sheeran P. "Implementation intentions and goal achievement: A meta-analysis of effects and processes." *Adv. Exp. Soc. Psychol.* 38:69–119, 2006. https://doi.org/10.1016/S0065-2601(06)38002-1
22. Wood W., Quinn J., Kashy D. "Habits in everyday life: Thought, emotion, and action." *JPSP* 83(6), 2002. https://doi.org/10.1037/0022-3514.83.6.1281 ; Wood W., Neal D. *Psychol. Rev.* 114(4), 2007. https://doi.org/10.1037/0033-295X.114.4.843
23. Lally P., van Jaarsveld C., Potts H., Wardle J. "How are habits formed: Modelling habit formation in the real world." *Eur. J. Soc. Psychol.* 40(6):998–1009, 2010. https://doi.org/10.1002/ejsp.674
24. Verplanken B., Walker I., Davis A., Jurasek M. "Context change and travel mode choice…" *J. Environ. Psychol.* 28(2):121–127, 2008. https://doi.org/10.1016/j.jenvp.2007.10.005
25. Ebeling F., Lotz S. "Domestic uptake of green energy promoted by opt-out tariffs." *Nature Climate Change* 5:868–871, 2015. https://doi.org/10.1038/nclimate2681
26. Mertens S., Herberz M., Hahnel U., Brosch T. "The effectiveness of nudging: A meta-analysis of choice architecture interventions across behavioral domains." *PNAS* 119(1):e2107346118, 2022. https://doi.org/10.1073/pnas.2107346118
27. Maier M. et al. "No evidence for nudging after adjusting for publication bias." *PNAS* 119(31):e2200300119, 2022.
28. Hamari J., Koivisto J., Sarsa H. "Does Gamification Work? A Literature Review of Empirical Studies on Gamification." HICSS 2014. https://doi.org/10.1109/HICSS.2014.377
29. Blanken I., van de Ven N., Zeelenberg M. "A meta-analytic review of moral licensing." *PSPB* 41(4):540–558, 2015. https://doi.org/10.1177/0146167215572134
30. Maki A., Carrico A., Raimi K., Truelove H., Araujo B., Yeung K.L. "Meta-analysis of pro-environmental behaviour spillover." *Nature Sustainability* 2:307–315, 2019. https://doi.org/10.1038/s41893-019-0263-9
31. Weber E.U. "Experience-based and description-based perceptions of long-term risk: why global warming does not scare us (yet)." *Climatic Change* 77:103–120, 2006. https://doi.org/10.1007/s10584-006-9060-3
32. Fitz N., Kushlev K., Jagannathan R., Lewis T., Paliwal D., Ariely D. "Batching smartphone notifications can improve well-being." *Computers in Human Behavior* 101:84–94, 2019. https://doi.org/10.1016/j.chb.2019.07.016
33. Iyengar S., Lepper M. "When choice is demotivating." *JPSP* 79(6), 2000. https://doi.org/10.1037/0022-3514.79.6.995
34. Chernev A., Böckenholt U., Goodman J. "Choice overload: A conceptual review and meta-analysis." *J. Consumer Psychol.* 25(2), 2015. https://doi.org/10.1016/j.jcps.2014.08.002
35. Dietz T., Gardner G., Gilligan J., Stern P., Vandenbergh M. "Household actions can provide a behavioral wedge to rapidly reduce US carbon emissions." *PNAS* 106(44):18452–18456, 2009. https://doi.org/10.1073/pnas.0908738106
36. Li L., Chu W., Langford J., Schapire R. "A Contextual-Bandit Approach to Personalized News Article Recommendation." WWW 2010. https://doi.org/10.1145/1772690.1772758