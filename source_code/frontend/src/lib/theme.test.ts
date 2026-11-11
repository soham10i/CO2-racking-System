import { readTheme, setTheme } from './theme'

describe('theme preference', () => {
  // Node's own experimental localStorage global shadows jsdom's and does not store anything.
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => {
    setTheme('system')
    vi.unstubAllGlobals()
  })

  it('pins light or dark on the root element and remembers it', () => {
    setTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readTheme()).toBe('dark')
    setTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('system clears the attribute so the OS setting decides', () => {
    setTheme('dark')
    setTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(readTheme()).toBe('system')
  })
})
