/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Token colours go through color-mix so Tailwind opacity modifiers (bg-danger/10, ring-brand/40) work.
  theme: {
    extend: {
      colors: {
        bg: 'color-mix(in srgb, var(--bg) calc(<alpha-value> * 100%), transparent)',
        surface: 'color-mix(in srgb, var(--surface-solid) calc(<alpha-value> * 100%), transparent)',
        line: 'color-mix(in srgb, var(--line) calc(<alpha-value> * 100%), transparent)',
        field: 'color-mix(in srgb, var(--field) calc(<alpha-value> * 100%), transparent)',
        fill: 'color-mix(in srgb, var(--fill) calc(<alpha-value> * 100%), transparent)',
        'fill-strong': 'color-mix(in srgb, var(--fill-strong) calc(<alpha-value> * 100%), transparent)',
        ink: 'color-mix(in srgb, var(--ink) calc(<alpha-value> * 100%), transparent)',
        muted: 'color-mix(in srgb, var(--muted) calc(<alpha-value> * 100%), transparent)',
        primary: 'color-mix(in srgb, var(--primary) calc(<alpha-value> * 100%), transparent)',
        brand: 'color-mix(in srgb, var(--brand) calc(<alpha-value> * 100%), transparent)',
        'brand-ink': 'color-mix(in srgb, var(--brand-ink) calc(<alpha-value> * 100%), transparent)',
        raised: 'color-mix(in srgb, var(--surface-raised) calc(<alpha-value> * 100%), transparent)',
        'primary-ink': 'color-mix(in srgb, var(--primary-ink) calc(<alpha-value> * 100%), transparent)',
        accent: 'color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)',
        warn: 'color-mix(in srgb, var(--warn) calc(<alpha-value> * 100%), transparent)',
        danger: 'color-mix(in srgb, var(--danger) calc(<alpha-value> * 100%), transparent)',
        'danger-ink': 'color-mix(in srgb, var(--danger-ink) calc(<alpha-value> * 100%), transparent)',
        cat: {
          transport: 'color-mix(in srgb, var(--cat-transport) calc(<alpha-value> * 100%), transparent)',
          energy: 'color-mix(in srgb, var(--cat-energy) calc(<alpha-value> * 100%), transparent)',
          diet: 'color-mix(in srgb, var(--cat-diet) calc(<alpha-value> * 100%), transparent)',
          shopping: 'color-mix(in srgb, var(--cat-shopping) calc(<alpha-value> * 100%), transparent)',
          waste: 'color-mix(in srgb, var(--cat-waste) calc(<alpha-value> * 100%), transparent)',
        },
      },
      // Self-hosted (no third-party font requests): Inter for text, Space Grotesk for headings and figures.
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '24px' },
    },
  },
  plugins: [],
}
