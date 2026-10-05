// components/dashboard/location-search.tsx
// DO NOT CHANGE LOGIC CALLS
// professional description of the component, its purpose, and how it is used in the dashboard. Include details about its props, state management, and any external libraries or components it relies on.
//
// LocationSearch is a dashboard search panel that lets a user look up a real-world place and
// inspect simulated pollution sources / environmental hazards for that location.
//
// Search protocol: OpenStreetMap geocoding, blended across two providers for broad coverage:
//   1. Photon (https://photon.komoot.io/api) — a typo-tolerant, autocomplete-oriented geocoder
//      built on OSM data. Used as the primary "search as you type" source since it matches
//      partial words and doesn't require an exact/well-formed place name.
//   2. Nominatim (https://nominatim.openstreetmap.org/search) — the canonical OSM search API.
//      Used as a fallback whenever Photon returns nothing.
// If both providers come back empty for the literal query, the query is progressively broadened
// (dropping the most specific comma-separated segment, e.g. a street or barangay) and retried,
// so a hyper-specific or slightly-off query still surfaces the nearest sensible matches instead
// of a dead end. When a broadened term is what actually produced the results, the UI says so.
//
// Requests are debounced (350ms) and cancelled via AbortController when the query changes.
// Nominatim's usage policy caps unauthenticated traffic at ~1 request/second and asks for an
// identifiable client — for production traffic beyond light/demo usage, proxy these requests
// through your own backend with a proper `email=` / custom domain, or use a hosted Nominatim
// instance, rather than calling nominatim.openstreetmap.org directly from the browser at scale.
// Photon (komoot.io) is a free public demo instance with similar fair-use expectations.
//
// Props:
//   - onSearch(lat, lng, location): called when the user selects a search result or their
//     current location. `location` is the enriched Location object (address + simulated
//     pollution/hazard/AQI data).
//   - onClose(): called when the panel is dismissed.
//   - isOpen: controls the panel's mount/animate state.
//
// State: query text, in-flight results, loading flags, broadened-search notice, and the
// currently selected location's detail panel. Pollution/hazard/AQI figures remain client-side
// simulated data (see generatePollutionData) since no live emissions API is wired in — only the
// place search itself is backed by real geocoding protocols.
//
// External libraries: framer-motion (animation), lucide-react (icon set).

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
  Gauge,
  Flame,
  Droplets,
  Cloud,
  Sun,
  CloudRain,
  ChevronRight,
  Utensils,
  Coffee,
  ShoppingBag,
  Landmark,
  GraduationCap,
  Fuel,
  BedDouble,
  Church,
  Plane,
  ParkingCircle,
  Stethoscope,
  Banknote,
  Building2,
  Mountain,
  Waves,
  Compass,
  SearchX,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Location {
  name: string
  lat: number
  lng: number
  type: string
  category?: string
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

interface SearchBias {
  center?: { lat: number; lng: number }
  bounds?: { west: number; south: number; east: number; north: number }
  countryCodes?: string[]
}

interface LocationSearchProps {
  onSearch: (lat: number, lng: number, location: Location) => void
  onClose: () => void
  isOpen: boolean
  /** Optional viewport / map bias to make the search feel more like Google Maps */
  searchBias?: SearchBias
}

// Shape returned by Nominatim's /search and /reverse endpoints (jsonv2)
interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  name?: string
  type: string
  class: string
  importance?: number
  address?: Record<string, string>
}

// Shape returned by Photon's /api endpoint (GeoJSON FeatureCollection)
interface PhotonFeature {
  geometry: { coordinates: [number, number] } // [lon, lat]
  properties: {
    name?: string
    osm_key?: string
    osm_value?: string
    country?: string
    state?: string
    city?: string
    district?: string
    street?: string
    postcode?: string
  }
}

// Unified, provider-agnostic search result used throughout the UI
interface PlaceResult {
  id: string
  name: string
  subtitle: string
  displayAddress: string
  lat: number
  lng: number
  osmClass: string
  osmType: string
  source: 'photon' | 'nominatim'
}

// ---------------------------------------------------------------------------
// OpenStreetMap geocoding protocols: Google-like search stack
// ---------------------------------------------------------------------------
//
// Strategy:
//   1) Detect direct coordinate input and reverse geocode immediately.
//   2) Try Photon first for autocomplete/fuzzy matching with map bias.
//   3) Only fall back to Nominatim when Photon cannot produce a good answer.
//   4) Broaden the query progressively when the literal phrase is too specific.
//   5) Rank results by text match quality and proximity to the map bias so the
//      top results feel closer to Google Maps.
//
// Notes:
//   - Photon supports location bias and bounding-box filtering.
//   - Nominatim supports free-form and structured search. The OSM project asks
//     for low request rates on the public service, so this implementation keeps
//     Nominatim as a fallback rather than calling it on every keystroke.
// ---------------------------------------------------------------------------

const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'

const DEFAULT_SEARCH_BIAS: Required<Pick<SearchBias, 'center' | 'bounds' | 'countryCodes'>> = {
  center: { lat: 15.4, lng: 121.0 }, // Luzon-friendly default bias for this dashboard
  bounds: { west: 119.0, south: 13.0, east: 122.8, north: 18.9 },
  countryCodes: ['ph'],
}

const ABBREVIATIONS: Record<string, string> = {
  st: 'saint',
  mt: 'mount',
  mtn: 'mountain',
  brgy: 'barangay',
  bgy: 'barangay',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  blvd: 'boulevard',
  hwy: 'highway',
  ext: 'extension',
  extn: 'extension',
  pque: 'parañaque',
  qc: 'quezon city',
  mnl: 'manila',
  ph: 'philippines',
}

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeQuery(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s,.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandAbbreviations(value: string): string {
  const words = value.split(/\s+/)
  const expanded = words.map(word => {
    const cleaned = word.replace(/[^\p{L}\p{N}.-]/gu, '')
    const hit = ABBREVIATIONS[cleaned]
    return hit ?? word
  })
  return expanded.join(' ')
}

function tokenizeQuery(value: string): string[] {
  return normalizeQuery(value)
    .split(/[\s,.-]+/)
    .map(token => token.trim())
    .filter(Boolean)
}

function broadenQuery(query: string): string | null {
  const normalized = query.trim().replace(/\s+/g, ' ')
  const commaSegments = normalized
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (commaSegments.length > 1) {
    return commaSegments.slice(1).join(', ')
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 2) {
    return words.slice(1).join(' ')
  }

  if (words.length === 2) {
    return `${words[1]} ${words[0]}`
  }

  return null
}

function buildQueryVariants(rawQuery: string): string[] {
  const original = rawQuery.trim()
  const normalized = normalizeQuery(original)
  const expanded = expandAbbreviations(normalized)

  const variants = [
    original,
    normalized,
    expanded,
  ]

  const commaSegments = normalized.split(',').map(s => s.trim()).filter(Boolean)
  if (commaSegments.length > 1) {
    variants.push(commaSegments.slice().reverse().join(', '))
    variants.push(commaSegments.slice(1).join(', '))
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    variants.push(words.join(' '))
    variants.push(words.slice().reverse().join(' '))
    variants.push(words.slice(1).join(' '))
    variants.push(words.filter(w => w.length > 1).join(' '))
  }

  return Array.from(new Set(variants.filter(Boolean).map(v => v.trim()))).slice(0, 8)
}

function parseCoordinateQuery(rawQuery: string): { lat: number; lng: number } | null {
  const q = rawQuery.trim()

  // "14.5995, 120.9842" or "14.5995 120.9842"
  const pair = q.match(
    /^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*[, ]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/
  )
  if (pair) {
    const lat = parseFloat(pair[1])
    const lng = parseFloat(pair[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }

  // "lat: 14.6 lng: 120.9"
  const labeled = q.match(
    /lat(?:itude)?\s*[:=]?\s*([+-]?\d{1,2}(?:\.\d+)?)\D+lng(?:itude)?\s*[:=]?\s*([+-]?\d{1,3}(?:\.\d+)?)/i
  )
  if (labeled) {
    const lat = parseFloat(labeled[1])
    const lng = parseFloat(labeled[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }

  return null
}

function parseStructuredAddress(query: string): Partial<{
  street: string
  city: string
  county: string
  state: string
  country: string
  postalcode: string
  amenity: string
}> | null {
  const parts = query.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const out: Partial<{
    street: string
    city: string
    county: string
    state: string
    country: string
    postalcode: string
    amenity: string
  }> = {}

  if (parts.length === 2) {
    out.street = parts[0]
    out.city = parts[1]
  } else if (parts.length === 3) {
    out.street = parts[0]
    out.city = parts[1]
    out.state = parts[2]
  } else {
    out.street = parts[0]
    out.city = parts[1]
    out.state = parts[2]
    out.country = parts[parts.length - 1]
  }

  return out
}

function buildMapBias(searchBias?: SearchBias) {
  const center = searchBias?.center ?? DEFAULT_SEARCH_BIAS.center
  const bounds = searchBias?.bounds ?? DEFAULT_SEARCH_BIAS.bounds
  const countryCodes = searchBias?.countryCodes?.length ? searchBias.countryCodes : DEFAULT_SEARCH_BIAS.countryCodes

  return { center, bounds, countryCodes }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function scoreResult(result: PlaceResult, rawQuery: string, biasCenter?: { lat: number; lng: number }): number {
  const query = normalizeQuery(rawQuery)
  const queryTokens = tokenizeQuery(query)
  const haystack = normalizeQuery(
    [result.name, result.subtitle, result.displayAddress, result.osmClass, result.osmType]
      .filter(Boolean)
      .join(' ')
  )

  let score = 0

  if (haystack === query) score += 120
  if (haystack.startsWith(query)) score += 90
  if (haystack.includes(query)) score += 60

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 10
    if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack)) score += 6
  }

  if (result.source === 'photon') score += 4
  if (result.osmClass === 'place') score += 4
  if (['amenity', 'shop', 'tourism', 'building'].includes(result.osmClass)) score += 3

  if (biasCenter) {
    const distance = haversineKm(biasCenter, { lat: result.lat, lng: result.lng })
    score += Math.max(0, 24 - distance)
  }

  return score
}

function rankAndDedupe(results: PlaceResult[], rawQuery: string, biasCenter?: { lat: number; lng: number }): PlaceResult[] {
  const seen = new Set<string>()
  const unique = results.filter(result => {
    const key = `${result.lat.toFixed(4)},${result.lng.toFixed(4)}|${normalizeQuery(result.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return unique
    .map(result => ({ result, score: scoreResult(result, rawQuery, biasCenter) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.result)
}

async function searchPhoton(query: string, signal: AbortSignal, bias?: SearchBias): Promise<PlaceResult[]> {
  const mapBias = buildMapBias(bias)
  const params = new URLSearchParams({
    q: query,
    limit: '12',
    lang: 'en',
    location_bias_scale: '0.8',
  })

  if (mapBias.center) {
    params.set('lat', String(mapBias.center.lat))
    params.set('lon', String(mapBias.center.lng))
    params.set('zoom', '12')
  }

  if (mapBias.bounds) {
    params.set(
      'bbox',
      `${mapBias.bounds.west},${mapBias.bounds.south},${mapBias.bounds.east},${mapBias.bounds.north}`
    )
  }

  if (mapBias.countryCodes?.length) {
    params.set('countrycode', mapBias.countryCodes[0])
  }

  const response = await fetch(`${PHOTON_SEARCH_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw new Error(`Photon search failed: ${response.status}`)

  const data: { features: PhotonFeature[] } = await response.json()

  return (data.features || [])
    .filter(f => f.properties?.name)
    .map((f, idx) => {
      const p = f.properties
      const addressParts = [p.street, p.district, p.city, p.state, p.country].filter(Boolean)
      return {
        id: `photon-${idx}-${f.geometry.coordinates.join(',')}`,
        name: p.name || 'Unnamed place',
        subtitle: addressParts.slice(0, 3).join(', '),
        displayAddress: [p.name, ...addressParts].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        osmClass: p.osm_key || 'place',
        osmType: p.osm_value || 'locality',
        source: 'photon' as const,
      }
    })
}

async function searchNominatim(query: string, signal: AbortSignal, bias?: SearchBias): Promise<PlaceResult[]> {
  const mapBias = buildMapBias(bias)
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    dedupe: '1',
    'accept-language': 'en',
    extratags: '1',
    namedetails: '1',
  })

  if (mapBias.countryCodes?.length) {
    params.set('countrycodes', mapBias.countryCodes.join(','))
  }

  if (mapBias.bounds) {
    // Nominatim viewbox boosts results in the area; it does not hard-filter unless bounded=1.
    params.set(
      'viewbox',
      `${mapBias.bounds.west},${mapBias.bounds.north},${mapBias.bounds.east},${mapBias.bounds.south}`
    )
  }

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw new Error(`Nominatim search failed: ${response.status}`)

  const data: NominatimResult[] = await response.json()

  return data.map(item => {
    const name = item.name?.trim() || item.display_name.split(',')[0].trim()
    const parts = item.display_name.split(',').map(p => p.trim())
    return {
      id: `nominatim-${item.place_id}`,
      name,
      subtitle: parts.slice(1, 4).join(', '),
      displayAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      osmClass: item.class,
      osmType: item.type,
      source: 'nominatim' as const,
    }
  })
}

async function searchNominatimStructured(
  structured: Partial<{
    street: string
    city: string
    county: string
    state: string
    country: string
    postalcode: string
    amenity: string
  }>,
  signal: AbortSignal,
  bias?: SearchBias
): Promise<PlaceResult[]> {
  const mapBias = buildMapBias(bias)
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    dedupe: '1',
    'accept-language': 'en',
    extratags: '1',
    namedetails: '1',
  })

  for (const [key, value] of Object.entries(structured)) {
    if (value) params.set(key, value)
  }

  if (mapBias.countryCodes?.length && !structured.country) {
    params.set('countrycodes', mapBias.countryCodes.join(','))
  }

  if (mapBias.bounds) {
    params.set(
      'viewbox',
      `${mapBias.bounds.west},${mapBias.bounds.north},${mapBias.bounds.east},${mapBias.bounds.south}`
    )
  }

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw new Error(`Nominatim structured search failed: ${response.status}`)

  const data: NominatimResult[] = await response.json()

  return data.map(item => {
    const name = item.name?.trim() || item.display_name.split(',')[0].trim()
    const parts = item.display_name.split(',').map(p => p.trim())
    return {
      id: `nominatim-${item.place_id}`,
      name,
      subtitle: parts.slice(1, 4).join(', '),
      displayAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      osmClass: item.class,
      osmType: item.type,
      source: 'nominatim' as const,
    }
  })
}

async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  })

  const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) return null
  const item: NominatimResult = await response.json()
  if (!item || !item.lat) return null

  const name = item.name?.trim() || item.display_name.split(',')[0].trim()
  const parts = item.display_name.split(',').map((p) => p.trim())
  return {
    id: `nominatim-${item.place_id}`,
    name,
    subtitle: parts.slice(1, 4).join(', '),
    displayAddress: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    osmClass: item.class,
    osmType: item.type,
    source: 'nominatim' as const,
  }
}

interface SearchOutcome {
  results: PlaceResult[]
  usedQuery: string
  wasBroadened: boolean
}

// Thrown when neither provider could even be reached (network/CORS/CSP/offline), as opposed
// to being reached successfully and legitimately returning zero matches. The UI treats these
// two cases very differently — one is "no such place", the other is "search is broken".
class ProvidersUnreachableError extends Error {
  constructor(public photonReason: unknown, public nominatimReason: unknown) {
    super('providers-unreachable')
    this.name = 'ProvidersUnreachableError'
  }
}

async function searchPlacesSmart(
  rawQuery: string,
  signal: AbortSignal,
  bias?: SearchBias
): Promise<SearchOutcome> {
  const trimmed = rawQuery.trim()
  const variants = buildQueryVariants(trimmed)
  const mapBias = buildMapBias(bias)

  // 1) Coordinates: immediate reverse geocode, just like Google Maps accepts pasted coords.
  const coordinates = parseCoordinateQuery(trimmed)
  if (coordinates) {
    const reverse = await reverseGeocode(coordinates.lat, coordinates.lng, signal)
    if (reverse) {
      return { results: [reverse], usedQuery: trimmed, wasBroadened: false }
    }
  }

  // 2) Photon first: autocomplete/fuzzy search with map bias.
  let photonError: unknown = null
  for (const variant of variants) {
    try {
      const photonResults = await searchPhoton(variant, signal, mapBias)
      if (photonResults.length > 0) {
        return {
          results: rankAndDedupe(photonResults, trimmed, mapBias.center),
          usedQuery: variant,
          wasBroadened: variant !== trimmed,
        }
      }
    } catch (err) {
      photonError = err
      break
    }
  }

  // 3) Nominatim fallback: use structured search when the query looks like an address,
  //    otherwise use free-form search. This keeps the request count low and respects the
  //    public service guidance to avoid heavy use.
  let nominatimError: unknown = null

  const structured = parseStructuredAddress(trimmed)
  if (structured) {
    try {
      const structuredResults = await searchNominatimStructured(structured, signal, mapBias)
      if (structuredResults.length > 0) {
        return {
          results: rankAndDedupe(structuredResults, trimmed, mapBias.center),
          usedQuery: trimmed,
          wasBroadened: false,
        }
      }
    } catch (err) {
      nominatimError = err
    }
  }

  try {
    const freeform = await searchNominatim(variants[0] ?? trimmed, signal, mapBias)
    if (freeform.length > 0) {
      return {
        results: rankAndDedupe(freeform, trimmed, mapBias.center),
        usedQuery: variants[0] ?? trimmed,
        wasBroadened: variants[0] !== trimmed,
      }
    }
  } catch (err) {
    nominatimError = err
  }

  // 4) Final broadened retry, but only once, to keep the experience responsive.
  const broadened = broadenQuery(trimmed)
  if (broadened && broadened !== trimmed) {
    try {
      const broadPhoton = await searchPhoton(broadened, signal, mapBias)
      if (broadPhoton.length > 0) {
        return {
          results: rankAndDedupe(broadPhoton, trimmed, mapBias.center),
          usedQuery: broadened,
          wasBroadened: true,
        }
      }
    } catch (err) {
      photonError = photonError ?? err
    }

    try {
      const broadNominatim = await searchNominatim(broadened, signal, mapBias)
      if (broadNominatim.length > 0) {
        return {
          results: rankAndDedupe(broadNominatim, trimmed, mapBias.center),
          usedQuery: broadened,
          wasBroadened: true,
        }
      }
    } catch (err) {
      nominatimError = nominatimError ?? err
    }
  }

  if (photonError && nominatimError) {
    console.error(
      '[LocationSearch] Both geocoding providers failed to respond.',
      '\nPhoton error:', photonError,
      '\nNominatim error:', nominatimError,
      '\nThis usually means the request never left the browser — check the Network tab for a ' +
        'CORS error, a blocked request (ad blocker / corporate proxy / VPN), a Content-Security-Policy ' +
        "connect-src directive that doesn't allow nominatim.openstreetmap.org / photon.komoot.io, " +
        'or that this is running in a sandboxed preview with no outbound network access.'
    )
    throw new ProvidersUnreachableError(photonError, nominatimError)
  }

  return { results: [], usedQuery: trimmed, wasBroadened: false }
}

// Map an OSM class/type pair to an Apple Maps-style category badge
function getCategoryInfo(osmClass: string, osmType: string): { icon: React.ReactNode; bg: string; label: string } {
  const iconProps = { className: 'w-4 h-4 text-white' }

  const table: Array<{ match: (c: string, t: string) => boolean; icon: React.ReactNode; bg: string; label: string }> = [
    { match: (c, t) => c === 'amenity' && ['restaurant', 'fast_food', 'food_court'].includes(t), icon: <Utensils {...iconProps} />, bg: 'bg-orange-500', label: 'Restaurant' },
    { match: (c, t) => c === 'amenity' && ['cafe', 'bar', 'pub'].includes(t), icon: <Coffee {...iconProps} />, bg: 'bg-amber-600', label: 'Cafe & Bar' },
    { match: (c, t) => c === 'amenity' && ['bank', 'atm'].includes(t), icon: <Banknote {...iconProps} />, bg: 'bg-emerald-600', label: 'Bank' },
    { match: (c, t) => c === 'amenity' && ['hospital', 'clinic', 'doctors', 'pharmacy'].includes(t), icon: <Stethoscope {...iconProps} />, bg: 'bg-red-500', label: 'Health' },
    { match: (c, t) => c === 'amenity' && ['school', 'university', 'college'].includes(t), icon: <GraduationCap {...iconProps} />, bg: 'bg-blue-500', label: 'Education' },
    { match: (c, t) => c === 'amenity' && t === 'place_of_worship', icon: <Church {...iconProps} />, bg: 'bg-indigo-500', label: 'Worship' },
    { match: (c, t) => c === 'amenity' && t === 'fuel', icon: <Fuel {...iconProps} />, bg: 'bg-sky-600', label: 'Fuel' },
    { match: (c, t) => c === 'amenity' && t === 'parking', icon: <ParkingCircle {...iconProps} />, bg: 'bg-blue-400', label: 'Parking' },
    { match: (c) => c === 'shop', icon: <ShoppingBag {...iconProps} />, bg: 'bg-pink-500', label: 'Shopping' },
    { match: (c, t) => c === 'tourism' && ['hotel', 'motel', 'guest_house', 'hostel'].includes(t), icon: <BedDouble {...iconProps} />, bg: 'bg-purple-500', label: 'Lodging' },
    { match: (c, t) => c === 'tourism' && ['attraction', 'museum', 'gallery'].includes(t), icon: <Landmark {...iconProps} />, bg: 'bg-amber-700', label: 'Attraction' },
    { match: (c, t) => c === 'leisure' && t === 'park', icon: <Trees {...iconProps} />, bg: 'bg-green-600', label: 'Park' },
    { match: (c, t) => c === 'natural' && ['water', 'bay', 'beach'].includes(t), icon: <Waves {...iconProps} />, bg: 'bg-cyan-500', label: 'Water' },
    { match: (c, t) => c === 'natural' && ['peak', 'volcano', 'ridge'].includes(t), icon: <Mountain {...iconProps} />, bg: 'bg-stone-500', label: 'Terrain' },
    { match: (c) => c === 'railway', icon: <Compass {...iconProps} />, bg: 'bg-blue-700', label: 'Transit' },
    { match: (c) => c === 'aeroway', icon: <Plane {...iconProps} />, bg: 'bg-sky-500', label: 'Airport' },
    { match: (c) => c === 'highway', icon: <Car {...iconProps} />, bg: 'bg-gray-500', label: 'Road' },
    { match: (c) => c === 'building', icon: <Building2 {...iconProps} />, bg: 'bg-slate-500', label: 'Building' },
    { match: (c) => c === 'place', icon: <MapPin {...iconProps} />, bg: 'bg-red-500', label: 'Place' },
  ]

  const hit = table.find((entry) => entry.match(osmClass, osmType))
  return hit ?? { icon: <MapPin {...iconProps} />, bg: 'bg-red-500', label: 'Place' }
}

// ---------------------------------------------------------------------------
// Simulated environmental enrichment (unchanged in spirit — no live emissions API wired in)
// ---------------------------------------------------------------------------

const generatePollutionData = (lat: number, lng: number): Location => {
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
        pm25: Math.floor(Math.random() * 60 + 10),
      },
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
        pm25: Math.floor(Math.random() * 40 + 5),
      },
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
        pm25: Math.floor(Math.random() * 30 + 5),
      },
    })
  }

  const hazards: EnvironmentalHazard[] = []
  if (Math.random() > 0.7) {
    hazards.push({
      type: 'flood',
      name: 'Flood Prone Area',
      risk: 'medium',
      description: 'Area near water bodies with moderate flood risk',
    })
  }

  if (Math.random() > 0.8) {
    hazards.push({
      type: 'landslide',
      name: 'Landslide Risk Zone',
      risk: 'low',
      description: 'Sloping terrain with potential landslide risk during heavy rain',
    })
  }

  const avgPollution = (industrialLevel + vehicleLevel + biomassLevel) / 3
  const aqi = Math.floor(avgPollution * 0.5 + 20)
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
      status,
    },
  }
}

function enrichLocation(base: Location): Location {
  const generated = generatePollutionData(base.lat, base.lng)
  return {
    ...base,
    pollutionSources: base.pollutionSources ?? generated.pollutionSources,
    environmentalHazards: base.environmentalHazards ?? generated.environmentalHazards,
    airQuality: base.airQuality ?? generated.airQuality,
  }
}

// ---------------------------------------------------------------------------
// Sub-components (Apple Maps styling: white cards, SF-style type, iOS blue/red accents)
// ---------------------------------------------------------------------------

const statusColors: Record<AirQualityData['status'], { text: string; bg: string }> = {
  good: { text: 'text-green-600', bg: 'bg-green-50 text-green-700' },
  moderate: { text: 'text-yellow-600', bg: 'bg-yellow-50 text-yellow-700' },
  unhealthy: { text: 'text-orange-600', bg: 'bg-orange-50 text-orange-700' },
  hazardous: { text: 'text-red-600', bg: 'bg-red-50 text-red-700' },
}

const PollutionSourcesDisplay: React.FC<{ location: Location }> = ({ location }) => {
  const [expanded, setExpanded] = useState(false)

  if (!location.pollutionSources || location.pollutionSources.length === 0) {
    return (
      <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl">
        <p className="text-xs text-green-700 flex items-center gap-2 font-medium">
          <Trees className="w-4 h-4" />
          No major pollution sources detected in this area
        </p>
      </div>
    )
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'industrial':
        return <Factory className="w-4 h-4 text-white" />
      case 'vehicle':
        return <Car className="w-4 h-4 text-white" />
      case 'biomass':
        return <Trees className="w-4 h-4 text-white" />
      case 'agricultural':
        return <Cloud className="w-4 h-4 text-white" />
      case 'mining':
        return <AlertTriangle className="w-4 h-4 text-white" />
      default:
        return <MapPin className="w-4 h-4 text-white" />
    }
  }

  const getSourceBg = (type: string) => {
    switch (type) {
      case 'industrial':
        return 'bg-purple-500'
      case 'vehicle':
        return 'bg-orange-500'
      case 'biomass':
        return 'bg-green-600'
      case 'agricultural':
        return 'bg-yellow-500'
      case 'mining':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-50 text-green-700'
      case 'medium':
        return 'bg-yellow-50 text-yellow-700'
      case 'high':
        return 'bg-red-50 text-red-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
      >
        <span className="text-xs font-semibold text-gray-700">
          {location.pollutionSources.length} pollution source{location.pollutionSources.length > 1 ? 's' : ''} detected
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
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
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getSourceBg(source.type)}`}>
                      {getSourceIcon(source.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{source.name}</p>
                      <p className="text-xs text-gray-500">{source.distance.toFixed(1)}km away</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityColor(source.severity)}`}>
                    {source.severity}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">CO₂</p>
                    <p className="text-xs text-gray-800 font-medium">{source.emissions.co2}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">SO₂</p>
                    <p className="text-xs text-gray-800 font-medium">{source.emissions.so2}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">NOx</p>
                    <p className="text-xs text-gray-800 font-medium">{source.emissions.nox}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400">PM2.5</p>
                    <p className="text-xs text-gray-800 font-medium">{source.emissions.pm25}µg</p>
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

const EnvironmentalHazardsDisplay: React.FC<{ location: Location }> = ({ location }) => {
  if (!location.environmentalHazards || location.environmentalHazards.length === 0) {
    return null
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'border-green-100 bg-green-50'
      case 'medium':
        return 'border-yellow-100 bg-yellow-50'
      case 'high':
        return 'border-red-100 bg-red-50'
      default:
        return 'border-gray-100 bg-gray-50'
    }
  }

  const getHazardIcon = (type: string) => {
    switch (type) {
      case 'flood':
        return <Droplets className="w-4 h-4 text-blue-500" />
      case 'drought':
        return <Sun className="w-4 h-4 text-yellow-500" />
      case 'landslide':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'wildfire':
        return <Flame className="w-4 h-4 text-red-500" />
      case 'earthquake':
        return <CloudRain className="w-4 h-4 text-purple-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-400 mb-2 font-medium">Environmental Hazards</p>
      {location.environmentalHazards.map((hazard, idx) => (
        <div key={idx} className={`border rounded-xl p-2.5 mb-2 ${getRiskColor(hazard.risk)}`}>
          <div className="flex items-center gap-2.5">
            {getHazardIcon(hazard.type)}
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">{hazard.name}</p>
              <p className="text-[10px] text-gray-500">{hazard.description}</p>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                hazard.risk === 'high'
                  ? 'bg-red-100 text-red-700'
                  : hazard.risk === 'medium'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {hazard.risk} risk
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Location Search Component — Apple Maps-styled search sheet
// ---------------------------------------------------------------------------

export function LocationSearch({ onSearch, onClose, isOpen, searchBias }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [broadenedNotice, setBroadenedNotice] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Debounced, cancellable, Google-like search stack:
  // coordinates -> Photon autocomplete -> Nominatim fallback -> one broadened retry.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      setError(null)
      setBroadenedNotice(null)
      return
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const outcome = await searchPlacesSmart(query.trim(), controller.signal, searchBias)
        setResults(outcome.results)
        setBroadenedNotice(outcome.wasBroadened ? outcome.usedQuery : null)
        if (outcome.results.length === 0) setError(null)
      } catch (err) {
        const e = err as Error
        if (e.name === 'AbortError') {
          // superseded by a newer keystroke — ignore
        } else if (e.name === 'ProvidersUnreachableError') {
          setError(
            "Can't reach location search. Requests to nominatim.openstreetmap.org / photon.komoot.io " +
              "aren't getting through — check your network connection, browser console/Network tab for a " +
              'CORS or CSP block, and disable any ad blocker or VPN for this site, then try again.'
          )
          setResults([])
          setBroadenedNotice(null)
        } else {
          console.error('[LocationSearch] Unexpected search error:', e)
          setError('Search failed. Check your connection and try again.')
          setResults([])
          setBroadenedNotice(null)
        }
      } finally {
        setIsLoading(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, searchBias])

  const handleSelect = useCallback(
    (result: PlaceResult) => {
      const category = getCategoryInfo(result.osmClass, result.osmType)
      const base: Location = {
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        type: result.osmType,
        category: category.label,
        address: result.displayAddress,
      }
      const enriched = enrichLocation(base)
      setSelectedLocation(enriched)
      onSearch(enriched.lat, enriched.lng, enriched)
      setQuery('')
      setResults([])
      setBroadenedNotice(null)
    },
    [onSearch]
  )

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location services are not available in this browser.')
      return
    }

    setIsLocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const reverse = await reverseGeocode(latitude, longitude)
          const category = reverse ? getCategoryInfo(reverse.osmClass, reverse.osmType) : undefined
          const base: Location = {
            name: reverse ? reverse.name : 'Current Location',
            lat: latitude,
            lng: longitude,
            type: reverse?.osmType ?? 'current_location',
            category: category?.label ?? 'Current Location',
            address: reverse?.displayAddress ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          }
          const enriched = enrichLocation(base)
          setSelectedLocation(enriched)
          onSearch(enriched.lat, enriched.lng, enriched)
          setQuery('')
          setResults([])
        } finally {
          setIsLocating(false)
        }
      },
      () => {
        setIsLocating(false)
        setError('Could not access your location. Check location permissions.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [onSearch])

  const handleClose = () => {
    setQuery('')
    setResults([])
    setSelectedLocation(null)
    setError(null)
    setBroadenedNotice(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="max-w-md w-full mx-auto rounded-[22px] bg-white/95 backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] border border-black/5 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text',sans-serif]"
        >
          {/* Header: search bar + cancel, à la Apple Maps */}
          <div className="p-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for a place or address"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-gray-100 border-none text-gray-900 placeholder:text-gray-400 pl-10 pr-9 py-2.5 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-colors text-[15px]"
                />
                {isLoading && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                )}
                {!isLoading && query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <div className="w-4 h-4 rounded-full bg-gray-300 hover:bg-gray-400 flex items-center justify-center transition-colors">
                      <X className="w-2.5 h-2.5 text-white" />
                    </div>
                  </button>
                )}
              </div>
              <button
                onClick={handleClose}
                className="text-[15px] text-blue-500 font-normal px-1 hover:text-blue-600 transition-colors shrink-0"
              >
                Cancel
              </button>
            </div>

            {/* Current location quick action */}
            <button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full mt-2 flex items-center gap-2.5 p-2 rounded-[12px] hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-white" fill="white" />
                )}
              </div>
              <span className="text-[13px] font-medium text-blue-500">
                {isLocating ? 'Finding your location…' : 'Current Location'}
              </span>
            </button>
          </div>

          {error && (
            <div className="mx-3 mb-2 px-3 py-2 rounded-[10px] bg-red-50 text-red-600 text-xs font-medium">
              {error}
            </div>
          )}

          {broadenedNotice && results.length > 0 && (
            <div className="mx-3 mb-1 flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
              <SearchX className="w-3 h-3" />
              <span>No exact match — showing broader results for "{broadenedNotice}"</span>
            </div>
          )}

          {/* Results list, Apple Maps row style */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="max-h-72 overflow-y-auto border-t border-gray-100"
              >
                {results.map((result, idx) => {
                  const category = getCategoryInfo(result.osmClass, result.osmType)
                  return (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleSelect(result)}
                      className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-b-0"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${category.bg}`}>
                        {category.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-gray-900 truncate">{result.name}</p>
                        <p className="text-[13px] text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </motion.button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {query.trim().length >= 2 && !isLoading && results.length === 0 && !error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-gray-400 py-6 text-center px-6">
              No results found for "{query}" — try a broader or differently spelled search.
            </motion.p>
          )}

          {/* Selected Location detail sheet */}
          <AnimatePresence>
            {selectedLocation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-gray-100 p-3.5"
              >
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-white" fill="white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-gray-900 leading-tight">{selectedLocation.name}</p>
                    <p className="text-[12px] text-gray-500 leading-snug mt-0.5">
                      {selectedLocation.category ?? 'Place'}
                      {selectedLocation.address ? ` · ${selectedLocation.address}` : ''}
                    </p>
                  </div>
                </div>

                {selectedLocation.airQuality && (
                  <div className="bg-gray-50 rounded-[14px] p-3 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500 font-medium">Air Quality Index</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[15px] font-bold ${statusColors[selectedLocation.airQuality.status].text}`}>
                          {selectedLocation.airQuality.aqi}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColors[selectedLocation.airQuality.status].bg}`}>
                          {selectedLocation.airQuality.status}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-2.5">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">PM2.5</p>
                        <p className="text-xs text-gray-800 font-medium">{selectedLocation.airQuality.pm25}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">PM10</p>
                        <p className="text-xs text-gray-800 font-medium">{selectedLocation.airQuality.pm10}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">NO₂</p>
                        <p className="text-xs text-gray-800 font-medium">{selectedLocation.airQuality.no2}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">SO₂</p>
                        <p className="text-xs text-gray-800 font-medium">{selectedLocation.airQuality.so2}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">O₃</p>
                        <p className="text-xs text-gray-800 font-medium">{selectedLocation.airQuality.o3}</p>
                      </div>
                    </div>
                  </div>
                )}

                <PollutionSourcesDisplay location={selectedLocation} />
                <EnvironmentalHazardsDisplay location={selectedLocation} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}