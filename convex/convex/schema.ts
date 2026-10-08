import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),
  legacyRecords: defineTable({
    tableName: v.string(),
    legacyId: v.string(),
    payload: v.any(),
    importedAt: v.number(),
    sourceCreatedAt: v.optional(v.string()),
  })
    .index("by_table", ["tableName"])
    .index("by_table_legacy_id", ["tableName", "legacyId"]),
  legacyRecordChunks: defineTable({
    tableName: v.string(),
    legacyId: v.string(),
    fieldPath: v.string(),
    chunkIndex: v.number(),
    data: v.string(),
  }).index("by_record_chunk", ["tableName", "legacyId", "fieldPath", "chunkIndex"]),
  migrationRuns: defineTable({
    tableName: v.string(),
    imported: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_table", ["tableName"]),
  iotDevices: defineTable({
    deviceCode: v.string(),
    deviceName: v.string(),
    location: v.string(),
    deviceType: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  }).index("by_code", ["deviceCode"]),
  iotSensorReadings: defineTable({
    deviceCode: v.string(),
    deviceName: v.string(),
    location: v.string(),
    deviceType: v.string(),
    motionDetected: v.boolean(),
    audioDetected: v.boolean(),
    audioLevel: v.number(),
    recordedAt: v.number(),
  }).index("by_device_time", ["deviceCode", "recordedAt"]),
  iotSecurityEvents: defineTable({
    deviceCode: v.string(),
    eventType: v.string(),
    eventStatus: v.string(),
    description: v.string(),
    confidence: v.number(),
    occurredAt: v.number(),
  }).index("by_time", ["occurredAt"]),
  iotSecurityState: defineTable({
    stateId: v.number(),
    mode: v.union(v.literal("away"), v.literal("home"), v.literal("disarm")),
    lockdownActive: v.boolean(),
    updatedAt: v.number(),
  }).index("by_state", ["stateId"]),
});
