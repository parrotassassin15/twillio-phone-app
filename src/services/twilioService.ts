/**
 * Thin wrapper around @twilio/voice-react-native-sdk.
 *
 * Keeps all Twilio-specific logic out of UI components so screens only
 * interact with the CallContext.
 */
import { Voice, Call, CallInvite } from '@twilio/voice-react-native-sdk';
import { fetchAccessToken } from './api';

export { Call, CallInvite };

const voice = new Voice();
let _token: string | null = null;
let _tokenExpiresAt = 0;
let _deviceId: string | null = null;
let _tokenPromise: Promise<string> | null = null;
let _registering = false;
let _lastRegisterAttempt = 0;
const MIN_REGISTER_INTERVAL_MS = 60_000;

/** Called by CallContext once the AgentContext has assigned a device ID. */
export function setDeviceId(id: string | null): void {
  if (id !== _deviceId) {
    _deviceId = id;
    _token = null; // invalidate cached token — identity may have changed
    _tokenExpiresAt = 0;
  }
}

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiresAt) return _token;
  if (_tokenPromise) return _tokenPromise;
  _tokenPromise = fetchAccessToken(_deviceId)
    .then(t => {
      _token = t;
      _tokenExpiresAt = Date.now() + 50 * 60 * 1000;
      _tokenPromise = null;
      return t;
    })
    .catch(err => {
      _tokenPromise = null;
      throw err;
    });
  return _tokenPromise;
}

export async function registerDevice(): Promise<void> {
  if (_registering) return;
  const now = Date.now();
  if (_token && now - _lastRegisterAttempt < MIN_REGISTER_INTERVAL_MS) return;
  _registering = true;
  _lastRegisterAttempt = now;
  try {
    const token = await getToken();
    await voice.register(token);
  } finally {
    _registering = false;
  }
}

export async function unregisterDevice(): Promise<void> {
  if (_token) await voice.unregister(_token);
}

export function onCallInvite(handler: (invite: CallInvite) => void): () => void {
  voice.on(Voice.Event.CallInvite, handler);
  return () => voice.off(Voice.Event.CallInvite, handler);
}


export async function makeCall(to: string, callerId: string): Promise<Call> {
  const token = await getToken();
  const call = await voice.connect(token, {
    params: { To: to, CallerId: callerId },
  });
  return call;
}

export function hangUp(call: Call): void {
  call.disconnect();
}

export function setMute(call: Call, muted: boolean): void {
  call.mute(muted);
}

export function sendDtmf(call: Call, digit: string): void {
  call.sendDigits(digit);
}

export function getCallSid(call: Call): string | undefined {
  return call.getSid() ?? undefined;
}
