<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Verificar que se haya enviado un archivo
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['imagen'])) {
    $carpeta_destino = 'img/';
    
    // Crear la carpeta si no existe en XAMPP
    if (!file_exists($carpeta_destino)) {
        mkdir($carpeta_destino, 0777, true);
    }

    $archivo = $_FILES['imagen'];
    $nombre_original = basename($archivo['name']);
    $extension = strtolower(pathinfo($nombre_original, PATHINFO_EXTENSION));

    // Validar extensiones válidas
    $extensiones_permitidas = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($extension, $extensiones_permitidas)) {
        echo json_encode(["status" => "error", "message" => "Formato de imagen inválido. Usar JPG, PNG o WEBP."]);
        exit;
    }

    // Renombrar la imagen para que sea única (ej: img_171245382.jpg)
    $nuevo_nombre = 'img_' . time() . '.' . $extension;
    $ruta_final = $carpeta_destino . $nuevo_nombre;

    if (move_uploaded_file($archivo['tmp_name'], $ruta_final)) {
        // Retornar la ruta relativa que guardaremos en Firebase
        echo json_encode(["status" => "success", "ruta" => $ruta_final]);
    } else {
        echo json_encode(["status" => "error", "message" => "No se pudo mover el archivo al servidor."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Petición no válida."]);
}
?>