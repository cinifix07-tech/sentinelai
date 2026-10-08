import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

function backendToken(request: Request) {
  return request.headers.get("x-backend-control-token") || "";
}

function backendAuthorized(request: Request) {
  const expected = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CONVEX_CONTROL_TOKEN;
  return Boolean(expected && backendToken(request) && backendToken(request) === expected);
}

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function migrationAuthorized(request: Request, token: string) {
  const expected = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.MIGRATION_TOKEN;
  return { configured: Boolean(expected), valid: Boolean(expected && token && token === expected && request.headers.get("x-migration-token") === token) };
}

function tableFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("table") || "";
}

http.route({
  path: "/app/records",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const url = new URL(request.url);
    const tableName = tableFromRequest(request);
    const records = await ctx.runQuery(internal.appData.listRecords, {
      tableName,
      limit: Number(url.searchParams.get("limit") || 100),
      orderField: url.searchParams.get("order") || undefined,
      descending: url.searchParams.get("descending") !== "false",
    });
    return Response.json({ records });
  }),
});

http.route({
  path: "/app/records/find",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const url = new URL(request.url);
    const record = await ctx.runQuery(internal.appData.findRecord, { tableName: tableFromRequest(request), legacyId: url.searchParams.get("id") || "" });
    return Response.json({ record });
  }),
});

http.route({
  path: "/app/records",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const body = await request.json();
    const record = await ctx.runMutation(internal.appData.insertRecord, { tableName: String(body.table || ""), legacyId: String(body.id || crypto.randomUUID()), payload: body.payload || {} });
    return Response.json({ record });
  }),
});

http.route({
  path: "/app/records",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const body = await request.json();
    const record = await ctx.runMutation(internal.appData.updateRecord, { tableName: String(body.table || ""), legacyId: String(body.id || ""), patch: body.patch || {} });
    return Response.json({ record });
  }),
});

http.route({
  path: "/app/records",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const url = new URL(request.url);
    const record = await ctx.runMutation(internal.appData.deleteRecord, { tableName: tableFromRequest(request), legacyId: url.searchParams.get("id") || "" });
    return Response.json({ record });
  }),
});

http.route({
  path: "/app/users/by-email",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const url = new URL(request.url);
    const email = url.searchParams.get("email") || "";
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });
    try {
      const user = await ctx.runQuery(internal.appData.userByEmail, { email });
      return Response.json({ user });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
    }
  }),
});

http.route({
  path: "/app/users/password",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!backendAuthorized(request)) return unauthorized();
    const body = await request.json();
    try {
      const result = await ctx.runMutation(internal.appData.updateUserPassword, {
        email: String(body.email || ""),
        passwordHash: String(body.password_hash || ""),
      });
      return Response.json(result);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
    }
  }),
});

function deviceToken(request: Request) {
  return request.headers.get("x-device-key") || "";
}

http.route({
  path: "/iot/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const token = deviceToken(request);
    const result = await ctx.runMutation(api.iot.recordReading, {
      token,
      deviceCode: String(body.device_code || "esp32-porch-01"),
      deviceName: String(body.device_name || "ESP32 Porch Node"),
      location: String(body.location || "Front entrance"),
      deviceType: String(body.device_type || "ESP32 PIR"),
      motionDetected: Boolean(body.motion_detected),
      audioDetected: Boolean(body.audio_detected),
      audioLevel: Number.isFinite(Number(body.audio_level)) ? Number(body.audio_level) : 0,
    });
    return Response.json({ ok: true, ...result });
  }),
});

http.route({
  path: "/iot/latest",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const result = await ctx.runQuery(api.iot.latest, { token: deviceToken(request), deviceCode: url.searchParams.get("device_code") || "esp32-porch-01" });
    return Response.json({ ok: true, ...result });
  }),
});

http.route({
  path: "/iot/activity",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 100);
    const events = await ctx.runQuery(api.iot.activity, { token: deviceToken(request), limit });
    return Response.json({ ok: true, events });
  }),
});

http.route({
  path: "/iot/mode",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runQuery(api.iot.mode, { token: deviceToken(request) });
    return Response.json(result);
  }),
});

http.route({
  path: "/iot/mode",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runMutation(api.iot.setMode, {
      controlToken: request.headers.get("x-backend-control-token") || "",
      mode: body.mode,
      ...(typeof body.lockdown_active === "boolean" ? { lockdownActive: body.lockdown_active } : {}),
    });
    return Response.json({ ok: true, ...result });
  }),
});

http.route({
  path: "/migration/import",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const migrationAuth = migrationAuthorized(request, String(body.token || ""));
    if (!migrationAuth.configured) return Response.json({ error: "Migration token is not configured" }, { status: 503 });
    if (!migrationAuth.valid) return unauthorized();
    const { token: _token, ...migration } = body;
    const result = await ctx.runMutation(internal.myFunctions.importLegacyBatch, migration);
    return Response.json(result);
  }),
});

export default http;
