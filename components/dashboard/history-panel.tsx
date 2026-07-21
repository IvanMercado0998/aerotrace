'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, TrendingUp, TrendingDown, X } from 'lucide-react'

interface HistoryEntry {
  date: string
  averageAQI: number
  peakAQI: number
  rating: string
  readings: number
}

interface HistoryPanelProps {
  nodeName: string
  history: HistoryEntry[]
  onClose: () => void
}

export function HistoryPanel({ nodeName, history, onClose }: HistoryPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'unhealthy':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
      case 'hazardous':
        return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="glass-card rounded-2xl p-6 h-full overflow-y-auto max-h-[80vh]"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          History Log
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <p className="text-sm text-white/70 mb-4">{nodeName}</p>

      {/* Daily Ratings */}
      <div className="space-y-3">
        {history.map((entry, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setSelectedDate(selectedDate === entry.date ? null : entry.date)}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{entry.date}</p>
                <p className="text-xs text-white/50">{entry.readings} readings</p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${getRatingColor(entry.rating)}`}>
                {entry.rating.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-white/70">Avg: <span className="font-medium text-white">{entry.averageAQI.toFixed(0)}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-white/70">Peak: <span className="font-medium text-white">{entry.peakAQI.toFixed(0)}</span></span>
              </div>
            </div>

            {selectedDate === entry.date && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/10"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Average AQI</p>
                    <p className="text-2xl font-bold text-blue-400">{entry.averageAQI.toFixed(1)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-white/50 mb-1">Peak AQI</p>
                    <p className="text-2xl font-bold text-red-400">{entry.peakAQI.toFixed(1)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-white/50 mb-1">Total Readings</p>
                    <p className="text-lg font-semibold text-white">{entry.readings} data points recorded</p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {history.length === 0 && (
        <div className="text-center py-8">
          <Calendar className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/50">No history data available</p>
        </div>
      )}
    </motion.div>
  )
}
