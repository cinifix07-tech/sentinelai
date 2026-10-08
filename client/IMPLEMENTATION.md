# Sentinel client

The HTML references remain in their original folders. The working React pages are:

- `src/login/login.jsx`: demo sign-in, password visibility, remember-device control.
- `src/dashboard/dash.jsx`: overview, demo security modes, token reveal/copy/rotation, sample telemetry, local assistant conversation and JSON export.
- `src/dashboard/userset.jsx`: editable profile, local demo password change, inactivity timeout, saved notification preference, local session revocation and logout.

The app uses `/login`, `/dashboard`, and `/settings`. Access-key and assistant navigation use dashboard anchors. URL navigation and saved sessions preserve the selected screen on refresh. Hosts must serve `index.html` for these app paths (Vite provides this in development and preview).

Run `npm run dev` from `client`. Initial demo credentials: `admin` / `admin123`. A password changed in Account settings replaces the default for this browser. Settings and demo data use `sentinel-client:` local-storage keys. Sessions use local storage when Remember this device is selected, and session storage otherwise. Admin session keys are separate.

These are local UI demonstrations, not production authentication or hardware integration. Tokens do not grant real API access; assistant replies and telemetry are samples. Two-factor authentication is marked as unavailable until an authentication provider is connected. The notification toggle saves a preference; it does not send notifications. Password hashing in browser storage does not make this a secure authentication system.

Design: deep graphite surfaces, lime accents, soft raised and inset shadows, responsive sidebar/bottom navigation, keyboard focus indicators and reduced-motion support.

Validation: client build and lint; server-rendered smoke checks for all three screens, both session storage choices, unauthenticated route gating, invalid JSON fallback and password digests. Interactive browser QA could not run because the browser tool failed to initialize.
