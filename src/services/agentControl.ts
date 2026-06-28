/**
 * Agent Control Service
 *
 * Handles registration, heartbeats, and status updates with the
 * Lorikeet Agent Control API at /api/agent-control.
 *
 * Each device gets a stable, unique Twilio client identity assigned by the
 * server on first registration (e.g. "agent_a3f8b29c1d").  That identity is
 * used for the Twilio Voice token so calls can be routed to specific agents.
 */
import { Config } from '../config';
import { getAuthToken } from './authToken';

// ── Types ─────────────────────────────────────────────────────────────────

export type AgentStatus = 'online' | 'busy' | 'away' | 'offline';

export type ScheduleWindow = {
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string;  // 'HH:MM:SS'
  end_time: string;
  timezone: string;
  active: number;
};

export type RegisterResult = {
  identity: string;
  extension: string;
  display_name: string;
  schedule_active: boolean;
  next_change: string | null;
  schedule: ScheduleWindow[];
};

export type HeartbeatResult = {
  schedule_active: boolean;
  next_change: string | null;
  commands: AgentCommand[];
};

export type AgentCommand = {
  command: string;
  payload: Record<string, unknown> | null;
};

export type PeerAgent = {
  identity: string;
  extension: string | null;
  display_name: string | null;
  status: AgentStatus;
  last_seen: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const ENDPOINT = `${Config.BASE_URL}/api/agent-control`;

async function post<T>(fields: Record<string, string>): Promise<T> {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  const token = getAuthToken();
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (resp.status === 401) throw new Error('Session expired. Please sign in again.');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.success) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Register this device with the control system.
 * Safe to call on every app launch — idempotent for existing registrations.
 * Returns the assigned identity, extension, and initial schedule state.
 */
export async function registerAgent(
  deviceId: string,
  displayName: string,
  platform: 'ios' | 'android',
  pushToken?: string,
): Promise<RegisterResult> {
  const fields: Record<string, string> = {
    action: 'register',
    device_id: deviceId,
    display_name: displayName,
    platform,
  };
  if (pushToken) fields.push_token = pushToken;
  const data = await post<RegisterResult & { success: true }>(fields);
  return data;
}

/**
 * Keep-alive ping — call every 30 seconds while the app is in the foreground.
 * Returns current schedule state and any pending commands from the admin.
 */
export async function heartbeat(
  deviceId: string,
  status: AgentStatus,
): Promise<HeartbeatResult> {
  return post<HeartbeatResult & { success: true }>({
    action: 'heartbeat',
    device_id: deviceId,
    status,
  });
}

/**
 * Notify the control system of a status change (e.g. call started/ended).
 */
export async function updateStatus(
  deviceId: string,
  status: AgentStatus,
  callSid?: string,
): Promise<void> {
  const fields: Record<string, string> = { action: 'update_status', device_id: deviceId, status };
  if (callSid) fields.call_sid = callSid;
  await post<{ success: true }>(fields);
}

/**
 * Mark this device offline when the app closes or backgrounded.
 */
export async function deregisterAgent(deviceId: string): Promise<void> {
  await post<{ success: true }>({ action: 'deregister', device_id: deviceId });
}

/**
 * Fetch peer agent presence for the extensions screen.
 */
export async function getAgents(): Promise<PeerAgent[]> {
  const data = await post<{ success: true; agents: PeerAgent[] }>({ action: 'get_agents' });
  return data.agents ?? [];
}
