/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface-solid)',
        line: 'var(--line)',
        field: 'var(--field)',
        fill: 'var(--fill)',
        'fill-strong': 'var(--fill-strong)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        'primary-ink': 'var(--primary-ink)',
        accent: 'var(--accent)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        cat: {
          transport: 'var(--cat-transport)',
          energy: 'var(--cat-energy)',
          diet: 'var(--cat-diet)',
          shopping: 'var(--cat-shopping)',
          waste: 'var(--cat-waste)',
        },
      },
      // San Francisco on Apple devices, the closest system UI font elsewhere.
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Helvetica Neue"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { card: '22px' },
    },
  },
  plugins: [],
}
