# Lorikeet Softphone

A React Native Android/iOS softphone built on the [Twilio Voice SDK](https://www.twilio.com/docs/voice/sdks/javascript). Supports outbound and inbound calls, call transfer, team extensions, call log, leads list, and SMS conversations — secured with per-user JWT authentication against your own backend.

---

## Features

| Feature | Details |
|---------|---------|
| **Authentication** | Email + password login; 7-day JWT sessions stored on-device |
| **Voice calls** | Outbound + inbound via Twilio Voice SDK |
| **Caller ID selection** | Pick which of your numbers shows on outbound calls |
| **Incoming call overlay** | Animated modal with accept / reject |
| **Mute / DTMF** | Mute mic, send tones during a live call |
| **Call transfer** | Blind-transfer to any number or a team extension |
| **Call log** | Full history with inbound/outbound/missed icons, tap to redial |
| **Extensions** | Quick-dial team members; one-tap transfer during an active call |
| **Leads** | View inbound leads, tap to call |
| **SMS** | Conversation list, threaded view, send messages |

---

## Prerequisites

- **Node** ≥ 18
- **Java** 17 (React Native requires Java 17; newer major versions may break Gradle)
- **Android Studio** + Android SDK (API 31+)
- A connected Android device or emulator
- A backend that exposes the endpoints described below

---

## 1 — Backend setup

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth` | POST | Login — returns a signed JWT |
| `/api/twilio-mobile-token` | GET | Returns a Twilio Access Token (Voice grant) |
| `/api/twilio-mobile-api` | POST | Call logs, SMS, leads, call transfer |
| `/api/agent-control` | POST | Agent registration and presence heartbeat |

Reference implementations in PHP are included in [`backend/`](backend/) for the Twilio endpoints. The auth endpoint (`/api/auth`) is **not** included in this repository; it connects directly to your production user database and should be kept private.

### Auth endpoint (implement privately)

The login endpoint accepts:
```
POST /api/auth
action=login&email=user@example.com&password=secret
```

On success it returns:
```json
{ "success": true, "token": "<hs256-jwt>" }
```

The JWT payload must include at minimum: `sub` (user id), `email`, `name`, `exp`.

Sign with `HS256` using a `JWT_SECRET` environment variable shared between `/api/auth` and the other mobile endpoints.

### User credentials table

Create a `mobile_credentials` table in your production database for users authorized to access the softphone:

```sql
CREATE TABLE mobile_credentials (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) DEFAULT NULL,
  active        TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP   NULL DEFAULT NULL,
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Add authorized users:
```sql
-- Generate the hash in PHP: echo password_hash('password', PASSWORD_BCRYPT);
INSERT INTO mobile_credentials (email, password_hash, full_name)
VALUES ('agent@yourcompany.com', '$2y$12$...', 'Agent Name');
```

### Environment variables

```
JWT_SECRET=<64-char random hex>   # openssl rand -hex 32
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
TWILIO_TWIML_APP_SID=AP...
```

### Twilio TwiML App

Your TwiML App's Voice URL must `<Dial>` to a `<Client>` identity that matches the agent identity assigned by the Agent Control API. The app registers each device on first launch and re-registers with the correct identity on every login.

### Optional: background incoming calls (FCM)

To receive calls when the app is **in the background**:

1. Create a Firebase project and add the Android app.
2. Download `google-services.json` → `android/app/google-services.json`.
3. Follow the [`@react-native-firebase/messaging`](https://rnfirebase.io/messaging/usage) guide.
4. In Twilio console → Voice → Push Credentials → create an FCM credential.
5. Set `TWILIO_PUSH_CREDENTIAL_SID` in your backend environment.

Without FCM the app rings normally when it is open in the foreground.

---

## 2 — App configuration

Edit [src/config/index.ts](src/config/index.ts):

```ts
export const Config = {
  /** Your backend base URL (no trailing slash) */
  BASE_URL: 'https://your-server.example.com',

  /** Caller ID numbers shown in the picker */
  CALLER_IDS: [
    { label: 'Main',    number: '+15550001111' },
    { label: 'Support', number: '+15550002222' },
  ],

  /** Team extensions for quick-dial and in-call transfer */
  EXTENSIONS: [
    { ext: '100', name: 'Main Line',  number: '+15550001111' },
    { ext: '101', name: 'Support',    number: '+15550002222' },
    { ext: '102', name: 'Sales',      number: '+15550003333' },
  ],

  /** Known contacts for caller-ID name resolution */
  CONTACTS: {
    '+15550001111': 'Main Line',
    '+15550002222': 'Support',
  } as Record<string, string>,
};
```

---

## 3 — Install & run

```bash
npm install
npm start          # Metro bundler
npm run android    # Build and install on device / emulator
```

---

## 4 — Android native setup

### Java version

```bash
# Check current version
java --version

# Switch to Java 17 if needed (Arch)
sudo archlinux-java set java-17-openjdk

# Ubuntu / Debian
sudo update-alternatives --config java

# Or set JAVA_HOME:
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
```

### Vector icons

Fonts are bundled automatically via the `apply from: ...fonts.gradle` line in `android/app/build.gradle`. No extra steps required.

### Ringtone

Place your ringtone at `android/app/src/main/res/raw/incoming_call.mp3` (note underscore — Android resource names cannot contain hyphens).

---

## Project structure

```
src/
├── config/index.ts                # All configurable values — edit this first
├── contexts/
│   ├── AuthContext.tsx            # Login / logout / JWT persistence
│   ├── CallContext.tsx            # Global call state (active call, mute, timer…)
│   └── AgentContext.tsx           # Agent registration and presence
├── navigation/AppNavigator.tsx    # Auth gate → login or tab bar
├── screens/
│   ├── LoginScreen.tsx
│   ├── DialerScreen.tsx
│   ├── CallLogScreen.tsx
│   ├── ExtensionsScreen.tsx
│   ├── LeadsScreen.tsx
│   ├── SMSScreen.tsx
│   └── SMSThreadScreen.tsx
├── components/
│   ├── IncomingCallOverlay.tsx
│   └── TransferModal.tsx
└── services/
    ├── authToken.ts               # Module-level JWT store (used by api.ts)
    ├── api.ts                     # REST calls to your backend
    ├── agentControl.ts            # Agent presence API
    └── twilioService.ts           # @twilio/voice-react-native-sdk wrapper

backend/                           # PHP reference implementations (public)
├── twilio-mobile-token.php
└── twilio-mobile-api.php
# backend/auth.php is private — not included in this repository
```

---

## Auth flow

1. App launches → checks AsyncStorage for a saved JWT
2. If the JWT exists and is not expired → goes straight to the dialer
3. If no JWT or expired → shows the login screen
4. User enters email + password → `POST /api/auth` → JWT saved to AsyncStorage
5. All subsequent API calls send `Authorization: Bearer <jwt>`
6. Sign out via the Extensions tab → clears the JWT and returns to login

---

## License

MIT
