export type RadioStation = { name: string; url: string; country: string }

const RADIO_BROWSER_BASE = 'https://de1.api.radio-browser.info/json/stations/search'

const DISCOVERY_COUNTRIES = [
  'BR', 'US', 'PT', 'ES', 'AR', 'MX', 'CO', 'CL', 'PE', 'UY', 'PY', 'GB', 'FR', 'DE', 'IT', 'NL',
  'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'TR', 'GR', 'JP', 'KR', 'CN', 'IN', 'ID', 'TH', 'PH',
  'VN', 'AU', 'NZ', 'CA', 'ZA', 'EG', 'NG', 'SA',
]

type RawStation = { name: string; url: string; url_resolved?: string; countrycode: string }

let discoveryPoolCache: RadioStation[] | null = null

async function fetchDiscoveryPool(): Promise<RadioStation[]> {
  if (discoveryPoolCache) return discoveryPoolCache
  const results = await Promise.all(
    DISCOVERY_COUNTRIES.map(async (cc) => {
      try {
        const res = await fetch(
          `${RADIO_BROWSER_BASE}?limit=20&hidebroken=true&order=clickcount&reverse=true&countrycode=${cc}`,
        )
        if (!res.ok) return []
        const rows = (await res.json()) as RawStation[]
        return rows.map((r) => ({ name: r.name, url: r.url_resolved || r.url, country: cc }))
      } catch {
        return []
      }
    }),
  )
  discoveryPoolCache = results.flat()
  return discoveryPoolCache
}

export async function fetchRandomStation(): Promise<RadioStation | null> {
  const pool = await fetchDiscoveryPool()
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export async function searchPublicStations(query: string): Promise<RadioStation[]> {
  const res = await fetch(`${RADIO_BROWSER_BASE}?limit=10&hidebroken=true&order=clickcount&reverse=true&name=${encodeURIComponent(query)}`)
  if (!res.ok) return []
  const rows = (await res.json()) as RawStation[]
  return rows.map((r) => ({ name: r.name, url: r.url_resolved || r.url, country: r.countrycode }))
}

export function isHlsStream(url: string): boolean {
  return url.toLowerCase().includes('.m3u8')
}
