// Applies saved appearance choices before first paint. Loaded as an external file because the CSP forbids
// inline scripts. Keys match src/lib/theme.ts and src/lib/appearance.ts.
try {
  var root = document.documentElement
  var t = localStorage.getItem('co2.theme')
  if (t === 'light' || t === 'dark') root.dataset.theme = t
  var a = localStorage.getItem('co2.accent')
  if (a === 'indigo' || a === 'teal' || a === 'pink') root.dataset.accent = a
  if (localStorage.getItem('co2.solid') === '1') root.dataset.transparency = 'reduced'
} catch (e) {}
