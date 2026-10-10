import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function requireDeviceToken(token: string) {
  const expected = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.IOT_DEVICE_API_KEY;
  if (!expected || token !== expected) throw new Error("Invalid device token");
}

function requireBackendControlToken(token: string) {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  // Production currently names this shared secret CONVEX_CONTROL_TOKEN;
  // retain BACKEND_CONTROL_TOKEN for older local deployments.
  const expected = env.BACKEND_CONTROL_TOKEN || env.CONVEX_CONTROL_TOKEN;
  if (!expected || token !== expected) throw new Error("Invalid backend control token");
}

async function readState(ctx: any) {
  return (await ctx.db.query("iotSecurityState").withIndex("by_state", (q: any) => q.eq("stateId", 1)).unique())
    ?? { stateId: 1, mode: "away" as const, lockdownActive: false, soundMuted: false, updatedAt: Date.now() };
}

export const recordReading = mutation({
  args: {
    token: v.string(), deviceCode: v.string(), deviceName: v.string(), location: v.string(), deviceType: v.string(),
    motionDetected: v.boolean(), audioDetected: v.boolean(), audioLevel: v.number(),
  },
  handler: async (ctx, args) => {
    requireDeviceToken(args.token);
    const now = Date.now();
    const existing = await ctx.db.query("iotDevices").withIndex("by_code", (q) => q.eq("deviceCode", args.deviceCode)).unique();
    const device = { deviceCode: args.deviceCode, deviceName: args.deviceName, location: args.location, deviceType: args.deviceType, isOnline: true, lastSeen: now };
    if (existing) await ctx.db.patch(existing._id, device); else await ctx.db.insert("iotDevices", device);
    const reading = await ctx.db.insert("iotSensorReadings", {
      deviceCode: args.deviceCode,
      deviceName: args.deviceName,
      location: args.location,
      deviceType: args.deviceType,
      motionDetected: args.motionDetected,
      audioDetected: args.audioDetected,
      audioLevel: args.audioLevel,
      recordedAt: now,
    });
    let event = null;
    const state = await readState(ctx);
    if (args.motionDetected) {
      event = await ctx.db.insert("iotSecurityEvents", { deviceCode: args.deviceCode, eventType: "MOTION_DETECTED", eventStatus: state.mode === "disarm" ? "passive" : "info", description: `${args.deviceName} detected motion (${state.mode})`, confidence: 0.98, occurredAt: now });
    }
    return { reading, event, state, recordedAt: now };
  },
});

export const latest = query({
  args: { token: v.string(), deviceCode: v.string() },
  handler: async (ctx, args) => {
    requireDeviceToken(args.token);
    const device = await ctx.db.query("iotDevices").withIndex("by_code", (q) => q.eq("deviceCode", args.deviceCode)).unique();
    const reading = await ctx.db.query("iotSensorReadings").withIndex("by_device_time", (q) => q.eq("deviceCode", args.deviceCode)).order("desc").first();
    return { device, reading, state: await readState(ctx) };
  },
});

export const activity = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireDeviceToken(args.token);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 5000);
    const events = await ctx.db.query("iotSecurityEvents").withIndex("by_time").order("desc").take(limit);
    return await Promise.all(events.map(async (event) => {
      const device = await ctx.db.query("iotDevices").withIndex("by_code", (q) => q.eq("deviceCode", event.deviceCode)).unique();
      const reading = await ctx.db.query("iotSensorReadings")
        .withIndex("by_device_time", (q) => q.eq("deviceCode", event.deviceCode).eq("recordedAt", event.occurredAt))
        .unique();
      return {
        id: `security-event-${event._id}`,
        title: "PIR motion detected",
        detail: event.description,
        time: new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        icon: "radar",
        tone: event.eventStatus === "passive" ? "muted" : "info",
        created_at: new Date(event.occurredAt).toISOString(),
        location: device?.location || "Front entrance",
        device_type: device?.deviceType || "ESP32 PIR",
        audio_detected: reading?.audioDetected || false,
        audio_level: reading?.audioLevel || 0,
        motion_detected: true,
        event_type: event.eventType,
        event_status: event.eventStatus,
        confidence: event.confidence,
      };
    }));
  },
});

export const readings = query({
  args: { token: v.string(), deviceCode: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requireDeviceToken(args.token);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 5000);
    const deviceCode = args.deviceCode;
    const rows = deviceCode
      ? await ctx.db.query("iotSensorReadings").withIndex("by_device_time", (q) => q.eq("deviceCode", deviceCode)).order("desc").take(limit)
      : await ctx.db.query("iotSensorReadings").withIndex("by_device_time").order("desc").take(limit);
    return {
      readings: rows.map((reading) => ({
        id: reading._id,
        reading_id: reading._id,
        device_id: reading.deviceCode,
        device_code: reading.deviceCode,
        device_name: reading.deviceName,
        location: reading.location,
        device_type: reading.deviceType,
        motion_detected: reading.motionDetected,
        audio_detected: reading.audioDetected,
        audio_level: reading.audioLevel,
        recorded_at: new Date(reading.recordedAt).toISOString(),
        created_at: new Date(reading.recordedAt).toISOString(),
      })),
    };
  },
});

export const mode = query({
  args: { token: v.string() },
  handler: async (ctx, args) => { requireDeviceToken(args.token); return { state: await readState(ctx) }; },
});

export const listDevices = query({
  args: { controlToken: v.string() },
  handler: async (ctx, args) => {
    requireBackendControlToken(args.controlToken);
    return await ctx.db.query("iotDevices").order("desc").collect();
  },
});

export const createDevice = mutation({
  args: {
    controlToken: v.string(), deviceCode: v.string(), deviceName: v.string(),
    location: v.string(), deviceType: v.string(), isOnline: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireBackendControlToken(args.controlToken);
    const existing = await ctx.db.query("iotDevices").withIndex("by_code", (q) => q.eq("deviceCode", args.deviceCode)).unique();
    if (existing) throw new Error("A device with that code already exists.");
    const now = Date.now();
    return await ctx.db.insert("iotDevices", {
      deviceCode: args.deviceCode,
      deviceName: args.deviceName,
      location: args.location,
      deviceType: args.deviceType,
      isOnline: args.isOnline ?? false,
      lastSeen: args.isOnline ? now : 0,
    });
  },
});

export const updateDevice = mutation({
  args: {
    controlToken: v.string(), id: v.id("iotDevices"), deviceName: v.optional(v.string()),
    location: v.optional(v.string()), deviceType: v.optional(v.string()), isOnline: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireBackendControlToken(args.controlToken);
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Device not found.");
    const patch: Record<string, unknown> = {};
    if (args.deviceName !== undefined) patch.deviceName = args.deviceName;
    if (args.location !== undefined) patch.location = args.location;
    if (args.deviceType !== undefined) patch.deviceType = args.deviceType;
    if (args.isOnline !== undefined) { patch.isOnline = args.isOnline; if (args.isOnline) patch.lastSeen = Date.now(); }
    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

export const deleteDevice = mutation({
  args: { controlToken: v.string(), id: v.id("iotDevices") },
  handler: async (ctx, args) => {
    requireBackendControlToken(args.controlToken);
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Device not found.");
    await ctx.db.delete(args.id);
    return { deleted: true, deviceCode: current.deviceCode };
  },
});

export const setMode = mutation({
  args: {
    controlToken: v.string(),
    mode: v.union(v.literal("away"), v.literal("home"), v.literal("disarm")),
    lockdownActive: v.optional(v.boolean()),
    soundMuted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireBackendControlToken(args.controlToken);
    const current = await readState(ctx);
    const lockdownActive = args.mode === "disarm" ? false : (args.lockdownActive ?? current.lockdownActive);
    const state = {
      stateId: 1,
      mode: args.mode,
      lockdownActive,
      soundMuted: args.soundMuted ?? current.soundMuted ?? false,
      updatedAt: Date.now(),
    };
    const existing = await ctx.db.query("iotSecurityState").withIndex("by_state", (q) => q.eq("stateId", 1)).unique();
    if (existing) await ctx.db.patch(existing._id, state); else await ctx.db.insert("iotSecurityState", state);
    return { state };
  },
});
