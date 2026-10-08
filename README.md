# Edge-AI Smart Home Security System

This repository now includes a complete REST-based architecture for the existing PostgreSQL database `smart_home_security`.

Flow:
## CINIFIX TECH BY GROUP 1
```text
ESP32 hardware -> Express REST API -> PostgreSQL -> React dashboard
```

The ESP32 should never connect directly to PostgreSQL.

## Created Structure

```text
backend/
  src/config/database.js
  src/controllers/
  src/routes/
  src/middleware/
  src/models/
  src/services/seedUsers.js
  src/socket/
  src/server.js
  API.md
  .env.example

frontend/
  src/App.jsx
  src/api.js
  src/main.jsx
  src/styles.css
  .env.example
```

## Run Backend

```bash
cd backend
npm install
copy .env.example .env
npm run seed:admin
npm run dev
```

## Run Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Existing Admin And Client Portals

The existing `admin/` and `client/` apps now authenticate against the backend too.

- `admin/` accepts only users with role `ADMIN`.
- `client/` accepts only users with role `USER`.
- Optional redirect URLs can be set with `VITE_ADMIN_URL` and `VITE_CLIENT_URL`.

Backend API documentation is in `backend/API.md`.
