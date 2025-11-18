-- ============================================
-- USUARIOS, ROLES Y SEGURIDAD
-- ============================================

CREATE TABLE Usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contraseña VARCHAR(255) NOT NULL,
    tipo_usuario VARCHAR(50) NOT NULL, -- cliente, proveedor, funeraria, cementerio, admin
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Rol (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL
);

CREATE TABLE Usuario_Rol (
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    PRIMARY KEY (id_usuario, id_rol),
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_rol) REFERENCES Rol(id_rol) ON DELETE CASCADE
);

CREATE TABLE Permiso (
    id_permiso SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL
);

CREATE TABLE Rol_Permiso (
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol) REFERENCES Rol(id_rol) ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES Permiso(id_permiso) ON DELETE CASCADE
);

CREATE TABLE Log_Sesiones (
    id_log SERIAL PRIMARY KEY,
    id_usuario INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(50),
    exito BOOLEAN,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE MFA_Token (
    id_mfa SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    codigo VARCHAR(10),
    expiracion TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

-- ============================================
-- ENTIDADES PRINCIPALES: CEMENTERIOS Y FUNERARIAS
-- ============================================

CREATE TABLE Cementerio (
    id_cementerio SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    email_contacto VARCHAR(100)
);

CREATE TABLE Funeraria (
    id_funeraria SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(50),
    email_contacto VARCHAR(100),
    id_usuario INT, -- administrador de la funeraria
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE SET NULL
);

-- ============================================
-- ESTRUCTURA DEL CEMENTERIO
-- ============================================

CREATE TABLE Parque (
    id_parque SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_cementerio INT NOT NULL,
    FOREIGN KEY (id_cementerio) REFERENCES Cementerio(id_cementerio) ON DELETE CASCADE
);

CREATE TABLE Sector (
    id_sector SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_parque INT NOT NULL,
    FOREIGN KEY (id_parque) REFERENCES Parque(id_parque) ON DELETE CASCADE
);

CREATE TABLE Subsector (
    id_subsector SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_sector INT NOT NULL,
    FOREIGN KEY (id_sector) REFERENCES Sector(id_sector) ON DELETE CASCADE
);

CREATE TABLE Sepultura (
    id_sepultura SERIAL PRIMARY KEY,
    tipo VARCHAR(50), -- lápida, nicho, mausoleo, crematorio
    disponibilidad BOOLEAN DEFAULT TRUE,
    id_subsector INT NOT NULL,
    FOREIGN KEY (id_subsector) REFERENCES Subsector(id_subsector) ON DELETE CASCADE
);

-- ============================================
-- MEMORIALES DIGITALES
-- ============================================

CREATE TABLE Memorial (
    id_memorial SERIAL PRIMARY KEY,
    id_sepultura INT NOT NULL,
    id_usuario INT NOT NULL,
    nombre_difunto VARCHAR(100) NOT NULL,
    fecha_fallecimiento DATE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    qr_code_url VARCHAR(255),
    FOREIGN KEY (id_sepultura) REFERENCES Sepultura(id_sepultura) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE Media (
    id_media SERIAL PRIMARY KEY,
    id_memorial INT NOT NULL,
    tipo_media VARCHAR(50), -- foto o video
    url_media VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_memorial) REFERENCES Memorial(id_memorial) ON DELETE CASCADE
);

CREATE TABLE Testimonio (
    id_testimonio SERIAL PRIMARY KEY,
    id_memorial INT NOT NULL,
    id_usuario INT NOT NULL,
    contenido TEXT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_memorial) REFERENCES Memorial(id_memorial) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE Obituario (
    id_obituario SERIAL PRIMARY KEY,
    id_memorial INT NOT NULL,
    fecha_servicio DATE NOT NULL,
    horario TIME,
    sector VARCHAR(100),
    subsector VARCHAR(100),
    FOREIGN KEY (id_memorial) REFERENCES Memorial(id_memorial) ON DELETE CASCADE
);

-- ============================================
-- FUNCIONALIDADES DEL SISTEMA
-- ============================================

CREATE TABLE Mantenimiento (
    id_mantenimiento SERIAL PRIMARY KEY,
    id_sepultura INT NOT NULL,
    id_usuario INT NOT NULL,
    descripcion TEXT,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_sepultura) REFERENCES Sepultura(id_sepultura) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE Recordatorio (
    id_recordatorio SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_memorial INT,
    fecha_evento DATE NOT NULL,
    mensaje TEXT,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_memorial) REFERENCES Memorial(id_memorial) ON DELETE SET NULL
);

CREATE TABLE Visita (
    id_visita SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_sepultura INT NOT NULL,
    fecha_visita TIMESTAMP NOT NULL,
    estado VARCHAR(50) DEFAULT 'Reservada',
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_sepultura) REFERENCES Sepultura(id_sepultura) ON DELETE CASCADE
);

CREATE TABLE Invitacion (
    id_invitacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_memorial INT NOT NULL,
    destinatario_email VARCHAR(100),
    mensaje TEXT,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_memorial) REFERENCES Memorial(id_memorial) ON DELETE CASCADE
);

CREATE TABLE Mensaje_Contacto (
    id_mensaje SERIAL PRIMARY KEY,
    id_usuario INT,
    asunto VARCHAR(150),
    mensaje TEXT,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE SET NULL
);

-- ============================================
-- MARKETPLACE Y PAGOS
-- ============================================

CREATE TABLE Proveedor (
    id_proveedor SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre_negocio VARCHAR(150),
    categoria VARCHAR(50), -- florista, urnas, etc.
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE Producto (
    id_producto SERIAL PRIMARY KEY,
    id_proveedor INT NOT NULL,
    nombre VARCHAR(150),
    descripcion TEXT,
    precio DECIMAL(12,2),
    stock INT,
    url_imagen VARCHAR(255),
    FOREIGN KEY (id_proveedor) REFERENCES Proveedor(id_proveedor) ON DELETE CASCADE
);

CREATE TABLE Pedido (
    id_pedido SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_proveedor INT NOT NULL,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    total DECIMAL(12,2),
    FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario),
    FOREIGN KEY (id_proveedor) REFERENCES Proveedor(id_proveedor)
);

CREATE TABLE Detalle_Pedido (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT DEFAULT 1,
    subtotal DECIMAL(12,2),
    FOREIGN KEY (id_pedido) REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES Producto(id_producto) ON DELETE CASCADE
);

CREATE TABLE Pago (
    id_pago SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    metodo_pago VARCHAR(50),
    monto DECIMAL(12,2) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'Pagado',
    FOREIGN KEY (id_pedido) REFERENCES Pedido(id_pedido) ON DELETE CASCADE
);
