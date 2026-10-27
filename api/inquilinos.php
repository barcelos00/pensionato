<?php
// api/inquilinos.php
require_once 'db.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

if ($action === 'list') {
    $stmt = $pdo->query("SELECT * FROM inquilinos ORDER BY id DESC");
    $rawInquilinos = $stmt->fetchAll();
    $inquilinos = [];

    foreach ($rawInquilinos as $i) {
        $stmtPaid = $pdo->prepare("SELECT mes_referencia FROM pagamentos_inquilinos WHERE inquilino_id = ? AND pago = 1");
        $stmtPaid->execute([$i['id']]);
        
        // Mapeia tanto o formato em inglês (para o JS) quanto as colunas originais do MySQL
        $inquilinos[] = [
            'id' => intval($i['id']),
            'name' => $i['nome'] ?? '',
            'nome' => $i['nome'] ?? '',
            'phone' => $i['telefone'] ?? '',
            'telefone' => $i['telefone'] ?? '',
            'rent' => floatval($i['valor_aluguel'] ?? 0),
            'valor_aluguel' => floatval($i['valor_aluguel'] ?? 0),
            'dueDay' => intval($i['dia_vencimento'] ?? 10),
            'dia_vencimento' => intval($i['dia_vencimento'] ?? 10),
            'bedId' => intval($i['leito_id'] ?? 0),
            'leito_id' => intval($i['leito_id'] ?? 0),
            'paidMonths' => $stmtPaid->fetchAll(PDO::FETCH_COLUMN)
        ];
    }

    echo json_encode($inquilinos);
} 

elseif ($action === 'add') {
    $stmt = $pdo->prepare("INSERT INTO inquilinos (nome, telefone, valor_aluguel, dia_vencimento, leito_id) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$data['name'], $data['phone'], $data['rent'], $data['dueDay'], $data['bedId']]);
    echo json_encode(['success' => true]);
} 

elseif ($action === 'update') {
    if (!empty($data['bedId'])) {
        $stmt = $pdo->prepare("UPDATE inquilinos SET nome = ?, telefone = ?, valor_aluguel = ?, dia_vencimento = ?, leito_id = ? WHERE id = ?");
        $stmt->execute([$data['name'], $data['phone'], $data['rent'], $data['dueDay'], $data['bedId'], $data['id']]);
    } else {
        $stmt = $pdo->prepare("UPDATE inquilinos SET nome = ?, telefone = ?, valor_aluguel = ?, dia_vencimento = ? WHERE id = ?");
        $stmt->execute([$data['name'], $data['phone'], $data['rent'], $data['dueDay'], $data['id']]);
    }
    echo json_encode(['success' => true]);
}

elseif ($action === 'delete') {
    $stmt = $pdo->prepare("DELETE FROM inquilinos WHERE id = ?");
    $stmt->execute([$data['id']]);
    echo json_encode(['success' => true]);
} 

elseif ($action === 'vacate_bed') {
    $stmt = $pdo->prepare("UPDATE inquilinos SET leito_id = NULL WHERE leito_id = ?");
    $stmt->execute([$data['bedId']]);
    echo json_encode(['success' => true]);
} 

elseif ($action === 'toggle_payment') {
    $tenantId = $data['tenantId'];
    $month = $data['monthYear'];

    $stmtCheck = $pdo->prepare("SELECT id FROM pagamentos_inquilinos WHERE inquilino_id = ? AND mes_referencia = ?");
    $stmtCheck->execute([$tenantId, $month]);
    $pag = $stmtCheck->fetch();

    if ($pag) {
        $stmtDel = $pdo->prepare("DELETE FROM pagamentos_inquilinos WHERE id = ?");
        $stmtDel->execute([$pag['id']]);
    } else {
        $stmtAdd = $pdo->prepare("INSERT INTO pagamentos_inquilinos (inquilino_id, mes_referencia, pago) VALUES (?, ?, 1)");
        $stmtAdd->execute([$tenantId, $month]);
    }

    echo json_encode(['success' => true]);
}