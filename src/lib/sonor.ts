export type RadioStation = { name: string; url: string; country: string }

const RADIO_BROWSER_BASE = 'https://de1.api.radio-browser.info/json/stations/search'

const DISCOVERY_COUNTRIES = [
  'BR', 'US', 'PT', 'ES', 'AR', 'MX', 'CO', 'CL', 'PE', 'UY', 'PY', 'GB', 'FR', 'DE', 'IT', 'NL',
  'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'TR', 'GR', 'JP', 'KR', 'CN', 'IN', 'ID', 'TH', 'PH',
  'VN', 'AU', 'NZ', 'CA', 'ZA', 'EG', 'NG', 'SA',
]

type RawStation = { name: string; url: string; url_resolved?: string; countrycode: string }

let discoveryPoolCache: RadioStation[] | null = null

function isSecureStream(url: string): boolean {
  // ThothChat roda em https:// — stream http:// e bloqueado pelo navegador (mixed content),
  // mesmo que a radio funcione normal em outros apps que nao tem essa restricao.
  return url.toLowerCase().startsWith('https://')
}

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
        return rows
          .map((r) => ({ name: r.name, url: r.url_resolved || r.url, country: cc }))
          .filter((r) => isSecureStream(r.url))
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
  return rows
    .map((r) => ({ name: r.name, url: r.url_resolved || r.url, country: r.countrycode }))
    .filter((r) => isSecureStream(r.url))
}

export function isHlsStream(url: string): boolean {
  return url.toLowerCase().includes('.m3u8')
}

const SONOR_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0ZHlkbWZ4cXhzdWpycWR0cmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMjI4MjMsImV4cCI6MjEwMjU5ODgyM30.16DYgh8unDuQXsxyj071uq2gKWeH-47QQ-Nq8UY0hdw'

export async function fetchNowPlaying(streamUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://xtdydmfxqxsujrqdtrkn.supabase.co/functions/v1/radio-nowplaying?url=${encodeURIComponent(streamUrl)}`,
      { headers: { Authorization: `Bearer ${SONOR_ANON_KEY}` } },
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.title || null
  } catch {
    return null
  }
}

export function shortRadioName(name: string): string {
  const stopIdx = name.search(/[¡!\-|:·,]/)
  let base = stopIdx > 1 ? name.slice(0, stopIdx).trim() : name.trim()
  const words = base.split(/\s+/)
  if (words.length > 2) base = words.slice(0, 2).join(' ')
  if (base.length > 14) base = `${base.slice(0, 14).trim()}…`
  return base || name.slice(0, 14)
}
