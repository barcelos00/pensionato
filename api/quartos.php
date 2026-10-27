<?php
// api/quartos.php
require_once 'db.php';

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    $stmt = $pdo->query("SELECT q.*, c.nome as nome_casa, c.foto_fachada 
                         FROM quartos q 
                         LEFT JOIN casas c ON q.casa_id = c.id 
                         ORDER BY q.id DESC");
    $quartos = $stmt->fetchAll();

    foreach ($quartos as &$q) {
        $q['features'] = $q['caracteristicas'] ? explode(',', $q['caracteristicas']) : [];
        $stmtBeds = $pdo->prepare("SELECT id, codigo, (SELECT id FROM inquilinos WHERE leito_id = leitos.id LIMIT 1) as tenantId FROM leitos WHERE quarto_id = ?");
        $stmtBeds->execute([$q['id']]);
        $q['beds'] = $stmtBeds->fetchAll();
        $q['number'] = $q['numero'];
        $q['floor'] = $q['andar'];
    }

    echo json_encode($quartos);
} 

elseif ($action === 'add') {
    $casaId = !empty($_POST['casaId']) ? intval($_POST['casaId']) : null;
    $number = $_POST['number'] ?? '';
    $floor = $_POST['floor'] ?? '';
    $bairro = $_POST['bairro'] ?? 'Centro';
    $tipoMobilia = $_POST['tipoMobilia'] ?? 'Quarto Simples';
    $valorBase = floatval($_POST['valorBase'] ?? 0);
    $featuresStr = $_POST['features'] ?? '';
    $bedCount = intval($_POST['bedCount'] ?? 1);
    $fotoUrl = $_POST['fotoUrl'] ?? '';

    if (isset($_FILES['fotoFile']) && $_FILES['fotoFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['fotoFile']['tmp_name'];
        $fileName = $_FILES['fotoFile']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'webp'])) {
            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $uploadFileDir = '../uploads/';
            if (!is_dir($uploadFileDir)) mkdir($uploadFileDir, 0755, true);
            if (move_uploaded_file($fileTmpPath, $uploadFileDir . $newFileName)) {
                $fotoUrl = 'uploads/' . $newFileName;
            }
        }
    }

    $stmt = $pdo->prepare("INSERT INTO quartos (casa_id, numero, andar, bairro, tipo_mobilia, foto_url, valor_base, caracteristicas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$casaId, $number, $floor, $bairro, $tipoMobilia, $fotoUrl, $valorBase, $featuresStr]);
    $quartoId = $pdo->lastInsertId();

    for ($i = 0; $i < $bedCount; $i++) {
        $codigo = 'Leito ' . chr(65 + $i);
        $stmtBed = $pdo->prepare("INSERT INTO leitos (quarto_id, codigo) VALUES (?, ?)");
        $stmtBed->execute([$quartoId, $codigo]);
    }

    echo json_encode(['success' => true]);
}

elseif ($action === 'update') {
    $id = $_POST['id'] ?? 0;
    $casaId = !empty($_POST['casaId']) ? intval($_POST['casaId']) : null;
    $number = $_POST['number'] ?? '';
    $floor = $_POST['floor'] ?? '';
    $bairro = $_POST['bairro'] ?? '';
    $tipoMobilia = $_POST['tipoMobilia'] ?? '';
    $valorBase = floatval($_POST['valorBase'] ?? 0);
    $featuresStr = $_POST['features'] ?? '';
    $fotoUrl = $_POST['fotoUrl'] ?? '';

    if (isset($_FILES['fotoFile']) && $_FILES['fotoFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['fotoFile']['tmp_name'];
        $fileName = $_FILES['fotoFile']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'webp'])) {
            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $uploadFileDir = '../uploads/';
            if (!is_dir($uploadFileDir)) mkdir($uploadFileDir, 0755, true);
            if (move_uploaded_file($fileTmpPath, $uploadFileDir . $newFileName)) {
                $fotoUrl = 'uploads/' . $newFileName;
            }
        }
    }

    if (!empty($fotoUrl)) {
        $stmt = $pdo->prepare("UPDATE quartos SET casa_id = ?, numero = ?, andar = ?, bairro = ?, tipo_mobilia = ?, foto_url = ?, valor_base = ?, caracteristicas = ? WHERE id = ?");
        $stmt->execute([$casaId, $number, $floor, $bairro, $tipoMobilia, $fotoUrl, $valorBase, $featuresStr, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE quartos SET casa_id = ?, numero = ?, andar = ?, bairro = ?, tipo_mobilia = ?, valor_base = ?, caracteristicas = ? WHERE id = ?");
        $stmt->execute([$casaId, $number, $floor, $bairro, $tipoMobilia, $valorBase, $featuresStr, $id]);
    }

    echo json_encode(['success' => true]);
}

elseif ($action === 'delete') {
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("DELETE FROM quartos WHERE id = ?");
    $stmt->execute([$data['id']]);
    echo json_encode(['success' => true]);
}

elseif ($action === 'vitrine') {
    $bairro = $_GET['bairro'] ?? '';
    $sql = "SELECT q.*, COUNT(l.id) as leitos_vagos 
            FROM quartos q 
            INNER JOIN leitos l ON l.quarto_id = q.id 
            LEFT JOIN inquilinos i ON i.leito_id = l.id 
            WHERE i.id IS NULL";

    if (!empty($bairro)) {
        $sql .= " AND LOWER(q.bairro) = LOWER(:bairro)";
    }

    $sql .= " GROUP BY q.id ORDER BY q.bairro ASC";
    $stmt = $pdo->prepare($sql);
    if (!empty($bairro)) $stmt->bindParam(':bairro', $bairro);
    $stmt->execute();

    echo json_encode($stmt->fetchAll());
}

elseif ($action === 'bairros') {
    $stmt = $pdo->query("SELECT DISTINCT bairro FROM quartos WHERE bairro IS NOT NULL AND bairro != '' ORDER BY bairro ASC");
    echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN));
}