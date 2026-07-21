'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, AlertCircle, X } from 'lucide-react'

interface Location {
  name: string
  type: 'city' | 'town' | 'volcano' | 'quarry' | 'factory' | 'industrial'
  lat: number
  lng: number
  description: string
  icon: string
}

const LUZON_LOCATIONS: Location[] = [
  // Major Cities
  { name: 'Manila', type: 'city', lat: 14.5994, lng: 120.9842, description: 'National Capital', icon: '🏙️' },
  { name: 'Quezon City', type: 'city', lat: 14.6349, lng: 121.0388, description: 'Major Urban Center', icon: '🏢' },
  
  // Pampanga
  { name: 'Pampanga Central', type: 'town', lat: 15.0896, lng: 120.6218, description: 'Central Luzon Hub', icon: '📍' },
  { name: 'San Fernando', type: 'city', lat: 15.0333, lng: 120.6833, description: 'Industrial City', icon: '🏭' },
  
  // Pollution Sources - Volcanoes
  { name: 'Mount Pinatubo', type: 'volcano', lat: 15.1381, lng: 120.3500, description: 'Active Volcano', icon: '🌋' },
  { name: 'Taal Volcano', type: 'volcano', lat: 13.9932, lng: 121.0062, description: 'Active Volcano', icon: '🌋' },
  
  // Pollution Sources - Industrial
  { name: 'Laguna Industrial Park', type: 'industrial', lat: 14.3521, lng: 121.2975, description: 'Major Industrial Zone', icon: '🏗️' },
  { name: 'Cavite Economic Zone', type: 'industrial', lat: 14.3050, lng: 120.9217, description: 'Manufacturing Hub', icon: '🏗️' },
  { name: 'PEZA Industrial Zone', type: 'industrial', lat: 14.5150, lng: 121.0050, description: 'Philippine Export Zone', icon: '🏗️' },
  
  // Pollution Sources - Quarries
  { name: 'Bulacan Quarries', type: 'quarry', lat: 14.7775, lng: 121.1500, description: 'Mining Area', icon: '⛏️' },
  { name: 'Rizal Stone Quarries', type: 'quarry', lat: 14.5917, lng: 121.5417, description: 'Extraction Site', icon: '⛏️' },
  
  // Pollution Sources - Factories
  { name: 'Calamba Industrial', type: 'factory', lat: 14.2039, lng: 121.1729, description: 'Manufacturing District', icon: '🏭' },
  { name: 'Bacoor Industrial', type: 'factory', lat: 14.3917, lng: 120.7667, description: 'Factory Zone', icon: '🏭' },
  { name: 'Rosario Industrial', type: 'factory', lat: 14.8167, lng: 120.9000, description: 'Manufacturing Complex', icon: '🏭' },
  
  // Other Major Towns
  { name: 'Makaati', type: 'city', lat: 14.5547, lng: 121.0244, description: 'Business District', icon: '💼' },
  { name: 'Antipolo', type: 'town', lat: 14.5894, lng: 121.5819, description: 'Mountain City', icon: '⛰️' },
]

interface LocationSearchEnhancedProps {
  onLocationSelect: (location: Location) => void
  onClose: () => void
}

export function LocationSearchEnhanced({
  onLocationSelect,
  onClose,
}: LocationSearchEnhancedProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const filteredLocations = useMemo(() => {
    return LUZON_LOCATIONS.filter(loc => {
      const matchesQuery = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          loc.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = !selectedType || loc.type === selectedType
      return matchesQuery && matchesType
    })
  }, [searchQuery, selectedType])

  const typeFilters = [
    { key: 'city', label: '🏙️ Cities', count: LUZON_LOCATIONS.filter(l => l.type === 'city').length },
    { key: 'town', label: '📍 Towns', count: LUZON_LOCATIONS.filter(l => l.type === 'town').length },
    { key: 'volcano', label: '🌋 Volcanoes', count: LUZON_LOCATIONS.filter(l => l.type === 'volcano').length },
    { key: 'quarry', label: '⛏️ Quarries', count: LUZON_LOCATIONS.filter(l => l.type === 'quarry').length },
    { key: 'factory', label: '🏭 Factories', count: LUZON_LOCATIONS.filter(l => l.type === 'factory').length },
    { key: 'industrial', label: '🏗️ Industrial', count: LUZON_LOCATIONS.filter(l => l.type === 'industrial').length },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-card rounded-2xl p-6 w-full max-w-md"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          Search Locations
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search locations, factories, volcanoes..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400/60"
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
      </div>

      {/* Type Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedType(null)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            selectedType === null
              ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60'
              : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
          }`}
        >
          All
        </button>
        {typeFilters.map(filter => (
          <button
            key={filter.key}
            onClick={() => setSelectedType(filter.key)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              selectedType === filter.key
                ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60'
                : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {filteredLocations.map((location) => (
            <motion.button
              key={location.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => onLocationSelect(location)}
              className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/40 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{location.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white group-hover:text-blue-300 transition-colors">
                    {location.name}
                  </h4>
                  <p className="text-xs text-white/50">{location.description}</p>
                  <p className="text-xs text-white/40 mt-1">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {filteredLocations.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/50">No locations found</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
