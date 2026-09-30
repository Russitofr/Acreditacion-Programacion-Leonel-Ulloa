CREATE DATABASE IF NOT EXISTS ulan_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ulan_db;

CREATE TABLE IF NOT EXISTS administradores (
    id INT NOT NULL AUTO_INCREMENT,
    usuario VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_administradores_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS servicios (
    id INT NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    precio VARCHAR(50) DEFAULT 'Consultar',
    icono VARCHAR(100) DEFAULT NULL,
    contador INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultas (
    id INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(30) DEFAULT NULL,
    asunto VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('no leida', 'leida') NOT NULL DEFAULT 'no leida',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_accesos (
    id INT NOT NULL AUTO_INCREMENT,
    admin_id INT DEFAULT NULL,
    usuario_intentado VARCHAR(100) DEFAULT NULL,
    ip VARCHAR(45) DEFAULT NULL,
    exitoso TINYINT(1) NOT NULL DEFAULT 0,
    fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_historial_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajusta tablas ya existentes.
ALTER TABLE servicios
    ADD COLUMN IF NOT EXISTS icono VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS contador INT NOT NULL DEFAULT 0;

ALTER TABLE consultas
    MODIFY email VARCHAR(255) NOT NULL;

ALTER TABLE historial_accesos
    MODIFY admin_id INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS usuario_intentado VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ip VARCHAR(45) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS exitoso TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fecha_ingreso DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Renombra el servicio antiguo si todavía no existe el nombre nuevo.
UPDATE servicios
SET titulo = 'Capacitación y Tutorías Asistidas'
WHERE titulo = 'Tutorías Avanzadas'
  AND NOT EXISTS (
      SELECT 1
      FROM (
          SELECT titulo FROM servicios
      ) AS existentes
      WHERE existentes.titulo = 'Capacitación y Tutorías Asistidas'
  );

-- Agrega la FK únicamente si no existe una relación equivalente.
SET @fk_existe = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'historial_accesos'
      AND COLUMN_NAME = 'admin_id'
      AND REFERENCED_TABLE_NAME = 'administradores'
      AND REFERENCED_COLUMN_NAME = 'id'
);

SET @sql_fk = IF(
    @fk_existe = 0,
    'ALTER TABLE historial_accesos
     ADD CONSTRAINT fk_historial_admin
     FOREIGN KEY (admin_id) REFERENCES administradores(id)
     ON UPDATE CASCADE ON DELETE SET NULL',
    'SELECT 1'
);

PREPARE crear_fk FROM @sql_fk;
EXECUTE crear_fk;
DEALLOCATE PREPARE crear_fk;

-- Administrador inicial de prueba: admin / 123.
INSERT INTO administradores (usuario, password)
VALUES ('admin', '123')
ON DUPLICATE KEY UPDATE usuario = VALUES(usuario);

-- Completa los íconos de los servicios existentes.
UPDATE servicios
SET icono = CASE
    WHEN titulo = 'Hardware' THEN 'fa-solid fa-computer'
    WHEN titulo = 'Redes' THEN 'fa-solid fa-network-wired'
    WHEN titulo = 'Software' THEN 'fa-solid fa-code'
    WHEN titulo = 'Capacitación y Tutorías Asistidas'
        THEN 'fa-solid fa-graduation-cap'
    ELSE icono
END
WHERE icono IS NULL OR icono = '';

-- Inserta los servicios que todavía no existen.
INSERT INTO servicios (titulo, descripcion, precio, icono)
SELECT datos.titulo, datos.descripcion, 'Consultar', datos.icono
FROM (
    SELECT
        'Hardware' AS titulo,
        'Diagnóstico avanzado, mantenimiento y soporte técnico físico de equipos.' AS descripcion,
        'fa-solid fa-computer' AS icono
    UNION ALL
    SELECT
        'Redes',
        'Configuración, infraestructura y mantenimiento de conectividad.',
        'fa-solid fa-network-wired'
    UNION ALL
    SELECT
        'Software',
        'Instalación, configuración y resolución de problemas de software.',
        'fa-solid fa-code'
    UNION ALL
    SELECT
        'Capacitación y Tutorías Asistidas',
        'Acompañamiento personalizado y formación técnica orientada al usuario.',
        'fa-solid fa-graduation-cap'
) AS datos
WHERE NOT EXISTS (
    SELECT 1 FROM servicios WHERE servicios.titulo = datos.titulo
);