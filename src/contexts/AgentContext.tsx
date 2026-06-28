/**
 * AgentContext
 *
 * Manages the lifecycle of this device as a softphone extension:
 *   1. Registers with the Lorikeet Agent Control API on mount
 *   2. Provides the assigned Twilio identity to the rest of the app
 *      (used when fetching the Twilio Access Token)
 *   3. Runs a 30-second heartbeat loop while foregrounded
 *   4. Surfaces schedule state ("are you within your active hours?")
 *   5. Processes server-push commands delivered via heartbeat
 *
 * Usage:
 *   const { agentIdentity, agentExtension, agentStatus, scheduleActive } = useAgent();
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AgentCommand,
  AgentStatus,
  ScheduleWindow,
  deregisterAgent,
  heartbeat,
  registerAgent,
  updateStatus,
} from '../services/agentControl';

// ── Storage key ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'lorikeet_device_id';
const HEARTBEAT_MS = 30_000;

// ── Stable device ID ──────────────────────────────────────────────────────

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(STORAGE_KEY);
  if (!id) {
    // Generate a random 16-char hex string as a stable device identifier
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// ── Context ───────────────────────────────────────────────────────────────

type AgentContextValue = {
  /** Unique Twilio client identity assigned by the server, e.g. "agent_a3f8b29c" */
  agentIdentity: string | null;
  /** Phone extension assigned by admin, e.g. "200" */
  agentExtension: string | null;
  /** Human-readable name for this agent */
  agentDisplayName: string | null;
  /** Current presence status */
  agentStatus: AgentStatus;
  /** True if current time is within the agent's scheduled active hours */
  scheduleActive: boolean;
  /** Time (HH:MM) when the schedule next changes state, or null */
  nextScheduleChange: string | null;
  /** Active schedule windows */
  schedule: ScheduleWindow[];
  /** True while the initial registration is in progress */
  registering: boolean;
  /** Registration/heartbeat error message, if any */
  registrationError: string | null;
  /** Stable device ID for this installation */
  deviceId: string | null;
  /** Manually update status (also syncs with server) */
  setAgentStatus: (status: AgentStatus) => Promise<void>;
  /** Notify the context that a call started (sets busy) */
  onCallStarted: (callSid: string) => Promise<void>;
  /** Notify the context that a call ended (sets online) */
  onCallEnded: () => Promise<void>;
  /** List of pending commands received from the admin */
  pendingCommands: AgentCommand[];
  /** Clear the pending commands list after they've been handled */
  clearCommands: () => void;
};

const AgentContext = createContext<AgentContextValue>({
  agentIdentity: null,
  agentExtension: null,
  agentDisplayName: null,
  agentStatus: 'offline',
  scheduleActive: true,
  nextScheduleChange: null,
  schedule: [],
  registering: true,
  registrationError: null,
  deviceId: null,
  setAgentStatus: async () => {},
  onCallStarted: async () => {},
  onCallEnded: async () => {},
  pendingCommands: [],
  clearCommands: () => {},
});

export function useAgent() {
  return useContext(AgentContext);
}

// ── Provider ──────────────────────────────────────────────────────────────

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [deviceId, setDeviceId]               = useState<string | null>(null);
  const [agentIdentity, setAgentIdentity]     = useState<string | null>(null);
  const [agentExtension, setAgentExtension]   = useState<string | null>(null);
  const [agentDisplayName, setAgentDisplayName] = useState<string | null>(null);
  const [agentStatus, setStatusLocal]         = useState<AgentStatus>('offline');
  const [scheduleActive, setScheduleActive]   = useState(true);
  const [nextScheduleChange, setNextChange]   = useState<string | null>(null);
  const [schedule, setSchedule]               = useState<ScheduleWindow[]>([]);
  const [registering, setRegistering]         = useState(true);
  const [registrationError, setRegError]      = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<AgentCommand[]>([]);

  const deviceIdRef  = useRef<string | null>(null);
  const statusRef    = useRef<AgentStatus>('offline');
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Registration ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const id = await getOrCreateDeviceId();
        if (cancelled) return;
        deviceIdRef.current = id;
        setDeviceId(id);

        const displayName = `Agent ${id.substring(0, 4).toUpperCase()}`;
        const platform    = Platform.OS === 'ios' ? 'ios' : 'android';

        const result = await registerAgent(id, displayName, platform);
        if (cancelled) return;

        setAgentIdentity(result.identity);
        setAgentExtension(result.extension);
        setAgentDisplayName(result.display_name);
        setScheduleActive(result.schedule_active);
        setNextChange(result.next_change ?? null);
        setSchedule(result.schedule);
        setStatusLocal('online');
        statusRef.current = 'online';
        setRegistering(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setRegError(err instanceof Error ? err.message : 'Registration failed');
          setRegistering(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Heartbeat ─────────────────────────────────────────────────────────

  const sendHeartbeat = useCallback(async () => {
    const id = deviceIdRef.current;
    if (!id) return;
    try {
      const result = await heartbeat(id, statusRef.current);
      setScheduleActive(result.schedule_active);
      setNextChange(result.next_change ?? null);
      if (result.commands.length > 0) {
        setPendingCommands(prev => [...prev, ...result.commands]);
      }
    } catch {
      // Ignore transient heartbeat failures
    }
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [deviceId, sendHeartbeat]);

  // ── App state: pause heartbeat when backgrounded ──────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        sendHeartbeat(); // immediate ping when foregrounded
        if (!heartbeatRef.current) {
          heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS);
        }
      } else if (state === 'background' || state === 'inactive') {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        const id = deviceIdRef.current;
        if (id) deregisterAgent(id).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [sendHeartbeat]);

  // ── Status helpers ────────────────────────────────────────────────────

  const setAgentStatus = useCallback(async (status: AgentStatus) => {
    setStatusLocal(status);
    statusRef.current = status;
    const id = deviceIdRef.current;
    if (id) await updateStatus(id, status).catch(() => {});
  }, []);

  const onCallStarted = useCallback(async (callSid: string) => {
    setStatusLocal('busy');
    statusRef.current = 'busy';
    const id = deviceIdRef.current;
    if (id) await updateStatus(id, 'busy', callSid).catch(() => {});
  }, []);

  const onCallEnded = useCallback(async () => {
    setStatusLocal('online');
    statusRef.current = 'online';
    const id = deviceIdRef.current;
    if (id) await updateStatus(id, 'online').catch(() => {});
  }, []);

  const clearCommands = useCallback(() => setPendingCommands([]), []);

  return (
    <AgentContext.Provider
      value={{
        agentIdentity,
        agentExtension,
        agentDisplayName,
        agentStatus,
        scheduleActive,
        nextScheduleChange,
        schedule,
        registering,
        registrationError,
        deviceId,
        setAgentStatus,
        onCallStarted,
        onCallEnded,
        pendingCommands,
        clearCommands,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}
