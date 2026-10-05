/**
 * components/dashboard/add-node-dialog.tsx
 *
 * ----------------------------------------------------------------------
 *  PURPOSE
 * ----------------------------------------------------------------------
 *
 * The **AddNodeDialog** component is the modal that lets users create a new
 * monitoring node on the map.  It collects the node name, location, and
 * monitoring radius, shows a live simulated reading preview and gives the
 * user a chance to toggle "map‑selection mode" (click‑to‑place the point).
 *
 * ----------------------------------------------------------------------
 *  DESIGN
 * ----------------------------------------------------------------------
 * The UI follows a **modern glass‑morphism** style – a translucent dark
 * background with a subtle backdrop‑blur, white‑border outlines and soft
 * shadows.  All colours, spacing and hover states are expressed with
 * Tailwind‑CSS utility classes so the component works out‑of‑the‑box in a
 * Next 13+ (App Router) code‑base.
 *
 * ----------------------------------------------------------------------
 *  PUBLIC API (unchanged)
 * ----------------------------------------------------------------------
 *  - isOpen: boolean – show / hide the modal.
 *  - selectedLocation: { lat, lng } | null – the point chosen on the map.
 *  - onClose: () => void – close the dialog.
 *  - onSubmit: (nodeName, lat, lng, radiusKm) => void – called when the user
 *    confirms the creation.
 *  - isMapSelectionMode: boolean – true when the map is in "click‑to‑select"
 *    mode.
 *  - onToggleMapMode: () => void – toggle the above flag.
 *  - nodes?: NodeData[] – optional list of existing nodes (used only for the
 *    right‑hand preview).
 *  - onNodeSelect?: (node: NodeData) => void – called when a node in the
 *    preview panel is clicked.
 *
 * ----------------------------------------------------------------------
 *  NOTE
 * ----------------------------------------------------------------------
 * The component does **not** import any heavy libraries (Leaflet, etc.) at the
 * top‑level – all heavy work is delegated to the map component, which now
 * lazy‑loads Leaflet to avoid the "window is not defined" error during SSR.
 *
 * ----------------------------------------------------------------------
 *  FIX LOG (this pass)
 * ----------------------------------------------------------------------
 * Bug: "pointing on the map is not working, the visualization of the
 * pointer and perimeter is not visible."
 *
 * Root cause: as soon as `selectedLocation` changed (i.e. the instant the
 * user clicked a point on the map), an effect immediately called
 * `onToggleMapMode()` to flip `isMapSelectionMode` back to `false`. But
 * the full-screen `Backdrop` is only suppressed *while*
 * `isMapSelectionMode` is `true`:
 *
 *   const Backdrop = !isMapSelectionMode ? <full-screen blurred div> : null
 *
 * So the moment a location was picked, the blurred backdrop slammed down
 * over the live map (and the dialog re-centered on top of it), hiding the
 * marker/perimeter that had just been placed. The user only ever saw the
 * dialog's own fake "Node Perimeter" preview circle, never the real map.
 *
 * Fix: stop auto-exiting map-selection mode on selection. The user now
 * stays in map mode (map fully visible, dialog docked to the corner) so
 * they can see the pin/perimeter update live and adjust the radius while
 * watching it. Map mode now only turns off when the user clicks the
 * toggle themselves, or automatically on successful submit.
 */

// higlight node form world air quality index with live telemtry
// implement live api calls for telemitry and AQI data and display in the dashboard with a history panel for each node. The history panel should show daily ratings, average AQI, peak AQI, and total readings for each day. The user should be able to click on a day to expand and see more details.
// higlight the nodes from Worl air Quailty Index Implement api for world air quality index and display the data in a dashboard with a history panel for each node. The history panel should show daily ratings, average AQI, peak AQI, and total readings for each day. The user should be able to click on a day to expand and see more details.


'use client'

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import {
  MapPin,
  AlertCircle,
  X,
  Target,
  ChevronUp,
  ChevronDown,
  Activity,
  CalendarDays,
  Clock3,
  TrendingUp,
  Gauge,
  Wind,
  Thermometer,
  Droplets,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/* ----------------------------------------------------------------------
   Types (unchanged – kept for type‑safety)
----------------------------------------------------------------------- */
interface PollutionReadings {
  industrialEmissions: number
  vehicleSoot: number
  biomassBurning: number
  overallRating: 'Good' | 'Moderate' | 'Poor' | 'Hazardous'
  timestamp: Date
  pm25?: number
  pm10?: number
  no2?: number
  so2?: number
  o3?: number
  temperature?: number
  humidity?: number
  windSpeed?: number
}
interface NodeData {
  id: string
  name: string
  lat: number
  lng: number
  radiusKm: number
  readings: PollutionReadings | null
  isActive: boolean
  /** UI‑only flag – indicates visual selection */
  isSelected?: boolean
}
interface AddNodeDialogProps {
  isOpen: boolean
  selectedLocation: { lat: number; lng: number } | null
  onClose: () => void
  /** (nodeName, latitude, longitude, radiusKm) */
  onSubmit: (nodeName: string, lat: number, lng: number, radiusKm: number) => void
  isMapSelectionMode: boolean
  onToggleMapMode: () => void
  /** Optional pre‑existing nodes – used only for the right‑hand preview */
  nodes?: NodeData[]
  /** Called when a node from the preview list is clicked */
  onNodeSelect?: (node: NodeData) => void
  /** Optional live preview hook for drawing the node perimeter on the map */
  onPreviewChange?: (
    preview:
      | {
          lat: number
          lng: number
          radiusKm: number
          name: string
        }
      | null
  ) => void
}

/* ----------------------------------------------------------------------
   Helper – generate a realistic fake reading (unchanged)
----------------------------------------------------------------------- */
const generatePollutionData = (): PollutionReadings => {
  const industrial = Math.floor(Math.random() * 100)
  const vehicle = Math.floor(Math.random() * 100)
  const biomass = Math.floor(Math.random() * 100)

  const weighted = industrial * 0.4 + vehicle * 0.35 + biomass * 0.25
  const overallRating =
    weighted < 25
      ? 'Good'
      : weighted < 50
      ? 'Moderate'
      : weighted < 75
      ? 'Poor'
      : 'Hazardous'

  return {
    industrialEmissions: industrial,
    vehicleSoot: vehicle,
    biomassBurning: biomass,
    overallRating,
    timestamp: new Date(),
    pm25: Math.floor(Math.random() * 100),
    pm10: Math.floor(Math.random() * 150),
    no2: Math.floor(Math.random() * 80),
    so2: Math.floor(Math.random() * 60),
    o3: Math.floor(Math.random() * 120),
    temperature: Math.floor(Math.random() * 35) + 15,
    humidity: Math.floor(Math.random() * 60) + 30,
    windSpeed: Math.floor(Math.random() * 30) + 5,
  }
}


/* ----------------------------------------------------------------------
   WAQI telemetry helpers + NodeReadingsDashboard
----------------------------------------------------------------------- */

type AQIRating =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous'

interface WaqiIaqiEntry {
  v?: number
}

interface WaqiFeedData {
  aqi?: number
  dominentpol?: string
  city?: {
    name?: string
    url?: string
    geo?: [number | string, number | string]
  }
  time?: {
    s?: string
    tz?: string
  }
  iaqi?: Record<string, WaqiIaqiEntry | undefined>
}

interface WaqiApiResponse {
  status: 'ok' | 'error'
  data?: WaqiFeedData
  message?: string
}

interface WaqiTelemetrySample {
  id: string
  timestamp: string
  aqi: number
  rating: AQIRating
  stationName: string
  cityName: string
  dominantPollutant?: string
  lat: number
  lng: number
  iaqi: Record<string, number>
  source: 'waqi' | 'fallback'
}

interface WaqiDaySummary {
  dayKey: string
  label: string
  date: Date
  rating: AQIRating
  avgAqi: number
  peakAqi: number
  totalReadings: number
  samples: WaqiTelemetrySample[]
}

const WAQI_TOKEN = process.env.NEXT_PUBLIC_WAQI_TOKEN || 'demo'
const WAQI_HISTORY_DAYS = 30
const WAQI_POLL_INTERVAL_MS = 5 * 60 * 1000

const ratingBands: Array<{
  max: number
  label: AQIRating
  badge: string
  border: string
  soft: string
  text: string
}> = [
  { max: 50, label: 'Good', badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30', border: 'border-emerald-400/35', soft: 'bg-emerald-500/10', text: 'text-emerald-300' },
  { max: 100, label: 'Moderate', badge: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30', border: 'border-yellow-400/35', soft: 'bg-yellow-500/10', text: 'text-yellow-300' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', badge: 'bg-orange-500/20 text-orange-200 border-orange-400/30', border: 'border-orange-400/35', soft: 'bg-orange-500/10', text: 'text-orange-300' },
  { max: 200, label: 'Unhealthy', badge: 'bg-red-500/20 text-red-200 border-red-400/30', border: 'border-red-400/35', soft: 'bg-red-500/10', text: 'text-red-300' },
  { max: 300, label: 'Very Unhealthy', badge: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30', border: 'border-fuchsia-400/35', soft: 'bg-fuchsia-500/10', text: 'text-fuchsia-300' },
  { max: Number.POSITIVE_INFINITY, label: 'Hazardous', badge: 'bg-rose-600/20 text-rose-100 border-rose-400/30', border: 'border-rose-400/35', soft: 'bg-rose-600/10', text: 'text-rose-200' },
]

function getAqiBand(aqi: number) {
  return ratingBands.find(b => aqi <= b.max) ?? ratingBands[ratingBands.length - 1]
}

function formatDayKey(date: Date) {
  return date.toLocaleDateString('en-CA')
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function mapLegacyReadingToSample(node: NodeData, readings: PollutionReadings): WaqiTelemetrySample {
  const avg = Math.round(
    (readings.industrialEmissions + readings.vehicleSoot + readings.biomassBurning) / 3
  )

  const band = getAqiBand(avg)

  const iaqi = {
    pm25: readings.pm25 ?? avg,
    pm10: readings.pm10 ?? avg + 10,
    no2: readings.no2 ?? Math.max(0, avg - 5),
    so2: readings.so2 ?? Math.max(0, avg - 8),
    o3: readings.o3 ?? Math.max(0, avg + 12),
    temp: readings.temperature ?? 28,
    humidity: readings.humidity ?? 60,
    wind: readings.windSpeed ?? 5,
  }

  return {
    id: `fallback-${node.id}-${readings.timestamp.toISOString()}`,
    timestamp: readings.timestamp.toISOString(),
    aqi: avg,
    rating: band.label,
    stationName: node.name,
    cityName: node.name,
    dominantPollutant: 'pm25',
    lat: node.lat,
    lng: node.lng,
    iaqi,
    source: 'fallback',
  }
}

async function fetchWaqiFeed(lat: number, lng: number, signal: AbortSignal): Promise<WaqiTelemetrySample | null> {
  const url = new URL(`https://api.waqi.info/feed/geo:${lat};${lng}/`)
  url.searchParams.set('token', WAQI_TOKEN)

  const response = await fetch(url.toString(), {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`WAQI request failed: ${response.status}`)
  }

  const payload = (await response.json()) as WaqiApiResponse

  if (payload.status !== 'ok' || !payload.data) {
    return null
  }

  const data = payload.data
  const aqi = safeNumber(data.aqi)
  if (typeof aqi !== 'number') return null

  const band = getAqiBand(aqi)
  const iaqi: Record<string, number> = {}
  for (const [key, value] of Object.entries(data.iaqi ?? {})) {
    const numberValue = safeNumber(value?.v)
    if (typeof numberValue === 'number') {
      iaqi[key] = numberValue
    }
  }

  const latValue = safeNumber(data.city?.geo?.[0]) ?? lat
  const lngValue = safeNumber(data.city?.geo?.[1]) ?? lng
  const stationName = data.city?.name || 'WAQI Station'
  const cityName = data.city?.name || stationName

  return {
    id: `waqi-${latValue.toFixed(4)}-${lngValue.toFixed(4)}-${data.time?.s ?? Date.now()}`,
    timestamp: data.time?.s
      ? new Date(data.time.s).toISOString()
      : new Date().toISOString(),
    aqi,
    rating: band.label,
    stationName,
    cityName,
    dominantPollutant: data.dominentpol,
    lat: latValue,
    lng: lngValue,
    iaqi,
    source: 'waqi',
  }
}

function useWaqiTelemetry(node: NodeData | null) {
  const [current, setCurrent] = useState<WaqiTelemetrySample | null>(null)
  const [history, setHistory] = useState<WaqiTelemetrySample[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storageKey = useMemo(() => {
    if (!node) return null
    return `waqi-history:${node.id}:${node.lat.toFixed(4)}:${node.lng.toFixed(4)}`
  }, [node?.id, node?.lat, node?.lng])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setCurrent(null)
      setHistory([])
      return
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setCurrent(null)
        setHistory([])
        return
      }

      const parsed = JSON.parse(raw) as WaqiTelemetrySample[]
      const valid = Array.isArray(parsed) ? parsed.filter(Boolean).slice(-2000) : []
      setHistory(valid)
      setCurrent(valid.at(-1) ?? null)
    } catch {
      setHistory([])
      setCurrent(null)
    }
  }, [storageKey])

  const persistHistory = useCallback(
    (samples: WaqiTelemetrySample[]) => {
      if (!storageKey || typeof window === 'undefined') return
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(samples.slice(-2000)))
      } catch {
        // Ignore quota/storage issues.
      }
    },
    [storageKey]
  )

  const recordSample = useCallback(
    (sample: WaqiTelemetrySample) => {
      setCurrent(sample)
      setHistory(prev => {
        const next = [...prev]
        const last = next.at(-1)
        if (!last || last.timestamp !== sample.timestamp || last.aqi !== sample.aqi) {
          next.push(sample)
        }
        const trimmed = next.slice(-2000)
        persistHistory(trimmed)

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('waqi-telemetry-update', {
              detail: {
                ...sample,
                nodeId: node?.id,
                nodeName: node?.name,
              },
            })
          )
        }

        return trimmed
      })
    },
    [persistHistory]
  )

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!node) return

      setIsLoading(true)
      setError(null)

      try {
        const live = await fetchWaqiFeed(node.lat, node.lng, signal ?? new AbortController().signal)
        if (live) {
          recordSample(live)
        } else if (node.readings) {
          recordSample(mapLegacyReadingToSample(node, node.readings))
        } else {
          setError('WAQI did not return a live station for this location.')
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Unable to load live WAQI telemetry right now.')
          if (node.readings) {
            recordSample(mapLegacyReadingToSample(node, node.readings))
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [node, recordSample]
  )

  useEffect(() => {
    if (!node) {
      setCurrent(null)
      setHistory([])
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    refresh(controller.signal)

    const intervalId = window.setInterval(() => {
      refresh(new AbortController().signal)
    }, WAQI_POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [node?.id, node?.lat, node?.lng, refresh])

  return { current, history, isLoading, error, refresh }
}

function buildDailySummaries(samples: WaqiTelemetrySample[]): WaqiDaySummary[] {
  const groups = new Map<string, WaqiTelemetrySample[]>()

  for (const sample of samples) {
    const date = new Date(sample.timestamp)
    const dayKey = formatDayKey(date)
    const existing = groups.get(dayKey) ?? []
    existing.push(sample)
    groups.set(dayKey, existing)
  }

  return [...groups.entries()]
    .map(([dayKey, daySamples]) => {
      const totalReadings = daySamples.length
      const values = daySamples.map(s => s.aqi)
      const avgAqi = Math.round(values.reduce((a, b) => a + b, 0) / totalReadings)
      const peakAqi = Math.max(...values)
      const band = getAqiBand(avgAqi)

      return {
        dayKey,
        label: formatDayLabel(new Date(daySamples[0].timestamp)),
        date: new Date(daySamples[0].timestamp),
        rating: band.label,
        avgAqi,
        peakAqi,
        totalReadings,
        samples: daySamples.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      } satisfies WaqiDaySummary
    })
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
}

const NodeReadingsDashboard: FC<{ node: NodeData | null }> = ({ node }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const { current, history, isLoading, error, refresh } = useWaqiTelemetry(node)

  const toggleExpanded = useCallback(() => setIsExpanded(p => !p), [])

  const dailySummaries = useMemo(() => buildDailySummaries(history), [history])

  const liveReading = current ?? (
    node?.readings ? mapLegacyReadingToSample(node, node.readings) : null
  )

  if (!node) {
    return (
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="text-center">
          <Target className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No node selected</p>
          <p className="text-white/40 text-xs mt-1">
            Click on a node on the map to view live WAQI telemetry
          </p>
        </div>
      </div>
    )
  }

  const tone = liveReading ? getAqiBand(liveReading.aqi) : ratingBands[0]

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl ${tone.border}`}
    >
      {/* Header */}
      <div
        className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-400 animate-pulse' : liveReading ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{node.name}</h3>
            <p className="text-white/40 text-xs truncate">
              {node.lat.toFixed(4)}, {node.lng.toFixed(4)} • Radius {node.radiusKm}km
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {liveReading && (
            <span className={`text-xs px-2 py-1 rounded-full border ${tone.badge}`}>
              {liveReading.source === 'waqi' ? 'WAQI Live' : 'Fallback'}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-4"
          >
            {!liveReading ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <Activity className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-white/70 text-sm">No live telemetry yet</p>
                <p className="text-white/40 text-xs mt-1">
                  The dashboard will poll WAQI for this node&apos;s location and keep a local history.
                </p>
              </div>
            ) : (
              <>
                {/* Live overview */}
                <div className={`border rounded-xl p-4 ${tone.soft} ${tone.border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/70 flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-white/70" />
                        Live Air Quality
                      </p>
                      <p className={`text-4xl font-bold mt-1 ${tone.text}`}>
                        {liveReading.aqi}
                      </p>
                      <p className="text-xs text-white/55 mt-1">
                        {liveReading.rating} • {liveReading.stationName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-white/40">Last updated</p>
                      <p className="text-xs text-white/70 flex items-center gap-1 justify-end">
                        <Clock3 className="w-3 h-3" />
                        {new Date(liveReading.timestamp).toLocaleString()}
                      </p>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          refresh()
                        }}
                        className="mt-2 text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/70 hover:bg-white/15 transition-colors"
                        data-drag-ignore="true"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(liveReading.iaqi).slice(0, 8).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-black/20 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-white/35">{key}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source / node info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/35">Station / City</p>
                    <p className="text-sm text-white mt-1">{liveReading.cityName}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-white/35">Dominant pollutant</p>
                    <p className="text-sm text-white mt-1">{liveReading.dominantPollutant ?? 'n/a'}</p>
                  </div>
                </div>

                {/* History panel */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-300" />
                        Telemetry History
                      </h4>
                      <p className="text-xs text-white/40">
                        Daily ratings, average AQI, peak AQI, and total readings
                      </p>
                    </div>
                    <span className="text-[11px] text-white/35">
                      {history.length} reading{history.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {error && (
                    <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {error}
                    </div>
                  )}

                  {dailySummaries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
                      <TrendingUp className="w-6 h-6 text-white/30 mx-auto mb-2" />
                      <p className="text-sm text-white/65">Waiting for history to build up</p>
                      <p className="text-xs text-white/40 mt-1">
                        As telemetry polls continue, the dashboard will aggregate each day automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dailySummaries.map(day => {
                        const band = getAqiBand(day.avgAqi)
                        const expanded = openDay === day.dayKey

                        return (
                          <div
                            key={day.dayKey}
                            className={`rounded-xl border ${band.border} bg-black/15 overflow-hidden`}
                          >
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setOpenDay(prev => (prev === day.dayKey ? null : day.dayKey))
                              }}
                              className="w-full p-3 text-left"
                              data-drag-ignore="true"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white">{day.label}</p>
                                  <p className="text-xs text-white/45 mt-1">
                                    Daily rating • {day.totalReadings} reading{day.totalReadings === 1 ? '' : 's'}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className={`inline-flex text-[11px] px-2.5 py-1 rounded-full border ${band.badge}`}>
                                    {day.rating}
                                  </div>
                                  <p className="text-xs text-white/50 mt-2">
                                    Avg {day.avgAqi} • Peak {day.peakAqi}
                                  </p>
                                </div>
                              </div>
                            </button>

                            <AnimatePresence>
                              {expanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22 }}
                                  className="border-t border-white/10 p-3 space-y-3"
                                >
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-lg bg-white/5 p-2">
                                      <p className="text-[10px] text-white/35">Average AQI</p>
                                      <p className="text-sm font-semibold text-white">{day.avgAqi}</p>
                                    </div>
                                    <div className="rounded-lg bg-white/5 p-2">
                                      <p className="text-[10px] text-white/35">Peak AQI</p>
                                      <p className="text-sm font-semibold text-white">{day.peakAqi}</p>
                                    </div>
                                    <div className="rounded-lg bg-white/5 p-2">
                                      <p className="text-[10px] text-white/35">Total</p>
                                      <p className="text-sm font-semibold text-white">{day.totalReadings}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    {day.samples.map(sample => (
                                      <div
                                        key={sample.id}
                                        className="rounded-lg border border-white/10 bg-black/20 p-3"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs text-white/45">
                                            {new Date(sample.timestamp).toLocaleTimeString()}
                                          </p>
                                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getAqiBand(sample.aqi).badge}`}>
                                            AQI {sample.aqi}
                                          </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                          {Object.entries(sample.iaqi).slice(0, 4).map(([key, value]) => (
                                            <div key={key} className="rounded-md bg-white/5 px-2 py-1.5">
                                              <p className="text-white/35 uppercase text-[10px]">{key}</p>
                                              <p className="text-white mt-0.5">{value}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ----------------------------------------------------------------------
   AddNodeDialog – main component (glass‑morphism UI)
----------------------------------------------------------------------- */
/* ----------------------------------------------------------------------
   AddNodeDialog – main component (glass‑morphism UI)
----------------------------------------------------------------------- */
export const AddNodeDialog: FC<AddNodeDialogProps> = ({
  isOpen,
  selectedLocation,
  onClose,
  onSubmit,
  isMapSelectionMode,
  onToggleMapMode,
  nodes = [],
  onNodeSelect,
  onPreviewChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragControls = useDragControls()

  /* ------------------------------- state ------------------------------- */
  const [nodeName, setNodeName] = useState('')
  const [radiusKm, setRadiusKm] = useState('5')
  const [error, setError] = useState('')
  const [readings, setReadings] = useState<PollutionReadings | null>(null)
  const [autoSimulate, setAutoSimulate] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [nodeRadius, setNodeRadius] = useState(5)

  /* --------------------------- helpers ---------------------------------- */
  const simulateReading = useCallback(() => {
    setReadings(() => generatePollutionData())
  }, [])

  /* --------------------------- effects --------------------------------- */
  // focus on open
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // radius visualisation
  useEffect(() => {
    setNodeRadius(parseFloat(radiusKm) || 5)
  }, [radiusKm])

  // Keep the parent map informed so it can render the perimeter circle in
  // real time while the user picks a point and adjusts the radius.
  useEffect(() => {
    const preview = selectedLocation
      ? {
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
          radiusKm: parseFloat(radiusKm) || 5,
          name: nodeName.trim() || 'Preview Node',
        }
      : null

    onPreviewChange?.(preview)

    // Also broadcast a DOM event so a map component can listen without
    // needing a new required prop contract.
    window.dispatchEvent(
      new CustomEvent('add-node-preview-change', { detail: preview })
    )
  }, [selectedLocation, radiusKm, nodeName, onPreviewChange])

  // FIX: previously this effect called `onToggleMapMode()` as soon as
  // `selectedLocation` changed, which flipped `isMapSelectionMode` to
  // `false` the instant the user clicked the map. Because the full-screen
  // `Backdrop` below is only suppressed while `isMapSelectionMode` is
  // `true`, that backdrop would immediately render on top of the live map,
  // hiding the marker/perimeter the user had just placed — this was the
  // "pointing on the map is not working / perimeter not visible" bug.
  //
  // We no longer auto-exit map mode on selection. The map stays fully
  // visible (dialog docked to the corner) so the user can see the pin and
  // perimeter update live, and adjust the radius while watching it. Map
  // mode now only turns off when the user clicks the toggle themselves, or
  // automatically on a successful submit (see handleSubmit below).

  // auto‑simulate reading
  useEffect(() => {
    if (!isOpen || !autoSimulate) return
    simulateReading()
    const id = setInterval(simulateReading, 30_000)
    return () => clearInterval(id)
  }, [isOpen, autoSimulate, simulateReading])

  /* --------------------------- callbacks ----------------------------- */
  const handleSubmit = useCallback(() => {
    setError('')
    if (!nodeName.trim()) {
      setError('Node name is required')
      return
    }
    if (!selectedLocation) {
      setError('Please select a location on the map')
      return
    }

    const radius = parseFloat(radiusKm) || 5
    onSubmit(nodeName, selectedLocation.lat, selectedLocation.lng, radius)

    // Exit map-selection mode on successful submit, since the flow is
    // complete. (This replaces the old "exit on select" behavior that
    // was hiding the map before the user was done.)
    if (isMapSelectionMode) {
      onToggleMapMode()
    }

    // reset UI
    setNodeName('')
    setRadiusKm('5')
    setReadings(null)
    onPreviewChange?.(null)
    onClose()
  }, [
    nodeName,
    selectedLocation,
    radiusKm,
    onSubmit,
    onClose,
    isMapSelectionMode,
    onToggleMapMode,
    onPreviewChange,
  ])

  const handleNodeClick = useCallback(
    (node: NodeData) => {
      setSelectedNode(node)
      onNodeSelect?.(node)
    },
    [onNodeSelect]
  )

  const beginPanelDrag = useCallback(
    (event: any) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('button, input, textarea, select, option, [data-drag-ignore="true"]')
      ) {
        return
      }

      dragControls.start(event)
    },
    [dragControls]
  )

  /* --------------------------- render --------------------------------- */
  if (!isOpen) return null

  // Dimmed backdrop – only rendered when NOT selecting on the map, so the
  // map is never covered or click-blocked while the user is placing a pin.
  const Backdrop = !isMapSelectionMode ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
  ) : null

  // NOTE: the old approach toggled `pointer-events: none` on the whole
  // dialog container while in map-selection mode so map clicks could pass
  // through underneath. Bug: pointer-events is inherited by every
  // descendant unless a child explicitly re-enables it — so the entire
  // dialog (name input, radius field, even the "Map Mode: ON" toggle
  // itself) became unusable at the same time, with no way to type a name
  // or turn map mode back off from inside the dialog.
  //
  // Fix: instead of layering the dialog over the map and fighting with
  // pointer-events, the dialog docks to a compact panel in the corner
  // while selecting, leaving the rest of the screen (the map) fully
  // visible and clickable, while the dialog itself stays 100% interactive
  // the whole time.
  const modalContent = (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className={
        isMapSelectionMode
          ? 'fixed top-4 right-4 z-[9999] w-[90vw] max-w-sm'
          : 'fixed inset-0 z-[9999] flex items-center justify-center p-4'
      }
    >
      <motion.div
        layout
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.08}
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className={
          isMapSelectionMode
            ? 'w-full flex flex-col gap-4 max-h-[85vh] overflow-y-auto bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10'
            : 'w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-4 max-h-[90vh] overflow-y-auto bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10'
        }
        onClick={e => e.stopPropagation()}
      >
        {/* ---------- LEFT PANEL – form ---------- */}
        <div
          className={
            isMapSelectionMode
              ? 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl'
              : 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 flex-1 md:max-w-md shadow-2xl'
          }
        >
          <div
            className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={beginPanelDrag}
          >
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Add Monitoring Node
              </h2>
              <p className="text-xs text-white/40 mt-1">
                Drag this panel by the header
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close dialog"
              data-drag-ignore="true"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Map-selection hint – makes the "click the map" flow explicit */}
          {isMapSelectionMode && (
            <div className="bg-blue-500/20 border border-blue-400/40 rounded-lg p-3 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-300 shrink-0 animate-pulse" />
              <p className="text-xs text-blue-200">
                Click anywhere on the map to place this node. You can still
                edit the name and radius here while you pick a spot, and the
                pin and perimeter will update live on the map.
              </p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {/* Node name */}
            <div>
              <Label htmlFor="nodeName" className="text-white/80 block mb-2">
                Node Name
              </Label>
              <Input
                id="nodeName"
                ref={inputRef}
                value={nodeName}
                onChange={e => setNodeName(e.target.value)}
                placeholder="e.g., San Francisco Station"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Location display */}
            <div>
              <Label className="text-white/80 block mb-2">Location</Label>
              {selectedLocation ? (
                <div className="bg-green-500/20 border border-green-400/40 rounded-lg p-3">
                  <p className="text-sm text-green-300 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Location Selected
                  </p>
                  <p className="text-xs text-green-200 mt-1 font-mono">
                    {selectedLocation.lat.toFixed(6)},{' '}
                    {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-500/20 border border-yellow-400/40 rounded-lg p-3">
                  <p className="text-sm text-yellow-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Click on the map to select location
                  </p>
                </div>
              )}
            </div>

            {/* Radius selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="radius" className="text-white/80">
                  Monitoring Radius (km)
                </Label>
                <span className="text-sm text-blue-400 font-mono">
                  {radiusKm} km
                </span>
              </div>
              <Input
                id="radius"
                type="number"
                value={radiusKm}
                onChange={e => setRadiusKm(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                placeholder="5"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              {/* visual bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${(parseFloat(radiusKm) / 50) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/40">
                  {Math.min(parseFloat(radiusKm), 50)}km
                </span>
              </div>
            </div>

            {/* Node preview – radius circle */}
            {selectedLocation && (
              <div className="relative bg-black/30 rounded-xl p-4 border border-white/10 overflow-hidden h-32">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, type: 'spring' }}
                      className="rounded-full border-2 border-blue-400/40 bg-blue-500/10"
                      style={{
                        width: `${nodeRadius * 4}px`,
                        height: `${nodeRadius * 4}px`,
                        margin: 'auto',
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-3 h-3 bg-blue-400 rounded-full"
                        />
                      </div>
                    </motion.div>

                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="text-xs text-white/60">
                        Node Perimeter
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-1 right-2 text-[10px] text-white/20 font-mono">
                  {selectedLocation.lat.toFixed(4)},{' '}
                  {selectedLocation.lng.toFixed(4)}
                </div>
              </div>
            )}

            {/* Validation error */}
            {error && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-3">
                <p className="text-sm text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Map‑selection toggle */}
          <button
            onClick={onToggleMapMode}
            className={`w-full mb-4 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
              isMapSelectionMode
                ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60 shadow-lg shadow-blue-500/20'
                : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
            }`}
            data-drag-ignore="true"
          >
            {isMapSelectionMode
              ? '📍 Map Mode: ON – Click map to select'
              : '🗺️ Enable Map Selection'}
          </button>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors font-medium"
              data-drag-ignore="true"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={!selectedLocation || !nodeName.trim()}
              className="flex-1 py-2.5 px-4 rounded-lg bg-blue-500/30 text-blue-300 border border-blue-400/40 hover:bg-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              data-drag-ignore="true"
            >
              Create Node
            </button>
          </div>
        </div>

        {/* ---------- RIGHT PANEL – preview ---------- */}
        {/* Hidden while docked to the side for map selection — there's no
            room for it in the compact layout, and the user's attention
            should be on the map, not a data preview. Reappears once the
            dialog re-centers. */}
        {!isMapSelectionMode && (
          <div className="flex-1 md:min-w-[380px]">
            <NodeReadingsDashboard
              node={
                selectedNode ||
                (readings
                  ? {
                      id: 'preview',
                      name: nodeName || 'Preview Node',
                      lat: selectedLocation?.lat ?? 0,
                      lng: selectedLocation?.lng ?? 0,
                      radiusKm: parseFloat(radiusKm) || 5,
                      readings,
                      isActive: true,
                    }
                  : null)
              }
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  )
  /* -----------------------------------------------------------------
     Render via portal (keeps stacking order)
  ----------------------------------------------------------------- */
  // NOTE: `#__next` was Pages Router's root element ID and does not exist
  // in the App Router — document.getElementById('__next') returned null,
  // and createPortal(content, null) threw "Target container is not a DOM
  // element." document.body always exists, so portal there instead.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {Backdrop}
          {modalContent}
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* Export default for convenience */
export default AddNodeDialog