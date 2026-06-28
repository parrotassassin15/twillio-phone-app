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
  _token = await fetchAccessToken(_deviceId);
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return _token;
}

export async function registerDevice(): Promise<void> {
  const token = await getToken();
  await voice.register(token);
}

export async function unregisterDevice(): Promise<void> {
  if (_token) await voice.unregister(_token);
}

export function onCallInvite(handler: (invite: CallInvite) => void): () => void {
  voice.on(Voice.Event.CallInvite, handler);
  return () => voice.off(Voice.Event.CallInvite, handler);
}

export function onCancelledCallInvite(handler: () => void): () => void {
  voice.on(Voice.Event.CancelledCallInvite, handler);
  return () => voice.off(Voice.Event.CancelledCallInvite, handler);
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
