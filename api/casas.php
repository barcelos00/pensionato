<?php
// api/casas.php
require_once 'db.php';

$action = $_GET['action'] ?? '';
$data = json_decode(file_get_contents('php://input'), true);

if ($action === 'list') {
    // Procura as casas e calcula dinamicamente o total de quartos, leitos e pessoas acomodadas
    $sql = "SELECT c.*, 
            COUNT(DISTINCT q.id) as total_quartos,
            COUNT(l.id) as total_leitos,
            COUNT(i.id) as total_ocupantes
            FROM casas c
            LEFT JOIN quartos q ON q.casa_id = c.id
            LEFT JOIN leitos l ON l.quarto_id = q.id
            LEFT JOIN inquilinos i ON i.leito_id = l.id
            GROUP BY c.id ORDER BY c.nome ASC";
            
    $stmt = $pdo->query($sql);
    echo json_encode($stmt->fetchAll());
} 

elseif ($action === 'add') {
    $nome = $_POST['nome'] ?? '';
    $bairro = $_POST['bairro'] ?? '';
    $endereco = $_POST['endereco'] ?? '';
    $fotoFachada = $_POST['fotoFachada'] ?? '';

    if (isset($_FILES['fotoFile']) && $_FILES['fotoFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['fotoFile']['tmp_name'];
        $fileName = $_FILES['fotoFile']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'webp'])) {
            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $uploadFileDir = '../uploads/';
            if (!is_dir($uploadFileDir)) mkdir($uploadFileDir, 0755, true);
            if (move_uploaded_file($fileTmpPath, $uploadFileDir . $newFileName)) {
                $fotoFachada = 'uploads/' . $newFileName;
            }
        }
    }

    $stmt = $pdo->prepare("INSERT INTO casas (nome, bairro, endereco, foto_fachada) VALUES (?, ?, ?, ?)");
    $stmt->execute([$nome, $bairro, $endereco, $fotoFachada]);
    echo json_encode(['success' => true]);
}

elseif ($action === 'update') {
    $id = $_POST['id'] ?? 0;
    $nome = $_POST['nome'] ?? '';
    $bairro = $_POST['bairro'] ?? '';
    $endereco = $_POST['endereco'] ?? '';
    $fotoFachada = $_POST['fotoFachada'] ?? '';

    if (isset($_FILES['fotoFile']) && $_FILES['fotoFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['fotoFile']['tmp_name'];
        $fileName = $_FILES['fotoFile']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if (in_array($fileExtension, ['jpg', 'jpeg', 'png', 'webp'])) {
            $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
            $uploadFileDir = '../uploads/';
            if (!is_dir($uploadFileDir)) mkdir($uploadFileDir, 0755, true);
            if (move_uploaded_file($fileTmpPath, $uploadFileDir . $newFileName)) {
                $fotoFachada = 'uploads/' . $newFileName;
            }
        }
    }

    if (!empty($fotoFachada)) {
        $stmt = $pdo->prepare("UPDATE casas SET nome = ?, bairro = ?, endereco = ?, foto_fachada = ? WHERE id = ?");
        $stmt->execute([$nome, $bairro, $endereco, $fotoFachada, $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE casas SET nome = ?, bairro = ?, endereco = ? WHERE id = ?");
        $stmt->execute([$nome, $bairro, $endereco, $id]);
    }

    echo json_encode(['success' => true]);
}

elseif ($action === 'delete') {
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("DELETE FROM casas WHERE id = ?");
    $stmt->execute([$data['id']]);
    echo json_encode(['success' => true]);
}