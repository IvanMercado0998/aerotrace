'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPin, 
  AlertCircle, 
  X, 
  Gauge, 
  Factory, 
  Car, 
  Trees, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw,
  Radio,
  Satellite,
  Waves,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  ChevronUp,
  ChevronDown,
  Activity,
  Circle,
  Target
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Types for pollution readings
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
  isSelected?: boolean
}

interface AddNodeDialogProps {
  isOpen: boolean
  selectedLocation: { lat: number; lng: number } | null
  onClose: () => void
  onSubmit: (nodeName: string, lat: number, lng: number, radiusKm: number) => void
  isMapSelectionMode: boolean
  onToggleMapMode: () => void
  nodes?: NodeData[]
  onNodeSelect?: (node: NodeData) => void
}

// Helper function to generate realistic pollution data
const generatePollutionData = (): PollutionReadings => {
  const industrial = Math.min(100, Math.max(0, Math.floor(Math.random() * 100)))
  const vehicle = Math.min(100, Math.max(0, Math.floor(Math.random() * 100)))
  const biomass = Math.min(100, Math.max(0, Math.floor(Math.random() * 100)))
  
  const weightedAverage = (industrial * 0.4 + vehicle * 0.35 + biomass * 0.25)
  let overallRating: 'Good' | 'Moderate' | 'Poor' | 'Hazardous'
  if (weightedAverage < 25) overallRating = 'Good'
  else if (weightedAverage < 50) overallRating = 'Moderate'
  else if (weightedAverage < 75) overallRating = 'Poor'
  else overallRating = 'Hazardous'

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
    windSpeed: Math.floor(Math.random() * 30) + 5
  }
}

// Component to display node readings in a dashboard style
const NodeReadingsDashboard: React.FC<{ node: NodeData | null }> = ({ node }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!node || !node.readings) {
    return (
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="text-center">
          <Radio className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No node selected</p>
          <p className="text-white/40 text-xs mt-1">Click on a node on the map to view readings</p>
        </div>
      </div>
    )
  }

  const readings = node.readings
  const getRatingColor = (value: number) => {
    if (value < 25) return 'text-green-400'
    if (value < 50) return 'text-yellow-400'
    if (value < 75) return 'text-orange-400'
    return 'text-red-400'
  }

  const getProgressColor = (value: number) => {
    if (value < 25) return 'bg-green-400'
    if (value < 50) return 'bg-yellow-400'
    if (value < 75) return 'bg-orange-400'
    return 'bg-red-400'
  }

  const getOverallColor = (rating: string) => {
    switch(rating) {
      case 'Good': return 'border-green-400/40 bg-green-500/10'
      case 'Moderate': return 'border-yellow-400/40 bg-yellow-500/10'
      case 'Poor': return 'border-orange-400/40 bg-orange-500/10'
      case 'Hazardous': return 'border-red-400/40 bg-red-500/10'
      default: return 'border-white/20 bg-white/5'
    }
  }

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div 
        className="p-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${node.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <div>
            <h3 className="text-white font-semibold">{node.name}</h3>
            <p className="text-white/40 text-xs">
              {node.lat.toFixed(4)}, {node.lng.toFixed(4)} • Radius: {node.radiusKm}km
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${getOverallColor(readings.overallRating)}`}>
            {readings.overallRating}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-4"
          >
            {/* Overall Rating Card */}
            <div className={`border rounded-xl p-4 ${getOverallColor(readings.overallRating)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70">Overall Air Quality</p>
                  <p className={`text-3xl font-bold ${getRatingColor(
                    (readings.industrialEmissions + readings.vehicleSoot + readings.biomassBurning) / 3
                  )}`}>
                    {readings.overallRating}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">Last updated</p>
                  <p className="text-xs text-white/60">{readings.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            {/* Pollution Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Industrial Emissions */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Factory className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-white/60">Industrial</span>
                </div>
                <p className={`text-lg font-bold ${getRatingColor(readings.industrialEmissions)}`}>
                  {readings.industrialEmissions}%
                </p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full ${getProgressColor(readings.industrialEmissions)} rounded-full transition-all duration-1000`}
                    style={{ width: `${readings.industrialEmissions}%` }}
                  />
                </div>
              </div>

              {/* Vehicle Soot */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-white/60">Vehicle Soot</span>
                </div>
                <p className={`text-lg font-bold ${getRatingColor(readings.vehicleSoot)}`}>
                  {readings.vehicleSoot}%
                </p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full ${getProgressColor(readings.vehicleSoot)} rounded-full transition-all duration-1000`}
                    style={{ width: `${readings.vehicleSoot}%` }}
                  />
                </div>
              </div>

              {/* Biomass Burning */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trees className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-white/60">Biomass</span>
                </div>
                <p className={`text-lg font-bold ${getRatingColor(readings.biomassBurning)}`}>
                  {readings.biomassBurning}%
                </p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full ${getProgressColor(readings.biomassBurning)} rounded-full transition-all duration-1000`}
                    style={{ width: `${readings.biomassBurning}%` }}
                  />
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-3 h-3 text-pink-400" />
                  <span className="text-xs text-white/60">AQI Index</span>
                </div>
                <p className={`text-lg font-bold ${getRatingColor(
                  (readings.pm25 || 0) / 100 * 100
                )}`}>
                  {(readings.pm25 || 0) + (readings.pm10 || 0) / 2}
                </p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full ${getProgressColor(
                      (readings.pm25 || 0) / 100 * 100
                    )} rounded-full transition-all duration-1000`}
                    style={{ width: `${((readings.pm25 || 0) + (readings.pm10 || 0) / 2) / 2}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Environmental Metrics */}
            <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-center">
                <Thermometer className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">Temp</p>
                <p className="text-white font-medium text-sm">{readings.temperature}°C</p>
              </div>
              <div className="text-center">
                <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">Humidity</p>
                <p className="text-white font-medium text-sm">{readings.humidity}%</p>
              </div>
              <div className="text-center">
                <Wind className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">Wind</p>
                <p className="text-white font-medium text-sm">{readings.windSpeed} km/h</p>
              </div>
            </div>

            {/* PM Details */}
            <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-center">
                <Eye className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">PM2.5</p>
                <p className="text-white font-medium text-sm">{readings.pm25} µg/m³</p>
              </div>
              <div className="text-center">
                <Eye className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">PM10</p>
                <p className="text-white font-medium text-sm">{readings.pm10} µg/m³</p>
              </div>
              <div className="text-center">
                <Satellite className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <p className="text-white/40 text-xs">NO₂</p>
                <p className="text-white font-medium text-sm">{readings.no2} ppb</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Main Component
export function AddNodeDialog({
  isOpen,
  selectedLocation,
  onClose,
  onSubmit,
  isMapSelectionMode,
  onToggleMapMode,
  nodes = [],
  onNodeSelect,
}: AddNodeDialogProps) {
  const [nodeName, setNodeName] = useState('')
  const [radiusKm, setRadiusKm] = useState('5')
  const [error, setError] = useState('')
  const [readings, setReadings] = useState<PollutionReadings | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [autoSimulate, setAutoSimulate] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [nodeRadius, setNodeRadius] = useState(5)

  // Simulate pollution readings
  const simulateReading = () => {
    setIsSimulating(true)
    setTimeout(() => {
      const newReadings = generatePollutionData()
      setReadings(newReadings)
      setIsSimulating(false)
    }, 500)
  }

  // Auto-simulate on mount and periodically
  useEffect(() => {
    if (isOpen && autoSimulate) {
      simulateReading()
      const interval = setInterval(() => {
        if (isOpen && autoSimulate) {
          simulateReading()
        }
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [isOpen, autoSimulate])

  // Update node radius when radius changes
  useEffect(() => {
    setNodeRadius(parseFloat(radiusKm) || 5)
  }, [radiusKm])

  if (!isOpen) return null

  const handleSubmit = () => {
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
    setNodeName('')
    setRadiusKm('5')
    setReadings(null)
    onClose()
  }

  // Handle node click
  const handleNodeClick = (node: NodeData) => {
    setSelectedNode(node)
    if (onNodeSelect) {
      onNodeSelect(node)
    }
  }

  return (
    <>
      {/* Full-screen map overlay for selection mode */}
      {isMapSelectionMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 pointer-events-none"
        />
      )}
      
      {/* Main Modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 ${
          isMapSelectionMode ? 'bg-transparent' : 'bg-black/50'
        } flex items-end justify-center z-50 md:items-center p-4`}
        style={{ pointerEvents: isMapSelectionMode ? 'none' : 'auto' }}
        onClick={!isMapSelectionMode ? onClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-4 max-h-[90vh] overflow-y-auto"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Left Panel - Node Creation Form */}
          <div className="glass-card rounded-2xl p-6 md:p-8 flex-1 md:max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Add Monitoring Node
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* Node Name */}
              <div>
                <Label htmlFor="nodeName" className="text-white/80 block mb-2">
                  Node Name
                </Label>
                <Input
                  id="nodeName"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  placeholder="e.g., San Francisco Station"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              {/* Location Display */}
              <div>
                <Label className="text-white/80 block mb-2">Location</Label>
                {selectedLocation ? (
                  <div className="bg-green-500/20 border border-green-400/40 rounded-lg p-3">
                    <p className="text-sm text-green-300 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Location Selected
                    </p>
                    <p className="text-xs text-green-200 mt-1 font-mono">
                      {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
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

              {/* Radius */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="radius" className="text-white/80">
                    Monitoring Radius (km)
                  </Label>
                  <span className="text-sm text-blue-400 font-mono">{radiusKm} km</span>
                </div>
                <Input
                  id="radius"
                  type="number"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                  min="1"
                  max="50"
                  step="0.5"
                  placeholder="5"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
                {/* Visual radius indicator */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${(parseFloat(radiusKm) / 50) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/40">{Math.min(parseFloat(radiusKm), 50)}km</span>
                </div>
              </div>

              {/* Node Preview with Radius Circle */}
              {selectedLocation && (
                <div className="relative bg-black/30 rounded-xl p-4 border border-white/10 overflow-hidden h-32">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* Radius circle visualization */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, type: "spring" }}
                        className="rounded-full border-2 border-blue-400/40 bg-blue-500/10"
                        style={{ 
                          width: `${nodeRadius * 4}px`, 
                          height: `${nodeRadius * 4}px`,
                          margin: 'auto'
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
                      {/* Label */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <span className="text-xs text-white/60">Node Perimeter</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-2">
                    <span className="text-[10px] text-white/20 font-mono">
                      {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-3">
                  <p className="text-sm text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Map Selection Mode Toggle */}
            <button
              onClick={onToggleMapMode}
              className={`w-full mb-4 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                isMapSelectionMode
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60 shadow-lg shadow-blue-500/20'
                  : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
              }`}
            >
              {isMapSelectionMode ? '📍 Map Mode: ON - Click map to select' : '🗺️ Enable Map Selection'}
            </button>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedLocation || !nodeName.trim()}
                className="flex-1 py-2.5 px-4 rounded-lg bg-blue-500/30 text-blue-300 border border-blue-400/40 hover:bg-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Create Node
              </button>
            </div>
          </div>

          {/* Right Panel - Node Readings */}
          <div className="flex-1 md:min-w-[380px]">
            <NodeReadingsDashboard node={selectedNode || (readings ? {
              id: 'preview',
              name: nodeName || 'Preview Node',
              lat: selectedLocation?.lat || 0,
              lng: selectedLocation?.lng || 0,
              radiusKm: parseFloat(radiusKm) || 5,
              readings: readings,
              isActive: true
            } : null)} />
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}