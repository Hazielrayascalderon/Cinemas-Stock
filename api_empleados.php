<?php
include(__DIR__ . '/conexion.php');

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida o error inesperado.'];

try {
    switch ($accion) {
        case 'obtener':
            $sql = "SELECT * FROM empleados ORDER BY nombre";
            $resultado = $conexion->query($sql);

            if ($resultado === false) {
                throw new Exception('Error en la consulta SQL: ' . $conexion->error);
            }
            
            $empleados = [];
            while ($fila = $resultado->fetch_assoc()) {
                $fila['horas'] = (int)$fila['horas'];
                $empleados[] = $fila;
            }
            
            $respuesta = ['status' => 'exito', 'data' => $empleados];
            break;

        case 'guardar':
            $nombre = $_POST['nombre'] ?? null;
            $puesto = $_POST['puesto'] ?? null;
            $horas = $_POST['horas'] ?? 0;

            if (empty($nombre) || empty($puesto)) {
                throw new Exception('El nombre y el puesto son obligatorios.');
            }

            $sql = "INSERT INTO empleados (nombre, puesto, horas) VALUES (?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssi", $nombre, $puesto, $horas);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'id' => $conexion->insert_id, 'mensaje' => 'Empleado guardado exitosamente.'];
            } else {
                throw new Exception('Error al guardar: ' . $stmt->error);
            }
            $stmt->close();
            break;

        case 'actualizar':
            $id = $_POST['id'] ?? null;
            $nombre = $_POST['nombre'] ?? null;
            $puesto = $_POST['puesto'] ?? null;
            $horas = $_POST['horas'] ?? 0;

            if (empty($id) || empty($nombre) || empty($puesto)) {
                throw new Exception('El ID, nombre y puesto son obligatorios para actualizar.');
            }

            $sql = "UPDATE empleados SET nombre = ?, puesto = ?, horas = ? WHERE id = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssii", $nombre, $puesto, $horas, $id);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'mensaje' => 'Empleado actualizado exitosamente.'];
            } else {
                throw new Exception('Error al actualizar: ' . $stmt->error);
            }
            $stmt->close();
            break;

        case 'eliminar':
            $id = $_POST['id'] ?? null;
            if (empty($id)) {
                throw new Exception('No se proporcionó ID para eliminar.');
            }
            
            $sql = "DELETE FROM empleados WHERE id = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'mensaje' => 'Empleado eliminado exitosamente.'];
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