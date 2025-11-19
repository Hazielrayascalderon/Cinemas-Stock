<?php
header('Content-Type: application/json');

$usuarios_file = 'usuarios.json';

function get_users() {
    global $usuarios_file;
    if (!file_exists($usuarios_file)) {
        $default_users = [
            'admin' => ['pass' => 'admin123', 'role' => 'admin', 'name' => 'Administrador'],
            'gerente' => ['pass' => 'gerente123', 'role' => 'manager', 'name' => 'Gerente General'],
            'jorge' => ['pass' => 'jorge123', 'role' => 'warehouse', 'name' => 'Jorge Alfonso']
        ];
        file_put_contents($usuarios_file, json_encode($default_users, JSON_PRETTY_PRINT));
        return $default_users;
    }
    
    $data = file_get_contents($usuarios_file);
    if ($data === false) {
        throw new Exception("No se pudo leer el archivo de usuarios. Verifica los permisos.");
    }
    return json_decode($data, true);
}

function save_users($users) {
    global $usuarios_file;
    if (file_put_contents($usuarios_file, json_encode($users, JSON_PRETTY_PRINT)) === false) {
         throw new Exception("No se pudo escribir en el archivo de usuarios. Verifica los permisos.");
    }
}

$accion = $_POST['accion'] ?? $_GET['accion'] ?? '';
$respuesta = ['status' => 'error', 'mensaje' => 'Acción no válida'];

try {
    if ($accion === 'obtener') {
        // Esta es la acción que app.js necesita para cargar los usuarios
        $users = get_users();
        $respuesta = ['status' => 'exito', 'data' => $users];

    } elseif ($accion === 'cambiar_pass' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        
        $username = $_POST['username'] ?? '';
        $new_password = $_POST['new_password'] ?? '';

        if (empty($username) || empty($new_password)) {
            $respuesta['mensaje'] = 'Faltan datos (usuario o contraseña).';
        } else {
            $users = get_users();
            if (isset($users[$username])) {
                $users[$username]['pass'] = $new_password;
                save_users($users);
                $respuesta['status'] = 'exito';
                $respuesta['mensaje'] = 'Contraseña actualizada correctamente para ' . $username;
            } else {
                $respuesta['mensaje'] = 'Usuario no encontrado.';
            }
        }
    }
    // Si la acción no es 'obtener' ni 'cambiar_pass', se usará la $respuesta por defecto.

} catch (Exception $e) {
    // Captura cualquier error de lectura/escritura de archivos
    $respuesta = ['status' => 'error', 'mensaje' => $e->getMessage()];
}

echo json_encode($respuesta);
?>