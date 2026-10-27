<?php
// api/despesas.php
require_once 'db.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

if ($action === 'list') {
    $month = $_GET['month'] ?? date('Y-m');
    $stmt = $pdo->prepare("SELECT id, titulo as title, valor as amount, categoria as category, tipo as type, status, mes_referencia as monthYear FROM despesas WHERE mes_referencia = ? ORDER BY id DESC");
    $stmt->execute([$month]);
    $despesas = $stmt->fetchAll();

    foreach ($despesas as &$d) {
        $d['amount'] = floatval($d['amount']);
    }

    echo json_encode($despesas);
} 

elseif ($action === 'add') {
    $stmt = $pdo->prepare("INSERT INTO despesas (titulo, valor, categoria, tipo, status, mes_referencia) VALUES (?, ?, ?, ?, 'Pendente', ?)");
    $stmt->execute([$data['title'], $data['amount'], $data['category'], $data['type'], $data['monthYear']]);
    echo json_encode(['success' => true]);
} 

elseif ($action === 'toggle') {
    $stmt = $pdo->prepare("UPDATE despesas SET status = IF(status = 'Pago', 'Pendente', 'Pago') WHERE id = ?");
    $stmt->execute([$data['id']]);
    echo json_encode(['success' => true]);
} 

elseif ($action === 'delete') {
    $stmt = $pdo->prepare("DELETE FROM despesas WHERE id = ?");
    $stmt->execute([$data['id']]);
    echo json_encode(['success' => true]);
}

elseif ($action === 'rateio') {
    $month = $data['monthYear'];
    
    $stmt = $pdo->prepare("SELECT * FROM despesas WHERE tipo = 'Consumo' AND status = 'Pendente' AND mes_referencia = ?");
    $stmt->execute([$month]);
    $despesas = $stmt->fetchAll();

    if (empty($despesas)) {
        echo json_encode(['success' => false, 'message' => 'Não há contas de consumo pendentes para ratear neste mês.']);
        exit;
    }

    $total = array_sum(array_column($despesas, 'valor'));
    $countTenants = $pdo->query("SELECT COUNT(*) FROM inquilinos")->fetchColumn();

    if ($countTenants == 0) {
        echo json_encode(['success' => false, 'message' => 'Não há inquilinos para ratear.']);
        exit;
    }

    $fatia = $total / $countTenants;

    $pdo->prepare("UPDATE inquilinos SET valor_aluguel = valor_aluguel + ?")->execute([$fatia]);
    $pdo->prepare("UPDATE despesas SET status = 'Pago' WHERE tipo = 'Consumo' AND mes_referencia = ?")->execute([$month]);

    echo json_encode(['success' => true, 'message' => 'Rateio concluído com sucesso!']);
}