import { Config } from '../config';
import { getAuthToken } from './authToken';

type FetchOpts = {
  method?: 'GET' | 'POST';
  body?: FormData | Record<string, string>;
};

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body } = opts;

  let fetchBody: FormData | undefined;
  if (body) {
    if (body instanceof FormData) {
      fetchBody = body;
    } else {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, v));
      fetchBody = fd;
    }
  }

  const token = getAuthToken();
  const resp = await fetch(`${Config.BASE_URL}${path}`, {
    method: fetchBody ? 'POST' : method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fetchBody,
  });

  if (resp.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return resp.json() as Promise<T>;
}

// ── Token ──────────────────────────────────────────────────────────────────

/**
 * Fetch a Twilio Access Token for this device.
 * Pass the device_id so the server can look up the unique agent identity
 * assigned by the Agent Control API.  Without a device_id the server falls
 * back to the shared 'lorikeet_agent' identity.
 */
export async function fetchAccessToken(deviceId?: string | null): Promise<string> {
  const path = deviceId
    ? `/api/twilio-mobile-token?device_id=${encodeURIComponent(deviceId)}`
    : '/api/twilio-mobile-token';
  const data = await request<{ success: boolean; token: string; identity?: string; error?: string }>(path);
  if (!data.success || !data.token) {
    throw new Error(data.error ?? 'Token request failed');
  }
  return data.token;
}

// ── Call logs ──────────────────────────────────────────────────────────────

export type CallRecord = {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  start_time: string;
  end_time: string | null;
};

export async function fetchCallLogs(opts: {
  limit?: number;
  direction?: '' | 'inbound' | 'outbound';
  startDate?: string;
}): Promise<CallRecord[]> {
  const body: Record<string, string> = {
    action: 'call_logs',
    limit: String(opts.limit ?? 30),
  };
  if (opts.startDate) body.start_date = opts.startDate;

  const data = await request<{ success: boolean; calls: CallRecord[] }>(
    '/api/twilio-mobile-api',
    { body },
  );
  let calls = data.calls ?? [];
  if (opts.direction) {
    calls = calls.filter(c => c.direction === opts.direction);
  }
  return calls;
}

// ── Transfer ───────────────────────────────────────────────────────────────

export async function transferCall(callSid: string, to: string, callerId: string): Promise<void> {
  const data = await request<{ success: boolean; error?: string }>(
    '/api/twilio-mobile-api',
    {
      body: { action: 'transfer', call_sid: callSid, to, caller_id: callerId },
    },
  );
  if (!data.success) {
    throw new Error(data.error ?? 'Transfer failed');
  }
}

// ── Leads ──────────────────────────────────────────────────────────────────

export type Lead = {
  id: number;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  company_name: string | null;
  lead_type: string | null;
  status: string | null;
  context_summary: string | null;
  created_at: string;
};

export async function fetchLeads(): Promise<Lead[]> {
  const data = await request<{ success: boolean; leads: Lead[] }>(
    '/api/twilio-mobile-api',
    { body: { action: 'leads' } },
  );
  return data.leads ?? [];
}

// ── SMS conversations ──────────────────────────────────────────────────────

export type SmsConversation = {
  partner: string;
  contact_name: string | null;
  last_message: string;
  last_direction: 'inbound' | 'outbound';
  last_time: string;
  msg_count: number;
  unread_count: number;
  has_lory: boolean;
};

export async function fetchSmsConversations(): Promise<SmsConversation[]> {
  const data = await request<{ success: boolean; conversations: SmsConversation[] }>(
    '/api/twilio-mobile-api',
    { body: { action: 'sms_conversations' } },
  );
  return data.conversations ?? [];
}

// ── SMS thread ─────────────────────────────────────────────────────────────

export type SmsMessage = {
  id: number;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  status: string;
  lory_handled: boolean;
  date: string;
};

export async function fetchSmsThread(number: string): Promise<SmsMessage[]> {
  const data = await request<{ success: boolean; messages: SmsMessage[] }>(
    '/api/twilio-mobile-api',
    { body: { action: 'sms_thread', number } },
  );
  return data.messages ?? [];
}

// ── Send SMS ───────────────────────────────────────────────────────────────

export async function sendSms(to: string, body: string, from?: string): Promise<void> {
  const payload: Record<string, string> = { action: 'send_sms', to, body };
  if (from) payload.from = from;
  const data = await request<{ success: boolean; error?: string }>(
    '/api/twilio-mobile-api',
    { body: payload },
  );
  if (!data.success) {
    throw new Error(data.error ?? 'Send failed');
  }
}

// ── Unread count ───────────────────────────────────────────────────────────

export async function fetchUnreadCount(): Promise<number> {
  const data = await request<{ success: boolean; count: number }>(
    '/api/twilio-mobile-api',
    { body: { action: 'unread_count' } },
  );
  return data.count ?? 0;
}
