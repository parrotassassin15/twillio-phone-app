# Twilio Softphone — Android

A React Native Android softphone built on the [Twilio Voice SDK](https://www.twilio.com/docs/voice/sdks/javascript). Supports outbound and inbound calls, call transfer, team extensions, call log, leads list, and SMS conversations — all authenticated against your own backend.

---

## Features

| Feature | Details |
|---------|---------|
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
- A backend that exposes the two API endpoints described below

---

## 1 — Backend setup

This app expects two endpoints on your server, authenticated with a shared Bearer token:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/twilio-mobile-token` | GET | Returns a Twilio Access Token (JWT with Voice grant) |
| `/api/twilio-mobile-api` | POST | Call logs, SMS, leads, call transfer |

Reference implementations in PHP are included in [`backend/`](backend/):
- `twilio-mobile-token.php`
- `twilio-mobile-api.php`

Both read a `$mobile_api_key` variable from your credentials file. Generate one:

```bash
openssl rand -hex 32
```

### Twilio TwiML App

Your TwiML App's Voice URL must `<Dial>` to a `<Client>` whose identity matches `TWILIO_CLIENT_IDENTITY` in your config (default: `softphone_agent`). The mobile app registers under the same identity so inbound calls ring both the browser and the device simultaneously.

### Optional: background incoming calls (FCM)

To receive calls when the app is **in the background**:

1. Create a Firebase project and add the Android app.
2. Download `google-services.json` → `android/app/google-services.json`.
3. Follow the [`@react-native-firebase/messaging`](https://rnfirebase.io/messaging/usage) guide.
4. In Twilio console → Voice → Push Credentials → create an FCM credential.
5. Set `$twilio_push_credential_sid` in your backend credentials.

Without FCM the app rings normally when it is open in the foreground.

---

## 2 — App configuration

Edit [src/config/index.ts](src/config/index.ts):

```ts
export const Config = {
  /** Your backend base URL (no trailing slash) */
  BASE_URL: 'https://your-server.example.com',

  /** Must match $mobile_api_key in your backend */
  MOBILE_API_KEY: process.env.MOBILE_API_KEY ?? 'REPLACE_ME',

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

For production builds, supply `MOBILE_API_KEY` via an environment variable or `react-native-config`.

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
├── config/index.ts           # All configurable values — edit this first
├── contexts/CallContext.tsx  # Global call state (active call, mute, timer…)
├── navigation/AppNavigator.tsx
├── screens/
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
    ├── api.ts               # REST calls to your backend
    └── twilioService.ts     # @twilio/voice-react-native-sdk wrapper

backend/
├── twilio-mobile-token.php  # Token endpoint (PHP reference implementation)
└── twilio-mobile-api.php    # API endpoint  (PHP reference implementation)
```

---

## License

MIT
