'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  MapPin, 
  X, 
  Factory, 
  Car, 
  Trees, 
  Building, 
  AlertTriangle,
  Loader2,
  Navigation,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Flame,
  Droplets,
  Wind,
  Cloud,
  Sun,
  Moon,
  CloudRain
} from 'lucide-react'

// Types for location and pollution data
interface Location {
  name: string
  lat: number
  lng: number
  type: string
  address?: string
  pollutionSources?: PollutionSource[]
  environmentalHazards?: EnvironmentalHazard[]
  airQuality?: AirQualityData
}

interface PollutionSource {
  type: 'industrial' | 'vehicle' | 'biomass' | 'agricultural' | 'mining'
  name: string
  severity: 'low' | 'medium' | 'high'
  distance: number // in km
  emissions: {
    co2: number
    so2: number
    nox: number
    pm25: number
  }
}

interface EnvironmentalHazard {
  type: 'flood' | 'drought' | 'landslide' | 'wildfire' | 'earthquake'
  name: string
  risk: 'low' | 'medium' | 'high'
  description: string
}

interface AirQualityData {
  aqi: number
  pm25: number
  pm10: number
  no2: number
  so2: number
  o3: number
  co: number
  timestamp: Date
  status: 'good' | 'moderate' | 'unhealthy' | 'hazardous'
}

interface LocationSearchProps {
  onSearch: (lat: number, lng: number, location: Location) => void
  onClose: () => void
  isOpen: boolean
}

// Mock pollution data generator - In production, this would come from a real API
const generatePollutionData = (lat: number, lng: number): Location => {
  // Simulate different pollution levels based on location
  const seed = Math.abs(Math.sin(lat + lng) * 1000)
  const industrialLevel = (Math.sin(seed + 1) * 0.5 + 0.5) * 100
  const vehicleLevel = (Math.sin(seed + 2) * 0.5 + 0.5) * 100
  const biomassLevel = (Math.sin(seed + 3) * 0.5 + 0.5) * 100
  
  const sources: PollutionSource[] = []
  
  if (industrialLevel > 60) {
    sources.push({
      type: 'industrial',
      name: 'Industrial Zone',
      severity: industrialLevel > 80 ? 'high' : 'medium',
      distance: Math.random() * 5 + 1,
      emissions: {
        co2: Math.floor(Math.random() * 500 + 100),
        so2: Math.floor(Math.random() * 50 + 10),
        nox: Math.floor(Math.random() * 80 + 20),
        pm25: Math.floor(Math.random() * 60 + 10)
      }
    })
  }
  
  if (vehicleLevel > 50) {
    sources.push({
      type: 'vehicle',
      name: 'Major Roadway',
      severity: vehicleLevel > 70 ? 'high' : 'medium',
      distance: Math.random() * 2 + 0.5,
      emissions: {
        co2: Math.floor(Math.random() * 300 + 50),
        so2: Math.floor(Math.random() * 30 + 5),
        nox: Math.floor(Math.random() * 100 + 20),
        pm25: Math.floor(Math.random() * 40 + 5)
      }
    })
  }
  
  if (biomassLevel > 40) {
    sources.push({
      type: 'biomass',
      name: 'Agricultural Area',
      severity: biomassLevel > 60 ? 'high' : 'medium',
      distance: Math.random() * 3 + 0.5,
      emissions: {
        co2: Math.floor(Math.random() * 200 + 50),
        so2: Math.floor(Math.random() * 20 + 5),
        nox: Math.floor(Math.random() * 50 + 10),
        pm25: Math.floor(Math.random() * 30 + 5)
      }
    })
  }

  const hazards: EnvironmentalHazard[] = []
  if (Math.random() > 0.7) {
    hazards.push({
      type: 'flood',
      name: 'Flood Prone Area',
      risk: 'medium',
      description: 'Area near water bodies with moderate flood risk'
    })
  }
  
  if (Math.random() > 0.8) {
    hazards.push({
      type: 'landslide',
      name: 'Landslide Risk Zone',
      risk: 'low',
      description: 'Sloping terrain with potential landslide risk during heavy rain'
    })
  }

  // Calculate AQI
  const avgPollution = (industrialLevel + vehicleLevel + biomassLevel) / 3
  let aqi = Math.floor(avgPollution * 0.5 + 20)
  let status: 'good' | 'moderate' | 'unhealthy' | 'hazardous'
  if (aqi < 50) status = 'good'
  else if (aqi < 100) status = 'moderate'
  else if (aqi < 200) status = 'unhealthy'
  else status = 'hazardous'

  return {
    name: 'Location',
    lat,
    lng,
    type: 'mixed',
    pollutionSources: sources,
    environmentalHazards: hazards,
    airQuality: {
      aqi,
      pm25: Math.floor(Math.random() * 100 + 10),
      pm10: Math.floor(Math.random() * 150 + 20),
      no2: Math.floor(Math.random() * 80 + 10),
      so2: Math.floor(Math.random() * 60 + 5),
      o3: Math.floor(Math.random() * 100 + 10),
      co: Math.floor(Math.random() * 10 + 1),
      timestamp: new Date(),
      status
    }
  }
}

// Mock location data with pollution sources
const LOCATIONS_DATA: Location[] = [
  { 
    name: 'San Fernando, Pampanga', 
    lat: 15.0411, 
    lng: 120.6825, 
    type: 'city',
    address: 'San Fernando, Pampanga, Philippines',
    pollutionSources: [
      { type: 'industrial', name: 'Light Industrial Zone', severity: 'medium', distance: 2.5, emissions: { co2: 120, so2: 15, nox: 30, pm25: 20 } },
      { type: 'vehicle', name: 'Major Highway', severity: 'high', distance: 0.8, emissions: { co2: 200, so2: 20, nox: 60, pm25: 35 } }
    ],
    environmentalHazards: [
      { type: 'flood', name: 'Flood Prone Area', risk: 'medium', description: 'Near river systems with moderate flood risk' }
    ],
    airQuality: { aqi: 78, pm25: 35, pm10: 55, no2: 25, so2: 12, o3: 30, co: 3, timestamp: new Date(), status: 'moderate' }
  },
  { 
    name: 'Angeles City', 
    lat: 15.1274, 
    lng: 120.6208, 
    type: 'city',
    address: 'Angeles City, Pampanga, Philippines',
    pollutionSources: [
      { type: 'vehicle', name: 'Urban Traffic', severity: 'high', distance: 0.3, emissions: { co2: 280, so2: 25, nox: 80, pm25: 45 } },
      { type: 'industrial', name: 'Industrial Park', severity: 'medium', distance: 3.0, emissions: { co2: 150, so2: 18, nox: 35, pm25: 25 } }
    ],
    airQuality: { aqi: 95, pm25: 45, pm10: 70, no2: 35, so2: 18, o3: 40, co: 5, timestamp: new Date(), status: 'moderate' }
  },
  { 
    name: 'Mabalacat City', 
    lat: 15.2203, 
    lng: 120.5933, 
    type: 'city',
    address: 'Mabalacat City, Pampanga, Philippines',
    pollutionSources: [
      { type: 'industrial', name: 'Industrial Zone', severity: 'high', distance: 1.5, emissions: { co2: 350, so2: 40, nox: 60, pm25: 50 } },
      { type: 'biomass', name: 'Agricultural Burning', severity: 'medium', distance: 4.0, emissions: { co2: 180, so2: 15, nox: 25, pm25: 30 } }
    ],
    environmentalHazards: [
      { type: 'wildfire', name: 'Fire Risk Area', risk: 'medium', description: 'Dry vegetation with potential fire risk' }
    ],
    airQuality: { aqi: 120, pm25: 55, pm10: 85, no2: 40, so2: 25, o3: 50, co: 6, timestamp: new Date(), status: 'unhealthy' }
  },
  { 
    name: 'Pinatubo Volcano', 
    lat: 15.1321, 
    lng: 120.3506, 
    type: 'volcano',
    address: 'Zambales/Pampanga Border, Philippines',
    pollutionSources: [
      { type: 'industrial', name: 'Geothermal Area', severity: 'medium', distance: 5.0, emissions: { co2: 200, so2: 50, nox: 20, pm25: 30 } }
    ],
    environmentalHazards: [
      { type: 'wildfire', name: 'Volcanic Activity', risk: 'high', description: 'Active volcanic zone with potential ashfall' },
      { type: 'landslide', name: 'Landslide Risk', risk: 'high', description: 'Steep terrain with volcanic deposits' }
    ],
    airQuality: { aqi: 65, pm25: 30, pm10: 45, no2: 15, so2: 30, o3: 20, co: 2, timestamp: new Date(), status: 'moderate' }
  },
  { 
    name: 'Sapang Bato Quarry', 
    lat: 15.1893, 
    lng: 120.7111, 
    type: 'quarry',
    address: 'Sapang Bato, Angeles City, Philippines',
    pollutionSources: [
      { type: 'mining', name: 'Quarry Operations', severity: 'high', distance: 0.5, emissions: { co2: 280, so2: 20, nox: 40, pm25: 80 } },
      { type: 'vehicle', name: 'Truck Routes', severity: 'high', distance: 0.2, emissions: { co2: 250, so2: 15, nox: 70, pm25: 60 } }
    ],
    environmentalHazards: [
      { type: 'landslide', name: 'Quarry Landslide Risk', risk: 'high', description: 'Unstable quarry slopes with landslide potential' }
    ],
    airQuality: { aqi: 150, pm25: 80, pm10: 120, no2: 30, so2: 15, o3: 25, co: 8, timestamp: new Date(), status: 'unhealthy' }
  },
  { 
    name: 'Hagonoy Industrial Zone', 
    lat: 14.8756, 
    lng: 120.9222, 
    type: 'industrial',
    address: 'Hagonoy, Bulacan, Philippines',
    pollutionSources: [
      { type: 'industrial', name: 'Heavy Industrial Zone', severity: 'high', distance: 0.2, emissions: { co2: 500, so2: 60, nox: 90, pm25: 70 } },
      { type: 'biomass', name: 'Rice Husk Burning', severity: 'medium', distance: 2.0, emissions: { co2: 150, so2: 10, nox: 20, pm25: 40 } }
    ],
    environmentalHazards: [
      { type: 'flood', name: 'Flood Risk Area', risk: 'high', description: 'Low-lying area with high flood risk during rainy season' }
    ],
    airQuality: { aqi: 175, pm25: 85, pm10: 130, no2: 45, so2: 35, o3: 30, co: 9, timestamp: new Date(), status: 'unhealthy' }
  },
  { 
    name: 'Clark Freeport Zone', 
    lat: 15.1858, 
    lng: 120.5585, 
    type: 'industrial',
    address: 'Clark Freeport Zone, Pampanga, Philippines',
    pollutionSources: [
      { type: 'industrial', name: 'Special Economic Zone', severity: 'medium', distance: 1.0, emissions: { co2: 250, so2: 25, nox: 50, pm25: 35 } },
      { type: 'vehicle', name: 'Major Road Network', severity: 'medium', distance: 0.5, emissions: { co2: 180, so2: 12, nox: 40, pm25: 25 } }
    ],
    airQuality: { aqi: 68, pm25: 30, pm10: 50, no2: 22, so2: 10, o3: 28, co: 3, timestamp: new Date(), status: 'moderate' }
  },
  { 
    name: 'Mexico, Pampanga', 
    lat: 15.0660, 
    lng: 120.7230, 
    type: 'town',
    address: 'Mexico, Pampanga, Philippines',
    pollutionSources: [
      { type: 'agricultural', name: 'Rice Fields', severity: 'medium', distance: 0.5, emissions: { co2: 80, so2: 5, nox: 15, pm25: 20 } },
      { type: 'biomass', name: 'Crop Burning', severity: 'medium', distance: 1.0, emissions: { co2: 120, so2: 8, nox: 18, pm25: 30 } }
    ],
    environmentalHazards: [
      { type: 'flood', name: 'Flood Risk', risk: 'medium', description: 'Agricultural areas with moderate flood risk' }
    ],
    airQuality: { aqi: 55, pm25: 25, pm10: 40, no2: 12, so2: 8, o3: 20, co: 2, timestamp: new Date(), status: 'moderate' }
  }
]

// Component to display pollution sources
const PollutionSourcesDisplay: React.FC<{ location: Location }> = ({ location }) => {
  const [expanded, setExpanded] = useState(false)
  
  if (!location.pollutionSources || location.pollutionSources.length === 0) {
    return (
      <div className="mt-3 p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
        <p className="text-xs text-green-300 flex items-center gap-2">
          <Trees className="w-4 h-4" />
          No major pollution sources detected in this area
        </p>
      </div>
    )
  }

  const getSourceIcon = (type: string) => {
    switch(type) {
      case 'industrial': return <Factory className="w-4 h-4 text-purple-400" />
      case 'vehicle': return <Car className="w-4 h-4 text-orange-400" />
      case 'biomass': return <Trees className="w-4 h-4 text-green-400" />
      case 'agricultural': return <Cloud className="w-4 h-4 text-yellow-400" />
      case 'mining': return <AlertTriangle className="w-4 h-4 text-red-400" />
      default: return <MapPin className="w-4 h-4 text-blue-400" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'low': return 'bg-green-500/20 text-green-300'
      case 'medium': return 'bg-yellow-500/20 text-yellow-300'
      case 'high': return 'bg-red-500/20 text-red-300'
      default: return 'bg-white/10 text-white/60'
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
      >
        <span className="text-xs font-medium text-white/70">
          {location.pollutionSources.length} pollution source{location.pollutionSources.length > 1 ? 's' : ''} detected
        </span>
        <span className="text-xs text-white/40">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {location.pollutionSources.map((source, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(source.type)}
                    <div>
                      <p className="text-sm font-medium text-white">{source.name}</p>
                      <p className="text-xs text-white/50">{source.distance}km away</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(source.severity)}`}>
                    {source.severity}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <div className="text-center">
                    <p className="text-[10px] text-white/40">CO₂</p>
                    <p className="text-xs text-white font-medium">{source.emissions.co2}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-white/40">SO₂</p>
                    <p className="text-xs text-white font-medium">{source.emissions.so2}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-white/40">NOx</p>
                    <p className="text-xs text-white font-medium">{source.emissions.nox}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-white/40">PM2.5</p>
                    <p className="text-xs text-white font-medium">{source.emissions.pm25}µg</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Component to display environmental hazards
const EnvironmentalHazardsDisplay: React.FC<{ location: Location }> = ({ location }) => {
  if (!location.environmentalHazards || location.environmentalHazards.length === 0) {
    return null
  }

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'border-green-400/30 bg-green-500/10'
      case 'medium': return 'border-yellow-400/30 bg-yellow-500/10'
      case 'high': return 'border-red-400/30 bg-red-500/10'
      default: return 'border-white/10 bg-white/5'
    }
  }

  const getHazardIcon = (type: string) => {
    switch(type) {
      case 'flood': return <Droplets className="w-4 h-4 text-blue-400" />
      case 'drought': return <Sun className="w-4 h-4 text-yellow-400" />
      case 'landslide': return <AlertTriangle className="w-4 h-4 text-orange-400" />
      case 'wildfire': return <Flame className="w-4 h-4 text-red-400" />
      case 'earthquake': return <CloudRain className="w-4 h-4 text-purple-400" />
      default: return <AlertTriangle className="w-4 h-4 text-white/40" />
    }
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-white/40 mb-2">Environmental Hazards</p>
      {location.environmentalHazards.map((hazard, idx) => (
        <div key={idx} className={`border rounded-lg p-2 mb-2 ${getRiskColor(hazard.risk)}`}>
          <div className="flex items-center gap-2">
            {getHazardIcon(hazard.type)}
            <div>
              <p className="text-xs font-medium text-white">{hazard.name}</p>
              <p className="text-[10px] text-white/50">{hazard.description}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${
              hazard.risk === 'high' ? 'bg-red-500/20 text-red-300' :
              hazard.risk === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-green-500/20 text-green-300'
            }`}>
              {hazard.risk} risk
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Main Location Search Component
export function LocationSearch({ onSearch, onClose, isOpen }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    setIsLoading(true)
    
    // Simulate API delay
    setTimeout(() => {
      if (value.length > 1) {
        const filtered = LOCATIONS_DATA.filter(loc =>
          loc.name.toLowerCase().includes(value.toLowerCase()) ||
          loc.address?.toLowerCase().includes(value.toLowerCase())
        )
        setResults(filtered)
      } else {
        setResults([])
      }
      setIsLoading(false)
    }, 300)
  }, [])

  const handleSelect = (location: Location) => {
    // Generate enhanced pollution data for the selected location
    const enhancedLocation = {
      ...location,
      pollutionSources: location.pollutionSources || generatePollutionData(location.lat, location.lng).pollutionSources,
      environmentalHazards: location.environmentalHazards || generatePollutionData(location.lat, location.lng).environmentalHazards,
      airQuality: location.airQuality || generatePollutionData(location.lat, location.lng).airQuality
    }
    
    setSelectedLocation(enhancedLocation)
    onSearch(enhancedLocation.lat, enhancedLocation.lng, enhancedLocation)
    setQuery('')
    setResults([])
  }

  const getTypeEmoji = (type: string) => {
    switch(type) {
      case 'volcano': return '🌋'
      case 'quarry': return '⛏️'
      case 'industrial': return '🏭'
      case 'city': return '🌆'
      case 'town': return '🏘️'
      default: return '📍'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="glass-card rounded-2xl p-4 max-w-md w-full mx-auto shadow-2xl border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              Search Location & Pollution Sources
            </h3>
            <button
              onClick={() => {
                setQuery('')
                setResults([])
                setSelectedLocation(null)
                onClose()
              }}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-white/40" />
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for locations with pollution sources..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-400/50 focus:bg-white/20 transition-colors text-sm"
            />
            {isLoading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
              </div>
            )}
          </div>

          {/* Results */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 max-h-64 overflow-y-auto"
              >
                {results.map((location, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelect(location)}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                          {getTypeEmoji(location.type)} {location.name}
                        </p>
                        {location.address && (
                          <p className="text-xs text-white/50">{location.address}</p>
                        )}
                        <p className="text-[10px] text-white/30 mt-1">
                          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                        {location.pollutionSources && location.pollutionSources.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            <span className="text-[10px] text-yellow-400/70">
                              {location.pollutionSources.length} pollution source{location.pollutionSources.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          location.type === 'volcano' ? 'bg-red-500/20 text-red-300' :
                          location.type === 'quarry' ? 'bg-orange-500/20 text-orange-300' :
                          location.type === 'industrial' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {location.type}
                        </span>
                        {location.airQuality && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            location.airQuality.status === 'good' ? 'bg-green-500/20 text-green-300' :
                            location.airQuality.status === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                            location.airQuality.status === 'unhealthy' ? 'bg-orange-500/20 text-orange-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>
                            AQI: {location.airQuality.aqi}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {query && results.length === 0 && !isLoading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-white/50 mt-3 text-center"
            >
              No locations found with pollution data
            </motion.p>
          )}

          {/* Selected Location Details */}
          <AnimatePresence>
            {selectedLocation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">{selectedLocation.name}</span>
                </div>

                {/* Air Quality */}
                {selectedLocation.airQuality && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-white/60" />
                        <span className="text-xs text-white/60">Air Quality Index</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          selectedLocation.airQuality.status === 'good' ? 'text-green-400' :
                          selectedLocation.airQuality.status === 'moderate' ? 'text-yellow-400' :
                          selectedLocation.airQuality.status === 'unhealthy' ? 'text-orange-400' :
                          'text-red-400'
                        }`}>
                          {selectedLocation.airQuality.aqi}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedLocation.airQuality.status === 'good' ? 'bg-green-500/20 text-green-300' :
                          selectedLocation.airQuality.status === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                          selectedLocation.airQuality.status === 'unhealthy' ? 'bg-orange-500/20 text-orange-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {selectedLocation.airQuality.status}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-2">
                      <div className="text-center">
                        <p className="text-[10px] text-white/40">PM2.5</p>
                        <p className="text-xs text-white">{selectedLocation.airQuality.pm25}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-white/40">PM10</p>
                        <p className="text-xs text-white">{selectedLocation.airQuality.pm10}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-white/40">NO₂</p>
                        <p className="text-xs text-white">{selectedLocation.airQuality.no2}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-white/40">SO₂</p>
                        <p className="text-xs text-white">{selectedLocation.airQuality.so2}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-white/40">O₃</p>
                        <p className="text-xs text-white">{selectedLocation.airQuality.o3}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pollution Sources */}
                <PollutionSourcesDisplay location={selectedLocation} />
                
                {/* Environmental Hazards */}
                <EnvironmentalHazardsDisplay location={selectedLocation} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}