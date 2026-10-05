/**
 * components/map/pollution-map.tsx
 *
 * A modern Leaflet‑based map that displays monitoring nodes,
 * pollution sources and optional perimeters.  The map itself is
 * forced onto the **lowest** stacking layer (z‑0) so that any
 * modal/dialog (e.g. AddNodeDialog with z‑[9999]) will always appear
 * on top.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  • All prop names and callback signatures are untouched.
 *  • UI is now built with Tailwind, nicer pop‑ups, and accessible
 *    custom map controls.
 *  • Z‑index handling:
 *        • Map container – `z-0`
 *        • Overlays (controls, indicators) – `z-[1000]`
 *        • Dialogs – `z-[9999]` (handled elsewhere)
 * ────────────────────────────────────────────────────────────────────────
 *
 * FIX LOG (this pass) — perimeter/pointer not visible
 * ────────────────────────────────────────────────────────────────────────
 * Leaflet's default panes (tilePane 200, overlayPane 400, markerPane 600,
 * popupPane 700) stack correctly *internally*, but that z-index is applied
 * via each pane's inline style at pane-creation time only. It is not
 * `!important`, and nothing in this file re-asserts it. If any global app
 * CSS (Tailwind preflight, a reset, or another component's stylesheet)
 * touches `.leaflet-pane` / `.leaflet-overlay-pane` / `.leaflet-marker-pane`
 * — even unintentionally, e.g. a blanket `[class*="pane"] { z-index: 0 }`
 * or similar reset — the perimeter circle and click/selection pointer can
 * end up rendered *underneath* the tile layer, which matches exactly the
 * "pointer/perimeter added but not visible" symptom.
 *
 * Fix: give the perimeter circle and the pointer markers (click-indicator,
 * user-location marker) their own dedicated Leaflet panes with a hard,
 * `!important` z-index set in this component's own <style> block. That
 * guarantees they always paint above the tile layer regardless of what
 * else is on the page, instead of depending on Leaflet's un-enforced
 * default pane order.
 * ────────────────────────────────────────────────────────────────────────
 *
 * FIX LOG (this pass) — Next.js prerender / SSR
 * ────────────────────────────────────────────────────────────────────────
 * Leaflet accesses `window` at module-evaluation time. Even with
 * `'use client'`, Next.js still evaluates the module during static
 * prerender of /dashboard, so a top-level `import L from 'leaflet'`
 * crashes the build with `ReferenceError: window is not defined`.
 *
 * Fix: import leaflet's TYPES only at the top (`import type * as L`),
 * which is erased at compile time, and load the actual runtime module
 * lazily inside the mount useEffect via `await import('leaflet')`.
 * The resolved namespace is stored in a ref (`LRef`) so every other
 * effect/callback can still call `L.map`, `L.marker`, etc. exactly as
 * before. All existing logic, prop shapes, and Leaflet API calls are
 * unchanged.
 * ────────────────────────────────────────────────────────────────────────
 */

'use client'

import {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  ZoomIn,
  ZoomOut,
  Compass,
  Navigation,
  Target,
} from 'lucide-react'

/* ----------------------------------------------------------------------
   Types
----------------------------------------------------------------------- */
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

/* ----------------------------------------------------------------------
   Colour / Icon dictionaries (unchanged – used inside helpers)
----------------------------------------------------------------------- */
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

/* ----------------------------------------------------------------------
   Helper – create a custom node marker (returns a DIV element)
----------------------------------------------------------------------- */
const createNodeMarker = (
  node: MonitoringNode,
  reading: NodeReading | undefined,
  isSelected: boolean,
) => {
  const rating = reading?.overallRating?.toLowerCase() || 'unknown'
  const color = ratingColors[rating] ?? ratingColors.unknown
  const size = isSelected ? 48 : 36
  const borderWidth = isSelected ? 3 : 2

  const el = document.createElement('div')
  el.className = 'custom-node-marker'
  el.innerHTML = `
    <div style="
      width:${size}px;
      height:${size}px;
      background:${color};
      border:${borderWidth}px solid white;
      border-radius:50%;
      box-shadow:${
        isSelected
          ? '0 0 20px rgba(52,152,219,0.6), 0 2px 10px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.2)'
      };
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:${isSelected ? 16 : 12}px;
      font-weight:bold;
      cursor:pointer;
      transition:all .3s ease;
      ${node.mode === 'realtime' ? 'animation:nodePulse 2s infinite;' : ''}
      position:relative;
    ">
      ${node.isActive ? '✓' : '✕'}
      ${
        isSelected
          ? `<div style="
              position:absolute;
              top:-6px;
              right:-6px;
              width:14px;
              height:14px;
              background:#3498DB;
              border-radius:50%;
              border:2px solid white;
              box-shadow:0 0 10px rgba(52,152,219,0.5);
            "></div>`
          : ''
      }
    </div>
    <style>
      @keyframes nodePulse {
        0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.7);}
        50%{box-shadow:0 0 0 10px rgba(231,76,60,0);}
      }
      .custom-node-marker{background:transparent !important;border:none !important;}
      .custom-source-marker{background:transparent !important;border:none !important;}
      .leaflet-popup-content-wrapper{
        background:rgba(17,24,39,0.95)!important;
        color:white!important;
        border-radius:12px!important;
        border:1px solid rgba(255,255,255,0.1)!important;
        backdrop-filter:blur(10px)!important;
        box-shadow:0 8px 32px rgba(0,0,0,0.4)!important;
      }
      .leaflet-popup-tip{background:rgba(17,24,39,0.95)!important;}
      .leaflet-popup-close-button{
        color:rgba(255,255,255,0.5)!important;
        font-size:18px!important;
        padding:4px 8px!important;
      }
      .leaflet-popup-close-button:hover{color:white!important;}
    </style>
  `
  return el
}

/* ----------------------------------------------------------------------
   Helper – create a custom source marker (returns a DIV element)
----------------------------------------------------------------------- */
const createSourceMarker = (source: PollutionSource) => {
  const color = sourceTypeColors[source.sourceType] ?? sourceTypeColors.default
  const icon = sourceTypeIcons[source.sourceType] ?? sourceTypeIcons.default
  const size = 34

  const el = document.createElement('div')
  el.className = 'custom-source-marker'
  el.innerHTML = `
    <div style="
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:50%;
      border:3px solid rgba(255,255,255,0.95);
      box-shadow:0 0 20px ${color}60,0 2px 10px rgba(0,0,0,0.3);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:16px;
      cursor:pointer;
      transition:all .3s ease;
      opacity:0.95;
    ">
      ${icon}
    </div>
  `
  return el
}

/* ----------------------------------------------------------------------
   PollutionMap component
----------------------------------------------------------------------- */
export const PollutionMap: FC<MapProps> = ({
  nodes,
  sources,
  selectedNodeId,
  onNodeSelect,
  readings,
  center,
  onMapClick,
  isClickMode,
  nodePerimeters,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null)

  /* Runtime Leaflet namespace — populated inside the mount effect after
     `await import('leaflet')`. Typed loosely (`any`) on purpose so that all
     existing `L.xxx(...)` calls below compile unchanged. */
  const LRef = useRef<any>(null)

  /* Leaflet instances (kept in refs to avoid re‑creating) */
  const mapInstance = useRef<L.Map | null>(null)
  const markersLayer = useRef<L.LayerGroup | null>(null)
  const sourcesLayer = useRef<L.LayerGroup | null>(null)
  const perimeterLayer = useRef<L.LayerGroup | null>(null)
  const clickMarker = useRef<L.Marker | null>(null)

  const [mapReady, setMapReady] = useState(false)

  const [currentCenter, setCurrentCenter] = useState({
    lat: center?.lat ?? 15.0896,
    lng: center?.lng ?? 120.6218,
  })
  const [currentZoom, setCurrentZoom] = useState(10)

  /* ------------------------------------------------------------------
     Initialise Leaflet map – one‑time only.
     Leaflet is imported lazily here (never at module top level) so
     nothing touches `window` during Next.js static prerender.
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return

    let cancelled = false

    ;(async () => {
      const mod: any = await import('leaflet')
      const L = mod.default ?? mod

      if (cancelled || !mapContainer.current || mapInstance.current) return

      LRef.current = L

      const map = L.map(mapContainer.current, {
        center: [currentCenter.lat, currentCenter.lng],
        zoom: currentZoom,
        zoomControl: false, // we use custom controls
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
        preferCanvas: true,
      })

      // OSM base tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3,
      }).addTo(map)

      // Dedicated panes with an explicit, hard-enforced z-index (see <style>
      // block below, `.leaflet-pane` rules with !important). We do NOT rely
      // on Leaflet's default pane z-indexes alone (tilePane 200, overlayPane
      // 400, markerPane 600, popupPane 700) because those are only set via
      // inline style at pane-creation time, without !important — any global
      // app CSS that later touches `.leaflet-pane` / `.leaflet-overlay-pane`
      // can silently override them and push the perimeter circle or pointer
      // markers underneath the tile layer. Custom panes + !important CSS
      // guarantee these always render on top, independent of the rest of
      // the app's stylesheet.
      map.createPane('perimeterPane')
      map.getPane('perimeterPane')!.style.zIndex = '450'
      map.createPane('pointerPane')
      map.getPane('pointerPane')!.style.zIndex = '650'

      // Layer groups – keep them separate for easier cleanup
      markersLayer.current = L.layerGroup().addTo(map)
      sourcesLayer.current = L.layerGroup().addTo(map)
      perimeterLayer.current = L.layerGroup().addTo(map)

      // ------- map event listeners ------------------------------------
      map.on('moveend', () => {
        const c = map.getCenter()
        setCurrentCenter({ lat: c.lat, lng: c.lng })
      })
      map.on('zoomend', () => setCurrentZoom(map.getZoom()))

      // Click‑mode handling
      map.on('click', (e: L.LeafletMouseEvent) => {
        // Guard: ignore clicks that actually originated on Leaflet's own UI
        // chrome (attribution/zoom control container, an open popup, or a
        // marker icon) rather than the bare map surface. Leaflet's control
        // container spans the full map with `pointer-events: none` on its
        // empty space by default so clicks normally pass through to the map
        // — but that default isn't `!important` (see the CSS block below),
        // so any global app stylesheet that touches pointer-events can
        // re-enable hit-testing on that empty space and "steal" clicks meant
        // for node placement. This check makes node placement immune to that
        // regardless of what the surrounding CSS does.
        const originalTarget = e.originalEvent?.target as HTMLElement | null
        if (
          originalTarget?.closest(
            '.leaflet-control, .leaflet-popup, .leaflet-marker-icon, .leaflet-control-container',
          )
        ) {
          return
        }

        if (isClickMode && onMapClick) {
          // small temporary click indicator
          if (clickMarker.current) clickMarker.current.remove()

          const icon = L.divIcon({
            className: 'click-indicator',
            html: `
              <div style="
                width:20px;height:20px;
                background:rgba(52,152,219,0.8);
                border-radius:50%;
                border:3px solid white;
                box-shadow:0 0 30px rgba(52,152,219,0.6);
                animation:clickPulse .6s ease-out;
              ">
                <div style="
                  position:absolute;top:50%;left:50%;
                  transform:translate(-50%,-50%);
                  width:6px;height:6px;
                  background:white;
                  border-radius:50%;
                "></div>
              </div>
              <style>
                @keyframes clickPulse{
                  0%{transform:scale(.5);opacity:1;}
                  100%{transform:scale(2);opacity:0;}
                }
              </style>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })
          // Rendered in the dedicated `pointerPane` (z-index 650, !important)
          // instead of Leaflet's default markerPane so it's guaranteed to sit
          // above the tile layer even if global CSS overrides default panes.
          clickMarker.current = L.marker(e.latlng, {
            icon,
            pane: 'pointerPane',
          }).addTo(map)

          setTimeout(() => {
            clickMarker.current?.remove()
            clickMarker.current = null
          }, 1000)

          onMapClick(e.latlng.lat, e.latlng.lng)
        }
      })

      mapInstance.current = map
      setMapReady(true)
    })()

    // cleanup on unmount
    return () => {
      cancelled = true
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, []) // empty deps → runs once

  /* ------------------------------------------------------------------
     Update cursor when click‑mode toggles
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (mapContainer.current) {
      mapContainer.current.style.cursor = isClickMode ? 'crosshair' : 'grab'
    }
  }, [isClickMode])

  /* ------------------------------------------------------------------
     Fly to an externally provided centre (smooth animation)
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mapInstance.current || !center) return

    mapInstance.current.flyTo([center.lat, center.lng], 12, {
      duration: 1.5,
      easeLinearity: 0.25,
    })
  }, [center])

  /* ------------------------------------------------------------------
     MARKERS – monitoring nodes
  ------------------------------------------------------------------ */
  const updateNodeMarkers = useCallback(() => {
    const L = LRef.current
    if (!L || !mapInstance.current || !markersLayer.current || !mapReady) return

    markersLayer.current.clearLayers()

    nodes.forEach(node => {
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
        }),
        riseOnHover: true,
        // Selected node's marker (the "pointer") gets the dedicated
        // high-priority pane so it's never visually buried under the
        // perimeter circle, other markers, or tile-layer redraws.
        pane: isSelected ? 'pointerPane' : undefined,
      })

      // ------------------- popup content -------------------
      const rating = reading?.overallRating?.toLowerCase() ?? 'unknown'
      const popupHTML = `
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
            ${
              reading?.airQualityIndex
                ? `<div class="flex items-center justify-between text-sm">
                     <span class="text-gray-400">AQI:</span>
                     <span class="text-white font-medium">${reading.airQualityIndex}</span>
                   </div>`
                : ''
            }
            ${
              reading?.overallRating
                ? `<div class="flex items-center justify-between text-sm">
                     <span class="text-gray-400">Rating:</span>
                     <span class="font-medium" style="color:${ratingColors[rating] ?? '#3498DB'}">
                       ${reading.overallRating}
                     </span>
                   </div>`
                : ''
            }
            ${
              nodePerimeters?.[node.id]
                ? `<div class="flex items-center justify-between text-sm">
                     <span class="text-gray-400">Perimeter:</span>
                     <span class="text-white font-medium">${nodePerimeters[node.id]}km</span>
                   </div>`
                : ''
            }
          </div>
          <button 
            onclick="window.selectNode('${node.id}')"
            class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ${isSelected ? '📍 Selected' : 'View Details'}
          </button>
        </div>
      `

      marker.bindPopup(popupHTML, {
        className: 'custom-popup',
        maxWidth: 300,
        minWidth: 220,
      })

      marker.on('click', () => onNodeSelect?.(node.id))

      markersLayer.current?.addLayer(marker)
    })

    // expose a tiny helper for the popup button
    ;(window as any).selectNode = (nodeId: string) => {
      onNodeSelect?.(nodeId)
      mapInstance.current?.closePopup()
    }
  }, [
    nodes,
    selectedNodeId,
    onNodeSelect,
    readings,
    nodePerimeters,
    mapReady,
  ])

  useEffect(() => {
    updateNodeMarkers()
  }, [updateNodeMarkers])

  /* ------------------------------------------------------------------
     MARKERS – pollution sources
  ------------------------------------------------------------------ */
  const updateSourceMarkers = useCallback(() => {
    const L = LRef.current
    if (!L || !mapInstance.current || !sourcesLayer.current || !mapReady) return

    sourcesLayer.current.clearLayers()

    sources.forEach(src => {
      const lat = parseFloat(src.latitude)
      const lng = parseFloat(src.longitude)
      const color = sourceTypeColors[src.sourceType] ?? sourceTypeColors.default
      const label = sourceTypeLabels[src.sourceType] ?? sourceTypeLabels.default

      const el = createSourceMarker(src)

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-source-marker',
          html: el.outerHTML,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        riseOnHover: true,
      })

      const popupHTML = `
        <div class="p-4 min-w-[240px]">
          <h3 class="font-bold text-white text-base mb-2">${src.name}</h3>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Type:</span>
              <span class="font-medium" style="color:${color}">${label}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Impact:</span>
              <span class="text-orange-400 font-medium">High</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Distance:</span>
              <span class="text-white font-medium">${(
                Math.random() * 3 +
                0.5
              ).toFixed(1)}km</span>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-white/10">
            <div class="grid grid-cols-2 gap-1 text-xs">
              <div><span class="text-gray-400">CO₂:</span> <span class="text-white">${Math.floor(
                Math.random() * 400 + 100,
              )}kg</span></div>
              <div><span class="text-gray-400">SO₂:</span> <span class="text-white">${Math.floor(
                Math.random() * 50 + 10,
              )}kg</span></div>
              <div><span class="text-gray-400">NOx:</span> <span class="text-white">${Math.floor(
                Math.random() * 80 + 20,
              )}kg</span></div>
              <div><span class="text-gray-400">PM2.5:</span> <span class="text-white">${Math.floor(
                Math.random() * 60 + 10,
              )}µg</span></div>
            </div>
          </div>

          <p class="text-xs text-gray-500 mt-2">
            ⚠️ Pollution source detected in this area
          </p>
        </div>
      `

      marker.bindPopup(popupHTML, {
        className: 'custom-popup',
        maxWidth: 300,
        minWidth: 240,
      })

      sourcesLayer.current?.addLayer(marker)
    })
  }, [sources, mapReady])

  useEffect(() => {
    updateSourceMarkers()
  }, [updateSourceMarkers])

  /* ------------------------------------------------------------------
     PERIMETER – draw a radius circle for the selected node
  ------------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current
    if (!L || !mapInstance.current || !perimeterLayer.current || !mapReady) return

    perimeterLayer.current.clearLayers()

    if (!selectedNodeId || !nodePerimeters) return
    const radiusKm = nodePerimeters[selectedNodeId]
    if (!radiusKm) return

    const node = nodes.find(n => n.id === selectedNodeId)
    if (!node) return

    const lat = parseFloat(node.latitude)
    const lng = parseFloat(node.longitude)

    // solid perimeter circle
    // Rendered in the dedicated `perimeterPane` (z-index 450, !important)
    // instead of Leaflet's default overlayPane, so it's guaranteed to sit
    // above the tile layer even if global app CSS overrides default panes.
    const circle = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: '#3498DB',
      fillColor: '#3498DB',
      fillOpacity: 0.08,
      weight: 2.5,
      dashArray: '6, 8',
      opacity: 0.6,
      interactive: false,
      pane: 'perimeterPane',
    })

    // animated pulse “halo”
    const pulse = L.circle([lat, lng], {
      radius: radiusKm * 1000,
      color: 'transparent',
      fillColor: '#3498DB',
      fillOpacity: 0.04,
      weight: 0,
      interactive: false,
      className: 'pulse-circle',
      pane: 'perimeterPane',
    })

    perimeterLayer.current.addLayer(circle)
    perimeterLayer.current.addLayer(pulse)

    // radius label
    const labelIcon = L.divIcon({
      className: 'radius-label',
      html: `
        <div style="
          background:rgba(52,152,219,0.2);
          backdrop-filter:blur(8px);
          color:rgba(255,255,255,0.9);
          padding:4px 14px;
          border-radius:20px;
          font-size:12px;
          font-weight:500;
          border:1px solid rgba(52,152,219,0.3);
          box-shadow:0 4px 12px rgba(0,0,0,0.2);
          letter-spacing:.5px;
        ">
          📍 ${radiusKm}km radius
        </div>
      `,
      iconSize: [0, 0],
    })
    const labelMarker = L.marker([lat, lng], {
      icon: labelIcon,
      interactive: false,
      // Same pointerPane as other point markers so the radius label always
      // renders above the perimeter circle it's describing.
      pane: 'pointerPane',
    })
    perimeterLayer.current.addLayer(labelMarker)

    // ----- animate the pulse circle -------------------------------------------------
    let scale = 1
    let growing = true
    const animatePulse = () => {
      if (!pulse) return
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
      pulse.setRadius(baseRadius * scale)
      requestAnimationFrame(animatePulse)
    }
    animatePulse()
    // -------------------------------------------------------------------------------
  }, [selectedNodeId, nodePerimeters, nodes, mapReady])

  /* ------------------------------------------------------------------
     MAP CONTROLS – custom UI placed over the map (high z‑index)
  ------------------------------------------------------------------ */
  const handleZoomIn = () => mapInstance.current?.zoomIn()
  const handleZoomOut = () => mapInstance.current?.zoomOut()
  const handleReset = () => {
    if (mapInstance.current) {
      mapInstance.current.flyTo([currentCenter.lat, currentCenter.lng], 10, {
        duration: 1,
      })
    }
  }
  const handleLocateUser = () => {
    const L = LRef.current
    if (!L) return
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        mapInstance.current?.flyTo([latitude, longitude], 15, {
          duration: 1.5,
        })

        // temporary “you are here” marker
        const icon = L.divIcon({
          className: 'user-location-marker',
          html: `
            <div style="
              width:20px;height:20px;
              background:#3498DB;
              border-radius:50%;
              border:3px solid white;
              box-shadow:0 0 30px rgba(52,152,219,0.6);
              position:relative;
            ">
              <div style="
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%);
                width:8px;height:8px;
                background:white;
                border-radius:50%;
                animation:userPulse 1.5s infinite;
              "></div>
            </div>
            <style>
              @keyframes userPulse{
                0%{transform:translate(-50%,-50%) scale(1);opacity:1;}
                100%{transform:translate(-50%,-50%) scale(3);opacity:0;}
              }
            </style>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        L.marker([latitude, longitude], {
          icon,
          pane: 'pointerPane',
        })
          .addTo(mapInstance.current!)
          .bindPopup('📍 Your location', { className: 'custom-popup' })
          .openPopup()
      },
      err => {
        alert('Unable to get your location – check browser permissions.')
        console.error(err)
      },
    )
  }

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */
  return (
    <div className="relative w-full h-full">
      {/* ------------------- MAP CANVAS (lowest z‑index) ------------------- */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden z-0"
        aria-label="Pollution monitoring map"
        role="application"
      />

      {/* ------------------- UI OVERLAYS (higher z‑index) ----------------- */}
      <div className="relative w-full h-full pointer-events-none">
        {/* Click‑mode hint */}
        {isClickMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-500/90 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-blue-400 shadow-lg flex items-center gap-2 pointer-events-auto">
            <Target className="w-4 h-4 text-white animate-pulse" />
            <span className="text-white text-sm font-medium">
              Click on the map to place a new node
            </span>
          </div>
        )}

        {/* Custom map controls – modern Tailwind styling */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000] pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleZoomOut}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleReset}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            aria-label="Reset view"
            title="Reset view"
          >
            <Compass className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={handleLocateUser}
            className="bg-gray-900/80 backdrop-blur-sm p-2.5 rounded-xl hover:bg-gray-800/90 transition-all border border-white/10 hover:border-white/20 shadow-lg group"
            aria-label="Locate me"
            title="Locate me"
          >
            <Navigation className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Bottom‑left node counter */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/60">
                Active: {nodes.filter(n => n.isActive).length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-white/60">
                Inactive: {nodes.filter(n => !n.isActive).length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">|</span>
              <span className="text-white/60">Sources: {sources.length}</span>
            </div>
          </div>
        </div>

        {/* Bottom‑right map info (zoom + coordinates) */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-gray-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 pointer-events-auto">
          <p className="text-[10px] text-white/40 font-mono">
            Zoom: {currentZoom.toFixed(1)} •{' '}
            {currentCenter.lat.toFixed(4)}, {currentCenter.lng.toFixed(4)}
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          Inline CSS – keeps the component self‑contained (no external .css)
      ------------------------------------------------------------------- */}
      <style>{`
        .leaflet-container{
          background:#1a1a2e;
          border-radius:16px;
        }
        /* Hard-enforced pane stacking. Leaflet sets each pane's z-index via
           inline style once, without !important, when the pane is created.
           These rules re-assert that order with !important so nothing else
           in the app's global CSS can push the perimeter circle or pointer
           markers underneath the tile layer. */
        .leaflet-tile-pane{ z-index: 200 !important; }
        .leaflet-overlay-pane{ z-index: 400 !important; }
        .leaflet-perimeterPane-pane{ z-index: 450 !important; }
        .leaflet-marker-pane{ z-index: 600 !important; }
        .leaflet-pointerPane-pane{ z-index: 650 !important; }
        .leaflet-tooltip-pane{ z-index: 650 !important; }
        .leaflet-popup-pane{ z-index: 700 !important; }
        /* The control container (attribution, and any leftover default
           control chrome) spans the FULL map. Leaflet ships this as
           pointer-events: none on the empty space so map clicks pass
           through to place a node, but without !important a global reset
           can flip that back to auto and silently swallow those clicks.
           Re-assert it here; only the actual control widgets (buttons,
           the attribution link) re-enable pointer-events so they stay
           clickable. */
        .leaflet-control-container{ pointer-events: none !important; }
        .leaflet-control-container .leaflet-top,
        .leaflet-control-container .leaflet-bottom{ pointer-events: none !important; }
        .leaflet-control-container .leaflet-control{ pointer-events: auto !important; }
        .leaflet-control-attribution{
          background:rgba(0,0,0,0.5)!important;
          color:rgba(255,255,255,0.3)!important;
          font-size:9px!important;
          padding:2px 8px!important;
        }
        .leaflet-control-attribution a{
          color:rgba(255,255,255,0.4)!important;
        }
        .leaflet-control-attribution a:hover{
          color:rgba(255,255,255,0.6)!important;
        }
        .leaflet-popup-content{
          margin:0!important;
          padding:0!important;
          min-width:200px;
        }
        .leaflet-popup-content-wrapper{
          border-radius:12px!important;
          overflow:hidden!important;
        }
        .custom-node-marker,.custom-source-marker{
          background:transparent!important;
          border:none!important;
        }
        .pulse-circle{animation:pulseRing 2s ease-in-out infinite;}
        @keyframes pulseRing{
          0%{opacity:.3;transform:scale(1);}
          50%{opacity:.1;transform:scale(1.1);}
          100%{opacity:.3;transform:scale(1);}
        }
        .click-indicator{pointer-events:none!important;}
        .radius-label-marker{pointer-events:none!important;}
        .leaflet-interactive{cursor:pointer;}
        .leaflet-container{touch-action:none!important;}
        .pointer-events-auto{pointer-events:auto!important;}
      `}</style>
    </div>
  )
}

/* Export default for convenience */
export default PollutionMap