import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    legacyUserId: v.optional(v.string()),
    role: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  }).index("email", ["email"]).index("phone", ["phone"]).index("legacyUserId", ["legacyUserId"]),
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
  // Application accounts are separate from Convex Auth's reserved `users` table.
  userAccounts: defineTable({
    legacyUserId: v.string(),
    fullName: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.string(),
    createdAt: v.optional(v.string()),
    residence: v.optional(v.string()),
    lastSeenAt: v.optional(v.string()),
    isActive: v.boolean(),
    phone: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    noiseAudioData: v.optional(v.string()),
    noiseAudioName: v.optional(v.string()),
    noiseAudioType: v.optional(v.string()),
    voiceAudioData: v.optional(v.string()),
    voiceAudioName: v.optional(v.string()),
    voiceAudioType: v.optional(v.string()),
  }).index("by_email", ["email"]).index("by_legacy_id", ["legacyUserId"]),
  authorizedProfiles: defineTable({
    legacyProfileId: v.string(),
    userId: v.optional(v.string()),
    securityPhrase: v.optional(v.string()),
    voiceReference: v.optional(v.string()),
    status: v.string(),
    createdAt: v.optional(v.string()),
  }).index("by_user", ["userId"]).index("by_legacy_id", ["legacyProfileId"]),
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
    soundMuted: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_state", ["stateId"]),
});
