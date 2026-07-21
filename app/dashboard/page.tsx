'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PollutionMap } from '@/components/map/pollution-map'
import { NodeDetailsPanel } from '@/components/map/node-details-panel'
import { NodeManagementPanel } from '@/components/dashboard/node-management-panel'
import { HistoryPanel } from '@/components/dashboard/history-panel'
import { LocationSearchEnhanced } from '@/components/dashboard/location-search-enhanced'
import { AddNodeDialog } from '@/components/dashboard/add-node-dialog'
import { DraggablePanel } from '@/components/dashboard/draggable-panel'
import {
  getMonitoringNodes,
  getPollutionSources,
  getLatestReadingsForNode,
  getSourceRatingsForNode,
  createMonitoringNode,
  simulateNodeReading,
  updateNodePingStatus,
  getReadingsHistoryForNode,
} from '@/app/actions/monitoring'
import { Button } from '@/components/ui/button'
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Eye, 
  Maximize2, 
  RefreshCw, 
  LogOut,
  Menu,
  Calendar,
  Activity,
  Search as SearchIcon,
  MapPin,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

interface MonitoringNode {
  id: string
  name: string
  description?: string
  latitude: string
  longitude: string
  isActive: boolean
  mode: string
  pingStatus?: string
  lastPingTime?: string
}

interface PollutionSource {
  id: string
  name: string
  sourceType: string
  latitude: string
  longitude: string
}

interface Reading {
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

interface HistoryEntry {
  date: string
  averageAQI: number
  peakAQI: number
  rating: string
  readings: number
}

interface Location {
  name: string
  type: 'city' | 'town' | 'volcano' | 'quarry' | 'factory' | 'industrial'
  lat: number
  lng: number
  description: string
  icon: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [nodes, setNodes] = useState<MonitoringNode[]>([])
  const [sources, setSources] = useState<PollutionSource[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [readings, setReadings] = useState<Record<string, Reading>>({})
  const [sourceRatings, setSourceRatings] = useState<Record<string, SourceRating[]>>({})
  const [loading, setLoading] = useState(true)
  const [mapCenter, setMapCenter] = useState({ lat: 15.0896, lng: 120.6218 })
  const [nodePerimeters, setNodePerimeters] = useState<Record<string, number>>({})
  
  // Panel states
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set())
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false)
  const [isMapClickMode, setIsMapClickMode] = useState(false)
  const [selectedMapLocation, setSelectedMapLocation] = useState<{ lat: number; lng: number } | null>(null)
  
  // Filter states
  const [selectedPollutant, setSelectedPollutant] = useState('all')
  const [selectedRegion, setSelectedRegion] = useState('luzon')
  const [selectedTimeRange, setSelectedTimeRange] = useState('5years')

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [nodesData, sourcesData] = await Promise.all([
          getMonitoringNodes(),
          getPollutionSources(),
        ])

        if (nodesData) setNodes(nodesData)
        if (sourcesData) setSources(sourcesData)

        // Initialize perimeters (default 5km radius for each node)
        const perimeters: Record<string, number> = {}
        nodesData?.forEach((node: MonitoringNode) => {
          perimeters[node.id] = 5
        })
        setNodePerimeters(perimeters)

        // Load readings for each node
        if (nodesData) {
          for (const node of nodesData) {
            const nodeReadings = await getLatestReadingsForNode(node.id)
            if (nodeReadings) {
              setReadings(prev => ({ ...prev, [node.id]: nodeReadings }))
            }
          }
        }
      } catch (error) {
        console.error('[v0] Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleNodeSelect = async (nodeId: string) => {
    setSelectedNodeId(nodeId)
    try {
      const [readings, sourceRatings] = await Promise.all([
        getLatestReadingsForNode(nodeId),
        getSourceRatingsForNode(nodeId),
      ])
      if (readings) setReadings(prev => ({ ...prev, [nodeId]: readings }))
      if (sourceRatings) setSourceRatings(prev => ({ ...prev, [nodeId]: sourceRatings }))
    } catch (error) {
      console.error('[v0] Error loading node details:', error)
    }
  }

  const handleAddNode = async (nodeName: string, lat: number, lng: number, radiusKm: number) => {
    try {
      const newNode = {
        id: uuidv4(),
        name: nodeName,
        latitude: lat.toString(),
        longitude: lng.toString(),
        isActive: true,
        mode: 'realtime',
        pingStatus: 'active',
      }

      // In a real app, this would call an API
      setNodes(prev => [...prev, newNode])
      setNodePerimeters(prev => ({ ...prev, [newNode.id]: radiusKm }))
      setShowAddNodeDialog(false)
      setIsMapClickMode(false)
      setSelectedMapLocation(null)

      // Simulate ping test
      await new Promise(resolve => setTimeout(resolve, 500))
      handleTestPing(newNode.id)
    } catch (error) {
      console.error('[v0] Error adding node:', error)
    }
  }

  const handleSimulate = async (nodeId: string) => {
    try {
      const simulatedReading = await simulateNodeReading(nodeId)
      if (simulatedReading) {
        setReadings(prev => ({ ...prev, [nodeId]: simulatedReading }))
      }
    } catch (error) {
      console.error('[v0] Error simulating reading:', error)
    }
  }

  const handleTestPing = async (nodeId: string) => {
    try {
      await updateNodePingStatus(nodeId, 'active')
      setNodes(prev =>
        prev.map(node =>
          node.id === nodeId
            ? { ...node, pingStatus: 'active', lastPingTime: new Date().toISOString() }
            : node
        )
      )
    } catch (error) {
      console.error('[v0] Error testing ping:', error)
    }
  }

  const handleLocationSelect = (location: Location) => {
    setMapCenter({ lat: location.lat, lng: location.lng })
    togglePanel('locationSearch')
  }

  const togglePanel = (panelId: string) => {
    setOpenPanels(prev => {
      const newSet = new Set(prev)
      if (newSet.has(panelId)) {
        newSet.delete(panelId)
      } else {
        newSet.add(panelId)
      }
      return newSet
    })
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/sign-in')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (isMapClickMode) {
      setSelectedMapLocation({ lat, lng })
    }
  }

  return (
    <main className="w-full h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-hidden relative">
      {/* Map Container */}
      <div className="absolute inset-0 w-full h-full">
        <PollutionMap
          nodes={nodes}
          sources={sources}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          readings={readings}
          center={mapCenter}
          onMapClick={handleMapClick}
          isClickMode={isMapClickMode}
          nodePerimeters={nodePerimeters}
        />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 glass-card m-4 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            AeroTrace Dashboard
          </h1>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedPollutant}
              onChange={(e) => setSelectedPollutant(e.target.value)}
              className="glass-dropdown"
            >
              <option value="all">All Pollutants</option>
              <option value="pm25">PM2.5</option>
              <option value="pm10">PM10</option>
            </select>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="glass-dropdown"
            >
              <option value="luzon">Luzon</option>
              <option value="pampanga">Pampanga</option>
            </select>

            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="glass-dropdown"
            >
              <option value="5years">5 years</option>
              <option value="1year">1 year</option>
              <option value="1month">1 month</option>
            </select>
          </div>

          {/* Header Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => togglePanel('locationSearch')}
              className="glass-button flex items-center gap-2"
            >
              <SearchIcon className="w-4 h-4" />
              Search
            </button>

            <button
              onClick={handleLogout}
              className="glass-button px-4 py-2 rounded-lg hover:bg-red-500/20 hover:border-red-400/40 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Draggable Panels */}
      <AnimatePresence>
        {/* Node Management Panel */}
        {openPanels.has('nodeManagement') && (
          <DraggablePanel
            id="nodeManagement"
            title="Nodes Management"
            icon={<Activity className="w-5 h-5" />}
            defaultX={20}
            defaultY={120}
            defaultWidth={380}
            defaultHeight={600}
            onClose={() => togglePanel('nodeManagement')}
          >
            <NodeManagementPanel
              nodes={nodes}
              onAddNode={() => {
                setShowAddNodeDialog(true)
                setIsMapClickMode(true)
              }}
              onSimulate={handleSimulate}
              onTestPing={handleTestPing}
              onClose={() => togglePanel('nodeManagement')}
            />
          </DraggablePanel>
        )}

        {/* History Panel */}
        {openPanels.has('history') && (
          <DraggablePanel
            id="history"
            title="History Log"
            icon={<Calendar className="w-5 h-5" />}
            defaultX={420}
            defaultY={120}
            defaultWidth={380}
            defaultHeight={600}
            onClose={() => togglePanel('history')}
          >
            <HistoryPanel
              selectedNodeId={selectedNodeId}
              onClose={() => togglePanel('history')}
            />
          </DraggablePanel>
        )}

        {/* Location Search Panel */}
        {openPanels.has('locationSearch') && (
          <DraggablePanel
            id="locationSearch"
            title="Location Search"
            icon={<MapPin className="w-5 h-5" />}
            defaultX={820}
            defaultY={120}
            defaultWidth={420}
            defaultHeight={600}
            onClose={() => togglePanel('locationSearch')}
          >
            <LocationSearchEnhanced
              onLocationSelect={handleLocationSelect}
              onClose={() => togglePanel('locationSearch')}
            />
          </DraggablePanel>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-8 right-8 z-30 flex flex-col gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => togglePanel('nodeManagement')}
          className="glass-button w-14 h-14 rounded-full flex items-center justify-center bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/60"
          title="Node Management"
        >
          <Activity className="w-6 h-6 text-blue-300" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => togglePanel('history')}
          className="glass-button w-14 h-14 rounded-full flex items-center justify-center bg-purple-500/30 hover:bg-purple-500/40 border border-purple-400/60"
          title="History"
        >
          <Calendar className="w-6 h-6 text-purple-300" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => togglePanel('locationSearch')}
          className="glass-button w-14 h-14 rounded-full flex items-center justify-center bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400/60"
          title="Location Search"
        >
          <SearchIcon className="w-6 h-6 text-cyan-300" />
        </motion.button>
      </div>

      {/* Add Node Dialog */}
      <AddNodeDialog
        isOpen={showAddNodeDialog}
        selectedLocation={selectedMapLocation}
        onClose={() => {
          setShowAddNodeDialog(false)
          setIsMapClickMode(false)
        }}
        onSubmit={handleAddNode}
        isMapSelectionMode={isMapClickMode}
        onToggleMapMode={() => {
          setIsMapClickMode(!isMapClickMode)
          setSelectedMapLocation(null)
        }}
      />

      {/* Selected Node Details Panel (bottom right) */}
      {selectedNodeId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-8 left-8 z-20 w-96"
        >
          <NodeDetailsPanel
            nodeId={selectedNodeId}
            readings={readings[selectedNodeId]}
            sourceRatings={sourceRatings[selectedNodeId] || []}
            onClose={() => setSelectedNodeId(null)}
          />
        </motion.div>
      )}

      {/* Map Click Mode Indicator */}
      {isMapClickMode && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 glass-card px-6 py-3 rounded-full"
        >
          <p className="text-center text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 animate-pulse" />
            Click on the map to select node location
          </p>
        </motion.div>
      )}
    </main>
  )
}
