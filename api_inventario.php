<?php
include(__DIR__ . '/conexion.php');

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida o error inesperado.'];

try {
    switch ($accion) {
        case 'obtener':
            $sql = "SELECT * FROM inventario ORDER BY area, nombre";
            $resultado = $conexion->query($sql);

            if ($resultado === false) {
                throw new Exception('Error en la consulta SQL: ' . $conexion->error);
            }
            
            $inventario = [];
            while ($fila = $resultado->fetch_assoc()) {
                $fila['stock_actual'] = (int)$fila['stock_actual'];
                $fila['stock_minimo'] = (int)$fila['stock_minimo'];
                $inventario[] = $fila;
            }
            
            $respuesta = ['status' => 'exito', 'data' => $inventario];
            break;

        case 'guardar':
            $area = $_POST['area'] ?? null;
            $nombre = $_POST['nombre'] ?? null;
            $categoria = $_POST['categoria'] ?? null;
            $stock_actual = $_POST['stock_actual'] ?? 0;
            $stock_minimo = $_POST['stock_minimo'] ?? 0;
            $unidad = $_POST['unidad'] ?? null;

            if (empty($area) || empty($nombre) || empty($categoria)) {
                 throw new Exception('Faltan datos obligatorios (área, nombre, categoría).');
            }

            $sql = "INSERT INTO inventario (area, nombre, categoria, stock_actual, stock_minimo, unidad) VALUES (?, ?, ?, ?, ?, ?)";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("sssiis", $area, $nombre, $categoria, $stock_actual, $stock_minimo, $unidad);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'id' => $conexion->insert_id, 'mensaje' => 'Producto guardado exitosamente.'];
            } else {
                throw new Exception('Error al guardar: ' . $stmt->error);
            }
            $stmt->close();
            break;

        case 'actualizar':
            $id = $_POST['id'] ?? null;
            $nombre = $_POST['nombre'] ?? null;
            $categoria = $_POST['categoria'] ?? null;
            $stock_actual = $_POST['stock_actual'] ?? 0;
            $stock_minimo = $_POST['stock_minimo'] ?? 0;
            $unidad = $_POST['unidad'] ?? null;

            if (empty($id) || empty($nombre) || empty($categoria)) {
                throw new Exception('Faltan datos obligatorios (ID, nombre, categoría).');
            }

            $sql = "UPDATE inventario SET nombre = ?, categoria = ?, stock_actual = ?, stock_minimo = ?, unidad = ? WHERE id = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("ssiisi", $nombre, $categoria, $stock_actual, $stock_minimo, $unidad, $id);

            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'mensaje' => 'Producto actualizado exitosamente.'];
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
            
            $sql = "DELETE FROM inventario WHERE id = ?";
            $stmt = $conexion->prepare($sql);
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                $respuesta = ['status' => 'exito', 'mensaje' => 'Producto eliminado exitosamente.'];
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