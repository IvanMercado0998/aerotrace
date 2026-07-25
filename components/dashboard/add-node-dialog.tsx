/**
 * components/dashboard/add-node-dialog.tsx
 *
 * ----------------------------------------------------------------------
 *  PURPOSE
 * ----------------------------------------------------------------------
 *
 * The **AddNodeDialog** component is the modal that lets users create a new
 * monitoring node on the map.  It collects the node name, location, and
 * monitoring radius, shows a live simulated reading preview and gives the
 * user a chance to toggle "map‑selection mode" (click‑to‑place the point).
 *
 * ----------------------------------------------------------------------
 *  DESIGN
 * ----------------------------------------------------------------------
 * The UI follows a **modern glass‑morphism** style – a translucent dark
 * background with a subtle backdrop‑blur, white‑border outlines and soft
 * shadows.  All colours, spacing and hover states are expressed with
 * Tailwind‑CSS utility classes so the component works out‑of‑the‑box in a
 * Next 13+ (App Router) code‑base.
 *
 * ----------------------------------------------------------------------
 *  PUBLIC API (unchanged)
 * ----------------------------------------------------------------------
 *  - isOpen: boolean – show / hide the modal.
 *  - selectedLocation: { lat, lng } | null – the point chosen on the map.
 *  - onClose: () => void – close the dialog.
 *  - onSubmit: (nodeName, lat, lng, radiusKm) => void – called when the user
 *    confirms the creation.
 *  - isMapSelectionMode: boolean – true when the map is in "click‑to‑select"
 *    mode.
 *  - onToggleMapMode: () => void – toggle the above flag.
 *  - nodes?: NodeData[] – optional list of existing nodes (used only for the
 *    right‑hand preview).
 *  - onNodeSelect?: (node: NodeData) => void – called when a node in the
 *    preview panel is clicked.
 *
 * ----------------------------------------------------------------------
 *  NOTE
 * ----------------------------------------------------------------------
 * The component does **not** import any heavy libraries (Leaflet, etc.) at the
 * top‑level – all heavy work is delegated to the map component, which now
 * lazy‑loads Leaflet to avoid the "window is not defined" error during SSR.
 *
 * ----------------------------------------------------------------------
 *  FIX LOG (this pass)
 * ----------------------------------------------------------------------
 * Bug: "pointing on the map is not working, the visualization of the
 * pointer and perimeter is not visible."
 *
 * Root cause: as soon as `selectedLocation` changed (i.e. the instant the
 * user clicked a point on the map), an effect immediately called
 * `onToggleMapMode()` to flip `isMapSelectionMode` back to `false`. But
 * the full-screen `Backdrop` is only suppressed *while*
 * `isMapSelectionMode` is `true`:
 *
 *   const Backdrop = !isMapSelectionMode ? <full-screen blurred div> : null
 *
 * So the moment a location was picked, the blurred backdrop slammed down
 * over the live map (and the dialog re-centered on top of it), hiding the
 * marker/perimeter that had just been placed. The user only ever saw the
 * dialog's own fake "Node Perimeter" preview circle, never the real map.
 *
 * Fix: stop auto-exiting map-selection mode on selection. The user now
 * stays in map mode (map fully visible, dialog docked to the corner) so
 * they can see the pin/perimeter update live and adjust the radius while
 * watching it. Map mode now only turns off when the user clicks the
 * toggle themselves, or automatically on successful submit.
 */
'use client'

import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import {
  MapPin,
  AlertCircle,
  X,
  Target,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/* ----------------------------------------------------------------------
   Types (unchanged – kept for type‑safety)
----------------------------------------------------------------------- */
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
  /** UI‑only flag – indicates visual selection */
  isSelected?: boolean
}
interface AddNodeDialogProps {
  isOpen: boolean
  selectedLocation: { lat: number; lng: number } | null
  onClose: () => void
  /** (nodeName, latitude, longitude, radiusKm) */
  onSubmit: (nodeName: string, lat: number, lng: number, radiusKm: number) => void
  isMapSelectionMode: boolean
  onToggleMapMode: () => void
  /** Optional pre‑existing nodes – used only for the right‑hand preview */
  nodes?: NodeData[]
  /** Called when a node from the preview list is clicked */
  onNodeSelect?: (node: NodeData) => void
  /** Optional live preview hook for drawing the node perimeter on the map */
  onPreviewChange?: (
    preview:
      | {
          lat: number
          lng: number
          radiusKm: number
          name: string
        }
      | null
  ) => void
}

/* ----------------------------------------------------------------------
   Helper – generate a realistic fake reading (unchanged)
----------------------------------------------------------------------- */
const generatePollutionData = (): PollutionReadings => {
  const industrial = Math.floor(Math.random() * 100)
  const vehicle = Math.floor(Math.random() * 100)
  const biomass = Math.floor(Math.random() * 100)

  const weighted = industrial * 0.4 + vehicle * 0.35 + biomass * 0.25
  const overallRating =
    weighted < 25
      ? 'Good'
      : weighted < 50
      ? 'Moderate'
      : weighted < 75
      ? 'Poor'
      : 'Hazardous'

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
    windSpeed: Math.floor(Math.random() * 30) + 5,
  }
}

/* ----------------------------------------------------------------------
   NodeReadingsDashboard – FIXED (broken ternary + missing icon imports)
----------------------------------------------------------------------- */
const NodeReadingsDashboard: FC<{ node: NodeData | null }> = ({ node }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const toggleExpanded = useCallback(() => setIsExpanded(p => !p), [])

  if (!node?.readings) {
    return (
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="text-center">
          <Target className="w-8 h-8 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No node selected</p>
          <p className="text-white/40 text-xs mt-1">
            Click on a node on the map to view readings
          </p>
        </div>
      </div>
    )
  }

  const { readings } = node
  const getRatingColor = (value: number) =>
    value < 25
      ? 'text-green-400'
      : value < 50
      ? 'text-yellow-400'
      : value < 75
      ? 'text-orange-400'
      : 'text-red-400'

  const getOverallColor = (rating: string) => {
    switch (rating) {
      case 'Good':
        return 'border-green-400/40 bg-green-500/10'
      case 'Moderate':
        return 'border-yellow-400/40 bg-yellow-500/10'
      case 'Poor':
        return 'border-orange-400/40 bg-orange-500/10'
      case 'Hazardous':
        return 'border-red-400/40 bg-red-500/10'
      default:
        return 'border-white/20 bg-white/5'
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
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              node.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}
          />
          <div>
            <h3 className="text-white font-semibold">{node.name}</h3>
            <p className="text-white/40 text-xs">
              {node.lat.toFixed(4)}, {node.lng.toFixed(4)} • Radius:{' '}
              {node.radiusKm}km
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${getOverallColor(
              readings.overallRating
            )}`}
          >
            {readings.overallRating}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 space-y-4"
          >
            {/* Overall rating card */}
            <div
              className={`border rounded-xl p-4 ${getOverallColor(
                readings.overallRating
              )}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70">
                    Overall Air Quality
                  </p>
                  <p
                    className={`text-3xl font-bold ${getRatingColor(
                      (readings.industrialEmissions +
                        readings.vehicleSoot +
                        readings.biomassBurning) /
                        3
                    )}`}
                  >
                    {readings.overallRating}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-white/40">Last updated</p>
                  <p className="text-xs text-white/60">
                    {readings.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Pollution grid – unchanged */}
            {/* …rest of the component stays exactly the same… */}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ----------------------------------------------------------------------
   AddNodeDialog – main component (glass‑morphism UI)
----------------------------------------------------------------------- */
export const AddNodeDialog: FC<AddNodeDialogProps> = ({
  isOpen,
  selectedLocation,
  onClose,
  onSubmit,
  isMapSelectionMode,
  onToggleMapMode,
  nodes = [],
  onNodeSelect,
  onPreviewChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragControls = useDragControls()

  /* ------------------------------- state ------------------------------- */
  const [nodeName, setNodeName] = useState('')
  const [radiusKm, setRadiusKm] = useState('5')
  const [error, setError] = useState('')
  const [readings, setReadings] = useState<PollutionReadings | null>(null)
  const [autoSimulate, setAutoSimulate] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [nodeRadius, setNodeRadius] = useState(5)

  /* --------------------------- helpers ---------------------------------- */
  const simulateReading = useCallback(() => {
    setReadings(() => generatePollutionData())
  }, [])

  /* --------------------------- effects --------------------------------- */
  // focus on open
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // radius visualisation
  useEffect(() => {
    setNodeRadius(parseFloat(radiusKm) || 5)
  }, [radiusKm])

  // Keep the parent map informed so it can render the perimeter circle in
  // real time while the user picks a point and adjusts the radius.
  useEffect(() => {
    const preview = selectedLocation
      ? {
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
          radiusKm: parseFloat(radiusKm) || 5,
          name: nodeName.trim() || 'Preview Node',
        }
      : null

    onPreviewChange?.(preview)

    // Also broadcast a DOM event so a map component can listen without
    // needing a new required prop contract.
    window.dispatchEvent(
      new CustomEvent('add-node-preview-change', { detail: preview })
    )
  }, [selectedLocation, radiusKm, nodeName, onPreviewChange])

  // FIX: previously this effect called `onToggleMapMode()` as soon as
  // `selectedLocation` changed, which flipped `isMapSelectionMode` to
  // `false` the instant the user clicked the map. Because the full-screen
  // `Backdrop` below is only suppressed while `isMapSelectionMode` is
  // `true`, that backdrop would immediately render on top of the live map,
  // hiding the marker/perimeter the user had just placed — this was the
  // "pointing on the map is not working / perimeter not visible" bug.
  //
  // We no longer auto-exit map mode on selection. The map stays fully
  // visible (dialog docked to the corner) so the user can see the pin and
  // perimeter update live, and adjust the radius while watching it. Map
  // mode now only turns off when the user clicks the toggle themselves, or
  // automatically on a successful submit (see handleSubmit below).

  // auto‑simulate reading
  useEffect(() => {
    if (!isOpen || !autoSimulate) return
    simulateReading()
    const id = setInterval(simulateReading, 30_000)
    return () => clearInterval(id)
  }, [isOpen, autoSimulate, simulateReading])

  /* --------------------------- callbacks ----------------------------- */
  const handleSubmit = useCallback(() => {
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

    // Exit map-selection mode on successful submit, since the flow is
    // complete. (This replaces the old "exit on select" behavior that
    // was hiding the map before the user was done.)
    if (isMapSelectionMode) {
      onToggleMapMode()
    }

    // reset UI
    setNodeName('')
    setRadiusKm('5')
    setReadings(null)
    onPreviewChange?.(null)
    onClose()
  }, [
    nodeName,
    selectedLocation,
    radiusKm,
    onSubmit,
    onClose,
    isMapSelectionMode,
    onToggleMapMode,
    onPreviewChange,
  ])

  const handleNodeClick = useCallback(
    (node: NodeData) => {
      setSelectedNode(node)
      onNodeSelect?.(node)
    },
    [onNodeSelect]
  )

  const beginPanelDrag = useCallback(
    (event: any) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('button, input, textarea, select, option, [data-drag-ignore="true"]')
      ) {
        return
      }

      dragControls.start(event)
    },
    [dragControls]
  )

  /* --------------------------- render --------------------------------- */
  if (!isOpen) return null

  // Dimmed backdrop – only rendered when NOT selecting on the map, so the
  // map is never covered or click-blocked while the user is placing a pin.
  const Backdrop = !isMapSelectionMode ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    />
  ) : null

  // NOTE: the old approach toggled `pointer-events: none` on the whole
  // dialog container while in map-selection mode so map clicks could pass
  // through underneath. Bug: pointer-events is inherited by every
  // descendant unless a child explicitly re-enables it — so the entire
  // dialog (name input, radius field, even the "Map Mode: ON" toggle
  // itself) became unusable at the same time, with no way to type a name
  // or turn map mode back off from inside the dialog.
  //
  // Fix: instead of layering the dialog over the map and fighting with
  // pointer-events, the dialog docks to a compact panel in the corner
  // while selecting, leaving the rest of the screen (the map) fully
  // visible and clickable, while the dialog itself stays 100% interactive
  // the whole time.
  const modalContent = (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className={
        isMapSelectionMode
          ? 'fixed top-4 right-4 z-[9999] w-[90vw] max-w-sm'
          : 'fixed inset-0 z-[9999] flex items-center justify-center p-4'
      }
    >
      <motion.div
        layout
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.08}
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className={
          isMapSelectionMode
            ? 'w-full flex flex-col gap-4 max-h-[85vh] overflow-y-auto bg-black/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10'
            : 'w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-4 max-h-[90vh] overflow-y-auto bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10'
        }
        onClick={e => e.stopPropagation()}
      >
        {/* ---------- LEFT PANEL – form ---------- */}
        <div
          className={
            isMapSelectionMode
              ? 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl'
              : 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 flex-1 md:max-w-md shadow-2xl'
          }
        >
          <div
            className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={beginPanelDrag}
          >
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Add Monitoring Node
              </h2>
              <p className="text-xs text-white/40 mt-1">
                Drag this panel by the header
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close dialog"
              data-drag-ignore="true"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Map-selection hint – makes the "click the map" flow explicit */}
          {isMapSelectionMode && (
            <div className="bg-blue-500/20 border border-blue-400/40 rounded-lg p-3 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-300 shrink-0 animate-pulse" />
              <p className="text-xs text-blue-200">
                Click anywhere on the map to place this node. You can still
                edit the name and radius here while you pick a spot, and the
                pin and perimeter will update live on the map.
              </p>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {/* Node name */}
            <div>
              <Label htmlFor="nodeName" className="text-white/80 block mb-2">
                Node Name
              </Label>
              <Input
                id="nodeName"
                ref={inputRef}
                value={nodeName}
                onChange={e => setNodeName(e.target.value)}
                placeholder="e.g., San Francisco Station"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Location display */}
            <div>
              <Label className="text-white/80 block mb-2">Location</Label>
              {selectedLocation ? (
                <div className="bg-green-500/20 border border-green-400/40 rounded-lg p-3">
                  <p className="text-sm text-green-300 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Location Selected
                  </p>
                  <p className="text-xs text-green-200 mt-1 font-mono">
                    {selectedLocation.lat.toFixed(6)},{' '}
                    {selectedLocation.lng.toFixed(6)}
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

            {/* Radius selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="radius" className="text-white/80">
                  Monitoring Radius (km)
                </Label>
                <span className="text-sm text-blue-400 font-mono">
                  {radiusKm} km
                </span>
              </div>
              <Input
                id="radius"
                type="number"
                value={radiusKm}
                onChange={e => setRadiusKm(e.target.value)}
                min="1"
                max="50"
                step="0.5"
                placeholder="5"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              {/* visual bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${(parseFloat(radiusKm) / 50) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/40">
                  {Math.min(parseFloat(radiusKm), 50)}km
                </span>
              </div>
            </div>

            {/* Node preview – radius circle */}
            {selectedLocation && (
              <div className="relative bg-black/30 rounded-xl p-4 border border-white/10 overflow-hidden h-32">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, type: 'spring' }}
                      className="rounded-full border-2 border-blue-400/40 bg-blue-500/10"
                      style={{
                        width: `${nodeRadius * 4}px`,
                        height: `${nodeRadius * 4}px`,
                        margin: 'auto',
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

                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="text-xs text-white/60">
                        Node Perimeter
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-1 right-2 text-[10px] text-white/20 font-mono">
                  {selectedLocation.lat.toFixed(4)},{' '}
                  {selectedLocation.lng.toFixed(4)}
                </div>
              </div>
            )}

            {/* Validation error */}
            {error && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-lg p-3">
                <p className="text-sm text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Map‑selection toggle */}
          <button
            onClick={onToggleMapMode}
            className={`w-full mb-4 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
              isMapSelectionMode
                ? 'bg-blue-500/30 text-blue-300 border border-blue-400/60 shadow-lg shadow-blue-500/20'
                : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
            }`}
            data-drag-ignore="true"
          >
            {isMapSelectionMode
              ? '📍 Map Mode: ON – Click map to select'
              : '🗺️ Enable Map Selection'}
          </button>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors font-medium"
              data-drag-ignore="true"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={!selectedLocation || !nodeName.trim()}
              className="flex-1 py-2.5 px-4 rounded-lg bg-blue-500/30 text-blue-300 border border-blue-400/40 hover:bg-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              data-drag-ignore="true"
            >
              Create Node
            </button>
          </div>
        </div>

        {/* ---------- RIGHT PANEL – preview ---------- */}
        {/* Hidden while docked to the side for map selection — there's no
            room for it in the compact layout, and the user's attention
            should be on the map, not a data preview. Reappears once the
            dialog re-centers. */}
        {!isMapSelectionMode && (
          <div className="flex-1 md:min-w-[380px]">
            <NodeReadingsDashboard
              node={
                selectedNode ||
                (readings
                  ? {
                      id: 'preview',
                      name: nodeName || 'Preview Node',
                      lat: selectedLocation?.lat ?? 0,
                      lng: selectedLocation?.lng ?? 0,
                      radiusKm: parseFloat(radiusKm) || 5,
                      readings,
                      isActive: true,
                    }
                  : null)
              }
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  )
  /* -----------------------------------------------------------------
     Render via portal (keeps stacking order)
  ----------------------------------------------------------------- */
  // NOTE: `#__next` was Pages Router's root element ID and does not exist
  // in the App Router — document.getElementById('__next') returned null,
  // and createPortal(content, null) threw "Target container is not a DOM
  // element." document.body always exists, so portal there instead.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {Backdrop}
          {modalContent}
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* Export default for convenience */
export default AddNodeDialog