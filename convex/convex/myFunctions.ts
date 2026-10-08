import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(args.count);
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get("users", userId);
    return {
      viewer: user?.email ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    //// Insert or modify documents in the database here.
    //// Mutations can also read from the database like queries.
    //// See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
    // Optionally, return a value from your mutation.
    // return id;
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

export const listLegacyRecords = query({
  args: {
    tableName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 1000);
    return ctx.db
      .query("legacyRecords")
      .withIndex("by_table", (query) => query.eq("tableName", args.tableName))
      .order("desc")
      .take(limit);
  },
});

export const listSensorReadings = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 100);
    return ctx.db
      .query("legacyRecords")
      .withIndex("by_table", (query) => query.eq("tableName", "sensor_readings"))
      .order("desc")
      .take(limit);
  },
});

export const migrationSummary = query({
  args: {},
  handler: async (ctx) => {
    const tableNames = [
      "access_attempts", "alerts", "authorized_profiles", "communication_group_members",
      "communication_group_messages", "communication_groups", "communication_messages",
      "communication_visitors", "device_logs", "devices", "interview_questions",
      "iot_security_state", "security_events", "security_sessions", "sensor_readings",
      "users", "voice_interactions",
    ];
    const counts = {} as Record<string, number>;
    for (const tableName of tableNames) {
      counts[tableName] = (await ctx.db.query("legacyRecords")
        .withIndex("by_table", (query) => query.eq("tableName", tableName))
        .collect()).length;
    }
    counts.legacyRecordChunks = (await ctx.db.query("legacyRecordChunks").collect()).length;
    return counts;
  },
});

// Used only by the one-time PostgreSQL migration utility. Keep the token in Convex env.
export const importLegacyBatch = internalMutation({
  args: {
    tableName: v.string(),
    records: v.array(v.object({
      legacyId: v.string(),
      payload: v.any(),
      sourceCreatedAt: v.optional(v.string()),
      chunks: v.optional(v.array(v.object({
        fieldPath: v.string(),
        chunkIndex: v.number(),
        data: v.string(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let imported = 0;
    for (const record of args.records) {
      const existing = await ctx.db
        .query("legacyRecords")
        .withIndex("by_table_legacy_id", (query) => query.eq("tableName", args.tableName).eq("legacyId", record.legacyId))
        .unique();
      const value = {
        tableName: args.tableName,
        legacyId: record.legacyId,
        payload: record.payload,
        importedAt: now,
        ...(record.sourceCreatedAt ? { sourceCreatedAt: record.sourceCreatedAt } : {}),
      };
      if (existing) await ctx.db.patch(existing._id, value);
      else await ctx.db.insert("legacyRecords", value);
      for (const chunk of record.chunks ?? []) {
        const existingChunk = await ctx.db
          .query("legacyRecordChunks")
          .withIndex("by_record_chunk", (query) => query
            .eq("tableName", args.tableName)
            .eq("legacyId", record.legacyId)
            .eq("fieldPath", chunk.fieldPath)
            .eq("chunkIndex", chunk.chunkIndex))
          .unique();
        const chunkValue = {
          tableName: args.tableName,
          legacyId: record.legacyId,
          fieldPath: chunk.fieldPath,
          chunkIndex: chunk.chunkIndex,
          data: chunk.data,
        };
        if (existingChunk) await ctx.db.patch(existingChunk._id, chunkValue);
        else await ctx.db.insert("legacyRecordChunks", chunkValue);
      }
      imported += 1;
    }
    return { tableName: args.tableName, imported };
  },
});
