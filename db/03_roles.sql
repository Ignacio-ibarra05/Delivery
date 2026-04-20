-- worker (REPARTIDORES)
CREATE TABLE auth.worker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id UUID NOT NULL,
  available BOOLEAN DEFAULT TRUE,
  state BOOLEAN DEFAULT TRUE,
  contract_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_worker_people
    FOREIGN KEY (people_id)
    REFERENCES auth.people(id)
    ON DELETE CASCADE
);

-- ADMINISTRADORES
CREATE TABLE auth.admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id UUID NOT NULL,
  state BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_admin_people
    FOREIGN KEY (people_id)
    REFERENCES auth.people(id)
    ON DELETE CASCADE
);
