<?php
include(__DIR__ . '/conexion.php');

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida o error inesperado.'];

try {
    switch ($accion) {
        case 'obtener':
            $sql = "SELECT * FROM proveedores ORDER BY nombre";
            $resultado = $conexion->query($sql);

            if ($resultado === false) {
                throw new Exception('Error en la consulta SQL: ' . $conexion->error);
            }
            
            $proveedores = [];
            while ($fila = $resultado->fetch_assoc()) {
                $proveedores[] = $fila;
            }
            
            $respuesta = ['status' => 'exito', 'data' => $proveedores];
            break;

        case 'guardar':
            $nombre = $_POST['name'] ?? null;
            $contacto = $_POST['contact'] ?? null;
            $telefono = $_POST['phone'] ?? null;
            $email = $_POST['email'] ?? null;
            $especialidad = $_POST['specialty'] ?? null;

            if (empty($nombre) || empty($especialidad)) {
                throw new Exception('El nombre y la especialidad son obligatorios.');
            }

            $sql = "INSERT INTO proveedores (nombre, contacto, telefono, email, especialidad) VALUES (?, ?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("sssss", $nombre, $contacto, $telefono, $email, $especialidad);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'id' => $conexion->insert_id, 'mensaje' => 'Proveedor guardado.'];
            } else {
                throw new Exception('Error al guardar: ' . $stmt->error);
            }
            $stmt->close();
            break;

        case 'eliminar':
            $id = $_POST['id'] ?? null;
            if (empty($id)) {
                throw new Exception('No se proporcionó ID para eliminar.');
            }
            
            $sql = "DELETE FROM proveedores WHERE id = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'mensaje' => 'Proveedor eliminado.'];
            } else {
                throw new Exception('Error al eliminar: ' . $stmt->error);
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