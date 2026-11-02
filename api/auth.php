<?php
// api/auth.php

// Garante que todas as respostas sejam estritamente JSON com codificação UTF-8
header('Content-Type: application/json; charset=utf-8');

try {
    require_once 'db.php';

    $action = $_GET['action'] ?? '';
    
    // Lê o corpo da requisição JSON de forma segura
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?? [];

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

        // Verifica se o usuário já existe
        $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE LOWER(TRIM(usuario)) = LOWER(TRIM(?))");
        $stmt->execute([$user]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Usuário já cadastrado']);
            exit;
        }

        // Insere o novo usuário
        $stmt = $pdo->prepare("INSERT INTO usuarios (nome, usuario, senha) VALUES (?, ?, ?)");
        $stmt->execute([$name, $user, $pass]);

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Ação inválida']);
    }

} catch (Exception $e) {
    // Captura qualquer erro do PDO ou do sistema e devolve em formato JSON limpo
    echo json_encode([
        'success' => false, 
        'message' => 'Erro interno no servidor: ' . $e->getMessage()
    ]);
}