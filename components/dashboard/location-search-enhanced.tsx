// components/dashboard/location-search-enhanced.tsx
//
// PROFESSIONAL COMPONENT DESCRIPTION
// -----------------------------------------------------------------------------
// LocationSearchEnhanced is a Google Maps-style location autocomplete panel for
// the AeroTrace dashboard. It is designed to search across *all* place
// categories that matter to a real map workflow, not only pollution-related
// destinations. The component can surface cities, towns, volcanoes, quarries,
// factories, industrial areas, malls, hospitals, schools, universities,
// restaurants, hotels, airports, ports, parks, churches, banks, and other
// establishments in Luzon, Philippines.
//
// Purpose:
// - Provide fast, relevant place suggestions while the user is typing.
// - Support any establishment search, similar to Google Maps autocomplete.
// - Offer a clean selection sheet that can be used to center a map, add a node,
//   or inspect a location.
// - Return latitude, longitude, category, description, and icon metadata so the
//   parent dashboard can render map markers, perimeter circles, or location
//   details.
//
// How it is used:
// - Render this component in a floating drawer, modal, or side panel.
// - The parent passes onLocationSelect to receive the selected place.
// - The parent passes onClose to dismiss the panel.
// - Optionally pass searchEndpoint to connect this UI to a backend proxy that
//   can call Google Places, OSM, or another search provider server-side.
//
// State management:
// - searchQuery: the live user input.
// - selectedType: active category filter.
// - results: current suggestion list.
// - isLoading: remote lookup state.
// - error: friendly search failure message.
// - selectedResult: the highlighted suggestion preview.
//
// Search protocol:
// 1) Parse direct coordinates first.
// 2) Search the local catalog with fuzzy matching over name, description,
//    aliases, and address.
// 3) Bias matches using inferred query intent (for example, “mall”, “hospital”,
//    “airport”, or “volcano”).
// 4) Optionally merge remote results from a backend proxy.
// 5) Rank and de-duplicate suggestions before displaying them.
//
// External libraries:
// - React for state and memoization.
// - framer-motion for animation.
// - lucide-react for icons.
//
// Note:
// - No browser-side scraper is included here.
// - For production Google-style search, point searchEndpoint at your own backend
//   proxy that calls Google Places or another provider safely server-side.
// -----------------------------------------------------------------------------

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Banknote,
  Building2,
  Building,
  ChevronRight,
  Church,
  Factory,
  Fuel,
  GraduationCap,
  Hammer,
  Hotel,
  Hospital,
  Landmark,
  LocateFixed,
  MapPin,
  Mountain,
  Plane,
  Search,
  Store,
  TrainFront,
  Trees,
  Utensils,
  X,
  Zap,
} from 'lucide-react'

type LocationType =
  | 'city'
  | 'town'
  | 'volcano'
  | 'quarry'
  | 'factory'
  | 'industrial'
  | 'mall'
  | 'hospital'
  | 'school'
  | 'university'
  | 'restaurant'
  | 'hotel'
  | 'airport'
  | 'port'
  | 'park'
  | 'church'
  | 'gas_station'
  | 'bank'
  | 'government'
  | 'transport'
  | 'landmark'
  | 'store'
  | 'all'

export interface LocationSearchItem {
  id: string
  name: string
  type: Exclude<LocationType, 'all'>
  lat: number
  lng: number
  description: string
  icon: React.ReactNode
  source?: 'local' | 'remote'
  confidence?: number
  address?: string
  aliases?: string[]
}

interface LocationSearchEnhancedProps {
  onLocationSelect: (location: LocationSearchItem) => void
  onClose: () => void
  searchEndpoint?: string
  initialQuery?: string
  countryCode?: string
  biasLabel?: string
}

const META: Record<Exclude<LocationType, 'all'>, { label: string; hint: string; icon: React.ReactNode }> = {
  city: { label: 'City', hint: 'Major urban center', icon: <Building2 className="h-4 w-4" /> },
  town: { label: 'Town', hint: 'Municipality or small city', icon: <MapPin className="h-4 w-4" /> },
  volcano: { label: 'Volcano', hint: 'Volcanic feature or hazard source', icon: <Mountain className="h-4 w-4" /> },
  quarry: { label: 'Quarry', hint: 'Extraction site', icon: <Hammer className="h-4 w-4" /> },
  factory: { label: 'Factory', hint: 'Manufacturing site', icon: <Factory className="h-4 w-4" /> },
  industrial: { label: 'Industrial', hint: 'Industrial park or zone', icon: <Zap className="h-4 w-4" /> },
  mall: { label: 'Mall', hint: 'Shopping center', icon: <Store className="h-4 w-4" /> },
  hospital: { label: 'Hospital', hint: 'Medical facility', icon: <Hospital className="h-4 w-4" /> },
  school: { label: 'School', hint: 'Basic education campus', icon: <GraduationCap className="h-4 w-4" /> },
  university: { label: 'University', hint: 'Higher education campus', icon: <GraduationCap className="h-4 w-4" /> },
  restaurant: { label: 'Restaurant', hint: 'Food and dining', icon: <Utensils className="h-4 w-4" /> },
  hotel: { label: 'Hotel', hint: 'Accommodation', icon: <Hotel className="h-4 w-4" /> },
  airport: { label: 'Airport', hint: 'Air transport hub', icon: <Plane className="h-4 w-4" /> },
  port: { label: 'Port', hint: 'Seaport or ferry terminal', icon: <Landmark className="h-4 w-4" /> },
  park: { label: 'Park', hint: 'Public green space', icon: <Trees className="h-4 w-4" /> },
  church: { label: 'Church', hint: 'Place of worship', icon: <Church className="h-4 w-4" /> },
  gas_station: { label: 'Gas Station', hint: 'Fuel stop', icon: <Fuel className="h-4 w-4" /> },
  bank: { label: 'Bank', hint: 'Banking and ATM', icon: <Banknote className="h-4 w-4" /> },
  government: { label: 'Government', hint: 'Public office or civic facility', icon: <Landmark className="h-4 w-4" /> },
  transport: { label: 'Transport', hint: 'Station or terminal', icon: <TrainFront className="h-4 w-4" /> },
  landmark: { label: 'Landmark', hint: 'Notable place', icon: <MapPin className="h-4 w-4" /> },
  store: { label: 'Store', hint: 'Retail establishment', icon: <Building className="h-4 w-4" /> },
}

const CATALOG: LocationSearchItem[] = [
  { id: 'manila', name: 'Manila', type: 'city', lat: 14.5995, lng: 120.9842, description: 'National capital and historic core of Metro Manila.', icon: META.city.icon, aliases: ['City of Manila', 'Metro Manila', 'Capital'] },
  { id: 'quezon-city', name: 'Quezon City', type: 'city', lat: 14.6760, lng: 121.0437, description: 'Largest city in Metro Manila and a major business center.', icon: META.city.icon, aliases: ['QC'] },
  { id: 'makati', name: 'Makati', type: 'city', lat: 14.5547, lng: 121.0244, description: 'Financial district and premium business hub.', icon: META.city.icon, aliases: ['Makati City', 'CBD'] },
  { id: 'san-fernando', name: 'San Fernando, Pampanga', type: 'city', lat: 15.0343, lng: 120.6844, description: 'Central Luzon regional city with industrial activity.', icon: META.city.icon, aliases: ['San Fernando City'] },
  { id: 'batangas-city', name: 'Batangas City', type: 'city', lat: 13.7565, lng: 121.0583, description: 'Port city with logistics, energy, and industrial support.', icon: META.city.icon, aliases: ['Batangas'] },
  { id: 'antipolo', name: 'Antipolo', type: 'town', lat: 14.5877, lng: 121.1751, description: 'Rising ridge city east of Metro Manila.', icon: META.town.icon, aliases: ['Antipolo City'] },
  { id: 'tagaytay', name: 'Tagaytay', type: 'town', lat: 14.1153, lng: 120.9629, description: 'Highland city known for scenic views over Taal Lake.', icon: META.town.icon, aliases: ['Tagaytay City'] },
  { id: 'santa-rosa', name: 'Santa Rosa', type: 'town', lat: 14.3122, lng: 121.1114, description: 'Highly urbanized growth area near industrial estates.', icon: META.town.icon, aliases: ['Santa Rosa, Laguna'] },

  { id: 'taal', name: 'Taal Volcano', type: 'volcano', lat: 14.0021, lng: 120.9935, description: 'Active volcano in Southern Luzon and a major hazard source.', icon: META.volcano.icon, aliases: ['Taal'] },
  { id: 'pinatubo', name: 'Mount Pinatubo', type: 'volcano', lat: 15.1424, lng: 120.3493, description: 'Famous active stratovolcano in Central Luzon.', icon: META.volcano.icon, aliases: ['Pinatubo', 'Mt. Pinatubo'] },
  { id: 'mayon', name: 'Mayon Volcano', type: 'volcano', lat: 13.2575, lng: 123.6850, description: 'Iconic active volcano with near-perfect cone shape.', icon: META.volcano.icon, aliases: ['Mayon', 'Mt. Mayon'] },

  { id: 'bulacan-quarries', name: 'Bulacan Quarries', type: 'quarry', lat: 14.7838, lng: 121.0514, description: 'Extraction corridor with aggregate hauling activity.', icon: META.quarry.icon, aliases: ['Bulacan Quarry Belt'] },
  { id: 'rizal-quarry', name: 'Rizal Quarry Belt', type: 'quarry', lat: 14.6219, lng: 121.3014, description: 'Stone extraction and hauling area in Rizal.', icon: META.quarry.icon, aliases: ['Rizal Quarries'] },
  { id: 'porac-quarry', name: 'Porac Quarry Zone', type: 'quarry', lat: 15.0703, lng: 120.5400, description: 'Aggregate and mining operations west of Angeles.', icon: META.quarry.icon, aliases: ['Porac Mines'] },

  { id: 'laguna-techno', name: 'Laguna Technopark', type: 'industrial', lat: 14.2768, lng: 121.1003, description: 'Major industrial estate with manufacturing tenants.', icon: META.industrial.icon, aliases: ['Laguna Techno Park'] },
  { id: 'cavite-economic', name: 'Cavite Economic Zone', type: 'industrial', lat: 14.3065, lng: 120.9490, description: 'Large export-oriented manufacturing zone.', icon: META.industrial.icon, aliases: ['Cavite EZ', 'PEZA Cavite'] },
  { id: 'subic-industrial', name: 'Subic Bay Industrial Area', type: 'industrial', lat: 14.8134, lng: 120.2866, description: 'Port-linked logistics and industrial region.', icon: META.industrial.icon, aliases: ['Subic Industrial'] },

  { id: 'calamba-factories', name: 'Calamba Factory Zone', type: 'factory', lat: 14.2117, lng: 121.1653, description: 'Manufacturing district with mixed production facilities.', icon: META.factory.icon, aliases: ['Calamba Industrial'] },
  { id: 'bacoor-factories', name: 'Bacoor Factory Zone', type: 'factory', lat: 14.4598, lng: 120.9520, description: 'Urban production area near Metro Manila supply chains.', icon: META.factory.icon, aliases: ['Bacoor Manufacturing'] },
  { id: 'rosario-factories', name: 'Rosario Factory Zone', type: 'factory', lat: 14.4186, lng: 120.8584, description: 'Manufacturing cluster near Cavite corridors.', icon: META.factory.icon, aliases: ['Rosario Industrial'] },

  { id: 'sm-north', name: 'SM City North EDSA', type: 'mall', lat: 14.6568, lng: 121.0326, description: 'Large shopping destination and transport node in Quezon City.', icon: META.mall.icon, aliases: ['SM North', 'SM North EDSA'] },
  { id: 'sm-clark', name: 'SM City Clark', type: 'mall', lat: 15.1680, lng: 120.5840, description: 'Regional mall serving Clark and nearby cities.', icon: META.mall.icon, aliases: ['SM Clark'] },
  { id: 'trinoma', name: 'TriNoma', type: 'mall', lat: 14.6538, lng: 121.0329, description: 'Retail and dining complex beside a major transit hub.', icon: META.mall.icon, aliases: ['TriNoma Mall'] },

  { id: 'st-lukes-qc', name: 'St. Luke’s Medical Center QC', type: 'hospital', lat: 14.6221, lng: 121.0367, description: 'Major tertiary hospital in Quezon City.', icon: META.hospital.icon, aliases: ['St. Lukes QC'] },
  { id: 'medical-city', name: 'The Medical City', type: 'hospital', lat: 14.5844, lng: 121.0781, description: 'Large private hospital and specialty center.', icon: META.hospital.icon, aliases: ['Medical City'] },
  { id: 'bgh', name: 'Baguio General Hospital', type: 'hospital', lat: 16.4099, lng: 120.5990, description: 'Provincial referral hospital in Northern Luzon.', icon: META.hospital.icon, aliases: ['BGH', 'Baguio General'] },

  { id: 'up-diliman', name: 'University of the Philippines Diliman', type: 'university', lat: 14.6538, lng: 121.0682, description: 'Flagship state university campus in Quezon City.', icon: META.university.icon, aliases: ['UP Diliman', 'UPD'] },
  { id: 'ateneo', name: 'Ateneo de Manila University', type: 'university', lat: 14.6393, lng: 121.0775, description: 'Major private university in the Loyola Heights area.', icon: META.university.icon, aliases: ['Ateneo', 'AdMU'] },
  { id: 'hau', name: 'Holy Angel University', type: 'university', lat: 15.1610, lng: 120.5902, description: 'University in Angeles City, Pampanga.', icon: META.university.icon, aliases: ['HAU'] },

  { id: 'trinoma-hub', name: 'North Avenue Station', type: 'transport', lat: 14.6517, lng: 121.0319, description: 'Key MRT/LRT interchange and transit anchor.', icon: META.transport.icon, aliases: ['North Ave Station'] },
  { id: 'edsa-busway', name: 'EDSA Busway Monumento', type: 'transport', lat: 14.6573, lng: 120.9848, description: 'Major public transport corridor stop.', icon: META.transport.icon, aliases: ['Monumento Station'] },
  { id: 'clark-airport', name: 'Clark International Airport', type: 'airport', lat: 15.1860, lng: 120.5600, description: 'Major international airport in Central Luzon.', icon: META.airport.icon, aliases: ['CRK', 'Clark Airport'] },

  { id: 'manila-port', name: 'Port of Manila', type: 'port', lat: 14.5906, lng: 120.9661, description: 'Critical seaport serving Metro Manila and surrounding regions.', icon: META.port.icon, aliases: ['Manila Harbor'] },
  { id: 'subic-port', name: 'Port of Subic', type: 'port', lat: 14.7940, lng: 120.2840, description: 'Port and logistics gateway in Zambales.', icon: META.port.icon, aliases: ['Subic Bay Port'] },

  { id: 'la-mesa-park', name: 'La Mesa Eco Park', type: 'park', lat: 14.7167, lng: 121.0833, description: 'Large green and recreation area in Quezon City.', icon: META.park.icon, aliases: ['La Mesa Park'] },
  { id: 'rizal-park', name: 'Rizal Park', type: 'park', lat: 14.5833, lng: 120.9794, description: 'Historic urban park in Manila.', icon: META.park.icon, aliases: ['Luneta'] },
  { id: 'burnham-park', name: 'Burnham Park', type: 'park', lat: 16.4102, lng: 120.5935, description: 'Central recreational park in Baguio City.', icon: META.park.icon, aliases: ['Burnham'] },

  { id: 'quiapo-church', name: 'Quiapo Church', type: 'church', lat: 14.5992, lng: 120.9830, description: 'Historic church and pilgrimage site in Manila.', icon: META.church.icon, aliases: ['Minor Basilica of the Black Nazarene'] },
  { id: 'church-san-agustin', name: 'San Agustin Church', type: 'church', lat: 14.5890, lng: 120.9742, description: 'UNESCO-recognized church in Intramuros.', icon: META.church.icon, aliases: ['San Agustin'] },

  { id: 'shell-edsa', name: 'Shell EDSA Northbound', type: 'gas_station', lat: 14.6560, lng: 121.0379, description: 'Fuel stop along the EDSA corridor.', icon: META.gas_station.icon, aliases: ['Shell EDSA', 'Gas Station'] },
  { id: 'petron-clark', name: 'Petron Clark', type: 'gas_station', lat: 15.1740, lng: 120.5790, description: 'Fuel station near Clark and Angeles traffic routes.', icon: META.gas_station.icon, aliases: ['Petron'] },

  { id: 'bdo-makati', name: 'BDO Makati Ayala', type: 'bank', lat: 14.5500, lng: 121.0245, description: 'Bank branch in the Ayala business district.', icon: META.bank.icon, aliases: ['BDO Ayala'] },
  { id: 'bpi-qc', name: 'BPI Quezon Avenue', type: 'bank', lat: 14.6399, lng: 121.0342, description: 'Banking branch near major Quezon City roads.', icon: META.bank.icon, aliases: ['BPI QC'] },

  { id: 'manila-city-hall', name: 'Manila City Hall', type: 'government', lat: 14.5900, lng: 120.9780, description: 'Local government center for the City of Manila.', icon: META.government.icon, aliases: ['City Hall'] },
  { id: 'dost-central', name: 'DOST Central Office', type: 'government', lat: 14.6545, lng: 121.0571, description: 'National science and technology government office.', icon: META.government.icon, aliases: ['DOST'] },

  { id: 'jollibee-qc', name: 'Jollibee Quezon Avenue', type: 'restaurant', lat: 14.6355, lng: 121.0283, description: 'Popular fast-food branch in Quezon City.', icon: META.restaurant.icon, aliases: ['Jollibee'] },
  { id: 'maxs-manila', name: 'Max’s Restaurant Intramuros', type: 'restaurant', lat: 14.5899, lng: 120.9760, description: 'Classic Filipino dining establishment in Manila.', icon: META.restaurant.icon, aliases: ['Maxs', 'Max Restaurant'] },
  { id: 'coffee-project', name: 'Coffee Project Clark', type: 'restaurant', lat: 15.1687, lng: 120.5858, description: 'Café and dining spot near Clark retail zones.', icon: META.restaurant.icon, aliases: ['Cafe', 'Coffee Shop'] },

  { id: 'seda-bgc', name: 'Seda Hotel BGC', type: 'hotel', lat: 14.5494, lng: 121.0521, description: 'Upscale hotel and accommodation option in Metro Manila.', icon: META.hotel.icon, aliases: ['Seda BGC'] },
  { id: 'microtel-baguio', name: 'Microtel Baguio', type: 'hotel', lat: 16.4187, lng: 120.5985, description: 'Hotel accommodation in Baguio City.', icon: META.hotel.icon, aliases: ['Microtel'] },
  { id: 'henann-batangas', name: 'Henann Batangas', type: 'hotel', lat: 13.7580, lng: 121.0550, description: 'Hotel and stay option near Batangas City.', icon: META.hotel.icon, aliases: ['Henann'] },

  { id: 'sm-store', name: 'SM Store Manila', type: 'store', lat: 14.5990, lng: 120.9845, description: 'Retail department store in the city center.', icon: META.store.icon, aliases: ['Department Store'] },
  { id: 'ace-hardware', name: 'Ace Hardware Pampanga', type: 'store', lat: 15.0367, lng: 120.6820, description: 'Retail hardware store for home and building supplies.', icon: META.store.icon, aliases: ['Hardware Store'] },

  { id: 'baguio-landmark', name: 'Mines View Park', type: 'landmark', lat: 16.4169, lng: 120.6200, description: 'Well-known scenic landmark in Baguio City.', icon: META.landmark.icon, aliases: ['Mines View'] },
  { id: 'intramuros', name: 'Intramuros', type: 'landmark', lat: 14.5890, lng: 120.9789, description: 'Historic walled district in Manila.', icon: META.landmark.icon, aliases: ['Old Manila'] },
]

const TYPE_ORDER: Exclude<LocationType, 'all'>[] = [
  'city',
  'town',
  'landmark',
  'mall',
  'hospital',
  'school',
  'university',
  'restaurant',
  'hotel',
  'airport',
  'port',
  'park',
  'church',
  'gas_station',
  'bank',
  'government',
  'transport',
  'volcano',
  'quarry',
  'factory',
  'industrial',
  'store',
]

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string) {
  return normalize(text).split(' ').filter(Boolean)
}

function parseCoordinates(query: string): { lat: number; lng: number } | null {
  const nums = query.trim().match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (nums.length < 2) return null

  const [a, b] = nums
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b }
  return null
}

function inferType(query: string): Exclude<LocationType, 'all'> | null {
  const q = normalize(query)
  if (/(city|metro|capital|urban|district)/.test(q)) return 'city'
  if (/(town|municipality|barangay|municipal)/.test(q)) return 'town'
  if (/(volcano|mount|mt\.|mountain)/.test(q)) return 'volcano'
  if (/(quarry|mining|aggregate|stone|rock)/.test(q)) return 'quarry'
  if (/(factory|plant|production|manufacturing)/.test(q)) return 'factory'
  if (/(industrial|economic zone|industrial park|peza|estate)/.test(q)) return 'industrial'
  if (/(mall|shopping center|shopping|store|retail)/.test(q)) return 'mall'
  if (/(hospital|clinic|medical|health)/.test(q)) return 'hospital'
  if (/(school|academy|elementary|high school|college)/.test(q)) return 'school'
  if (/(university|college|campus|state university)/.test(q)) return 'university'
  if (/(restaurant|food|diner|eatery|cafe|coffee)/.test(q)) return 'restaurant'
  if (/(hotel|resort|inn|lodging|accommodation)/.test(q)) return 'hotel'
  if (/(airport|airfield|terminal)/.test(q)) return 'airport'
  if (/(port|seaport|harbor|ferry)/.test(q)) return 'port'
  if (/(park|garden|eco park|green)/.test(q)) return 'park'
  if (/(church|chapel|cathedral|basilica)/.test(q)) return 'church'
  if (/(gas|fuel|petrol|petron|shell)/.test(q)) return 'gas_station'
  if (/(bank|atm|bdo|bpi|metrobank|security bank)/.test(q)) return 'bank'
  if (/(government|city hall|municipal hall|office|dost|dole|bfp|pnp)/.test(q)) return 'government'
  if (/(station|terminal|transit|bus|train|mrt|lrt)/.test(q)) return 'transport'
  return null
}

function getCategoryMeta(type: Exclude<LocationType, 'all'>) {
  return META[type]
}

function scoreItem(item: LocationSearchItem, query: string, selectedType: LocationType | 'all') {
  const q = normalize(query)
  const name = normalize(item.name)
  const desc = normalize(item.description)
  const aliases = normalize((item.aliases ?? []).join(' '))
  const combined = `${name} ${desc} ${aliases}`.trim()

  if (!q) return item.type === 'city' ? 12 : 8

  let score = 0

  if (name === q) score += 120
  if (name.startsWith(q)) score += 70
  if (name.includes(q)) score += 40
  if (aliases.includes(q)) score += 32
  if (desc.includes(q)) score += 18
  if (combined.includes(q)) score += 24

  for (const token of tokenize(q)) {
    if (name.includes(token)) score += 10
    if (aliases.includes(token)) score += 8
    if (desc.includes(token)) score += 5
  }

  const inferred = inferType(q)
  if (inferred && item.type === inferred) score += 26
  if (inferred && item.type !== inferred) score -= 4

  if (selectedType !== 'all' && item.type === selectedType) score += 24
  if (selectedType !== 'all' && item.type !== selectedType) score -= 12

  // Light map-style bias toward well-known place categories for broad queries.
  if (q.length <= 3 && (item.type === 'city' || item.type === 'mall' || item.type === 'landmark')) score += 6

  return score
}

function localSearch(query: string, selectedType: LocationType | 'all') {
  const trimmed = query.trim()

  const coords = parseCoordinates(trimmed)
  if (coords) {
    return [
      {
        id: `coords-${coords.lat}-${coords.lng}`,
        name: 'Pinned Coordinates',
        type: 'landmark' as const,
        lat: coords.lat,
        lng: coords.lng,
        description: 'Coordinates entered directly by the user.',
        icon: <LocateFixed className="h-4 w-4" />,
        source: 'local' as const,
        confidence: 1,
        aliases: ['Coordinates', 'LatLng'],
      },
    ]
  }

  const ranked = CATALOG
    .filter((item) => selectedType === 'all' || item.type === selectedType)
    .map((item) => ({
      ...item,
      confidence: scoreItem(item, trimmed, selectedType),
    }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))

  if (!trimmed) {
    return ranked.slice(0, 12)
  }

  const q = normalize(trimmed)
  return ranked
    .filter((item) => {
      const searchable = normalize(`${item.name} ${item.description} ${item.address ?? ''} ${(item.aliases ?? []).join(' ')}`)
      return searchable.includes(q) || q.includes(normalize(item.name))
    })
    .slice(0, 18)
}

type RemoteSearchResult = {
  id?: string
  name: string
  type?: LocationType
  lat: number
  lng: number
  description?: string
  address?: string
  confidence?: number
  source?: string
  aliases?: string[]
}

async function searchRemoteLocations(params: {
  endpoint: string
  query: string
  selectedType: LocationType | 'all'
  countryCode: string
  biasLabel: string
  signal: AbortSignal
}): Promise<LocationSearchItem[]> {
  const url = new URL(params.endpoint, window.location.origin)
  url.searchParams.set('q', params.query)
  url.searchParams.set('country', params.countryCode)
  url.searchParams.set('bias', params.biasLabel)
  if (params.selectedType !== 'all') url.searchParams.set('type', params.selectedType)

  const response = await fetch(url.toString(), {
    signal: params.signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Search endpoint failed: ${response.status}`)
  }

  const payload = await response.json()
  const items: RemoteSearchResult[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : []

  return items.map((item, idx) => {
    const type = item.type && item.type !== 'all' ? item.type : (inferType(`${item.name} ${item.description ?? ''} ${item.address ?? ''}`) ?? 'landmark')
    return {
      id: item.id ?? `remote-${idx}-${item.lat}-${item.lng}`,
      name: item.name,
      type,
      lat: item.lat,
      lng: item.lng,
      description: item.description ?? item.address ?? 'Search suggestion from your location service.',
      icon: META[type].icon,
      source: 'remote' as const,
      confidence: item.confidence ?? 0.5,
      address: item.address,
      aliases: item.aliases,
    }
  })
}

function mergeAndRank(local: LocationSearchItem[], remote: LocationSearchItem[], query: string, selectedType: LocationType | 'all') {
  const map = new Map<string, LocationSearchItem>()

  for (const item of [...remote, ...local]) {
    const key = `${item.name.toLowerCase()}-${item.lat.toFixed(4)}-${item.lng.toFixed(4)}-${item.type}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }

    const existingScore = existing.confidence ?? 0
    const nextScore = item.confidence ?? 0
    if (nextScore > existingScore || (item.source === 'remote' && existing.source === 'local')) {
      map.set(key, item)
    }
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      confidence: item.confidence ?? scoreItem(item, query, selectedType),
    }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
}

function groupedByType(items: LocationSearchItem[]) {
  const groups = new Map<Exclude<LocationType, 'all'>, LocationSearchItem[]>()
  for (const item of items) {
    const list = groups.get(item.type) ?? []
    list.push(item)
    groups.set(item.type, list)
  }
  return groups
}

export function LocationSearchEnhanced({
  onLocationSelect,
  onClose,
  searchEndpoint = '/api/location-search',
  initialQuery = '',
  countryCode = 'PH',
  biasLabel = 'Luzon',
}: LocationSearchEnhancedProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedType, setSelectedType] = useState<LocationType>('all')
  const [results, setResults] = useState<LocationSearchItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<LocationSearchItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const typeFilters = useMemo(
    () => [
      'all',
      'city',
      'town',
      'landmark',
      'mall',
      'hospital',
      'university',
      'restaurant',
      'hotel',
      'airport',
      'port',
      'industrial',
      'factory',
      'quarry',
      'volcano',
    ] as LocationType[],
    []
  )

  const suggestedQuickPicks = useMemo(() => {
    return CATALOG.filter((item) =>
      ['city', 'mall', 'hospital', 'university', 'restaurant', 'hotel', 'airport', 'industrial'].includes(item.type)
    ).slice(0, 8)
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(
    async (query: string, type: LocationType) => {
      const trimmed = query.trim()

      if (!trimmed && type === 'all') {
        setResults(suggestedQuickPicks)
        setSelectedResult(suggestedQuickPicks[0] ?? null)
        setIsLoading(false)
        setError(null)
        return
      }

      const localResults = localSearch(trimmed, type)

      let remoteResults: LocationSearchItem[] = []
      if (searchEndpoint && trimmed) {
        try {
          abortRef.current?.abort()
          const controller = new AbortController()
          abortRef.current = controller

          remoteResults = await searchRemoteLocations({
            endpoint: searchEndpoint,
            query: trimmed,
            selectedType: type,
            countryCode,
            biasLabel,
            signal: controller.signal,
          })
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            remoteResults = []
          }
        }
      }

      const merged = mergeAndRank(localResults, remoteResults, trimmed, type)
      setResults(merged)
      setSelectedResult(merged[0] ?? null)
      setError(null)
      setIsLoading(false)
    },
    [biasLabel, countryCode, searchEndpoint, suggestedQuickPicks]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setResults(suggestedQuickPicks)
      setSelectedResult(suggestedQuickPicks[0] ?? null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    debounceRef.current = setTimeout(() => {
      runSearch(searchQuery, selectedType).catch(() => {
        setError('Search failed. Please try again.')
        setIsLoading(false)
      })
    }, 220)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, selectedType, runSearch, suggestedQuickPicks])

  const groups = useMemo(() => groupedByType(results), [results])

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/85 text-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15">
            <Search className="h-4 w-4 text-blue-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Location Search</h2>
            <p className="text-xs text-white/50">Search any place or establishment in Luzon</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        <div className="relative">
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
            <Search className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cities, malls, hospitals, restaurants, airports..."
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/8 pl-11 pr-11 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-blue-400/50 focus:bg-white/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {typeFilters.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedType === type
                  ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                  : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10'
              }`}
            >
              {type === 'all' ? 'All' : META[type].label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
          <span>Type filter: {selectedType === 'all' ? 'All locations' : META[selectedType].label}</span>
          <span>{searchQuery.trim() ? `Showing matching places in ${biasLabel}` : 'Quick picks loaded'}</span>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedType}-${searchQuery}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 max-h-[60vh] overflow-y-auto pr-1"
          >
            {isLoading && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                Searching locations...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
                <AlertCircle className="mx-auto h-7 w-7 text-white/30" />
                <p className="mt-2 text-sm text-white/65">No locations found</p>
                <p className="mt-1 text-xs text-white/40">
                  Try a city, establishment, landmark, or category keyword.
                </p>
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="space-y-4">
                {typeFilters.filter((t) => t !== 'all').map((type) => {
                  const items = groups.get(type as Exclude<LocationType, 'all'>)
                  if (!items?.length) return null

                  return (
                    <section key={type} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                          {META[type as Exclude<LocationType, 'all'>].icon}
                          <span>{META[type as Exclude<LocationType, 'all'>].label}</span>
                        </div>
                        <span className="text-[11px] text-white/35">{items.length} result{items.length > 1 ? 's' : ''}</span>
                      </div>

                      <div className="space-y-2">
                        {items.map((location) => (
                          <motion.button
                            key={location.id}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              setSelectedResult(location)
                              onLocationSelect(location)
                            }}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-blue-400/40 hover:bg-white/8"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
                                {location.icon}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">{location.name}</p>
                                    <p className="mt-0.5 text-xs text-white/55">{location.description}</p>
                                  </div>

                                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/70">
                                    {META[location.type].label}
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-[11px] text-white/45">
                                  <span>
                                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-blue-200">
                                    Select <ChevronRight className="h-3 w-3" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}

            {!searchQuery.trim() && !isLoading && (
              <section className="mt-5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium text-white/80">Suggested places</h3>
                  <span className="text-[11px] text-white/35">Google-style quick picks</span>
                </div>

                <div className="grid gap-2">
                  {suggestedQuickPicks.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => {
                        setSelectedResult(location)
                        onLocationSelect(location)
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-blue-400/35 hover:bg-white/8"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
                        {location.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{location.name}</p>
                        <p className="truncate text-xs text-white/45">{location.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>

        {selectedResult && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/4 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
                {selectedResult.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{selectedResult.name}</p>
                    <p className="text-xs text-white/50">{selectedResult.description}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/60">
                    {META[selectedResult.type].label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-white/40">Latitude</p>
                    <p className="mt-0.5 font-medium text-white">{selectedResult.lat.toFixed(6)}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 px-3 py-2">
                    <p className="text-white/40">Longitude</p>
                    <p className="mt-0.5 font-medium text-white">{selectedResult.lng.toFixed(6)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default LocationSearchEnhanced
