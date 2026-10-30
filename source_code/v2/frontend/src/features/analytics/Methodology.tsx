import { useFactors } from '../activities/hooks'
import { errorMessage } from '../../app/queryClient'
import { Tex } from '../../components/Tex'
import { Card, ErrorBanner, Spinner } from '../../components/ui'
import { categories, categoryLabel, unitLabel } from '../../lib/format'

// The in-app summary of docs/05-emission-methodology.md. Factor values are never hard-coded here:
// the table is read from the API, so it always shows exactly what the calculator uses.

const references: { text: string; href?: string }[] = [
  { text: 'IPCC (2006). 2006 IPCC Guidelines for National Greenhouse Gas Inventories, Vol. 2 Energy (Tables 1.2, 1.4) and Vol. 5 Waste.' },
  { text: 'Forster, P. et al. (2021). The Earth’s energy budget, climate feedbacks and climate sensitivity. IPCC AR6 WG1, Ch. 7, Table 7.15.' },
  { text: 'WRI & WBCSD. GHG Protocol Corporate Standard (2004) and Scope 2 Guidance (2015).' },
  { text: 'Poore, J. & Nemecek, T. (2018). Reducing food’s environmental impacts through producers and consumers. Science 360, 987–992.', href: 'https://doi.org/10.1126/science.aaq0216' },
  { text: 'Lee, D. S. et al. (2021). The contribution of global aviation to anthropogenic climate forcing for 2000 to 2018. Atmospheric Environment 244, 117834.', href: 'https://doi.org/10.1016/j.atmosenv.2020.117834' },
  { text: 'UK DESNZ. Greenhouse gas reporting: conversion factors (annual).' },
  { text: 'Umweltbundesamt. CO2 emission factors of the German electricity mix (annual) and TREMOD transport data.' },
  { text: 'Ember (2024). Global Electricity Review 2024.' },
  { text: 'Friedlingstein, P. et al. (2023). Global Carbon Budget 2023. Earth System Science Data 15, 5301–5369.', href: 'https://doi.org/10.5194/essd-15-5301-2023' },
  { text: 'IGES, Aalto University & D-mat (2019). 1.5-Degree Lifestyles: Targets and Options for Reducing Lifestyle Carbon Footprints.' },
  { text: 'US EPA. Waste Reduction Model (WARM) documentation.' },
  { text: 'ISO 14040/14044:2006 (life-cycle assessment) and ISO 14067:2018 (carbon footprint of products).' },
]

const tex = String.raw

export default function Methodology() {
  const factors = useFactors()

  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">How emissions are calculated</h1>
        <p className="text-muted">
          Every figure follows the GHG Protocol activity-data × emission-factor method used in national inventories (IPCC
          Tier 1), expressed in kg CO2-equivalent with IPCC AR6 100-year global warming potentials.
        </p>
      </header>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">1. The formula</h2>
        <Tex display tex={tex`E\ [\text{kg CO}_2\text{e}] = \frac{Q \times EF}{n}`} />
        <ul className="space-y-1 text-sm">
          <li><Tex tex="Q" /> — quantity you log (km, kWh, litres, meals, items, €, kg)</li>
          <li><Tex tex="EF" /> — emission factor, kg CO2e per unit</li>
          <li><Tex tex="n" /> — people sharing the trip (car journeys only, otherwise 1)</li>
        </ul>
        <p className="text-sm">Gases are combined with 100-year global warming potentials (AR6 WG1 Table 7.15):</p>
        <Tex display tex={tex`\text{CO}_2\text{e} = \sum_g m_g \times \mathrm{GWP}_{100,g}`} />
        <p className="text-sm">
          with <Tex tex={tex`\mathrm{GWP}_{\text{CO}_2} = 1`} />, fossil <Tex tex={tex`\mathrm{GWP}_{\text{CH}_4} = 29.8`} />,
          non-fossil <Tex tex={tex`\mathrm{GWP}_{\text{CH}_4} = 27.0`} /> and <Tex tex={tex`\mathrm{GWP}_{\text{N}_2\text{O}} = 273`} />.
          Results are computed with exact decimals on the server and rounded half-to-even to 3 decimals (grams).
        </p>
        <h3 className="font-semibold">Which factor is used</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            The factor valid on the activity’s date (<Tex tex={tex`\text{validFrom} \le d < \text{validTo}`} />), so old
            entries keep their historic factor.
          </li>
          <li>A factor for your country (from your profile) beats the global default — e.g. German grid electricity.</li>
          <li>The chosen factor’s id is stored with the entry, so later factor updates never silently rewrite your history.</li>
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">2. Worked examples</h2>
        <p className="text-sm font-medium">Petrol car, 12 km, shared by 2 people</p>
        <Tex
          display
          tex={tex`\begin{aligned}
EF_{\text{litre}} &= 0.745\,\tfrac{\text{kg}}{\text{L}} \times 44.3\,\tfrac{\text{MJ}}{\text{kg}} \times 69.3\,\tfrac{\text{g CO}_2}{\text{MJ}} \approx 2.287\ \tfrac{\text{kg CO}_2}{\text{L}} \\
EF_{\text{km}} &= 2.287 \times \tfrac{7.4\ \text{L}}{100\ \text{km}} \approx 0.169\ \tfrac{\text{kg CO}_2\text{e}}{\text{km}} \\
E &= \frac{12\ \text{km} \times 0.169}{2} = 1.014\ \text{kg CO}_2\text{e}
\end{aligned}`}
        />
        <p className="text-xs text-muted">Density, net calorific value and carbon factor are IPCC 2006 defaults.</p>
        <p className="text-sm font-medium">Beef meal</p>
        <Tex
          display
          tex={tex`\begin{aligned}
EF_{\text{meal}} &= 0.1\ \text{kg} \times 99.48\ \tfrac{\text{kg CO}_2\text{e}}{\text{kg}} + 0.5\ \text{kg CO}_2\text{e} \approx 10.448 \\
E &= 1\ \text{meal} \times 10.448 = 10.448\ \text{kg CO}_2\text{e}
\end{aligned}`}
        />
        <p className="text-xs text-muted">
          99.48 is the beef-herd mean from Poore &amp; Nemecek (2018); 0.5 kg CO2e is an allowance for the sides.
        </p>
        <p className="text-sm font-medium">Annualised footprint and change (Insights)</p>
        <Tex
          display
          tex={tex`\begin{aligned}
T_{\text{year}}\ [\text{t CO}_2\text{e}] &= \frac{K_N}{N} \times \frac{365}{1000}, \qquad 7 \le N \le 365 \\
\Delta\% &= \frac{C - P}{P} \times 100
\end{aligned}`}
        />
        <p className="text-xs text-muted">
          <Tex tex="K_N" /> is the kg logged in the last <Tex tex="N" /> days, where <Tex tex="N" /> counts days since your
          first entry. <Tex tex="C" /> and <Tex tex="P" /> are the current and previous period; the change shows as “new”
          when <Tex tex="P = 0" />.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">3. Factors currently in use</h2>
        <p className="text-sm text-muted">
          Read live from the calculator. Values marked “indicative” are averages with wide real-world spread (product
          footprints and waste can vary by a factor of 2–5); see the methodology document for every derivation.
        </p>
        {factors.isPending && <Spinner />}
        <ErrorBanner message={factors.isError ? errorMessage(factors.error, 'Could not load factors') : null} />
        {factors.data &&
          categories.map((c) => {
            const rows = factors.data.filter((f) => f.category === c)
            if (rows.length === 0) return null
            return (
              <div key={c} className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="py-2 text-left font-semibold">{categoryLabel[c]}</caption>
                  <thead className="border-b border-line text-muted">
                    <tr>
                      <th scope="col" className="p-2 font-medium">Activity</th>
                      <th scope="col" className="p-2 text-right font-medium">kg CO2e / unit</th>
                      <th scope="col" className="p-2 font-medium">Region</th>
                      <th scope="col" className="p-2 font-medium">Source and method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.id} className="border-b border-line align-top last:border-0">
                        <th scope="row" className="p-2 font-normal">{f.label}</th>
                        <td className="whitespace-nowrap p-2 text-right tabular-nums">
                          {f.kgCo2ePerUnit} / {unitLabel(f.unit).replace(/s$/, '')}
                        </td>
                        <td className="p-2">{f.region ?? 'Global'}</td>
                        <td className="p-2">
                          {f.sourceUrl ? (
                            <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                              {f.sourceName}
                            </a>
                          ) : (
                            f.sourceName
                          )}
                          <span className="text-muted"> · v{f.version}, from {f.validFrom}</span>
                          {f.methodNote && <span className="block text-xs text-muted">{f.methodNote}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">4. Limits</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Electricity is location-based (grid average); a green tariff does not lower it under this method.</li>
          <li>Flights include CO2 only; non-CO2 effects (contrails, NOx) roughly double to triple the warming (Lee et al. 2021).</li>
          <li>Car factors are tank-to-wheel; fuel production adds about 15–25%.</li>
          <li>You only see what you log, so totals are a lower bound of your full footprint.</li>
        </ul>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">References</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {references.map((r) => (
            <li key={r.text}>
              {r.text}{' '}
              {r.href && (
                <a href={r.href} target="_blank" rel="noreferrer" className="text-accent underline">
                  {r.href.replace('https://', '')}
                </a>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </article>
  )
}
