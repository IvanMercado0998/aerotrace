'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  Navigation, 
  Target,
  Crosshair,
  MapPin,
  Circle
} from 'lucide-react'

interface MonitoringNode {
  id: string
  name: string
  latitude: string
  longitude: string
  isActive: boolean
  mode: string
}

interface PollutionSource {
  id: string
  name: string
  sourceType: string
  latitude: string
  longitude: string
}

interface NodeReading {
  airQualityIndex?: string
  overallRating?: string
}

interface MapProps {
  nodes: MonitoringNode[]
  sources: PollutionSource[]
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
  readings: Record<string, NodeReading>
  center?: { lat: number; lng: number }
  onMapClick?: (lat: number, lng: number) => void
  isClickMode?: boolean
  nodePerimeters?: Record<string, number>
}

const sourceTypeColors: Record<string, string> = {
  cement_plant: '#E74C3C',
  quarry: '#E67E22',
  volcano: '#C0392B',
  factory: '#8E44AD',
  power_plant: '#E91E63',
  industrial: '#D35400',
  default: '#95A5A6',
}

const sourceTypeIcons: Record<string, string> = {
  volcano: '🌋',
  quarry: '⛏️',
  factory: '🏭',
  industrial: '🏗️',
  cement_plant: '🏢',
  power_plant: '⚡',
  default: '📍',
}

const sourceTypeLabels: Record<string, string> = {
  cement_plant: 'Cement Plant',
  quarry: 'Quarry',
  volcano: 'Volcano',
  factory: 'Factory',
  power_plant: 'Power Plant',
  industrial: 'Industrial',
  default: 'Source',
}

const ratingColors: Record<string, string> = {
  good: '#27AE60',
  moderate: '#F39C12',
  unhealthy: '#E67E22',
  hazardous: '#E74C3C',
  unknown: '#3498DB',
}

// Helper to create custom node marker
const createNodeMarker = (node: MonitoringNode, reading: NodeReading | undefined, isSelected: boolean) => {
  const rating = reading?.overallRating?.toLowerCase() || 'unknown'
  const color = ratingColors[rating] || ratingColors.unknown
  const size = isSelected ? 48 : 36
  const borderWidth = isSelected ? 3 : 2

  const el = document.createElement('div')
  el.className = 'custom-node-marker'
  el.innerHTML = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      border: ${borderWidth}px solid white;
      box-shadow: ${isSelected ? '0 0 20px rgba(52, 152, 219, 0.6), 0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.2)'};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${isSelected ? '16px' : '12px'};
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      ${node.mode === 'realtime' ? 'animation: nodePulse 2s infinite;' : ''}
      position: relative;
    ">
      ${node.isActive ? '✓' : '✕'}
      ${isSelected ? `<div style="position: absolute; top: -6px; right: -6px; width: 14px; height: 14px; background: #3498DB; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(52,152,219,0.5);"></div>` : ''}
    </div>
    <style>
      @keyframes nodePulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
        50% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
      }
      .custom-node-marker {
        background: transparent !important;
        border: none !important;
      }
      .custom-source-marker {
        background: transparent !important;
        border: none !important;
      }
      .leaflet-popup-content-wrapper {
        background: rgba(17, 24, 39, 0.95) !important;
        color: white !important;
        border-radius: 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
      }
      .leaflet-popup-tip {
        background: rgba(17, 24, 39, 0.95) !important;
      }
      .leaflet-popup-close-button {
        color: rgba(255, 255, 255, 0.5) !important;
        font-size: 18px !important;
        padding: 4px 8px !important;
      }
      .leaflet-popup-close-button:hover {
        color: white !important;
      }
    </style>
  `
  return el
}

// Helper to create custom source marker
const createSourceMarker = (source: PollutionSource) => {
  const color = sourceTypeColors[source.sourceType] || sourceTypeColors.default
  const icon = sourceTypeIcons[source.sourceType] || sourceTypeIcons.default
  const size = 34

  const el = document.createElement('div')
  el.className = 'custom-source-marker'
  el.innerHTML = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 0 20px ${color}60, 0 2px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      opacity: 0.95;
      transform: scale(1);
    ">
      ${icon}
    </div>
  `
  return el
}

export function PollutionMap({
  nodes,
  sources,
  selectedNodeId,
  onNodeSelect,
  readings,
  center,
  onMapClick,
  isClickMode,
  nodePerimeters,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markersLayer = useRef<L.LayerGroup | null>(null)
  const sourcesLayer = useRef<L.LayerGroup | null>(null)
  const perimeterLayer = useRef<L.LayerGroup | null>(null)
  const clickMarker = useRef<L.Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [currentCenter, setCurrentCenter] = useState({ 
    lat: center?.lat || 15.0896, 
    lng: center?.lng || 120.6218 
  })
  const [currentZoom, setCurrentZoom] = useState(10)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return

    const map = L.map(mapContainer.current, {
      center: [currentCenter.lat, currentCenter.lng],
      zoom: currentZoom,
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      preferCanvas: true,
    })

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 3,
    }).addTo(map)

    // Initialize layers
    markersLayer.current = L.layerGroup().addTo(map)
    sourcesLayer.current = L.layerGroup().addTo(map)
    perimeterLayer.current = L.layerGroup().addTo(map)

    // Map event handlers
    map.on('moveend', () => {
      const center = map.getCenter()
      setCurrentCenter({ lat: center.lat, lng: center.lng })
      setCurrentZoom(map.getZoom())
    })

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isClickMode && onMapClick) {
        // Show click indicator
        if (clickMarker.current) {
          clickMarker.current.remove()
        }
        
        const icon = L.divIcon({
          className: 'click-indicator',
          html: `
            <div style="
              width: 20px;
              height: 20px;
              background: rgba(52, 152, 219, 0.8);
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 0 30px rgba(52, 152, 219, 0.6);
              animation: clickPulse 0.6s ease-out;
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 6px;
                height: 6px;
                background: white;
                border-radius: 50%;
              "></div>
            </div>
            <style>
              @keyframes clickPulse {
                0% { transform: scale(0.5); opacity: 1; }
                100% { transform: scale(2); opacity: 0; }
              }
            </style>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        
        clickMarker.current = L.marker([e.latlng.lat, e.latlng.lng], { icon })
          .addTo(map)
        
        setTimeout(() => {
          if (clickMarker.current) {
            clickMarker.current.remove()
            clickMarker.current = null
          }
        }, 1000)
        
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    })

    mapInstance.current = map
    setMapReady(true)

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  // Handle click mode changes
  useEffect(() => {
    if (!mapContainer.current) return
    mapContainer.current.style.cursor = isClickMode ? 'crosshair' : 'grab'
  }, [isClickMode])

  // Update center with tweening animation
  useEffect(() => {
    if (!mapInstance.current || !center) return
    mapInstance.current.flyTo([center.lat, center.lng], 12, {
      duration: 1.5,
      easeLinearity: 0.25,
    })
  }, [center])

  // Add monitoring nodes to map
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !mapReady) return

    markersLayer.current.clearLayers()

    nodes.forEach((node) => {
      const lat = parseFloat(node.latitude)
      const lng = parseFloat(node.longitude)
      const reading = readings[node.id]
      const isSelected = node.id === selectedNodeId

      const el = createNodeMarker(node, reading, isSelected)
      const marker = L.marker([lat, lng], { 
        icon: L.divIcon({
          className: 'custom-node-marker',
          html: el.outerHTML,
          iconSize: [isSelected ? 48 : 36, isSelected ? 48 : 36],
          iconAnchor: [isSelected ? 24 : 18, isSelected ? 24 : 18],
        })
      })

      // Create popup content
      const rating = reading?.overallRating || 'Unknown'
      const popupContent = `
        <div class="p-4 min-w-[220px]">
          <h3 class="font-bold text-white text-base mb-2">${node.name}</h3>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Status:</span>
              <span class="${node.isActive ? 'text-green-400' : 'text-red-400'} font-medium">
                ${node.isActive ? '● Active' : '○ Inactive'}
              </span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Mode:</span>
              <span class="text-blue-400 font-medium">${node.mode}</span>
            </div>
            ${reading?.airQualityIndex ? `
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">AQI:</span>
                <span class="text-white font-medium">${reading.airQualityIndex}</span>
              </div>
            ` : ''}
            ${reading?.overallRating ? `
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">Rating:</span>
                <span class="font-medium" style="color: ${ratingColors[rating.toLowerCase()] || '#3498DB'}">
                  ${rating}
                </span>
              </div>
            ` : ''}
            ${nodePerimeters?.[node.id] ? `
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">Perimeter:</span>
                <span class="text-white font-medium">${nodePerimeters[node.id]}km</span>
              </div>
            ` : ''}
          </div>
          <button 
            onclick="window.selectNode('${node.id}')"
            class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ${isSelected ? '📍 Selected' : 'View Details'}
          </button>
        </div>
      `

      marker.bindPopup(popupContent, {
        className: 'custom-popup',
        maxWidth: 300,
        minWidth: 220,
      })

      marker.on('click', () => {
        if (onNodeSelect) onNodeSelect(node.id)
      })

      markersLayer.current.addLayer(marker)
    })

    // Add global select function for popup buttons
    ;(window as any).selectNode = (nodeId: string) => {
      if (onNodeSelect) onNodeSelect(nodeId)
      if (mapInstance.current) {
        mapInstance.current.closePopup()
      }
    }
  }, [nodes, selectedNodeId, onNodeSelect, readings, nodePerimeters, mapReady])

  // Add pollution sources to map
  useEffect(() => {
    if (!mapInstance.current || !sourcesLayer.current || !mapReady) return

    sourcesLayer.current.clearLayers()

    sources.forEach((source) => {
      const lat = parseFloat(source.latitude)
      const lng = parseFloat(source.longitude)
      const color = sourceTypeColors[source.sourceType] || sourceTypeColors.default
      const label = sourceTypeLabels[source.sourceType] || sourceTypeLabels.default

      const el = createSourceMarker(source)
      const marker = L.marker([lat, lng], { 
        icon: L.divIcon({
          className: 'custom-source-marker',
          html: el.outerHTML,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })
      })

      // Create popup content
      const popupContent = `
        <div class="p-4 min-w-[240px]">
          <h3 class="font-bold text-white text-base mb-2">${source.name}</h3>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Type:</span>
              <span class="font-medium" style="color: ${color}">
                ${label}
              </span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Impact:</span>
              <span class="text-orange-400 font-medium">High</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Distance:</span>
              <span class="text-white font-medium">${(Math.random() * 3 + 0.5).toFixed(1)}km</span>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-white/10">
            <div class="grid grid-cols-2 gap-1 text-xs">
              <div>
                <span class="text-gray-400">CO₂:</span>
                <span class="text-white">${Math.floor(Math.random() * 400 + 100)}kg</span>
              </div>
              <div>
                <span class="text-gray-400">SO₂:</span>
                <span class="text-white">${Math.floor(Math.random() * 50 + 10)}kg</span>
              </div>
              <div>
                <span class="text-gray-400">NOx:</span>
                <span class="text-white">${Math.floor(Math.random() * 80 + 20)}kg</span>
              </div>
              <div>
                <span class="text-gray-400">PM2.5:</span>
                <span class="text-white">${Math.floor(Math.random() * 60 + 10)}µg</span>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            ⚠️ Pollution source detected in this area
          </p>
        </div>
      `

      marker.bindPopup(popupContent, {
        className: 'custom-popup',
        maxWidth: 300,
        minWidth: 240,
      })

      sourcesLayer.current.addLayer(marker)
    })
  }, [sources, mapReady])

  // Draw perimeter for selected node
  useEffect(() => {
    if (!mapInstance.current || !perimeterLayer.current || !mapReady) return

    perimeterLayer.current.clearLayers()

    if (!selectedNodeId || !nodePerimeters) return

    const radiusKm = nodePerimeters[selectedNodeId]
    if (!radiusKm) return

    const node = nodes.find(n => n.id === selectedNodeId)
    if (!node) return

    const lat = parseFloat(node.latitude)
    const lng = parseFloat(node.longitude)

    // Create circle with animation
    const circle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#3498DB',
      fillColor: '#3498DB',
      fillOpacity: 0.08,
      weight: 2.5,
      dashArray: '6, 8',
      opacity: 0.6,
      interactive: false,
    })

    // Add animated pulse circle
    const pulseCircle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: 'transparent',
      fillColor: '#3498DB',
      fillOpacity: 0.04,
      weight: 0,
      interactive: false,
      className: 'pulse-circle',
    })

    perimeterLayer.current.addLayer(circle)
    perimeterLayer.current.addLayer(pulseCircle)

    // Add radius label with better styling
    const labelIcon = L.divIcon({
      className: 'radius-label',
      html: `
        <div style="
          background: rgba(52, 152, 219, 0.2);
          backdrop-filter: blur(8px);
          color: rgba(255, 255, 255, 0.9);
          padding: 4px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid rgba(52, 152, 219, 0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          letter-spacing: 0.5px;
        ">
          📍 ${radiusKm}km radius
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })

    const labelMarker = L.marker([lat, lng], { 
      icon: labelIcon, 
      interactive: false,
      className: 'radius-label-marker',
    })
    perimeterLayer.current.addLayer(labelMarker)

    // Animate pulse circle
    let scale = 1
    let growing = true
    const animatePulse = () => {
      if (!pulseCircle) return
      const baseRadius = radiusKm * 1000
      const maxScale = 1.15
      const minScale = 0.85
      
      if (growing) {
        scale += 0.008
        if (scale >= maxScale) growing = false
      } else {
        scale -= 0.008
        if (scale <= minScale) growing = true
      }
      
      pulseCircle.setRadius(baseRadius * scale)
      requestAnimationFrame(animatePulse)
    }
    
    animatePulse()
  }, [selectedNodeId, nodePerimeters, nodes, mapReady])

  // Map controls
  const handleZoomIn = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomIn()
    }
  }

  const handleZoomOut = () => {
    if (mapInstance.current) {
      mapInstance.current.zoomOut()
    }
  }

  const handleResetView = () => {
    if (mapInstance.current) {
      mapInstance.current.flyTo([currentCenter.lat, currentCenter.lng], 10, {
        duration: 1,
      })
    }
  }

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (mapInstance.current) {
          mapInstance.current.flyTo([latitude, longitude], 15, {
            duration: 1.5,
          })
          
          // Add temporary user location marker
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div style="
                width: 20px;
                height: 20px;
                background: #3498DB;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 30px rgba(52, 152, 219, 0.6);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 8px;
                  height: 8px;
                  background: white;
                  border-radius: 50%;
                  animation: userPulse 1.5s infinite;
                "></div>
              </div>
              <style>
                @keyframes userPulse {
                  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                  100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
                }
              </style>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
          
          L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapInstance.current)
            .bindPopup('📍 Your Location', { className: 'custom-popup' })
            .openPopup()
        }
      },
      (error) => {
        alert('Unable to get your location. Please check your browser permissions.')
        console.error(error)
      }
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Map Container - Set to proper z-index for touch events */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden"
        style={{ 
          minHeight: '600px',
          zIndex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      {/* All overlays with higher z-index */}
      <div className="relative w-full h-full" style={{ zIndex: 10, pointerEvents: 'none' }}>
        {/* Click Mode Indicator */}
        {isClickMode && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-500/90 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-blue-400 shadow-lg flex items-center gap-2 pointer-events-auto">
            <Target className="w-4 h-4 text-white animate-pulse" />
            <span className="text-white text-sm font-medium">Click on the map to place a new node</span>
          </div>
        )}

        {/* Custom Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000] pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>
          <button
            onClick={handleResetView}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            title="Reset View"
          >
            <Compass className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>
          <button
            onClick={handleLocateUser}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            title="Locate Me"
          >
            <Navigation className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Node Counter */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/60">Active: {nodes.filter(n => n.isActive).length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-white/60">Inactive: {nodes.filter(n => !n.isActive).length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">|</span>
              <span className="text-white/60">Sources: {sources.length}</span>
            </div>
          </div>
        </div>

        {/* Map Info */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-gray-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 pointer-events-auto">
          <p className="text-[10px] text-white/40 font-mono">
            Zoom: {currentZoom.toFixed(1)} • {currentCenter.lat.toFixed(4)}, {currentCenter.lng.toFixed(4)}
          </p>
        </div>
      </div>

      {/* CSS Styles */}
      <style>{`
        .leaflet-container {
          background: #1a1a2e;
          border-radius: 16px;
          z-index: 1 !important;
        }
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.5) !important;
          color: rgba(255, 255, 255, 0.3) !important;
          font-size: 9px !important;
          padding: 2px 8px !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        .leaflet-control-attribution a:hover {
          color: rgba(255, 255, 255, 0.6) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
          min-width: 200px;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          overflow: hidden !important;
        }
        .custom-node-marker, .custom-source-marker {
          background: transparent !important;
          border: none !important;
        }
        .pulse-circle {
          animation: pulseRing 2s ease-in-out infinite;
        }
        @keyframes pulseRing {
          0% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.1; transform: scale(1.1); }
          100% { opacity: 0.3; transform: scale(1); }
        }
        .click-indicator {
          pointer-events: none !important;
        }
        .radius-label-marker {
          pointer-events: none !important;
        }
        .leaflet-interactive {
          cursor: pointer;
        }
        /* Ensure map container gets touch events */
        .leaflet-container {
          touch-action: none !important;
        }
        /* Allow pointer events on overlays that need them */
        .pointer-events-auto {
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  )
}