/**
 * components/map/node-details-panel.tsx
 *
 * • Fixed a few TypeScript / runtime issues (rating case‑sensitivity,
 *   defensive parseFloat, missing button type, optional close‑button).
 * • Re‑implemented the UI with a clean glass‑morphism style using Tailwind
 *   utilities (no external CSS required).
 * • Added a11y attributes (aria‑expanded, aria-controls, role="button").
 * • All original logic (expansion, colour mapping, callbacks) is unchanged.
 *
 * ────────────────────────────────────────────────────────────────────────
 * FIX LOG (this pass)
 * ────────────────────────────────────────────────────────────────────────
 * This is a slide-in overlay panel (see the `x: 400 → 0` entrance
 * animation) meant to float above the map, but it previously had NO
 * positioning or z-index of its own — it was just a plain flow element
 * with individual translucent "glass" cards inside it. Two problems
 * followed from that:
 *
 *   1. Depending on where the parent mounted it in the DOM, it could
 *      render behind the map canvas or its z-[1000] controls instead of
 *      above them, since it never declared its own stacking position.
 *   2. Because the panel itself had no solid backdrop (only its inner
 *      sections used `glass`, which is a translucent background), map
 *      tiles/markers could show through the gaps and make the text hard
 *      to read when it *was* floating correctly.
 *
 * Fix: the panel now positions itself explicitly (`fixed`, docked to the
 * right edge) with `z-[1500]` — placed above the map's `z-[1000]` custom
 * controls but below the AddNodeDialog's backdrop (`z-[9998]`) and dialog
 * (`z-[9999]`), matching the app's existing stacking scheme:
 *
 *     map canvas (0) < map controls (1000) < this panel (1500)
 *       < dialog backdrop (9998) < dialog (9999)
 *
 * It also gets its own solid dark backdrop (matching the
 * NodeReadingsDashboard component's style) so it reads clearly above any
 * part of the map, and `pointer-events-auto` so it stays clickable even
 * if a parent wrapper sets `pointer-events-none` for map click-through.
 *
 * Also fixed a stray trailing whitespace node after the source-type label
 * that rendered an extra space in the DOM.
 */

'use client'

import { FC, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'

/* ----------------------------------------------------------------------
   Types
----------------------------------------------------------------------- */
interface NodeReading {
  id?: string
  pm25?: string
  pm10?: string
  no2?: string
  so2?: string
  o3?: string
  co?: string
  airQualityIndex?: string
  overallRating?: string // e.g. “Good”, “Moderate”, …
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

interface NodeDetailsPanelProps {
  nodeName: string
  nodeDescription?: string
  mode: string
  reading?: NodeReading
  sourceRatings?: SourceRating[]
  sources?: Record<string, Source>
  onClose?: () => void
}

/* ----------------------------------------------------------------------
   Helper colour functions – case‑insensitive
----------------------------------------------------------------------- */
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

/* ----------------------------------------------------------------------
   Helper – pollutant status (colour + label) based on WHO thresholds
----------------------------------------------------------------------- */
const getPollutantStatus = (
  value?: string,
  pollutant?: string,
): { status: string; color: string } => {
  if (!value) return { status: 'Unknown', color: 'text-slate-400' }

  const num = parseFloat(value)
  if (Number.isNaN(num)) return { status: 'Unknown', color: 'text-slate-400' }

  const thresholds: Record<
    string,
    { good: number; moderate: number; unhealthy: number }
  > = {
    pm25: { good: 25, moderate: 50, unhealthy: 100 },
    pm10: { good: 50, moderate: 100, unhealthy: 200 },
    no2: { good: 50, moderate: 100, unhealthy: 200 },
    so2: { good: 30, moderate: 100, unhealthy: 350 },
    o3: { good: 50, moderate: 100, unhealthy: 150 },
    co: { good: 5000, moderate: 10000, unhealthy: 20000 },
  }

  const t = thresholds[pollutant ?? ''] ?? {
    good: 100,
    moderate: 200,
    unhealthy: 400,
  }

  if (num <= t.good) return { status: 'Good', color: 'text-green-400' }
  if (num <= t.moderate) return { status: 'Moderate', color: 'text-yellow-400' }
  if (num <= t.unhealthy) return { status: 'Unhealthy', color: 'text-orange-400' }
  return { status: 'Hazardous', color: 'text-red-400' }
}

/* ----------------------------------------------------------------------
   Glass‑morphism utility class (Tailwind) – reusable in the markup
----------------------------------------------------------------------- */
const glass = 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg'

/* ----------------------------------------------------------------------
   Component
----------------------------------------------------------------------- */
export const NodeDetailsPanel: FC<NodeDetailsPanelProps> = ({
  nodeName,
  nodeDescription,
  mode,
  reading,
  sourceRatings = [],
  sources = {},
  onClose,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('readings')

  /* --------------------------------------------------------------------
     Toggle helper (keeps the same boolean logic)
  -------------------------------------------------------------------- */
  const toggle = (section: string) =>
    setExpandedSection(prev => (prev === section ? null : section))

  return (
    // Fixed, explicitly z-indexed overlay docked to the right edge.
    // z-[1500] sits above the map's z-[1000] controls and below the
    // AddNodeDialog's backdrop (z-[9998]) / dialog (z-[9999]) — see the
    // FIX LOG above for the full stacking scheme. `pointer-events-auto`
    // guarantees it stays clickable even inside a `pointer-events-none`
    // map-overlay wrapper.
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="fixed top-4 right-4 bottom-4 z-[1500] flex w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/95 to-gray-800/95 shadow-2xl backdrop-blur-xl pointer-events-auto"
    >
      {/* ── Header – title + optional close button ─────────────────────── */}
      <div className="flex items-start justify-between border-b border-white/10 pb-4 px-6 pt-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{nodeName}</h2>
          {nodeDescription && (
            <p className="mt-1 text-xs text-white/60">{nodeDescription}</p>
          )}
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

      {/* ── Mode badge ───────────────────────────────────────────────────── */}
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

      {/* ── Main content – only show when we have a reading ────────────── */}
      {reading ? (
        <>
          {/* ── AQI ─────────────────────────────────────────────────────── */}
          <section className="px-6 py-2">
            <button
              type="button"
              className={`${glass} w-full flex items-center justify-between p-4`}
              onClick={() => toggle('aqi')}
              aria-controls="aqi-panel"
              aria-expanded={expandedSection === 'aqi'}
            >
              <h3 className="text-sm font-semibold text-white">
                Air Quality Index
              </h3>
              <span
                className={`text-3xl font-bold font-mono ${
                  (() => {
                    const col = (reading.overallRating ?? '').toLowerCase()
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
                {reading.airQualityIndex
                  ? Math.round(parseFloat(reading.airQualityIndex))
                  : '—'}
              </span>
            </button>

            {/* Expanded AQI description */}
            {expandedSection === 'aqi' && (
              <motion.div
                id="aqi-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mt-2 px-4 py-3 ${glass} border ${getRatingColor(
                  reading.overallRating,
                )}`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide">
                  {reading.overallRating ?? 'Unknown'}
                </p>
                <p className="mt-1 text-xs opacity-75">
                  {(() => {
                    const r = (reading.overallRating ?? '').toLowerCase()
                    switch (r) {
                      case 'hazardous':
                        return 'Health alert: Everyone may begin to experience serious health effects.'
                      case 'unhealthy':
                        return 'Members of sensitive groups may experience health effects.'
                      case 'moderate':
                        return 'Members of sensitive groups may experience health effects.'
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

          {/* ── Pollutant Levels ─────────────────────────────────────────── */}
          <section className="px-6 py-2">
            <button
              type="button"
              className={`${glass} w-full flex items-center justify-between p-4`}
              onClick={() => toggle('readings')}
              aria-controls="readings-panel"
              aria-expanded={expandedSection === 'readings'}
            >
              <h3 className="text-sm font-semibold text-white">
                Pollutant Levels
              </h3>
              <ChevronDown
                className={`h-4 w-4 text-white/70 transition-transform ${
                  expandedSection === 'readings' ? 'rotate-180' : ''
                }`}
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
                  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', value: reading.pm25 },
                  { key: 'pm10', label: 'PM10', unit: 'µg/m³', value: reading.pm10 },
                  { key: 'no2', label: 'NO₂', unit: 'µg/m³', value: reading.no2 },
                  { key: 'so2', label: 'SO₂', unit: 'µg/m³', value: reading.so2 },
                  { key: 'o3', label: 'O₃', unit: 'µg/m³', value: reading.o3 },
                  { key: 'co', label: 'CO', unit: 'µg/m³', value: reading.co },
                ].map(({ key, label, unit, value }) => {
                  const status = getPollutantStatus(value, key)
                  const num = value ? parseFloat(value) : 0

                  // progress bar colour based on simple ranges
                  const barColor =
                    num < 50
                      ? 'bg-green-400'
                      : num < 100
                      ? 'bg-yellow-400'
                      : num < 200
                      ? 'bg-orange-400'
                      : 'bg-red-400'

                  return (
                    <div key={key} className={glass}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-xs text-white/50">{unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-bold ${status.color}`}>
                            {value ?? '—'}
                          </p>
                          <p className={`text-xs font-semibold ${status.color}`}>
                            {status.status}
                          </p>
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

          {/* ── Pollution sources (contributions) ───────────────────────── */}
          {sourceRatings.length > 0 && (
            <section className="px-6 py-2">
              <button
                type="button"
                className={`${glass} w-full flex items-center justify-between p-4`}
                onClick={() => toggle('sources')}
                aria-controls="sources-panel"
                aria-expanded={expandedSection === 'sources'}
              >
                <h3 className="text-sm font-semibold text-white">
                  Pollution Sources
                </h3>
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
                        <p className="font-semibold text-sm text-white">
                          {src?.name ?? 'Unknown source'}
                        </p>
                        <p className="mt-1 text-xs text-white/60">
                          {src?.sourceType?.replace(/_/g, ' ')?.toUpperCase() ??
                            'UNKNOWN'}
                        </p>

                        {/* distance */}
                        <div className="mt-3 flex justify-between text-xs text-white/70">
                          <span>Distance</span>
                          <span>{rating.distanceKm} km</span>
                        </div>

                        {/* contribution bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/70 mb-1">
                            <span>Contribution</span>
                            <span className="text-orange-400 font-semibold">
                              {rating.contributionPercentage}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all"
                              style={{ width: `${Math.min(contribution, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* rating */}
                        <div className="mt-2 flex justify-between text-xs text-white/70">
                          <span>Rating</span>
                          <span className="text-red-400 font-semibold">
                            {rating.pollutionRating}/10
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </section>
          )}
        </>
      ) : (
        /* ── No reading available ─────────────────────────────────────── */
        <div className={`${glass} flex-1 flex items-center justify-center p-8 m-6 text-center text-white/50`}>
          <p>No reading data available</p>
        </div>
      )}
    </motion.div>
  )
}

/* Export default for convenience */
export default NodeDetailsPanel