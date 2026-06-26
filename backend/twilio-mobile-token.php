<?php
/**
 * Twilio Access Token for Mobile Softphone
 * GET /api/twilio-mobile-token
 *
 * Authentication: Authorization: Bearer <MOBILE_API_KEY>
 *
 * Returns a Twilio Access Token (JWT) with a Voice grant so the mobile SDK
 * can make and receive calls. The token identity must match the <Client>
 * your TwiML App dials for inbound routing.
 *
 * Required PHP variables (load from environment or a secrets file):
 *   $mobile_api_key          — shared secret with the mobile app
 *   $twilio_account_sid      — Twilio Account SID  (AC...)
 *   $twilio_api_key_sid      — Twilio API Key SID  (SK...)
 *   $twilio_api_key_secret   — Twilio API Key Secret
 *   $twilio_twiml_app_sid    — Twilio TwiML App SID (AP...)
 *
 * Optional:
 *   $twilio_push_credential_sid — FCM Push Credential SID (CR...) for
 *                                  background incoming calls; omit if unused
 */
header('Content-Type: application/json');
header('Cache-Control: no-store');

// Load your credentials however suits your stack:
//   require_once __DIR__ . '/creds.php';
// or read from environment:
$mobile_api_key            = getenv('MOBILE_API_KEY');
$twilio_account_sid        = getenv('TWILIO_ACCOUNT_SID');
$twilio_api_key_sid        = getenv('TWILIO_API_KEY_SID');
$twilio_api_key_secret     = getenv('TWILIO_API_KEY_SECRET');
$twilio_twiml_app_sid      = getenv('TWILIO_TWIML_APP_SID');
$twilio_push_credential_sid = getenv('TWILIO_PUSH_CREDENTIAL_SID') ?: null;

require_once __DIR__ . '/vendor/autoload.php';
use Firebase\JWT\JWT;

// ── Bearer token auth ─────────────────────────────────────────────────────

$authHeader  = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$providedKey = '';
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    $providedKey = trim($m[1]);
}

if (empty($mobile_api_key) || empty($providedKey) || !hash_equals($mobile_api_key, $providedKey)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// ── Build JWT ─────────────────────────────────────────────────────────────

$identity = 'softphone_agent'; // must match your TwiML App's <Client> identity
$now      = time();
$ttl      = 3600;

$grants = [
    'identity' => $identity,
    'voice'    => [
        'incoming'  => ['allow' => true],
        'outgoing'  => ['application_sid' => $twilio_twiml_app_sid],
    ],
];

if ($twilio_push_credential_sid) {
    $grants['voice']['push_credential_sid'] = $twilio_push_credential_sid;
}

$payload = [
    'jti'    => $twilio_api_key_sid . '-' . $now,
    'iss'    => $twilio_api_key_sid,
    'sub'    => $twilio_account_sid,
    'exp'    => $now + $ttl,
    'nbf'    => $now,
    'grants' => $grants,
];

$token = JWT::encode($payload, $twilio_api_key_secret, 'HS256', null, ['cty' => 'twilio-fpa;v=1']);

echo json_encode(['success' => true, 'token' => $token, 'identity' => $identity]);
