<?php
include(__DIR__ . '/conexion.php');

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida o error inesperado.'];

try {
    switch ($accion) {
        case 'obtener':
            $sql = "SELECT * FROM citas ORDER BY fecha, hora";
            $resultado = $conexion->query($sql);

            if ($resultado === false) {
                throw new Exception('Error en la consulta SQL: ' . $conexion->error);
            }
            
            $citas = [];
            while ($fila = $resultado->fetch_assoc()) {
                $fila['id_proveedor'] = (int)$fila['id_proveedor'];
                $citas[] = $fila;
            }
            
            $respuesta = ['status' => 'exito', 'data' => $citas];
            break;

        case 'guardar':
            $id_proveedor = $_POST['supplierId'] ?? null;
            $fecha = $_POST['date'] ?? null;
            $hora = $_POST['time'] ?? null;
            $tipo = $_POST['type'] ?? null;
            $descripcion = $_POST['description'] ?? ''; // Descripción puede ser opcional
            $estado = $_POST['status'] ?? 'programada';

            if (empty($id_proveedor) || empty($fecha) || empty($hora) || empty($tipo)) {
                throw new Exception('Faltan datos obligatorios (proveedor, fecha, hora, tipo).');
            }

            $sql = "INSERT INTO citas (id_proveedor, fecha, hora, tipo, descripcion, estado) VALUES (?, ?, ?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("isssss", $id_proveedor, $fecha, $hora, $tipo, $descripcion, $estado);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'id' => $conexion->insert_id, 'mensaje' => 'Cita guardada.'];
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