<?php
/**
 * Twilio Access Token for Mobile Softphone
 * GET /api/twilio-mobile-token
 *
 * Authentication: Authorization: Bearer <JWT>  (issued by /api/auth)
 *
 * Returns a Twilio Access Token (JWT) with a Voice grant so the mobile SDK
 * can make and receive calls. The token identity must match the <Client>
 * your TwiML App dials for inbound routing.
 *
 * Required environment variables:
 *   JWT_SECRET               — shared secret for verifying mobile JWTs
 *   TWILIO_ACCOUNT_SID       — Twilio Account SID  (AC...)
 *   TWILIO_API_KEY_SID       — Twilio API Key SID  (SK...)
 *   TWILIO_API_KEY_SECRET    — Twilio API Key Secret
 *   TWILIO_TWIML_APP_SID     — Twilio TwiML App SID (AP...)
 *
 * Optional:
 *   TWILIO_PUSH_CREDENTIAL_SID — FCM Push Credential SID (CR...) for
 *                                 background incoming calls; omit if unused
 */
header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Load credentials from environment:
$jwt_secret                 = getenv('JWT_SECRET');
$twilio_account_sid         = getenv('TWILIO_ACCOUNT_SID');
$twilio_api_key_sid         = getenv('TWILIO_API_KEY_SID');
$twilio_api_key_secret      = getenv('TWILIO_API_KEY_SECRET');
$twilio_twiml_app_sid       = getenv('TWILIO_TWIML_APP_SID');
$twilio_push_credential_sid = getenv('TWILIO_PUSH_CREDENTIAL_SID') ?: null;

// ── JWT auth ──────────────────────────────────────────────────────────────

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$jwt        = '';
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    $jwt = trim($m[1]);
}

if (empty($jwt) || empty($jwt_secret)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
    $auth_user_id = $decoded->sub ?? null;
} catch (\Exception $e) {
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
