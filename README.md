# PG Monitor

PG Monitor is an Expo React Native app for managing PostgreSQL connection settings and viewing real monitoring results returned by a backend. It is written in JavaScript and JSX and uses Expo Router.

## Run the app

```bash
npx expo start
```

Use a development build for native notification and Face ID testing. Expo Go supports local notifications and fingerprint/passcode prompts; Face ID requires a development build.

## Local data and credentials

- Profiles, database metadata, schedules, preferences, and monitoring history are stored with AsyncStorage.
- Local account passwords are derived with PBKDF2-HMAC-SHA256 and a random per-account salt. The verifier is stored in SecureStore.
- PostgreSQL passwords and the optional backend token are stored in SecureStore. They are excluded from JSON exports.
- Local accounts are device-specific. They do not sync to a cloud identity service.
- Importing a database configuration intentionally resets its status and disables its schedule; enter its password again before running a manual check.

## Monitoring backend contract

The app never opens a PostgreSQL socket. `src/services/api.js` is the backend boundary and sends database credentials only over HTTPS (plain HTTP is permitted for loopback development hosts). Optionally configure a checker endpoint URL and bearer token in Monitoring settings. The app accepts either a checker base URL (which uses `/api/monitor/check/`) or the direct check endpoint URL, such as `https://example.com/monitor/check/`. The checker can run on a computer or server you control on your private network; it does not need to be a cloud service.

The direct check endpoint needs only this route:

- `POST /api/monitor/check/` — perform a real check and return `{ "success": true, "latency_ms": 32, "checked_at": "..." }`, or `{ "success": false, "error_code": "...", "checked_at": "..." }`.
This check-only endpoint supports manual checks. It does not sync database configurations, run schedules, or register push tokens. A backend scheduler and push integration require their own compatible routes. The backend must protect credentials at rest, validate authorization where possible, use bounded timeouts, and redact secrets from logs. The mobile app cannot open raw PostgreSQL sockets and includes no Django/Celery checker server; a saved local schedule alone does not run while the app is closed.

## Project structure

- `src/app/` — Expo Router routes and tabs.
- `src/state/AppContext.jsx` — app state, local authentication, persistence, and secure credential access.
- `src/services/api.js` — monitoring checker request and response handling.
- `src/services/notifications.js` — local alert generation for real check outcomes.
- `src/components/ui.jsx` — shared theme-aware controls.
