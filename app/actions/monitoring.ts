'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { 
  monitoringNodes, 
  pollutionSources, 
  nodePerimeters, 
  monitoringReadings,
  sourceRatings 
} from '@/lib/db/schema'
import { headers } from 'next/headers'
import { eq, and, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getMonitoringNodes() {
  const userId = await getUserId()
  return db
    .select()
    .from(monitoringNodes)
    .where(eq(monitoringNodes.userId, userId))
}

export async function getMonitoringNodeById(nodeId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(monitoringNodes)
    .where(and(eq(monitoringNodes.id, nodeId), eq(monitoringNodes.userId, userId)))
    .limit(1)
}

export async function createMonitoringNode(data: {
  name: string
  description?: string
  latitude: string
  longitude: string
  mode?: string
}) {
  const userId = await getUserId()
  const nodeId = crypto.randomUUID()
  
  const result = await db.insert(monitoringNodes).values({
    id: nodeId,
    name: data.name,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    mode: data.mode || 'realtime',
    isActive: true,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  revalidatePath('/dashboard')
  return nodeId
}

export async function updateNodePingStatus(nodeId: string, status: 'active' | 'inactive') {
  const userId = await getUserId()
  
  const result = await db.update(monitoringNodes)
    .set({
      pingStatus: status,
      lastPingTime: new Date(),
    })
    .where(and(eq(monitoringNodes.id, nodeId), eq(monitoringNodes.userId, userId)))
  
  revalidatePath('/dashboard')
  return result
}

export async function simulateNodeReading(nodeId: string) {
  const userId = await getUserId()
  const readingId = crypto.randomUUID()
  
  // Generate realistic simulated data
  const baseAQI = Math.random() * 500
  const ratings = ['good', 'moderate', 'unhealthy', 'hazardous']
  let rating = 'good'
  if (baseAQI > 100) rating = 'moderate'
  if (baseAQI > 150) rating = 'unhealthy'
  if (baseAQI > 300) rating = 'hazardous'
  
  const reading = {
    id: readingId,
    nodeId,
    pm25: (Math.random() * 150).toFixed(1),
    pm10: (Math.random() * 200).toFixed(1),
    no2: (Math.random() * 200).toFixed(1),
    so2: (Math.random() * 150).toFixed(1),
    o3: (Math.random() * 100).toFixed(1),
    co: (Math.random() * 10000).toFixed(0),
    airQualityIndex: baseAQI.toFixed(0),
    overallRating: rating,
    userId,
    createdAt: new Date(),
  }

  const result = await db.insert(monitoringReadings).values(reading)
  
  revalidatePath('/dashboard')
  return reading
}

export async function getPollutionSources() {
  const userId = await getUserId()
  return db
    .select()
    .from(pollutionSources)
    .where(eq(pollutionSources.userId, userId))
}

export async function getPollutionSourcesByType(sourceType: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(pollutionSources)
    .where(and(eq(pollutionSources.userId, userId), eq(pollutionSources.sourceType, sourceType)))
}

export async function getLatestReadingsForNode(nodeId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(monitoringReadings)
    .where(and(eq(monitoringReadings.nodeId, nodeId), eq(monitoringReadings.userId, userId)))
    .orderBy(desc(monitoringReadings.createdAt))
    .limit(1)
}

export async function getReadingsHistoryForNode(nodeId: string, limit: number = 30) {
  const userId = await getUserId()
  return db
    .select()
    .from(monitoringReadings)
    .where(and(eq(monitoringReadings.nodeId, nodeId), eq(monitoringReadings.userId, userId)))
    .orderBy(desc(monitoringReadings.createdAt))
    .limit(limit)
}

export async function createOrUpdateReading(nodeId: string, data: {
  pm25?: string
  pm10?: string
  no2?: string
  so2?: string
  o3?: string
  co?: string
  airQualityIndex?: string
  overallRating?: string
}) {
  const userId = await getUserId()
  const readingId = crypto.randomUUID()
  
  const result = await db.insert(monitoringReadings).values({
    id: readingId,
    nodeId,
    pm25: data.pm25,
    pm10: data.pm10,
    no2: data.no2,
    so2: data.so2,
    o3: data.o3,
    co: data.co,
    airQualityIndex: data.airQualityIndex,
    overallRating: data.overallRating,
    userId,
    createdAt: new Date(),
  })
  
  revalidatePath('/dashboard')
  return readingId
}

export async function getSourceRatingsForNode(nodeId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(sourceRatings)
    .where(and(eq(sourceRatings.nodeId, nodeId), eq(sourceRatings.userId, userId)))
}

export async function updateNodePerimeter(
  nodeId: string,
  radiusKm: number,
  geoJsonPolygon?: string
) {
  const userId = await getUserId()
  const perimeterId = crypto.randomUUID()
  
  const result = await db.insert(nodePerimeters).values({
    id: perimeterId,
    nodeId,
    radiusKm: radiusKm.toString(),
    geoJsonPolygon,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  revalidatePath('/dashboard')
  return perimeterId
}

export async function getNodePerimeter(nodeId: string) {
  const userId = await getUserId()
  return db
    .select()
    .from(nodePerimeters)
    .where(and(eq(nodePerimeters.nodeId, nodeId), eq(nodePerimeters.userId, userId)))
    .limit(1)
}
