-- PERSONAS
CREATE TABLE auth.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut VARCHAR(12) UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  fecha_nacimiento DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USUARIOS (CLIENTES)
CREATE TABLE auth.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL,
  password TEXT NOT NULL,
  estado BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usuario_persona
    FOREIGN KEY (persona_id)
    REFERENCES auth.personas(id)
    ON DELETE CASCADE
);