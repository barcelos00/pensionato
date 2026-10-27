<?php
// api/db.php - Conexão centralizada usando PDO
header('Content-Type: application/json; charset=utf-8');

// Configurações Locais (XAMPP)
$host = getenv('DB_HOST') ?: 'dpg-dbggr46k1f9s73e93cq0-a';
$user = getenv('DB_USER') ?: 'pensionato_user';
$pass = getenv('DB_PASS') ?: 'xkeSgAhnhxrEfBXDzUXf2BzHudZVWtf9';
$dbname = getenv('DB_NAME') ?: 'pensionato_db';
$port = getenv('DB_PORT') ?: '5432';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['erro' => 'Falha na conexão com o banco: ' . $e->getMessage()]);
    exit;
}