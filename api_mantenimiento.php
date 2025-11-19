<?php
include(__DIR__ . '/conexion.php');

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida o error inesperado.'];

try {
    switch ($accion) {
        case 'obtener':
            $sql = "SELECT * FROM reportes_mantenimiento ORDER BY fecha DESC";
            $resultado = $conexion->query($sql);

            if ($resultado === false) {
                throw new Exception('Error en la consulta SQL: ' . $conexion->error);
            }
            
            $reportes = [];
            while ($fila = $resultado->fetch_assoc()) {
                $reportes[] = $fila;
            }
            
            $respuesta = ['status' => 'exito', 'data' => $reportes];
            break;

        case 'guardar':
            $area = $_POST['area'] ?? null;
            $urgencia = $_POST['urgency'] ?? null;
            $descripcion = $_POST['description'] ?? null;
            $fecha = $_POST['date'] ?? null; // La fecha que envía el JS

            if (empty($area) || empty($urgencia) || empty($descripcion) || empty($fecha)) {
                throw new Exception('Faltan datos obligatorios (area, urgencia, descripcion, fecha).');
            }

            $sql = "INSERT INTO reportes_mantenimiento (area, urgencia, descripcion, fecha) VALUES (?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssss", $area, $urgencia, $descripcion, $fecha);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'id' => $conexion->insert_id, 'mensaje' => 'Reporte guardado.'];
            } else {
                throw new Exception('Error al guardar: ' . $stmt->error);
            }
            $stmt->close();
            break;
    }
} catch (Exception $e) {
    $respuesta = ['status' => 'error', 'mensaje' => $e->getMessage()];
}

if ($conexion) {
    $conexion->close();
}

enviarRespuestaJSON($respuesta);
?>