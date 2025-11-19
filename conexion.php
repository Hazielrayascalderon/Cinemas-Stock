<?php
$servidor = "localhost";
$usuario = "root";
$password = "";
$base_de_datos = "cinemas_wtc";

$conexion = new mysqli($servidor, $usuario, $password, $base_de_datos);

if ($conexion->connect_error) {
    die("Conexión fallida: " . $conexion->connect_error);
}

$conexion->set_charset("utf8mb4");

function enviarRespuestaJSON($datos) {
    header('Content-Type: application/json');
    echo json_encode($datos);
    exit;
}
?>