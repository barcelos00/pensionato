<?php
// api/db.php
header('Content-Type: application/json; charset=utf-8');

// A InfinityFree fornece estes dados no painel da sua conta (MySQL Details)
$host = getenv('DB_HOST') ?: 'sql308.infinityfree.com'; // Exemplo: sql302.infinityfree.com
$user = getenv('DB_USER') ?: 'if0_43289034';             // Seu usuário da InfinityFree
$pass = getenv('DB_PASS') ?: 'uME20ZjColzg';         // Sua senha do Vpanel/InfinityFree
$dbname = getenv('DB_NAME') ?: 'if0_43289034_XXX'; // Nome do banco com prefixo
$port = '3306';

    // $host = 'localhost';
    // $user = 'root';
    // $pass = '';
    // $dbname = 'pensionato_db'; // Nome do banco que você criou no seu phpMyAdmin local
    // $port = '3306';

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