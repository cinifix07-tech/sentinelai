import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

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
    const expected = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.MIGRATION_TOKEN;
    const provided = request.headers.get("x-migration-token");
    if (!expected || provided !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const result = await ctx.runMutation(api.myFunctions.importLegacyBatch, body);
    return Response.json(result);
  }),
});

export default http;
