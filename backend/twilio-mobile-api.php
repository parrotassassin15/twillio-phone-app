<?php
/**
 * Twilio Mobile API
 * POST /api/twilio-mobile-api
 *
 * Authentication: Authorization: Bearer <JWT>  (issued by /api/auth)
 *
 * Supported actions (POST body field "action"):
 *   call_logs          — Call history from Twilio
 *   transfer           — Blind-transfer a live call
 *   leads              — Lead records from your DB
 *   sms_conversations  — Grouped SMS threads from your DB
 *   sms_thread         — Messages for a specific number
 *   send_sms           — Send an outbound SMS
 *   unread_count       — Count of unread inbound SMS
 *
 * Required environment / credential variables:
 *   $mobile_api_key, $twilio_account_sid, $twilio_auth_token,
 *   $twilio_messaging_service_sid (for send_sms)
 *   DB_HOST, DB_USER, DB_PASS, DB_NAME (for DB-backed actions)
 *
 * DB table assumed for SMS: sms_messages
 * DB table assumed for leads: lory_leads
 * Adapt getDb() and the queries to match your schema.
 */
header('Content-Type: application/json');

require_once __DIR__ . '/vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Load credentials from environment (or require your own creds file):
$twilio_account_sid           = getenv('TWILIO_ACCOUNT_SID');
$twilio_auth_token            = getenv('TWILIO_AUTH_TOKEN');
$twilio_messaging_service_sid = getenv('TWILIO_MESSAGING_SERVICE_SID');
$jwt_secret                   = getenv('JWT_SECRET');

// ── JWT auth ──────────────────────────────────────────────────────────────

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$jwt        = '';
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    $jwt = trim($m[1]);
}

if (empty($jwt) || empty($jwt_secret)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
    $auth_user_id = $decoded->sub ?? null;
} catch (\Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// ── Helpers ───────────────────────────────────────────────────────────────

$action = $_POST['action'] ?? '';
$sid    = $twilio_account_sid;
$token  = $twilio_auth_token;

function twilioGet(string $url, string $sid, string $token): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_USERPWD => "{$sid}:{$token}"]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'data' => json_decode($resp, true)];
}

function getDb(): ?mysqli {
    // Adapt this to your database setup.
    $host = getenv('DB_HOST') ?: 'localhost';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASS') ?: '';
    $name = getenv('DB_NAME') ?: 'softphone';
    $conn = new mysqli($host, $user, $pass, $name);
    if ($conn->connect_error) return null;
    $conn->set_charset('utf8mb4');
    return $conn;
}

switch ($action) {

    // ── Call Logs ──────────────────────────────────────────────────────────
    case 'call_logs':
        $limit = min(50, max(10, (int)($_POST['limit'] ?? 30)));
        $url   = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Calls.json?PageSize={$limit}";
        if (!empty($_POST['start_date'])) $url .= '&StartTime>=' . urlencode($_POST['start_date']);

        $result = twilioGet($url, $sid, $token);
        if ($result['code'] !== 200) { echo json_encode(['success' => false, 'error' => 'Twilio API error']); exit; }

        // Normalize inbound/outbound direction across the two Twilio call legs.
        // Replace $ourNumbers with your own Twilio numbers.
        $ourNumbers   = []; // e.g. ['+15550001111', '+15550002222']
        $normalizeDir = function($c) use ($ourNumbers) {
            $from = $c['from'] ?? '';
            $to   = $c['to']   ?? '';
            if (str_starts_with($to,   'client:'))                           return 'inbound';
            if (str_starts_with($from, 'client:') || in_array($from, $ourNumbers, true)) return 'outbound';
            if (in_array($to, $ourNumbers, true))                            return 'inbound';
            return strpos($c['direction'] ?? '', 'outbound') !== false ? 'outbound' : 'inbound';
        };

        $calls = array_map(fn($c) => [
            'sid'        => $c['sid'],
            'from'       => $c['from'],
            'to'         => $c['to'],
            'status'     => $c['status'],
            'direction'  => $normalizeDir($c),
            'duration'   => (int)($c['duration'] ?? 0),
            'start_time' => $c['start_time'],
            'end_time'   => $c['end_time'],
        ], $result['data']['calls'] ?? []);

        echo json_encode(['success' => true, 'calls' => $calls]);
        break;

    // ── SMS Conversations ──────────────────────────────────────────────────
    case 'sms_conversations':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }

        $result = $conn->query("
            SELECT CASE WHEN direction='inbound' THEN from_number ELSE to_number END AS partner,
                   MAX(id) AS latest_id, COUNT(*) AS msg_count,
                   SUM(CASE WHEN direction='inbound' AND read_at IS NULL THEN 1 ELSE 0 END) AS unread_count,
                   MAX(lory_handled) AS has_lory
            FROM sms_messages GROUP BY partner ORDER BY latest_id DESC LIMIT 50
        ");

        $conversations = [];
        if ($result) {
            $ids = $map = [];
            while ($r = $result->fetch_assoc()) { $ids[] = (int)$r['latest_id']; $map[(int)$r['latest_id']] = $r; }
            if ($ids) {
                $msgs = $conn->query('SELECT id,direction,from_number,to_number,body,contact_name,lory_handled,created_at FROM sms_messages WHERE id IN (' . implode(',', $ids) . ')');
                $mm   = [];
                while ($m = $msgs->fetch_assoc()) { $mm[(int)$m['id']] = $m; }
                foreach ($ids as $id) {
                    if (!isset($mm[$id])) continue;
                    $m = $mm[$id]; $c = $map[$id];
                    $conversations[] = ['partner' => $c['partner'], 'contact_name' => $m['contact_name'],
                        'last_message' => $m['body'], 'last_direction' => $m['direction'],
                        'last_time' => $m['created_at'], 'msg_count' => (int)$c['msg_count'],
                        'unread_count' => (int)$c['unread_count'], 'has_lory' => (bool)$c['has_lory']];
                }
            }
        }
        $conn->close();
        echo json_encode(['success' => true, 'conversations' => $conversations]);
        break;

    // ── SMS Thread ────────────────────────────────────────────────────────
    case 'sms_thread':
        $number = $_POST['number'] ?? '';
        if (!$number) { echo json_encode(['success' => false, 'error' => 'number required']); exit; }
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }

        $d = substr(preg_replace('/[^\d]/', '', $number), -10);
        $s = $conn->prepare("SELECT id,direction,from_number,to_number,body,status,lory_handled,created_at FROM sms_messages WHERE REPLACE(REPLACE(from_number,' ',''),'-','') LIKE CONCAT('%',?) OR REPLACE(REPLACE(to_number,' ',''),'-','') LIKE CONCAT('%',?) ORDER BY created_at ASC LIMIT 100");
        $s->bind_param('ss', $d, $d); $s->execute(); $r = $s->get_result();

        $messages = $unread = [];
        while ($row = $r->fetch_assoc()) {
            $messages[] = ['id' => (int)$row['id'], 'direction' => $row['direction'],
                'from' => $row['from_number'], 'to' => $row['to_number'], 'body' => $row['body'],
                'status' => $row['status'], 'lory_handled' => (bool)$row['lory_handled'], 'date' => $row['created_at']];
            if ($row['direction'] === 'inbound' && empty($row['read_at'])) $unread[] = (int)$row['id'];
        }
        $s->close();
        if ($unread) $conn->query('UPDATE sms_messages SET read_at=NOW() WHERE id IN (' . implode(',', $unread) . ')');
        $conn->close();
        echo json_encode(['success' => true, 'messages' => $messages]);
        break;

    // ── Send SMS ──────────────────────────────────────────────────────────
    case 'send_sms':
        $to   = $_POST['to']   ?? '';
        $body = $_POST['body'] ?? '';
        $from = $_POST['from'] ?? '';
        if (!$to || !$body) { echo json_encode(['success' => false, 'error' => 'to and body required']); exit; }

        $to = preg_replace('/[^\d+]/', '', $to);
        if ($to[0] !== '+') $to = '+1' . $to;

        $post = $from ? ['To' => $to, 'Body' => $body, 'From' => $from]
                      : ['To' => $to, 'Body' => $body, 'MessagingServiceSid' => $twilio_messaging_service_sid];

        $ch = curl_init("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json");
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_USERPWD => "{$sid}:{$token}", CURLOPT_POSTFIELDS => http_build_query($post)]);
        $resp = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);

        $data = json_decode($resp, true);
        if ($code >= 200 && $code < 300) {
            $conn = getDb();
            if ($conn) {
                $st = $conn->prepare("INSERT INTO sms_messages (twilio_sid,direction,from_number,to_number,body,status,created_at) VALUES (?,'outbound',?,?,?,'sent',NOW())");
                $af = $data['from'] ?? ($from ?: 'messaging_service');
                $ms = $data['sid']  ?? null;
                $st->bind_param('ssss', $ms, $af, $to, $body); $st->execute(); $st->close(); $conn->close();
            }
            echo json_encode(['success' => true, 'sid' => $data['sid'] ?? null]);
        } else {
            echo json_encode(['success' => false, 'error' => $data['message'] ?? "HTTP {$code}"]);
        }
        break;

    // ── Unread count ──────────────────────────────────────────────────────
    case 'unread_count':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'count' => 0]); exit; }
        $r = $conn->query("SELECT COUNT(*) AS cnt FROM sms_messages WHERE direction='inbound' AND read_at IS NULL");
        echo json_encode(['success' => true, 'count' => $r ? (int)$r->fetch_assoc()['cnt'] : 0]);
        $conn->close();
        break;

    // ── Leads ─────────────────────────────────────────────────────────────
    case 'leads':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }
        $s = $conn->prepare("SELECT id,visitor_name,visitor_email,visitor_phone,company_name,lead_type,status,context_summary,created_at FROM lory_leads ORDER BY created_at DESC LIMIT 50");
        $s->execute(); $r = $s->get_result();
        $leads = [];
        while ($row = $r->fetch_assoc()) { $leads[] = $row; }
        $s->close(); $conn->close();
        echo json_encode(['success' => true, 'leads' => $leads]);
        break;

    // ── Contacts ──────────────────────────────────────────────────────────
    case 'contacts':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }
        $search = trim($_POST['search'] ?? '');
        if ($search !== '') {
            $like = '%' . $search . '%';
            $s = $conn->prepare("SELECT id,name,phone,email,company,notes,created_at FROM contacts WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY name ASC LIMIT 50");
            $s->bind_param('ssss', $like, $like, $like, $like);
        } else {
            $s = $conn->prepare("SELECT id,name,phone,email,company,notes,created_at FROM contacts ORDER BY name ASC LIMIT 100");
        }
        $s->execute(); $r = $s->get_result();
        $contacts = [];
        while ($row = $r->fetch_assoc()) { $contacts[] = $row; }
        $s->close(); $conn->close();
        echo json_encode(['success' => true, 'contacts' => $contacts]);
        break;

    case 'contact_save':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }
        $id      = (int)($_POST['id'] ?? 0);
        $name    = trim($_POST['name']    ?? '');
        $phone   = trim($_POST['phone']   ?? '');
        $email   = trim($_POST['email']   ?? '');
        $company = trim($_POST['company'] ?? '');
        $notes   = trim($_POST['notes']   ?? '');
        if (!$name) { echo json_encode(['success' => false, 'error' => 'name required']); exit; }
        if ($id) {
            $s = $conn->prepare("UPDATE contacts SET name=?,phone=?,email=?,company=?,notes=?,updated_at=NOW() WHERE id=?");
            $s->bind_param('sssssi', $name, $phone, $email, $company, $notes, $id);
        } else {
            $s = $conn->prepare("INSERT INTO contacts (name,phone,email,company,notes,created_at,updated_at) VALUES (?,?,?,?,?,NOW(),NOW())");
            $s->bind_param('sssss', $name, $phone, $email, $company, $notes);
        }
        $s->execute();
        $newId = $id ?: (int)$conn->insert_id;
        $s->close(); $conn->close();
        echo json_encode(['success' => true, 'id' => $newId]);
        break;

    case 'contact_delete':
        $conn = getDb();
        if (!$conn) { echo json_encode(['success' => false, 'error' => 'DB error']); exit; }
        $id = (int)($_POST['id'] ?? 0);
        if (!$id) { echo json_encode(['success' => false, 'error' => 'id required']); exit; }
        $s = $conn->prepare("DELETE FROM contacts WHERE id=?");
        $s->bind_param('i', $id); $s->execute(); $s->close(); $conn->close();
        echo json_encode(['success' => true]);
        break;

    // ── Blind transfer ────────────────────────────────────────────────────
    case 'transfer':
        $callSid  = $_POST['call_sid']  ?? '';
        $to       = $_POST['to']        ?? '';
        $callerId = $_POST['caller_id'] ?? '';
        if (!$callSid || !$to) { echo json_encode(['success' => false, 'error' => 'call_sid and to required']); exit; }

        $to = preg_replace('/[^\d+]/', '', $to);
        if (!$to) { echo json_encode(['success' => false, 'error' => 'Invalid destination']); exit; }
        if ($to[0] !== '+') { $to = strlen($to) === 10 ? '+1'.$to : '+'.$to; }

        // Redirect the child leg (PSTN side) so the caller is transferred.
        $child = twilioGet("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Calls.json?ParentCallSid=" . urlencode($callSid) . '&PageSize=1', $sid, $token);
        $targetSid = ($child['code'] ?? 0) === 200 && !empty($child['data']['calls'][0]['sid'])
            ? $child['data']['calls'][0]['sid'] : $callSid;

        $da    = $callerId ? ' callerId="' . htmlspecialchars($callerId, ENT_QUOTES) . '"' : '';
        $twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Google.en-US-Neural2-F">Transferring your call, please hold.</Say><Dial' . $da . '><Number>' . htmlspecialchars($to) . '</Number></Dial></Response>';

        $ch = curl_init("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Calls/" . urlencode($targetSid) . '.json');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_USERPWD => "{$sid}:{$token}", CURLOPT_POSTFIELDS => http_build_query(['Twiml' => $twiml])]);
        $resp = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);

        $data = json_decode($resp, true);
        echo $code >= 200 && $code < 300
            ? json_encode(['success' => true, 'sid' => $data['sid'] ?? $targetSid, 'to' => $to])
            : json_encode(['success' => false, 'error' => $data['message'] ?? "HTTP {$code}"]);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
}
