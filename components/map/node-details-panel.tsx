'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

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

export function NodeDetailsPanel({
  nodeName,
  nodeDescription,
  mode,
  reading,
  sourceRatings = [],
  sources = {},
  onClose,
}: NodeDetailsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('readings')

  const getRatingColor = (rating?: string) => {
    switch (rating) {
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

  const getRatingBadgeColor = (rating?: string) => {
    switch (rating) {
      case 'hazardous':
        return 'bg-red-500/30 text-red-200'
      case 'unhealthy':
        return 'bg-orange-500/30 text-orange-200'
      case 'moderate':
        return 'bg-yellow-500/30 text-yellow-200'
      case 'good':
        return 'bg-green-500/30 text-green-200'
      default:
        return 'bg-slate-500/30 text-slate-200'
    }
  }

  const getPollutantStatus = (value?: string, pollutant?: string) => {
    if (!value) return { status: 'Unknown', color: 'text-slate-400' }

    const numValue = parseFloat(value)

    // WHO Air Quality Guidelines
    const thresholds: Record<string, { good: number; moderate: number; unhealthy: number }> = {
      pm25: { good: 25, moderate: 50, unhealthy: 100 },
      pm10: { good: 50, moderate: 100, unhealthy: 200 },
      no2: { good: 50, moderate: 100, unhealthy: 200 },
      so2: { good: 30, moderate: 100, unhealthy: 350 },
      o3: { good: 50, moderate: 100, unhealthy: 150 },
      co: { good: 5000, moderate: 10000, unhealthy: 20000 },
    }

    const threshold = thresholds[pollutant || ''] || { good: 100, moderate: 200, unhealthy: 400 }

    if (numValue <= threshold.good) return { status: 'Good', color: 'text-green-400' }
    if (numValue <= threshold.moderate) return { status: 'Moderate', color: 'text-yellow-400' }
    if (numValue <= threshold.unhealthy) return { status: 'Unhealthy', color: 'text-orange-400' }
    return { status: 'Hazardous', color: 'text-red-400' }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className="glass-card p-6 w-full h-full rounded-2xl overflow-y-auto flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/10">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{nodeName}</h2>
          {nodeDescription && (
            <p className="text-xs text-white/60 mt-1">{nodeDescription}</p>
          )}
        </div>
      </div>

      {/* Mode Badge */}
      <div className="mb-6">
        <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold ${
          mode === 'realtime'
            ? 'bg-green-500/20 text-green-200 border border-green-400/30'
            : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
        }`}>
          {mode === 'realtime' ? '● Real-time Monitoring' : '⊡ Manual Mode'}
        </span>
      </div>

      {/* Current Air Quality Index */}
      {reading && (
        <>
          {/* AQI Section */}
          <div className="mb-4">
            <button
              className="w-full glass p-4 rounded-lg flex justify-between items-center hover:bg-white/15 transition-colors"
              onClick={() =>
                setExpandedSection(expandedSection === 'aqi' ? null : 'aqi')
              }
            >
              <h3 className="font-semibold text-white text-sm">Air Quality Index</h3>
              <span className={`text-3xl font-bold font-mono ${
                reading.overallRating === 'hazardous'
                  ? 'text-red-400'
                  : reading.overallRating === 'unhealthy'
                  ? 'text-orange-400'
                  : reading.overallRating === 'moderate'
                  ? 'text-yellow-400'
                  : 'text-green-400'
              }`}>
                {reading.airQualityIndex ? Math.round(parseFloat(reading.airQualityIndex as any)) : '—'}
              </span>
            </button>
            
            {expandedSection === 'aqi' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mt-2 px-4 py-3 rounded-lg border ${getRatingColor(
                  reading.overallRating
                )}`}
              >
                <p className="font-semibold text-sm uppercase tracking-wide">
                  {reading.overallRating || 'Unknown'}
                </p>
                <p className="text-xs mt-1 opacity-75">
                  {reading.overallRating === 'hazardous' && 'Health alert: Everyone may begin to experience serious health effects.'}
                  {reading.overallRating === 'unhealthy' && 'Members of sensitive groups may experience health effects.'}
                  {reading.overallRating === 'moderate' && 'Members of sensitive groups may experience health effects.'}
                  {reading.overallRating === 'good' && 'Air quality is satisfactory.'}
                </p>
              </motion.div>
            )}
          </div>

          {/* Pollutant Readings */}
          <div className="mb-4">
            <button
              className="w-full glass p-4 rounded-lg flex justify-between items-center hover:bg-white/15 transition-colors"
              onClick={() =>
                setExpandedSection(expandedSection === 'readings' ? null : 'readings')
              }
            >
              <h3 className="font-semibold text-white text-sm">Pollutant Levels</h3>
              <ChevronDown 
                className={`w-4 h-4 text-white/50 transition-transform ${
                  expandedSection === 'readings' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSection === 'readings' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 space-y-2"
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
                  const numValue = value ? parseFloat(value) : 0
                  return (
                    <div key={key} className="glass p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{label}</p>
                          <p className="text-xs text-white/50">{unit}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-base ${status.color}`}>
                            {value || '—'}
                          </p>
                          <p className={`text-xs font-semibold ${status.color}`}>
                            {status.status}
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            numValue < 50 ? 'bg-green-400' :
                            numValue < 100 ? 'bg-yellow-400' :
                            numValue < 200 ? 'bg-orange-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min((numValue / 300) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </div>

          {/* Source Contribution */}
          {sourceRatings.length > 0 && (
            <div>
              <button
                className="w-full glass p-4 rounded-lg flex justify-between items-center hover:bg-white/15 transition-colors"
                onClick={() =>
                  setExpandedSection(expandedSection === 'sources' ? null : 'sources')
                }
              >
                <h3 className="font-semibold text-white text-sm">Pollution Sources</h3>
                <span className="bg-orange-500/30 text-orange-200 text-xs px-2 py-1 rounded-full font-semibold">
                  {sourceRatings.length}
                </span>
              </button>

              {expandedSection === 'sources' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-2"
                >
                  {sourceRatings.map(rating => {
                    const source = sources[rating.sourceId]
                    const contribution = parseFloat(rating.contributionPercentage)
                    return (
                      <div key={rating.id} className="glass p-3 rounded-lg">
                        <p className="font-semibold text-sm text-white">{source?.name || 'Unknown'}</p>
                        <p className="text-xs text-white/60 mt-1">
                          {source?.sourceType.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <div className="mt-3 space-y-2 text-xs">
                          <div className="flex justify-between text-white/70">
                            <span>Distance</span>
                            <span className="text-white">{rating.distanceKm} km</span>
                          </div>
                          <div>
                            <div className="flex justify-between text-white/70 mb-1">
                              <span>Contribution</span>
                              <span className="text-orange-400 font-semibold">{rating.contributionPercentage}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(contribution, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-white/70">
                            <span>Rating</span>
                            <span className="text-red-400 font-semibold">{rating.pollutionRating}/10</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </div>
          )}
        </>
      )}

      {!reading && (
        <div className="glass p-4 rounded-lg text-center text-white/50 flex-1 flex items-center justify-center">
          <p>No reading data available</p>
        </div>
      )}
    </motion.div>
  )
}
