# Smart Home Security API

Base URL: `http://localhost:4000/api`

Authentication: send `Authorization: Bearer <token>` for every route except `POST /auth/login`, password reset endpoints, and `GET /health`.

## Auth

`POST /auth/login`

```json
{ "email": "admin@cinifix.com", "password": "0147" }
```

Response:

```json
{ "token": "...", "user_id": 1, "full_name": "Cinifix Admin", "role": "ADMIN" }
```

`POST /auth/send-reset-otp`

```json
{ "email": "admin@cinifix.com" }
```

Generates a 6-digit password reset OTP. If `SMTP_USER` and `SMTP_PASS` are configured, the code is sent through SMTP. Otherwise the response includes `dev_otp` for local development.

`POST /auth/verify-reset-otp`

```json
{ "email": "admin@cinifix.com", "code": "123456" }
```

`POST /auth/reset-password`

```json
{ "email": "admin@cinifix.com", "password": "0147" }
```

## Devices

- `GET /devices`
- `POST /devices`
- `PUT /devices/:id`
- `POST /devices/:device_code/heartbeat`

Heartbeat sets `is_online = true` and `last_seen = CURRENT_TIMESTAMP`.

## Security Flow

- `POST /security/session`
- `POST /interview/questions`
- `POST /interview/response`
- `GET /access/attempts`
- `POST /access/attempt`

## Sensors

- `POST /sensors/data`
- `GET /sensors/latest/:device_id`

Example sensor payload:

```json
{ "device_id": 1, "motion_detected": true, "audio_detected": false, "audio_level": 75 }
```

## IoT Device Ingest

- `POST /iot/ingest`
- `GET /iot/latest`
- `GET /iot/activity`

The ESP32/Wokwi simulator should send `x-device-key: <IOT_DEVICE_API_KEY>` to `POST /iot/ingest`.

```json
{
  "device_code": "esp32-porch-01",
  "device_name": "ESP32 Porch Node",
  "location": "Front entrance",
  "device_type": "ESP32 PIR",
  "motion_detected": true,
  "audio_detected": false,
  "audio_level": 100
}
```

## Events And Alerts

- `POST /events`
- `GET /events`
- `POST /alerts`
- `GET /alerts`
- `PUT /alerts/:id/read`

Supported event types: `MOTION_DETECTED`, `VOICE_AUTH_SUCCESS`, `VOICE_AUTH_FAILED`, `ACCESS_GRANTED`, `ACCESS_DENIED`.

## Dashboard

- `GET /dashboard`

Returns devices, latest readings, sessions, voice interaction history, alerts, and event timeline.

## Realtime Events

Socket.IO emits: `device:heartbeat`, `session:created`, `interview:question`, `interview:response`, `access:denied`, `sensor:reading`, `motion:detected`, `security:event`, `alert:new`, and `alert:read`.
