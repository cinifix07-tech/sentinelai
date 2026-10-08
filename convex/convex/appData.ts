import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function isBackendRequest(token: string) {
  const expected = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CONVEX_CONTROL_TOKEN;
  return Boolean(expected && token && token === expected);
}

function recordPayload(record: { legacyId: string; payload: unknown }) {
  const payload = (record.payload && typeof record.payload === "object") ? record.payload as Record<string, unknown> : {};
  return { ...payload, _legacy_id: record.legacyId };
}

export const listRecords = query({
  args: { token: v.string(), tableName: v.string(), limit: v.optional(v.number()), orderField: v.optional(v.string()), descending: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 1000);
    const records = await ctx.db.query("legacyRecords")
      .withIndex("by_table", (q) => q.eq("tableName", args.tableName))
      .collect();
    const field = args.orderField || "created_at";
    records.sort((a, b) => {
      const av = (a.payload as Record<string, unknown>)?.[field];
      const bv = (b.payload as Record<string, unknown>)?.[field];
      const left = av == null ? "" : String(av);
      const right = bv == null ? "" : String(bv);
      return (args.descending === false ? 1 : -1) * left.localeCompare(right);
    });
    return records.slice(0, limit).map(recordPayload);
  },
});

export const findRecord = query({
  args: { token: v.string(), tableName: v.string(), legacyId: v.string() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const record = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    return record ? recordPayload(record) : null;
  },
});

export const insertRecord = mutation({
  args: { token: v.string(), tableName: v.string(), legacyId: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (existing) throw new Error("Record already exists");
    await ctx.db.insert("legacyRecords", { tableName: args.tableName, legacyId: args.legacyId, payload: args.payload, importedAt: Date.now() });
    return recordPayload({ legacyId: args.legacyId, payload: args.payload });
  },
});

export const updateRecord = mutation({
  args: { token: v.string(), tableName: v.string(), legacyId: v.string(), patch: v.any() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (!existing) return null;
    const payload = (existing.payload && typeof existing.payload === "object") ? existing.payload as Record<string, unknown> : {};
    const nextPayload = { ...payload, ...(args.patch as Record<string, unknown>) };
    await ctx.db.patch(existing._id, { payload: nextPayload, importedAt: Date.now() });
    return recordPayload({ legacyId: args.legacyId, payload: nextPayload });
  },
});

export const deleteRecord = mutation({
  args: { token: v.string(), tableName: v.string(), legacyId: v.string() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (!existing) return null;
    const row = recordPayload(existing);
    await ctx.db.delete(existing._id);
    return row;
  },
});

export const userByEmail = query({
  args: { token: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const email = args.email.trim().toLowerCase();
    const record = await ctx.db
      .query("legacyRecords")
      .withIndex("by_table", (q) => q.eq("tableName", "users"))
      .collect();
    const match = record.find((item) => {
      const payload = item.payload as Record<string, unknown>;
      return String(payload.email ?? "").toLowerCase() === email;
    });
    return match ? match.payload : null;
  },
});

export const updateUserPassword = mutation({
  args: { token: v.string(), email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    if (!isBackendRequest(args.token)) throw new Error("Unauthorized");
    const email = args.email.trim().toLowerCase();
    const records = await ctx.db
      .query("legacyRecords")
      .withIndex("by_table", (q) => q.eq("tableName", "users"))
      .collect();
    const record = records.find((item) => {
      const payload = item.payload as Record<string, unknown>;
      return String(payload.email ?? "").toLowerCase() === email;
    });
    if (!record) return { updated: false };
    const payload = record.payload as Record<string, unknown>;
    const { password: _legacyPassword, ...safePayload } = payload;
    await ctx.db.patch(record._id, {
      payload: { ...safePayload, password_hash: args.passwordHash },
      importedAt: Date.now(),
    });
    return { updated: true };
  },
});
