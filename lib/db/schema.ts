import { pgTable, text, timestamp, boolean, decimal, index } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Add your app tables below. Always include a plain `userId` column so queries
// can be scoped per user — the security model depends on this column existing,
// not on a foreign key. Do NOT add a foreign key constraint
// (`.references(() => user.id, ...)`) unless the user explicitly asks for
// foreign keys or referential integrity; FK constraints make iterating on the
// schema harder.
//
// Example:
//
// import { serial } from "drizzle-orm/pg-core"
//
// export const todos = pgTable("todos", {
//   id: serial("id").primaryKey(),
//   userId: text("userId").notNull(),
//   title: text("title").notNull(),
//   completed: boolean("completed").notNull().default(false),
//   createdAt: timestamp("createdAt").notNull().defaultNow(),
// })
//
// If the user asks for foreign keys, add the reference back in:
//   userId: text("userId")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),

export const monitoringNodes = pgTable('monitoring_nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  isActive: boolean('is_active').default(true),
  mode: text('mode').default('realtime'), // 'realtime' or 'manual'
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const pollutionSources = pgTable('pollution_sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(), // 'cement_plant', 'quarry', 'volcano', etc
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  description: text('description'),
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const nodePerimeters = pgTable('node_perimeters', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  radiusKm: decimal('radius_km', { precision: 5, scale: 2 }),
  geoJsonPolygon: text('geojson_polygon'), // Store as JSON string
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const monitoringReadings = pgTable('monitoring_readings', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  pm25: decimal('pm25', { precision: 8, scale: 2 }),
  pm10: decimal('pm10', { precision: 8, scale: 2 }),
  no2: decimal('no2', { precision: 8, scale: 2 }),
  so2: decimal('so2', { precision: 8, scale: 2 }),
  o3: decimal('o3', { precision: 8, scale: 2 }),
  co: decimal('co', { precision: 8, scale: 2 }),
  airQualityIndex: decimal('air_quality_index', { precision: 8, scale: 2 }),
  overallRating: text('overall_rating'), // 'good', 'moderate', 'unhealthy', 'hazardous'
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const sourceRatings = pgTable('source_ratings', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  sourceId: text('source_id').notNull(),
  pollutionRating: decimal('pollution_rating', { precision: 5, scale: 2 }),
  distanceKm: decimal('distance_km', { precision: 8, scale: 2 }),
  contributionPercentage: decimal('contribution_percentage', { precision: 5, scale: 2 }),
  userId: text('userId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
