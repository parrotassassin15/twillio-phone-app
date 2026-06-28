<?php
/**
 * One-shot migration: create the contacts table.
 * Run once then delete this file from the server.
 *
 * Usage (CLI):
 *   php migrate-contacts.php
 *
 * Usage (web — protect or delete immediately after):
 *   curl https://yoursite.com/api/migrate-contacts.php
 */
header('Content-Type: text/plain');

$host = getenv('DB_HOST') ?: 'localhost';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$name = getenv('DB_NAME') ?: 'softphone';

$conn = new mysqli($host, $user, $pass, $name);
if ($conn->connect_error) {
    http_response_code(500);
    die("Connection failed: " . $conn->connect_error . "\n");
}
$conn->set_charset('utf8mb4');

$sql = "
CREATE TABLE IF NOT EXISTS contacts (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(50)  DEFAULT NULL,
  email      VARCHAR(255) DEFAULT NULL,
  company    VARCHAR(255) DEFAULT NULL,
  notes      TEXT         DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_name    (name),
  KEY idx_phone   (phone),
  KEY idx_company (company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if ($conn->query($sql)) {
    echo "OK — contacts table created (or already existed).\n";
    echo "Delete this file from the server now.\n";
} else {
    http_response_code(500);
    echo "Error: " . $conn->error . "\n";
}

$conn->close();
