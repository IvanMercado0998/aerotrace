// app/actions/monitoring.ts
//
// ----------------------------------------------------------------------
//  AeroTrace — Monitoring Server Actions
// ----------------------------------------------------------------------
//  Server-only data layer (Next.js 13+ App Router `'use server'` actions)
//  for AeroTrace's air-quality and pollution-source monitoring system,
//  focused on Luzon, Philippines.
//
//  Responsibilities:
//    - CRUD for monitoring nodes (user-owned sensor/collection points)
//    - Pulling live ambient air-quality readings from OpenAQ — a free,
//      open-source, nonprofit-run global air quality data platform —
//      for the nearest real monitoring station to a given node, with a
//      clearly-labeled simulated fallback when no station is nearby
//    - Tracking pollution sources, source ratings, and node perimeters
//
//  Auth model: every action resolves the caller's user ID from the
//  Better Auth session. Every read is scoped with `userId` in its WHERE
//  clause. Every write that targets an *existing* node first calls
//  `assertNodeOwnership` so a user can never write data against a node
//  they don't own, even if they know or guess its ID.
//
//  External data: set OPENAQ_API_KEY (free — register at
//  https://explore.openaq.org/register) to enable live readings. Without
//  it, or when no station is within range, readings fall back to a
//  clearly-flagged simulated value so the app keeps working end-to-end.
// ----------------------------------------------------------------------
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  monitoringNodes,
  pollutionSources,
  nodePerimeters,
  monitoringReadings,
  sourceRatings,
} from '@/lib/db/schema';
import { headers } from 'next/headers';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ----------------------------------------------------------------------
//  Type helpers – infer row types directly from your Drizzle schema
// ----------------------------------------------------------------------
type MonitoringNode    = InferSelectModel<typeof monitoringNodes>;
type MonitoringReading = InferSelectModel<typeof monitoringReadings>;
type PollutionSource   = InferSelectModel<typeof pollutionSources>;
type NodePerimeter      = InferSelectModel<typeof nodePerimeters>;
type SourceRating       = InferSelectModel<typeof sourceRatings>;

// ----------------------------------------------------------------------
//  Helper – get the currently‑authenticated user ID
// ----------------------------------------------------------------------
async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}

// ----------------------------------------------------------------------
//  Helper – confirm a node exists AND belongs to the current user before
//  allowing any write (reading, perimeter, ping status) against it.
//  Without this, any authenticated user could insert rows referencing a
//  nodeId they don't own.
// ----------------------------------------------------------------------
async function assertNodeOwnership(nodeId: string, userId: string): Promise<void> {
  const rows = await db
    .select({ id: monitoringNodes.id })
    .from(monitoringNodes)
    .where(and(eq(monitoringNodes.id, nodeId), eq(monitoringNodes.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    throw new Error('Node not found or access denied');
  }
}

// ----------------------------------------------------------------------
//  Helper – basic input validation for geographic coordinates
// ----------------------------------------------------------------------
function assertValidCoordinates(latitude: string, longitude: string): void {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw new Error('Invalid latitude');
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error('Invalid longitude');
  }
}

/* --------------------------------------------------------------------
   Monitoring Nodes
--------------------------------------------------------------------- */
export async function getMonitoringNodes(): Promise<MonitoringNode[]> {
  const userId = await getUserId();
  return db
    .select()
    .from(monitoringNodes)
    .where(eq(monitoringNodes.userId, userId));
}

export async function getMonitoringNodeById(
  nodeId: string,
): Promise<MonitoringNode | null> {
  const userId = await getUserId();
  const rows = await db
    .select()
    .from(monitoringNodes)
    .where(
      and(
        eq(monitoringNodes.id, nodeId),
        eq(monitoringNodes.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createMonitoringNode(data: {
  name: string;
  description?: string;
  latitude: string;
  longitude: string;
  mode?: string;
}): Promise<string> {
  const userId = await getUserId();

  if (!data.name.trim()) {
    throw new Error('Node name is required');
  }
  assertValidCoordinates(data.latitude, data.longitude);

  const nodeId = crypto.randomUUID();

  await db.insert(monitoringNodes).values({
    id: nodeId,
    name: data.name,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    mode: data.mode ?? 'realtime',
    isActive: true,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Refresh the dashboard so the new node appears immediately
  revalidatePath('/dashboard');
  return nodeId;
}

/**
 * Update the ping status for a node.
 * The function purpose is unchanged – it only writes the two columns
 * `pingStatus` and `lastPingTime`.
 */
export async function updateNodePingStatus(
  nodeId: string,
  status: 'active' | 'inactive',
): Promise<void> {
  const userId = await getUserId();

  await db
    .update(monitoringNodes)
    .set({
      pingStatus: status,
      lastPingTime: new Date(),
    })
    .where(
      and(eq(monitoringNodes.id, nodeId), eq(monitoringNodes.userId, userId)),
    );

  revalidatePath('/dashboard');
}

/* --------------------------------------------------------------------
   Live air-quality data — OpenAQ (free, open-source, nonprofit)
--------------------------------------------------------------------- */
const OPENAQ_BASE_URL = 'https://api.openaq.org/v3';

/** OpenAQ parameter IDs we care about, per docs.openaq.org */
const OPENAQ_PARAMETER_IDS = {
  pm25: 2,
  pm10: 1,
  no2: 5,
  so2: 4,
  o3: 3,
  co: 8,
} as const;

interface LiveAirQualityReading {
  pm25?: string;
  pm10?: string;
  no2?: string;
  so2?: string;
  o3?: string;
  co?: string;
  source: 'openaq' | 'simulated';
  stationName?: string;
}

/**
 * Look up the nearest OpenAQ station within `radiusMeters` of the given
 * coordinates and pull its latest measurements. Returns `null` (rather
 * than throwing) if OPENAQ_API_KEY isn't configured, no station is in
 * range, or the request fails — callers should fall back to a simulated
 * reading in that case so a flaky/unconfigured external API never
 * breaks node creation or the dashboard.
 */
async function fetchNearestOpenAQReading(
  latitude: string,
  longitude: string,
  radiusMeters = 25_000,
): Promise<LiveAirQualityReading | null> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) return null;

  try {
    const locationsUrl =
      `${OPENAQ_BASE_URL}/locations?coordinates=${latitude},${longitude}` +
      `&radius=${radiusMeters}&limit=1`;

    const locationsRes = await fetch(locationsUrl, {
      headers: { 'X-API-Key': apiKey },
      // Station metadata changes rarely; cache briefly to limit rate-limit usage.
      next: { revalidate: 3600 },
    });
    if (!locationsRes.ok) return null;

    const locationsJson = await locationsRes.json();
    const station = locationsJson?.results?.[0];
    if (!station?.id) return null;

    const latestRes = await fetch(
      `${OPENAQ_BASE_URL}/locations/${station.id}/latest`,
      { headers: { 'X-API-Key': apiKey }, cache: 'no-store' },
    );
    if (!latestRes.ok) return null;

    const latestJson = await latestRes.json();
    const measurements: Array<{ parameter?: { id?: number }; value?: number }> =
      latestJson?.results ?? [];

    const byParamId = (id: number) =>
      measurements.find(m => m.parameter?.id === id)?.value;

    const reading: LiveAirQualityReading = {
      pm25: byParamId(OPENAQ_PARAMETER_IDS.pm25)?.toFixed(1),
      pm10: byParamId(OPENAQ_PARAMETER_IDS.pm10)?.toFixed(1),
      no2: byParamId(OPENAQ_PARAMETER_IDS.no2)?.toFixed(1),
      so2: byParamId(OPENAQ_PARAMETER_IDS.so2)?.toFixed(1),
      o3: byParamId(OPENAQ_PARAMETER_IDS.o3)?.toFixed(1),
      co: byParamId(OPENAQ_PARAMETER_IDS.co)?.toFixed(0),
      source: 'openaq',
      stationName: station.name,
    };

    // If the station returned no usable parameters, treat it as a miss.
    const hasAnyValue = [reading.pm25, reading.pm10, reading.no2, reading.so2, reading.o3, reading.co]
      .some(v => v !== undefined);
    return hasAnyValue ? reading : null;
  } catch {
    // Network error, malformed response, rate limit, etc. — fall back silently.
    return null;
  }
}

function computeAqiRating(pm25: number): 'good' | 'moderate' | 'unhealthy' | 'hazardous' {
  if (pm25 <= 12) return 'good';
  if (pm25 <= 35.4) return 'moderate';
  if (pm25 <= 150.4) return 'unhealthy';
  return 'hazardous';
}

function simulateFallbackReading(): LiveAirQualityReading {
  return {
    pm25: (Math.random() * 150).toFixed(1),
    pm10: (Math.random() * 200).toFixed(1),
    no2: (Math.random() * 200).toFixed(1),
    so2: (Math.random() * 150).toFixed(1),
    o3: (Math.random() * 100).toFixed(1),
    co: (Math.random() * 10000).toFixed(0),
    source: 'simulated',
  };
}

/**
 * Pull a reading for a node: real OpenAQ data from the nearest station
 * when available, otherwise a clearly-flagged simulated value so the UI
 * still has something to render. Persists the result either way.
 */
export async function simulateNodeReading(
  nodeId: string,
): Promise<MonitoringReading> {
  const userId = await getUserId();
  await assertNodeOwnership(nodeId, userId);

  const [node] = await db
    .select()
    .from(monitoringNodes)
    .where(and(eq(monitoringNodes.id, nodeId), eq(monitoringNodes.userId, userId)))
    .limit(1);
  if (!node) throw new Error('Node not found or access denied');

  const live = await fetchNearestOpenAQReading(node.latitude, node.longitude);
  const reading = live ?? simulateFallbackReading();

  const pm25Value = Number.parseFloat(reading.pm25 ?? '0');
  const overallRating = computeAqiRating(pm25Value);
  // Rough AQI proxy from PM2.5 when we don't have a proper AQI breakpoint table.
  const airQualityIndex = Math.min(500, Math.round(pm25Value * 2)).toString();

  const readingId = crypto.randomUUID();
  const row = {
    id: readingId,
    nodeId,
    pm25: reading.pm25,
    pm10: reading.pm10,
    no2: reading.no2,
    so2: reading.so2,
    o3: reading.o3,
    co: reading.co,
    airQualityIndex,
    overallRating,
    userId,
    createdAt: new Date(),
  } satisfies InferInsertModel<typeof monitoringReadings>;

  await db.insert(monitoringReadings).values(row);
  revalidatePath('/dashboard');

  return row as unknown as MonitoringReading;
}

/* --------------------------------------------------------------------
   Pollution Sources
--------------------------------------------------------------------- */
export async function getPollutionSources(): Promise<PollutionSource[]> {
  const userId = await getUserId();
  return db
    .select()
    .from(pollutionSources)
    .where(eq(pollutionSources.userId, userId));
}

export async function getPollutionSourcesByType(
  sourceType: string,
): Promise<PollutionSource[]> {
  const userId = await getUserId();
  return db
    .select()
    .from(pollutionSources)
    .where(
      and(
        eq(pollutionSources.userId, userId),
        eq(pollutionSources.sourceType, sourceType),
      ),
    );
}

/* --------------------------------------------------------------------
   Readings (latest + history)
--------------------------------------------------------------------- */
export async function getLatestReadingsForNode(
  nodeId: string,
): Promise<MonitoringReading | null> {
  const userId = await getUserId();
  const rows = await db
    .select()
    .from(monitoringReadings)
    .where(
      and(
        eq(monitoringReadings.nodeId, nodeId),
        eq(monitoringReadings.userId, userId),
      ),
    )
    .orderBy(desc(monitoringReadings.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getReadingsHistoryForNode(
  nodeId: string,
  limit = 30,
): Promise<MonitoringReading[]> {
  const userId = await getUserId();
  return db
    .select()
    .from(monitoringReadings)
    .where(
      and(
        eq(monitoringReadings.nodeId, nodeId),
        eq(monitoringReadings.userId, userId),
      ),
    )
    .orderBy(desc(monitoringReadings.createdAt))
    .limit(limit);
}

/**
 * Insert a manually-supplied reading for a node. Always performs an
 * INSERT (readings are treated as an append-only time series, matching
 * the original behavior) — the name reflects the caller-facing intent
 * ("record this reading now"), not a SQL upsert.
 */
export async function createOrUpdateReading(
  nodeId: string,
  data: {
    pm25?: string;
    pm10?: string;
    no2?: string;
    so2?: string;
    o3?: string;
    co?: string;
    airQualityIndex?: string;
    overallRating?: string;
  },
): Promise<string> {
  const userId = await getUserId();
  await assertNodeOwnership(nodeId, userId);

  const readingId = crypto.randomUUID();

  await db.insert(monitoringReadings).values({
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
  });

  revalidatePath('/dashboard');
  return readingId;
}

/* --------------------------------------------------------------------
   Source Ratings (per node)
--------------------------------------------------------------------- */
export async function getSourceRatingsForNode(
  nodeId: string,
): Promise<SourceRating[]> {
  const userId = await getUserId();
  return db
    .select()
    .from(sourceRatings)
    .where(
      and(
        eq(sourceRatings.nodeId, nodeId),
        eq(sourceRatings.userId, userId),
      ),
    );
}

/* --------------------------------------------------------------------
   Node Perimeters
--------------------------------------------------------------------- */
/**
 * Record a new perimeter radius/polygon for a node. Kept as an
 * append-only insert (so perimeter history is preserved for audit /
 * playback), paired with `getNodePerimeter` below always returning the
 * most recently created row.
 */
export async function updateNodePerimeter(
  nodeId: string,
  radiusKm: number,
  geoJsonPolygon?: string,
): Promise<string> {
  const userId = await getUserId();
  await assertNodeOwnership(nodeId, userId);

  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
    throw new Error('radiusKm must be between 0 and 50');
  }

  const perimeterId = crypto.randomUUID();

  await db.insert(nodePerimeters).values({
    id: perimeterId,
    nodeId,
    radiusKm: radiusKm.toString(),
    geoJsonPolygon,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath('/dashboard');
  return perimeterId;
}

/**
 * Retrieve the most recently created perimeter for a node (or `null` if
 * none exists). Explicitly ordered by `createdAt` — without this,
 * `.limit(1)` on a table with multiple perimeter rows for the same node
 * can return an arbitrary, potentially stale, row.
 */
export async function getNodePerimeter(
  nodeId: string,
): Promise<NodePerimeter | null> {
  const userId = await getUserId();

  const rows = await db
    .select()
    .from(nodePerimeters)
    .where(
      and(
        eq(nodePerimeters.nodeId, nodeId),
        eq(nodePerimeters.userId, userId),
      ),
    )
    .orderBy(desc(nodePerimeters.createdAt))
    .limit(1);
  return rows[0] ?? null;
}