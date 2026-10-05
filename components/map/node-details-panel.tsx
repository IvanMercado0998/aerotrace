/**
 * components/map/node-details-panel.tsx
 *
 * Live WAQI telemetry + expandable daily history panel.
 */

'use client'

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Clock3,
  Loader2,
  AlertCircle,
  Activity,
  X,
} from 'lucide-react'

interface NodeReading {
  id?: string
  pm25?: string
  pm10?: string
  no2?: string
  so2?: string
  o3?: string
  co?: string
  airQualityIndex?: string
  overallRating?: string
  timestamp?: string | Date
}

interface SourceRating {
  id: string
  sourceId: string
  pollutionRating: string
  distanceKm: string
  contributionPercentage: string
}

interface Source {
  id: string
  name: string
  sourceType: string
}

interface LiveTelemetrySnapshot {
  aqi: number
  rating: 'Good' | 'Moderate' | 'Unhealthy' | 'Hazardous' | 'Unknown'
  timestamp: string
  source: 'waqi'
  stationName?: string
  city?: string
  dominentpol?: string
  pm25?: number
  pm10?: number
  no2?: number
  so2?: number
  o3?: number
  co?: number
  lat?: number
  lng?: number
  raw?: unknown
}

interface TelemetrySample {
  timestamp: string
  aqi: number
  rating: LiveTelemetrySnapshot['rating']
  source: 'waqi' | 'manual' | 'history'
  pm25?: number
  pm10?: number
  no2?: number
  so2?: number
  o3?: number
  co?: number
  dominantPollutant?: string
  stationName?: string
  city?: string
  lat?: number
  lng?: number
}

interface DailyTelemetrySummary {
  dayKey: string
  label: string
  rating: LiveTelemetrySnapshot['rating']
  averageAqi: number
  peakAqi: number
  totalReadings: number
  minAqi: number
  dominantPollutants: string[]
  samples: TelemetrySample[]
}

interface NodeDetailsPanelProps {
  nodeName: string
  nodeDescription?: string
  mode: string
  reading?: NodeReading
  sourceRatings?: SourceRating[]
  sources?: Record<string, Source>
  onClose?: () => void

  nodeLat?: number
  nodeLng?: number
  waqiToken?: string
  waqiStationId?: string
  waqiBaseUrl?: string
  historyEndpoint?: string
  telemetryRefreshMs?: number
  historyDays?: number

  onTelemetryUpdate?: (telemetry: LiveTelemetrySnapshot | null) => void
  onHistoryUpdate?: (history: DailyTelemetrySummary[]) => void
}

const glass = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg'

const getRatingColor = (rating?: string) => {
  const key = (rating ?? '').toLowerCase()
  switch (key) {
    case 'hazardous':
      return 'bg-red-500/20 border-red-400/50 text-red-200'
    case 'unhealthy':
      return 'bg-orange-500/20 border-orange-400/50 text-orange-200'
    case 'moderate':
      return 'bg-yellow-500/20 border-yellow-400/50 text-yellow-200'
    case 'good':
      return 'bg-green-500/20 border-green-400/50 text-green-200'
    default:
      return 'bg-slate-500/20 border-slate-400/50 text-slate-200'
  }
}

const ratingFromAqi = (aqi?: number | null): LiveTelemetrySnapshot['rating'] => {
  if (typeof aqi !== 'number' || Number.isNaN(aqi)) return 'Unknown'
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy'
  return 'Hazardous'
}

const safeNum = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const formatDayKey = (input: string | Date) => {
  const date = typeof input === 'string' ? new Date(input) : input
  return date.toISOString().slice(0, 10)
}

const formatReadableDate = (dayKey: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dayKey}T00:00:00`))

const getPollutantStatus = (
  value?: string,
  pollutant?: string,
): { status: string; color: string } => {
  if (!value) return { status: 'Unknown', color: 'text-slate-400' }

  const num = parseFloat(value)
  if (Number.isNaN(num)) return { status: 'Unknown', color: 'text-slate-400' }

  const thresholds: Record<string, { good: number; moderate: number; unhealthy: number }> = {
    pm25: { good: 25, moderate: 50, unhealthy: 100 },
    pm10: { good: 50, moderate: 100, unhealthy: 200 },
    no2: { good: 50, moderate: 100, unhealthy: 200 },
    so2: { good: 30, moderate: 100, unhealthy: 350 },
    o3: { good: 50, moderate: 100, unhealthy: 150 },
    co: { good: 5000, moderate: 10000, unhealthy: 20000 },
  }

  const t = thresholds[pollutant ?? ''] ?? { good: 100, moderate: 200, unhealthy: 400 }

  if (num <= t.good) return { status: 'Good', color: 'text-green-400' }
  if (num <= t.moderate) return { status: 'Moderate', color: 'text-yellow-400' }
  if (num <= t.unhealthy) return { status: 'Unhealthy', color: 'text-orange-400' }
  return { status: 'Hazardous', color: 'text-red-400' }
}

type WaqiFeedResponse = {
  status?: string
  data?: {
    aqi?: number
    idx?: number
    dominentpol?: string
    city?: { name?: string; geo?: [number, number] }
    iaqi?: Record<string, { v?: number }>
    time?: { s?: string }
    attributions?: Array<{ name?: string; url?: string }>
  }
  error?: { message?: string }
}

const buildWaqiFeedUrl = (params: {
  baseUrl: string
  token: string
  stationId?: string
  lat?: number
  lng?: number
}) => {
  const base = params.baseUrl.replace(/\/+$/, '')
  const source = params.stationId
    ? `feed/${encodeURIComponent(params.stationId)}`
    : typeof params.lat === 'number' && typeof params.lng === 'number'
      ? `feed/geo:${params.lat};${params.lng}`
      : null

  if (!source) return null

  const url = new URL(`${base}/${source}/`)
  url.searchParams.set('token', params.token)
  return url.toString()
}

const parseLiveTelemetry = (payload: WaqiFeedResponse): LiveTelemetrySnapshot | null => {
  if (!payload || payload.status !== 'ok' || !payload.data) return null
  const data = payload.data
  const aqi = safeNum(data.aqi) ?? safeNum(data.idx)
  if (typeof aqi !== 'number') return null

  const lat = data.city?.geo?.[1]
  const lng = data.city?.geo?.[0]

  return {
    aqi,
    rating: ratingFromAqi(aqi),
    timestamp: new Date().toISOString(),
    source: 'waqi',
    stationName: data.city?.name,
    city: data.city?.name,
    dominentpol: data.dominentpol,
    pm25: safeNum(data.iaqi?.pm25?.v),
    pm10: safeNum(data.iaqi?.pm10?.v),
    no2: safeNum(data.iaqi?.no2?.v),
    so2: safeNum(data.iaqi?.so2?.v),
    o3: safeNum(data.iaqi?.o3?.v),
    co: safeNum(data.iaqi?.co?.v),
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
    raw: payload,
  }
}

const liveToSample = (telemetry: LiveTelemetrySnapshot): TelemetrySample => ({
  timestamp: telemetry.timestamp,
  aqi: telemetry.aqi,
  rating: telemetry.rating,
  source: 'waqi',
  pm25: telemetry.pm25,
  pm10: telemetry.pm10,
  no2: telemetry.no2,
  so2: telemetry.so2,
  o3: telemetry.o3,
  co: telemetry.co,
  dominantPollutant: telemetry.dominentpol,
  stationName: telemetry.stationName,
  city: telemetry.city,
  lat: telemetry.lat,
  lng: telemetry.lng,
})

const manualReadingToSample = (reading: NodeReading | undefined): TelemetrySample | null => {
  if (!reading) return null
  const aqi = safeNum(reading.airQualityIndex)
  if (typeof aqi !== 'number') return null

  return {
    timestamp:
      typeof reading.timestamp === 'string'
        ? reading.timestamp
        : reading.timestamp instanceof Date
          ? reading.timestamp.toISOString()
          : new Date().toISOString(),
    aqi,
    rating: ratingFromAqi(aqi),
    source: 'manual',
    pm25: safeNum(reading.pm25),
    pm10: safeNum(reading.pm10),
    no2: safeNum(reading.no2),
    so2: safeNum(reading.so2),
    o3: safeNum(reading.o3),
    co: safeNum(reading.co),
  }
}

const summarizeTelemetry = (samples: TelemetrySample[]): DailyTelemetrySummary[] => {
  const groups = new Map<string, TelemetrySample[]>()
  for (const sample of samples) {
    const key = formatDayKey(sample.timestamp)
    const list = groups.get(key) ?? []
    list.push(sample)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayKey, daySamples]) => {
      const aqis = daySamples.map(s => s.aqi)
      const averageAqi = aqis.reduce((sum, value) => sum + value, 0) / daySamples.length
      const peakAqi = Math.max(...aqis)
      const minAqi = Math.min(...aqis)
      const dominantPollutants = Array.from(
        new Set(
          daySamples
            .map(s => s.dominantPollutant)
            .filter((v): v is string => Boolean(v))
            .map(v => v.toUpperCase()),
        ),
      )

      return {
        dayKey,
        label: formatReadableDate(dayKey),
        rating: ratingFromAqi(averageAqi),
        averageAqi,
        peakAqi,
        totalReadings: daySamples.length,
        minAqi,
        dominantPollutants,
        samples: [...daySamples].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      }
    })
}

export const NodeDetailsPanel: FC<NodeDetailsPanelProps> = ({
  nodeName,
  nodeDescription,
  mode,
  reading,
  sourceRatings = [],
  sources = {},
  onClose,
  nodeLat,
  nodeLng,
  waqiToken,
  waqiStationId,
  waqiBaseUrl = 'https://api.waqi.info',
  historyEndpoint,
  telemetryRefreshMs = 5 * 60 * 1000,
  historyDays = 14,
  onTelemetryUpdate,
  onHistoryUpdate,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('history')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<LiveTelemetrySnapshot | null>(null)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historySamples, setHistorySamples] = useState<TelemetrySample[]>([])
  const lastTelemetryStampRef = useRef<string | null>(null)
  const historySeedKeyRef = useRef<string>('')

  const toggle = (section: string) =>
    setExpandedSection(prev => (prev === section ? null : section))

  const effectiveReading = useMemo<NodeReading | undefined>(() => {
    if (reading) return reading
    if (!telemetry) return undefined
    return {
      airQualityIndex: String(telemetry.aqi),
      overallRating: telemetry.rating,
      pm25: telemetry.pm25 != null ? String(telemetry.pm25) : undefined,
      pm10: telemetry.pm10 != null ? String(telemetry.pm10) : undefined,
      no2: telemetry.no2 != null ? String(telemetry.no2) : undefined,
      so2: telemetry.so2 != null ? String(telemetry.so2) : undefined,
      o3: telemetry.o3 != null ? String(telemetry.o3) : undefined,
      co: telemetry.co != null ? String(telemetry.co) : undefined,
      timestamp: telemetry.timestamp,
    }
  }, [reading, telemetry])

  useEffect(() => {
    const key = `${nodeName}|${nodeLat ?? 'na'}|${nodeLng ?? 'na'}|${waqiStationId ?? 'station-na'}`
    if (historySeedKeyRef.current !== key) {
      historySeedKeyRef.current = key
      setHistorySamples([])
      setExpandedDay(null)
      setHistoryError(null)
    }
  }, [nodeName, nodeLat, nodeLng, waqiStationId])

  useEffect(() => {
    const manualSample = manualReadingToSample(reading)
    if (!manualSample) return
    setHistorySamples(prev => {
      const dedupKey = manualSample.timestamp.slice(0, 16)
      const filtered = prev.filter(sample => sample.timestamp.slice(0, 16) !== dedupKey)
      return [manualSample, ...filtered].slice(0, 700)
    })
  }, [reading])

  useEffect(() => {
    const canPoll = Boolean(
      waqiToken && (waqiStationId || (typeof nodeLat === 'number' && typeof nodeLng === 'number')),
    )

    if (!canPoll) {
      setTelemetry(null)
      setTelemetryError(null)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchOnce = async () => {
      const url = buildWaqiFeedUrl({
        baseUrl: waqiBaseUrl,
        token: waqiToken!,
        stationId: waqiStationId,
        lat: nodeLat,
        lng: nodeLng,
      })

      if (!url) return

      setTelemetryLoading(true)
      setTelemetryError(null)

      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        const payload = (await response.json()) as WaqiFeedResponse
        if (cancelled) return

        const snapshot = parseLiveTelemetry(payload)
        if (!snapshot) {
          setTelemetryError(payload?.error?.message ?? 'WAQI returned no usable live telemetry.')
          setTelemetry(null)
          return
        }

        const stampKey = snapshot.timestamp.slice(0, 16)
        if (lastTelemetryStampRef.current !== stampKey) {
          lastTelemetryStampRef.current = stampKey
          setHistorySamples(prev => [liveToSample(snapshot), ...prev].slice(0, 700))
        }

        setTelemetry(snapshot)
        onTelemetryUpdate?.(snapshot)
      } catch {
        if (!cancelled) {
          setTelemetryError('Live telemetry request failed.')
          setTelemetry(null)
        }
      } finally {
        if (!cancelled) setTelemetryLoading(false)
      }
    }

    void fetchOnce()
    timer = setInterval(() => { void fetchOnce() }, telemetryRefreshMs)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [waqiToken, waqiStationId, nodeLat, nodeLng, waqiBaseUrl, telemetryRefreshMs, onTelemetryUpdate])

  useEffect(() => {
    if (!historyEndpoint) return

    let cancelled = false

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)

      try {
        const response = await fetch(historyEndpoint, { headers: { Accept: 'application/json' } })
        const payload = await response.json()
        if (cancelled) return

        const items: TelemetrySample[] = Array.isArray(payload?.samples)
          ? payload.samples
              .map((item: any) => {
                const aqi = safeNum(item.aqi)
                if (typeof aqi !== 'number') return null
                return {
                  timestamp: item.timestamp ?? new Date().toISOString(),
                  aqi,
                  rating: ratingFromAqi(aqi),
                  source: 'history' as const,
                  pm25: safeNum(item.pm25),
                  pm10: safeNum(item.pm10),
                  no2: safeNum(item.no2),
                  so2: safeNum(item.so2),
                  o3: safeNum(item.o3),
                  co: safeNum(item.co),
                  dominantPollutant: item.dominantPollutant,
                  stationName: item.stationName,
                  city: item.city,
                } as TelemetrySample
              })
              .filter(Boolean)
          : []

        setHistorySamples(prev => {
          const merged = [...items, ...prev]
          const seen = new Set<string>()
          return merged.filter(sample => {
            const key = `${sample.timestamp.slice(0, 16)}-${sample.aqi}-${sample.source}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }).slice(0, Math.max(historyDays * 50, 200))
        })
      } catch {
        if (!cancelled) setHistoryError('Historical data could not be loaded.')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [historyEndpoint, historyDays])

  const dailyHistory = useMemo(() => summarizeTelemetry(historySamples), [historySamples])

  useEffect(() => {
    onHistoryUpdate?.(dailyHistory)
  }, [dailyHistory, onHistoryUpdate])

  const liveBadge = telemetry
    ? getRatingColor(telemetry.rating)
    : getRatingColor(effectiveReading?.overallRating)

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-4 right-4 bottom-4 z-[1500] flex w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/95 to-gray-800/95 shadow-2xl backdrop-blur-xl pointer-events-auto"
    >
      <div className="flex items-start justify-between border-b border-white/10 pb-4 px-6 pt-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{nodeName}</h2>
          {nodeDescription && <p className="mt-1 text-xs text-white/60">{nodeDescription}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-full p-1 text-white/60 hover:bg-white/10"
            aria-label="Close details panel"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-6 py-4">
        <span
          className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold ${
            mode === 'realtime'
              ? 'bg-green-500/20 text-green-200 border border-green-400/30'
              : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
          }`}
        >
          {mode === 'realtime' ? '● Real‑time Monitoring' : '⊡ Manual Mode'}
        </span>
      </div>

      <section className="px-6 py-2">
        <button
          type="button"
          className={`${glass} w-full flex items-center justify-between p-4`}
          onClick={() => toggle('telemetry')}
          aria-controls="telemetry-panel"
          aria-expanded={expandedSection === 'telemetry'}
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-300" />
              Live WAQI Telemetry
            </h3>
            <p className="text-[11px] text-white/45 mt-1">
              Real-time air quality feed from World Air Quality Index
            </p>
          </div>

          <div className="flex items-center gap-2">
            {telemetryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            ) : (
              <span className={`text-xs px-2 py-1 rounded-full border ${liveBadge}`}>
                {telemetry?.rating ?? effectiveReading?.overallRating ?? 'Unknown'}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-white/70 transition-transform ${
                expandedSection === 'telemetry' ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {expandedSection === 'telemetry' && (
          <motion.div
            id="telemetry-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mt-2 p-4 ${glass}`}
          >
            {telemetry ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-white/50">Current AQI</p>
                    <p className={`text-4xl font-bold font-mono ${telemetry.rating === 'Good' ? 'text-green-400' : telemetry.rating === 'Moderate' ? 'text-yellow-400' : telemetry.rating === 'Unhealthy' ? 'text-orange-400' : 'text-red-400'}`}>
                      {Math.round(telemetry.aqi)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/50">Status</p>
                    <span className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold border ${liveBadge}`}>
                      {telemetry.rating}
                    </span>
                    <p className="mt-2 text-[11px] text-white/50">
                      {new Date(telemetry.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[11px] text-white/45">Station</p>
                    <p className="text-sm text-white font-medium">
                      {telemetry.stationName ?? telemetry.city ?? 'WAQI Feed'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[11px] text-white/45">Dominant Pollutant</p>
                    <p className="text-sm text-white font-medium">
                      {telemetry.dominentpol?.toUpperCase() ?? '—'}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-white/40">
                  WAQI live data requires a token. Attribution to the World Air Quality Index Project is mandatory.
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-white/70">
                  {telemetryError ? telemetryError : 'No live telemetry available yet.'}
                </p>
                <p className="text-xs text-white/45">
                  Provide <span className="font-mono">waqiToken</span> plus either <span className="font-mono">nodeLat/nodeLng</span> or <span className="font-mono">waqiStationId</span>.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </section>

      {effectiveReading ? (
        <>
          <section className="px-6 py-2">
            <button
              type="button"
              className={`${glass} w-full flex items-center justify-between p-4`}
              onClick={() => toggle('aqi')}
              aria-controls="aqi-panel"
              aria-expanded={expandedSection === 'aqi'}
            >
              <h3 className="text-sm font-semibold text-white">Air Quality Index</h3>
              <span
                className={`text-3xl font-bold font-mono ${
                  (() => {
                    const col = (effectiveReading.overallRating ?? '').toLowerCase()
                    return col === 'hazardous'
                      ? 'text-red-400'
                      : col === 'unhealthy'
                        ? 'text-orange-400'
                        : col === 'moderate'
                          ? 'text-yellow-400'
                          : 'text-green-400'
                  })()
                }`}
              >
                {effectiveReading.airQualityIndex ? Math.round(parseFloat(effectiveReading.airQualityIndex)) : '—'}
              </span>
            </button>

            {expandedSection === 'aqi' && (
              <motion.div
                id="aqi-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mt-2 px-4 py-3 ${glass} border ${getRatingColor(effectiveReading.overallRating)}`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide">
                  {effectiveReading.overallRating ?? 'Unknown'}
                </p>
                <p className="mt-1 text-xs opacity-75">
                  {(() => {
                    const r = (effectiveReading.overallRating ?? '').toLowerCase()
                    switch (r) {
                      case 'hazardous':
                        return 'Health alert: everyone may experience more serious health effects.'
                      case 'unhealthy':
                        return 'Members of sensitive groups may experience health effects.'
                      case 'moderate':
                        return 'Air quality is acceptable; some sensitive groups may be affected.'
                      case 'good':
                        return 'Air quality is satisfactory.'
                      default:
                        return 'No rating information available.'
                    }
                  })()}
                </p>
              </motion.div>
            )}
          </section>

          <section className="px-6 py-2">
            <button
              type="button"
              className={`${glass} w-full flex items-center justify-between p-4`}
              onClick={() => toggle('readings')}
              aria-controls="readings-panel"
              aria-expanded={expandedSection === 'readings'}
            >
              <h3 className="text-sm font-semibold text-white">Pollutant Levels</h3>
              <ChevronDown
                className={`h-4 w-4 text-white/70 transition-transform ${expandedSection === 'readings' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedSection === 'readings' && (
              <motion.div
                id="readings-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 space-y-3"
              >
                {[
                  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', value: effectiveReading.pm25 },
                  { key: 'pm10', label: 'PM10', unit: 'µg/m³', value: effectiveReading.pm10 },
                  { key: 'no2', label: 'NO₂', unit: 'µg/m³', value: effectiveReading.no2 },
                  { key: 'so2', label: 'SO₂', unit: 'µg/m³', value: effectiveReading.so2 },
                  { key: 'o3', label: 'O₃', unit: 'µg/m³', value: effectiveReading.o3 },
                  { key: 'co', label: 'CO', unit: 'µg/m³', value: effectiveReading.co },
                ].map(({ key, label, unit, value }) => {
                  const status = getPollutantStatus(value, key)
                  const num = value ? parseFloat(value) : 0
                  const barColor = num < 50 ? 'bg-green-400' : num < 100 ? 'bg-yellow-400' : num < 200 ? 'bg-orange-400' : 'bg-red-400'

                  return (
                    <div key={key} className={glass}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-xs text-white/50">{unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-bold ${status.color}`}>{value ?? '—'}</p>
                          <p className={`text-xs font-semibold ${status.color}`}>{status.status}</p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all`}
                          style={{ width: `${Math.min((num / 300) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </section>

          {sourceRatings.length > 0 && (
            <section className="px-6 py-2">
              <button
                type="button"
                className={`${glass} w-full flex items-center justify-between p-4`}
                onClick={() => toggle('sources')}
                aria-controls="sources-panel"
                aria-expanded={expandedSection === 'sources'}
              >
                <h3 className="text-sm font-semibold text-white">Pollution Sources</h3>
                <span className="rounded-full bg-orange-500/30 px-2 py-0.5 text-xs font-semibold text-orange-200">
                  {sourceRatings.length}
                </span>
              </button>

              {expandedSection === 'sources' && (
                <motion.div
                  id="sources-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-3"
                >
                  {sourceRatings.map(rating => {
                    const src = sources[rating.sourceId]
                    const contribution = parseFloat(rating.contributionPercentage)

                    return (
                      <div key={rating.id} className={glass}>
                        <p className="font-semibold text-sm text-white">{src?.name ?? 'Unknown source'}</p>
                        <p className="mt-1 text-xs text-white/60">
                          {src?.sourceType?.replace(/_/g, ' ')?.toUpperCase() ?? 'UNKNOWN'}
                        </p>
                        <div className="mt-3 flex justify-between text-xs text-white/70">
                          <span>Distance</span>
                          <span>{rating.distanceKm} km</span>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Contribution</span>
                            <span className="text-orange-400 font-semibold">{rating.contributionPercentage}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all"
                              style={{ width: `${Math.min(contribution, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-white/70">
                          <span>Rating</span>
                          <span className="text-red-400 font-semibold">{rating.pollutionRating}/10</span>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </section>
          )}

          <section className="px-6 py-2 pb-6">
            <button
              type="button"
              className={`${glass} w-full flex items-center justify-between p-4`}
              onClick={() => toggle('history')}
              aria-controls="history-panel"
              aria-expanded={expandedSection === 'history'}
            >
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  Daily AQI History
                </h3>
                <p className="text-[11px] text-white/45 mt-1">
                  Average AQI, peak AQI, and total readings by day
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-white/70 transition-transform ${expandedSection === 'history' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedSection === 'history' && (
              <motion.div
                id="history-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 space-y-2"
              >
                {historyLoading && (
                  <div className={`${glass} p-4 text-sm text-white/60 flex items-center gap-2`}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading historical data...
                  </div>
                )}

                {historyError && (
                  <div className={`${glass} p-4 text-sm text-red-200 border border-red-400/20 bg-red-500/10 flex items-center gap-2`}>
                    <AlertCircle className="h-4 w-4" />
                    {historyError}
                  </div>
                )}

                {!historyLoading && dailyHistory.length === 0 && (
                  <div className={`${glass} p-4 text-sm text-white/55`}>
                    No history available yet. Live telemetry will populate this panel as readings arrive.
                  </div>
                )}

                {dailyHistory.map(day => {
                  const isOpen = expandedDay === day.dayKey
                  return (
                    <div key={day.dayKey} className={`${glass} overflow-hidden`}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 text-left"
                        onClick={() => setExpandedDay(prev => (prev === day.dayKey ? null : day.dayKey))}
                        aria-expanded={isOpen}
                        aria-controls={`day-${day.dayKey}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{day.label}</p>
                          <p className="text-[11px] text-white/45 mt-1">
                            {day.totalReadings} reading{day.totalReadings === 1 ? '' : 's'}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block rounded-lg px-2 py-1 text-[11px] font-semibold border ${getRatingColor(day.rating)}`}>
                            {day.rating}
                          </span>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-white/45">
                            <span>Avg {Math.round(day.averageAqi)}</span>
                            <span>Peak {Math.round(day.peakAqi)}</span>
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            id={`day-${day.dayKey}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-white/10 px-4 py-4 space-y-3"
                          >
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-[10px] text-white/40">Average AQI</p>
                                <p className="text-sm font-semibold text-white">{Math.round(day.averageAqi)}</p>
                              </div>
                              <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-[10px] text-white/40">Peak AQI</p>
                                <p className="text-sm font-semibold text-white">{Math.round(day.peakAqi)}</p>
                              </div>
                              <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-[10px] text-white/40">Readings</p>
                                <p className="text-sm font-semibold text-white">{day.totalReadings}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-[10px] text-white/40">Minimum AQI</p>
                                <p className="text-sm font-semibold text-white">{Math.round(day.minAqi)}</p>
                              </div>
                              <div className="rounded-xl bg-black/20 p-3">
                                <p className="text-[10px] text-white/40">Dominant Pollutants</p>
                                <p className="text-sm font-semibold text-white">
                                  {day.dominantPollutants.length > 0 ? day.dominantPollutants.join(', ') : '—'}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                                Latest samples
                              </p>
                              {day.samples.slice(0, 6).map((sample, index) => (
                                <div key={`${sample.timestamp}-${index}`} className="rounded-xl bg-black/20 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-white">
                                        {new Date(sample.timestamp).toLocaleTimeString()}
                                      </p>
                                      <p className="text-[11px] text-white/45">
                                        {sample.source.toUpperCase()} • {sample.dominantPollutant?.toUpperCase() ?? 'UNKNOWN'}
                                      </p>
                                    </div>
                                    <span className={`inline-block rounded-lg px-2 py-1 text-[11px] font-semibold border ${getRatingColor(sample.rating)}`}>
                                      {sample.rating}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                                    {[
                                      ['AQI', sample.aqi],
                                      ['PM2.5', sample.pm25],
                                      ['PM10', sample.pm10],
                                      ['CO', sample.co],
                                    ].map(([label, value]) => (
                                      <div key={label as string} className="rounded-lg bg-white/5 p-2">
                                        <p className="text-[10px] text-white/40">{label}</p>
                                        <p className="text-xs text-white font-semibold">
                                          {typeof value === 'number' ? Math.round(value) : '—'}
                                        </p>
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
              </motion.div>
            )}
          </section>
        </>
      ) : (
        <div className={`${glass} flex-1 flex items-center justify-center p-8 m-6 text-center text-white/50`}>
          <p>No reading data available</p>
        </div>
      )}
    </motion.div>
  )
}

export default NodeDetailsPanel
