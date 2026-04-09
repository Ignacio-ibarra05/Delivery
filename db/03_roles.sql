-- TRABAJADORES (REPARTIDORES)
CREATE TABLE auth.trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL,
  disponible BOOLEAN DEFAULT TRUE,
  estado BOOLEAN DEFAULT TRUE,
  fecha_contratacion DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_trabajador_persona
    FOREIGN KEY (persona_id)
    REFERENCES auth.personas(id)
    ON DELETE CASCADE
);

-- ADMINISTRADORES
CREATE TABLE auth.administradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL,
  estado BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_admin_persona
    FOREIGN KEY (persona_id)
    REFERENCES auth.personas(id)
    ON DELETE CASCADE
);
