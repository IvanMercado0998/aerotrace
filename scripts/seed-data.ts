import { db } from '@/lib/db'
import {
  monitoringNodes,
  pollutionSources,
  monitoringReadings,
  sourceRatings,
} from '@/lib/db/schema'

const DEMO_USER_ID = 'demo-user-001'

async function seedData() {
  console.log('🌱 Seeding database with sample data...')

  // Create monitoring nodes across Luzon
  const nodeLocations = [
    {
      id: 'node-manila',
      name: 'Manila CBD Station',
      latitude: '14.5995',
      longitude: '120.9842',
      description: 'Central business district air quality monitor',
    },
    {
      id: 'node-qc',
      name: 'Quezon City North',
      latitude: '14.6928',
      longitude: '121.0829',
      description: 'Quezon City metropolitan area monitoring',
    },
    {
      id: 'node-caloocan',
      name: 'Caloocan Industrial',
      latitude: '14.6387',
      longitude: '120.9576',
      description: 'Industrial zone near cement factories',
    },
    {
      id: 'node-laguna',
      name: 'Laguna Province',
      latitude: '14.3546',
      longitude: '121.2368',
      description: 'Southern Luzon monitoring station',
    },
    {
      id: 'node-cavite',
      name: 'Cavite Port Area',
      latitude: '14.4769',
      longitude: '120.8809',
      description: 'Port and industrial area monitoring',
    },
  ]

  for (const node of nodeLocations) {
    try {
      await db.insert(monitoringNodes).values({
        id: node.id,
        name: node.name,
        description: node.description,
        latitude: node.latitude as any,
        longitude: node.longitude as any,
        isActive: true,
        mode: Math.random() > 0.5 ? 'realtime' : 'manual',
        userId: DEMO_USER_ID,
      })
      console.log(`✓ Created node: ${node.name}`)
    } catch (err) {
      console.log(`- Node ${node.name} might already exist`)
    }
  }

  // Create pollution sources
  const sources = [
    {
      id: 'source-cement-1',
      name: 'Lafarge Cement Plant',
      sourceType: 'cement_plant',
      latitude: '14.6150',
      longitude: '120.9650',
    },
    {
      id: 'source-cement-2',
      name: 'Solid Cement Corporation',
      sourceType: 'cement_plant',
      latitude: '14.6850',
      longitude: '121.0550',
    },
    {
      id: 'source-quarry-1',
      name: 'San Fernando Quarry',
      sourceType: 'quarry',
      latitude: '14.5450',
      longitude: '120.9350',
    },
    {
      id: 'source-quarry-2',
      name: 'Laguna Stone Quarry',
      sourceType: 'quarry',
      latitude: '14.3800',
      longitude: '121.2000',
    },
    {
      id: 'source-volcano',
      name: 'Taal Volcano',
      sourceType: 'volcano',
      latitude: '13.9873',
      longitude: '120.9980',
    },
    {
      id: 'source-factory-1',
      name: 'Thermopol Industrial Complex',
      sourceType: 'industrial',
      latitude: '14.4500',
      longitude: '120.9200',
    },
  ]

  for (const source of sources) {
    try {
      await db.insert(pollutionSources).values({
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        latitude: source.latitude as any,
        longitude: source.longitude as any,
        userId: DEMO_USER_ID,
      })
      console.log(`✓ Created source: ${source.name}`)
    } catch (err) {
      console.log(`- Source ${source.name} might already exist`)
    }
  }

  // Create sample readings for nodes
  for (const node of nodeLocations) {
    try {
      const reading = {
        id: `reading-${node.id}-001`,
        nodeId: node.id,
        pm25: (Math.random() * 150).toFixed(1),
        pm10: (Math.random() * 200).toFixed(1),
        no2: (Math.random() * 200).toFixed(1),
        so2: (Math.random() * 150).toFixed(1),
        o3: (Math.random() * 100).toFixed(1),
        co: (Math.random() * 10000).toFixed(0),
        airQualityIndex: (Math.random() * 500).toFixed(0),
        overallRating: ['good', 'moderate', 'unhealthy', 'hazardous'][
          Math.floor(Math.random() * 4)
        ],
        userId: DEMO_USER_ID,
      }

      await db.insert(monitoringReadings).values({
        id: reading.id,
        nodeId: reading.nodeId,
        pm25: reading.pm25 as any,
        pm10: reading.pm10 as any,
        no2: reading.no2 as any,
        so2: reading.so2 as any,
        o3: reading.o3 as any,
        co: reading.co as any,
        airQualityIndex: reading.airQualityIndex as any,
        overallRating: reading.overallRating,
        userId: reading.userId,
      })
      console.log(`✓ Created reading for: ${node.name}`)
    } catch (err) {
      console.log(`- Reading for ${node.name} might already exist`)
    }
  }

  // Create source ratings
  const ratings = [
    { nodeId: 'node-manila', sourceId: 'source-cement-1', rating: 4.5 },
    { nodeId: 'node-qc', sourceId: 'source-cement-2', rating: 3.8 },
    { nodeId: 'node-caloocan', sourceId: 'source-cement-1', rating: 8.2 },
    { nodeId: 'node-caloocan', sourceId: 'source-quarry-1', rating: 6.5 },
    { nodeId: 'node-laguna', sourceId: 'source-quarry-2', rating: 5.1 },
    { nodeId: 'node-cavite', sourceId: 'source-factory-1', rating: 7.3 },
  ]

  for (const rating of ratings) {
    try {
      await db.insert(sourceRatings).values({
        id: `rating-${rating.nodeId}-${rating.sourceId}`,
        nodeId: rating.nodeId,
        sourceId: rating.sourceId,
        pollutionRating: rating.rating as any,
        distanceKm: (Math.random() * 20).toFixed(1) as any,
        contributionPercentage: (Math.random() * 30 + 10).toFixed(1) as any,
        userId: DEMO_USER_ID,
      })
      console.log(`✓ Created rating: ${rating.nodeId} -> ${rating.sourceId}`)
    } catch (err) {
      console.log(`- Rating might already exist`)
    }
  }

  console.log('✅ Seed data complete!')
}

seedData().catch(err => {
  console.error('❌ Seeding failed:', err)
  process.exit(1)
})
