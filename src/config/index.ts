/**
 * App configuration — update these values before building.
 *
 * MOBILE_API_KEY must match the value set in your backend's credentials file.
 * Never commit real keys to source control; supply via environment variable.
 */

export const Config = {
  /** Base URL of your backend (no trailing slash) */
  BASE_URL: 'https://your-server.example.com',

  /**
   * Shared secret sent on every request as:
   *   Authorization: Bearer <MOBILE_API_KEY>
   */
  MOBILE_API_KEY: process.env.MOBILE_API_KEY ?? 'REPLACE_WITH_YOUR_MOBILE_API_KEY',

  /**
   * Twilio Client identity. Must match the <Client> identity your TwiML
   * App dials when routing inbound calls to the softphone.
   */
  TWILIO_CLIENT_IDENTITY: 'softphone_agent',

  /** Caller ID numbers shown in the picker */
  CALLER_IDS: [
    { label: 'Main',    number: '+15550001111' },
    { label: 'Office',  number: '+15550002222' },
  ],

  /** Internal team extensions for quick-dial and call transfer */
  EXTENSIONS: [
    { ext: '100', name: 'Main Line', number: '+15550001111' },
    { ext: '101', name: 'Office',    number: '+15550002222' },
    { ext: '102', name: 'Support',   number: '+15550003333' },
  ],

  /**
   * Known contacts for name resolution on the dialer display and call log.
   * Keys are E.164 numbers; values are display names.
   */
  CONTACTS: {
    '+15550001111': 'Main Line',
    '+15550002222': 'Office',
  } as Record<string, string>,

  /** Token refresh interval in milliseconds (50 minutes) */
  TOKEN_REFRESH_MS: 50 * 60 * 1000,
};

export type Extension = (typeof Config.EXTENSIONS)[number];
export type CallerId  = (typeof Config.CALLER_IDS)[number];
