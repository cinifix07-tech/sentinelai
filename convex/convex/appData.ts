import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

function recordPayload(record: { legacyId: string; payload: unknown }) {
  const payload = (record.payload && typeof record.payload === "object") ? record.payload as Record<string, unknown> : {};
  return { ...payload, _legacy_id: record.legacyId };
}

export const listRecords = internalQuery({
  args: { tableName: v.string(), limit: v.optional(v.number()), orderField: v.optional(v.string()), descending: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
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

export const findRecord = internalQuery({
  args: { tableName: v.string(), legacyId: v.string(), idField: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const record = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (record) return recordPayload(record);
    const records = await ctx.db.query("legacyRecords").withIndex("by_table", (q) => q.eq("tableName", args.tableName)).collect();
    const match = records.find((item) => String((item.payload as Record<string, unknown>)?.[args.idField || "id"] ?? "") === args.legacyId);
    return match ? recordPayload(match) : null;
  },
});

export const insertRecord = internalMutation({
  args: { tableName: v.string(), legacyId: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (existing) throw new Error("Record already exists");
    await ctx.db.insert("legacyRecords", { tableName: args.tableName, legacyId: args.legacyId, payload: args.payload, importedAt: Date.now() });
    return recordPayload({ legacyId: args.legacyId, payload: args.payload });
  },
});

export const updateRecord = internalMutation({
  args: { tableName: v.string(), legacyId: v.string(), idField: v.optional(v.string()), patch: v.any() },
  handler: async (ctx, args) => {
    let existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (!existing) {
      const records = await ctx.db.query("legacyRecords").withIndex("by_table", (q) => q.eq("tableName", args.tableName)).collect();
      existing = records.find((item) => String((item.payload as Record<string, unknown>)?.[args.idField || "id"] ?? "") === args.legacyId) ?? null;
    }
    if (!existing) return null;
    const payload = (existing.payload && typeof existing.payload === "object") ? existing.payload as Record<string, unknown> : {};
    const nextPayload = { ...payload, ...(args.patch as Record<string, unknown>) };
    await ctx.db.patch(existing._id, { payload: nextPayload, importedAt: Date.now() });
    return recordPayload({ legacyId: args.legacyId, payload: nextPayload });
  },
});

export const deleteRecord = internalMutation({
  args: { tableName: v.string(), legacyId: v.string(), idField: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let existing = await ctx.db.query("legacyRecords")
      .withIndex("by_table_legacy_id", (q) => q.eq("tableName", args.tableName).eq("legacyId", args.legacyId))
      .unique();
    if (!existing) {
      const records = await ctx.db.query("legacyRecords").withIndex("by_table", (q) => q.eq("tableName", args.tableName)).collect();
      existing = records.find((item) => String((item.payload as Record<string, unknown>)?.[args.idField || "id"] ?? "") === args.legacyId) ?? null;
    }
    if (!existing) return null;
    const row = recordPayload(existing);
    await ctx.db.delete(existing._id);
    return row;
  },
});

export const userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const account = await ctx.db.query("userAccounts").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (account) {
      return {
        user_id: account.legacyUserId,
        full_name: account.fullName,
        email: account.email,
        password_hash: account.passwordHash,
        role: account.role,
        created_at: account.createdAt,
        residence: account.residence,
        last_seen_at: account.lastSeenAt,
        is_active: account.isActive,
        phone: account.phone,
        first_name: account.firstName,
        last_name: account.lastName,
        username: account.username,
      };
    }
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

export const updateUserPassword = internalMutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const account = await ctx.db.query("userAccounts").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (account) await ctx.db.patch(account._id, { passwordHash: args.passwordHash });
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

export const updateUserProfile = internalMutation({
  args: { currentEmail: v.string(), patch: v.any() },
  handler: async (ctx, args) => {
    const currentEmail = args.currentEmail.trim().toLowerCase();
    const patch = args.patch as Record<string, unknown>;
    const nextEmail = String(patch.email || currentEmail).trim().toLowerCase();
    const account = await ctx.db.query("userAccounts").withIndex("by_email", (q) => q.eq("email", currentEmail)).unique();
    if (!account) return null;
    const duplicate = await ctx.db.query("userAccounts").withIndex("by_email", (q) => q.eq("email", nextEmail)).unique();
    if (duplicate && duplicate._id !== account._id) throw new Error("That email address is already in use.");

    const firstName = String(patch.first_name || account.firstName || account.fullName.split(" ")[0] || "").trim();
    const lastName = String(patch.last_name || account.lastName || account.fullName.split(" ").slice(1).join(" ") || "").trim();
    const nextAccount = {
      fullName: String(patch.full_name || account.fullName),
      email: nextEmail,
      firstName,
      lastName,
      username: nextEmail,
      residence: String(patch.residence || account.residence || ""),
      ...(patch.phone ? { phone: String(patch.phone) } : { phone: account.phone }),
    };
    await ctx.db.patch(account._id, nextAccount);

    const records = await ctx.db.query("legacyRecords").withIndex("by_table", (q) => q.eq("tableName", "users")).collect();
    const record = records.find((item) => {
      const payload = item.payload as Record<string, unknown>;
      return String(payload.email || "").toLowerCase() === currentEmail || String(payload.user_id || "") === account.legacyUserId;
    });
    if (record) {
      const payload = record.payload as Record<string, unknown>;
      await ctx.db.patch(record._id, {
        payload: { ...payload, ...{
          full_name: nextAccount.fullName,
          email: nextAccount.email,
          username: nextAccount.username,
          first_name: nextAccount.firstName,
          last_name: nextAccount.lastName,
          residence: nextAccount.residence,
          phone: nextAccount.phone || null,
        } },
        importedAt: Date.now(),
      });
    }
    return {
      user_id: account.legacyUserId,
      full_name: nextAccount.fullName,
      email: nextAccount.email,
      username: nextAccount.username,
      first_name: nextAccount.firstName,
      last_name: nextAccount.lastName,
      residence: nextAccount.residence,
      phone: nextAccount.phone,
      role: account.role,
      is_active: account.isActive,
      _legacy_id: account.legacyUserId,
    };
  },
});

export const upsertUserAccount = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const payload = args.payload as Record<string, unknown>;
    const optionalString = (field: string) => typeof payload[field] === "string" ? payload[field] as string : undefined;
    const account = {
      legacyUserId: String(payload.user_id || payload._legacy_id || ""),
      fullName: String(payload.full_name || payload.email || "User"),
      email: String(payload.email || "").toLowerCase(),
      passwordHash: String(payload.password_hash || payload.password || ""),
      role: String(payload.role || "USER"),
      isActive: payload.is_active !== false,
      ...(optionalString("created_at") ? { createdAt: optionalString("created_at") } : {}),
      ...(optionalString("residence") ? { residence: optionalString("residence") } : {}),
      ...(optionalString("last_seen_at") ? { lastSeenAt: optionalString("last_seen_at") } : {}),
      ...(optionalString("phone") ? { phone: optionalString("phone") } : {}),
      ...(optionalString("first_name") ? { firstName: optionalString("first_name") } : {}),
      ...(optionalString("last_name") ? { lastName: optionalString("last_name") } : {}),
      ...(optionalString("username") ? { username: optionalString("username") } : {}),
    };
    const existing = await ctx.db.query("userAccounts").withIndex("by_legacy_id", (q) => q.eq("legacyUserId", account.legacyUserId)).unique();
    if (existing) await ctx.db.patch(existing._id, account);
    else await ctx.db.insert("userAccounts", account);
    return account;
  },
});
