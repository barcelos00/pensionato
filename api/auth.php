<?php
// api/auth.php
require_once 'db.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

if ($action === 'login') {
    $user = trim($data['user'] ?? '');
    $pass = trim($data['pass'] ?? '');

    if (empty($user) || empty($pass)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, nome, senha FROM usuarios WHERE LOWER(TRIM(usuario)) = LOWER(TRIM(?))");
    $stmt->execute([$user]);
    $usuario = $stmt->fetch();

    if ($usuario && $usuario['senha'] === $pass) {
        echo json_encode(['success' => true, 'name' => $usuario['nome']]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuário ou senha incorretos']);
    }
} 

elseif ($action === 'register') {
    $name = trim($data['name'] ?? '');
    $user = trim($data['user'] ?? '');
    $pass = trim($data['pass'] ?? '');

    if (empty($name) || empty($user) || empty($pass)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos']);
        exit;
    }

    // Verifica se já existe
    $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(TRIM(usuario)) = LOWER(TRIM(?))");
    $stmt->execute([$user]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Usuário já cadastrado']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO usuarios (nome, usuario, senha) VALUES (?, ?, ?)");
    $stmt->execute([$name, $user, $pass]);

    echo json_encode(['success' => true]);
}